package com.gymcore.backend.modules.content.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.annotation.PostConstruct;

@Service
public class GeminiChatService {

    private final RestTemplate restTemplate;
    private final JdbcTemplate jdbcTemplate;
    private static final Logger log = LoggerFactory.getLogger(GeminiChatService.class);
    private static final Pattern RETRY_DELAY_SECONDS_PATTERN = Pattern.compile("\"retryDelay\"\\s*:\\s*\"(\\d+)s\"");
    private static final Pattern RETRY_HINT_SECONDS_PATTERN = Pattern.compile("Please\\s+retry\\s+in\\s+([0-9]+(?:\\.[0-9]+)?)s", Pattern.CASE_INSENSITIVE);

    @Value("${app.ai.gemini.api-key:}")
    private String apiKey;

    @Value("${app.ai.gemini.model:gemini-2.5-flash}")
    private String model;

    public GeminiChatService(RestTemplate restTemplate, JdbcTemplate jdbcTemplate) {
        this.restTemplate = restTemplate;
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    void initializeConfig() {
        apiKey = resolveConfigValue(apiKey, "APP_AI_GEMINI_API_KEY", null);
        model = resolveConfigValue(model, "APP_AI_GEMINI_MODEL", "gemini-2.5-flash");
        log.info("Gemini config initialized: apiKeyPresent={}, model='{}'",
                StringUtils.hasText(apiKey), model);
    }

    public String chat(List<Map<String, Object>> messages, Map<String, Object> context) {
        if (!StringUtils.hasText(apiKey)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI chat is not configured on the server.");
        }

        String preferredModel = StringUtils.hasText(model) ? model.trim() : "gemini-2.5-flash";
        // Helpful debug: show effective model and whether env overrides exist (do NOT log apiKey).
        log.info("Gemini effective model='{}' (APP_AI_GEMINI_MODEL='{}')",
                preferredModel, String.valueOf(System.getenv("APP_AI_GEMINI_MODEL")));
        Map<String, Object> body = buildRequestBody(messages, context);

        try {
            return callGenerateContent(preferredModel, body);
        } catch (HttpClientErrorException.BadRequest badRequest) {
            // Some models (e.g. "deep-research-*") do not support generateContent.
            // If configured model is incompatible, fall back to a supported model.
            String errorBody = badRequest.getResponseBodyAsString();
            if (StringUtils.hasText(errorBody) && errorBody.toLowerCase().contains("interactions api")) {
                Optional<String> fallback = discoverFallbackModel();
                if (fallback.isPresent() && !fallback.get().equalsIgnoreCase(preferredModel)) {
                    return callGenerateContent(fallback.get(), body);
                }
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Configured AI model is incompatible with generateContent. Update APP_AI_GEMINI_MODEL to a supported model (e.g. gemini-2.5-flash).");
            }
            throw badRequest;
        } catch (HttpClientErrorException.NotFound notFound) {
            Optional<String> fallback = discoverFallbackModel();
            if (fallback.isPresent() && !fallback.get().equalsIgnoreCase(preferredModel)) {
                return callGenerateContent(fallback.get(), body);
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "AI model is unavailable. Update APP_AI_GEMINI_MODEL to a supported model.");
        } catch (HttpClientErrorException.TooManyRequests rateLimited) {
            int retrySeconds = parseRetryAfterSeconds(rateLimited.getResponseBodyAsString());
            String message = retrySeconds > 0
                    ? "AI quota exceeded. Please retry in %ds.".formatted(retrySeconds)
                    : "AI quota exceeded. Please retry shortly.";
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, message);
        } catch (HttpClientErrorException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "AI provider request failed.");
        }
    }

    private String resolveConfigValue(String propertyValue, String envKey, String fallback) {
        if (StringUtils.hasText(propertyValue)) {
            return propertyValue.trim();
        }
        String envValue = System.getenv(envKey);
        if (StringUtils.hasText(envValue)) {
            return envValue.trim();
        }
        String dotEnvValue = loadFromDotEnv(envKey);
        if (StringUtils.hasText(dotEnvValue)) {
            return dotEnvValue.trim();
        }
        return fallback;
    }

    private String loadFromDotEnv(String key) {
        for (Path candidate : getDotEnvCandidates()) {
            if (!Files.isRegularFile(candidate)) {
                continue;
            }
            try {
                for (String rawLine : Files.readAllLines(candidate)) {
                    String line = rawLine == null ? "" : rawLine.trim();
                    if (line.isEmpty() || line.startsWith("#")) {
                        continue;
                    }
                    String prefix = key + "=";
                    if (!line.startsWith(prefix)) {
                        continue;
                    }
                    return stripOptionalQuotes(line.substring(prefix.length()).trim());
                }
            } catch (IOException exception) {
                log.debug("Skipping unreadable env file '{}': {}", candidate, exception.getMessage());
            }
        }
        return null;
    }

    private List<Path> getDotEnvCandidates() {
        Path cwd = Path.of("").toAbsolutePath().normalize();
        return List.of(
                cwd.resolve(".env"),
                cwd.resolve(".env.local"),
                cwd.resolve("backend").resolve(".env"),
                cwd.resolve("backend").resolve(".env.local"));
    }

    private String stripOptionalQuotes(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private int parseRetryAfterSeconds(String body) {
        if (!StringUtils.hasText(body)) return 0;
        Matcher retryDelay = RETRY_DELAY_SECONDS_PATTERN.matcher(body);
        if (retryDelay.find()) {
            try {
                return Integer.parseInt(retryDelay.group(1));
            } catch (NumberFormatException ignored) {
                return 0;
            }
        }
        Matcher hint = RETRY_HINT_SECONDS_PATTERN.matcher(body);
        if (hint.find()) {
            try {
                double seconds = Double.parseDouble(hint.group(1));
                int rounded = (int) Math.ceil(seconds);
                return Math.max(1, rounded);
            } catch (NumberFormatException ignored) {
                return 0;
            }
        }
        return 0;
    }

    private Map<String, Object> buildRequestBody(List<Map<String, Object>> messages, Map<String, Object> context) {
        Map<String, Object> body = new LinkedHashMap<>();
        String foodCatalog = buildFoodCatalogContext();
        body.put("systemInstruction", Map.of(
                "parts", List.of(Map.of("text",
                        buildSystemInstruction(context, foodCatalog)))));
        body.put("contents", mapMessages(messages));
        body.put("generationConfig", Map.of(
                "temperature", 0.6,
                "maxOutputTokens", 512));
        return body;
    }

    @SuppressWarnings("rawtypes")
    private String callGenerateContent(String resolvedModel, Map<String, Object> body) {
        log.info("Calling Gemini generateContent with model='{}'", resolvedModel);
        String url = UriComponentsBuilder
                .fromUriString("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent")
                .queryParam("key", apiKey.trim())
                .buildAndExpand(resolvedModel)
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, request, Map.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider request failed.");
        }
        return extractTextResponse(response.getBody());
    }

    @SuppressWarnings("rawtypes")
    private Optional<String> discoverFallbackModel() {
        try {
            String listUrl = UriComponentsBuilder
                    .fromUriString("https://generativelanguage.googleapis.com/v1/models")
                    .queryParam("key", apiKey.trim())
                    .toUriString();
    
            ResponseEntity<Map> response = restTemplate.exchange(
                    listUrl,
                    HttpMethod.GET,
                    new HttpEntity<>(new HttpHeaders()),
                    Map.class
            );
    
            Map body = response.getBody();
            if (body == null) return Optional.empty();
    
            Object modelsObj = body.get("models");
            if (!(modelsObj instanceof List<?> models) || models.isEmpty()) {
                return Optional.empty();
            }
    
            List<String> candidates = new ArrayList<>();
    
            for (Object modelObj : models) {
                if (!(modelObj instanceof Map<?, ?> modelMap)) continue;
    
                Object nameObj = modelMap.get("name");
                if (nameObj == null) continue;
    
                String name = String.valueOf(nameObj).trim();
                if (!name.startsWith("models/")) continue;
    
                String id = name.substring("models/".length());
                String lower = id.toLowerCase();
    
                // ---- HARD FILTER ----
                if (!lower.startsWith("gemini-")) continue;
                if (lower.contains("image")) continue;
                if (lower.contains("vision")) continue;
                if (lower.contains("preview")) continue;
                if (lower.contains("research")) continue;
                if (lower.contains("embedding")) continue;
    
                // ---- CHECK API SUPPORT ----
                Object methodsObj = modelMap.get("supportedGenerationMethods");
                boolean supportsGenerate =
                        methodsObj instanceof List<?> list &&
                        list.stream().anyMatch(v ->
                                "generateContent".equalsIgnoreCase(String.valueOf(v)));
    
                if (!supportsGenerate) continue;
    
                candidates.add(id);
            }
    
            if (candidates.isEmpty()) {
                return Optional.empty();
            }
    
            // ---- PRIORITY ORDER ----
            List<String> priority = List.of(
                    "gemini-2.5-flash",
                    "gemini-2.0-flash",
                    "gemini-1.5-pro",
                    "gemini-1.5-flash"
            );
    
            for (String preferred : priority) {
                for (String candidateModel : candidates) {
                    if (candidateModel.equalsIgnoreCase(preferred)) {
                        log.info("Gemini fallback model selected='{}'", candidateModel);
                        return Optional.of(candidateModel);
                    }
                }
            }
    
            // If none matched priority, use first safe candidate
            String fallback = candidates.get(0);
            log.info("Gemini fallback model selected='{}'", fallback);
            return Optional.of(fallback);
    
        } catch (RuntimeException ex) {
            log.warn("Failed to discover Gemini fallback model: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private String buildSystemInstruction(Map<String, Object> context, String foodCatalog) {
        String mode = context == null ? "" : String.valueOf(context.getOrDefault("mode", "")).trim();
        String consultativeContext = buildConsultativeContext(context);
        String allowedActions = buildAllowedActionContext(context);
        String selectedContext = buildSelectedItemContext(context);
        String responseLanguage = determineResponseLanguage(context);
        return """
                You are GymCore AI assistant.

                Reply in %s.
                Match the user's language consistently from the start. If the latest user message is Vietnamese, stay in Vietnamese. If it is English, stay in English.
                Use plain text only. Do not use Markdown formatting, bold markers, heading markers, or code fences.
                Be concise, practical, and consultative.
                Scope: workouts, foods, weekly guidance, and routing users into real GymCore flows.
                Never claim an action was completed inside chat. You can only explain or route the user to supported GymCore screens.
                If user asks for medical advice, respond with general guidance and advise consulting a professional.
                When recommending next steps, only use the allowed GymCore actions below. Do not invent unsupported routes, bookings, workouts, foods, or product capabilities.
                PT booking must remain a receiving flow. Do not act like chat itself can replace coach programming or complete booking.

                IMPORTANT FOOD CONSTRAINT:
                - When suggesting foods, you MUST ONLY recommend food names from the allowed catalog below.
                - Do NOT invent new food names.
                - If no suitable item exists in the catalog, clearly say no suitable database food was found.
                - Prefer answers in bullet points with exact food names.

                Current screen: %s
                Consultative customer context:
                %s

                Current page selections:
                %s

                Allowed GymCore actions:
                %s

                Allowed food catalog from database:
                %s
                """.formatted(responseLanguage, mode, consultativeContext, selectedContext, allowedActions, foodCatalog);
    }

    private String determineResponseLanguage(Map<String, Object> context) {
        String latestMessageLanguage = detectLatestUserMessageLanguage(context);
        if (StringUtils.hasText(latestMessageLanguage)) {
            return latestMessageLanguage;
        }
        String preferredLanguage = normalizeText(context == null ? null : context.get("preferredLanguage"));
        if ("vi".equalsIgnoreCase(preferredLanguage) || "vietnamese".equalsIgnoreCase(preferredLanguage)) {
            return "Vietnamese";
        }
        return "English";
    }

    private String detectLatestUserMessageLanguage(Map<String, Object> context) {
        Object rawMessages = context == null ? null : context.get("conversationMessages");
        if (!(rawMessages instanceof Collection<?> collection)) {
            return null;
        }
        List<?> items = new ArrayList<>(collection);
        for (int index = items.size() - 1; index >= 0; index--) {
            Map<String, Object> message = asMap(items.get(index));
            String role = normalizeText(message.get("role"));
            if (!"user".equalsIgnoreCase(role)) {
                continue;
            }
            String content = normalizeText(message.get("content"));
            if (!StringUtils.hasText(content)) {
                continue;
            }
            return inferLanguageFromText(content);
        }
        return null;
    }

    private String inferLanguageFromText(String text) {
        if (!StringUtils.hasText(text)) {
            return null;
        }
        String sample = text.trim().toLowerCase();
        if (sample.matches(".*[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ].*")) {
            return "Vietnamese";
        }
        List<String> vietnameseKeywords = List.of(
                "toi", "ban", "giam can", "tang can", "bua an", "tap", "bai tap", "huan luyen", "dinh duong", "thuc don");
        for (String keyword : vietnameseKeywords) {
            if (sample.contains(keyword)) {
                return "Vietnamese";
            }
        }
        if (sample.matches(".*[a-z].*")) {
            return "English";
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private String buildConsultativeContext(Map<String, Object> context) {
        if (context == null || context.isEmpty()) {
            return "- No resolved customer context provided.";
        }

        List<String> lines = new ArrayList<>();
        Map<String, Object> contextMeta = asMap(context.get("contextMeta"));
        Map<String, Object> aiContext = asMap(context.get("aiContext"));
        Map<String, Object> goals = asMap(aiContext.get("goals"));
        Map<String, Object> health = asMap(aiContext.get("health"));
        Map<String, Object> progress = asMap(aiContext.get("progress"));
        Map<String, Object> latestProgressSignal = asMap(progress.get("latestProgressSignal"));
        Map<String, Object> latestNoteSignal = asMap(progress.get("latestNoteSignal"));
        Map<String, Object> currentSnapshot = asMap(health.get("currentSnapshot"));

        List<String> usedSignals = toStringList(contextMeta.get("usedSignals"));
        if (!usedSignals.isEmpty()) {
            lines.add("- Active customer signals: " + String.join(", ", usedSignals) + ".");
        }

        List<String> goalCodes = toStringList(goals.get("effectiveGoalCodes"));
        if (!goalCodes.isEmpty()) {
            lines.add("- Effective goals: " + String.join(", ", goalCodes) + ".");
        }

        String goalSource = normalizeText(goals.get("source"));
        if (goalSource != null) {
            lines.add("- Goal source: " + goalSource + ".");
        }

        String healthSummary = buildHealthSummary(currentSnapshot);
        if (StringUtils.hasText(healthSummary)) {
            lines.add("- Health snapshot: " + healthSummary + ".");
        }

        String progressSummary = normalizeText(latestProgressSignal.get("summary"));
        if (StringUtils.hasText(progressSummary) && !progressSummary.startsWith("No ")) {
            lines.add("- Latest progress signal: " + progressSummary + ".");
        }

        String noteSummary = normalizeText(latestNoteSignal.get("summary"));
        if (StringUtils.hasText(noteSummary) && !noteSummary.startsWith("No ")) {
            lines.add("- Latest coach note: " + noteSummary + ".");
        }

        List<String> missingSignals = toStringList(contextMeta.get("missingSignals"));
        if (!missingSignals.isEmpty()) {
            lines.add("- Missing signals: " + String.join(", ", missingSignals) + ".");
        }

        return lines.isEmpty() ? "- No resolved customer context provided." : String.join("\n", lines);
    }

    private String buildSelectedItemContext(Map<String, Object> context) {
        if (context == null || context.isEmpty()) {
            return "- No workout or food detail is currently selected.";
        }

        List<String> lines = new ArrayList<>();
        Map<String, Object> workout = asMap(context.get("selectedWorkout"));
        Map<String, Object> food = asMap(context.get("selectedFood"));

        String workoutName = normalizeText(workout.get("name"));
        if (workoutName != null) {
            lines.add("- Selected workout: " + workoutName + summarizeSelectionDetail(workout.get("description")));
        }

        String foodName = normalizeText(food.get("name"));
        if (foodName != null) {
            List<String> nutrition = new ArrayList<>();
            if (food.get("calories") != null) nutrition.add("calories " + food.get("calories"));
            if (food.get("protein") != null) nutrition.add("protein " + food.get("protein"));
            if (food.get("carbs") != null) nutrition.add("carbs " + food.get("carbs"));
            if (food.get("fat") != null) nutrition.add("fat " + food.get("fat"));
            String suffix = nutrition.isEmpty() ? summarizeSelectionDetail(food.get("description")) : " (" + String.join(", ", nutrition) + ")";
            lines.add("- Selected food: " + foodName + suffix);
        }

        return lines.isEmpty() ? "- No workout or food detail is currently selected." : String.join("\n", lines);
    }

    private String buildAllowedActionContext(Map<String, Object> context) {
        List<Map<String, Object>> actions = extractActionList(context == null ? null : context.get("availableActions"));
        if (actions.isEmpty()) {
            return """
                    - view-workout-detail -> /customer/knowledge/workouts/:id
                    - view-food-detail -> /customer/knowledge/foods/:id
                    - open-progress-hub -> /customer/progress-hub
                    - open-coach-booking -> /customer/coach-booking""";
        }

        StringBuilder builder = new StringBuilder();
        for (Map<String, Object> action : actions) {
            String actionId = normalizeText(action.get("id"));
            String label = normalizeText(action.get("label"));
            String route = normalizeText(action.get("route"));
            if (route == null) continue;
            builder.append("- ")
                    .append(actionId != null ? actionId : "route")
                    .append(" -> ")
                    .append(route);
            if (label != null) {
                builder.append(" (").append(label).append(")");
            }
            builder.append('\n');
        }
        String text = builder.toString().trim();
        return text.isEmpty() ? "- No route-ready GymCore actions are currently available." : text;
    }

    private List<Map<String, Object>> extractActionList(Object rawActions) {
        if (!(rawActions instanceof Collection<?> collection)) {
            return List.of();
        }

        List<Map<String, Object>> actions = new ArrayList<>();
        for (Object item : collection) {
            Map<String, Object> action = asMap(item);
            String route = normalizeText(action.get("route"));
            String label = normalizeText(action.get("label"));
            if (route == null || label == null) continue;
            Map<String, Object> copy = new LinkedHashMap<>();
            copy.put("id", normalizeText(action.get("id")));
            copy.put("label", label);
            copy.put("route", route);
            actions.add(copy);
        }
        return actions;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    private List<String> toStringList(Object value) {
        if (!(value instanceof Collection<?> collection)) {
            return List.of();
        }
        List<String> items = new ArrayList<>();
        for (Object item : collection) {
            String text = normalizeText(item);
            if (text != null) {
                items.add(text);
            }
        }
        return items;
    }

    private String buildHealthSummary(Map<String, Object> currentSnapshot) {
        if (currentSnapshot == null || currentSnapshot.isEmpty()) {
            return null;
        }

        List<String> parts = new ArrayList<>();
        if (currentSnapshot.get("weightKg") != null) {
            parts.add("weight " + currentSnapshot.get("weightKg") + "kg");
        }
        if (currentSnapshot.get("bmi") != null) {
            parts.add("BMI " + currentSnapshot.get("bmi"));
        }
        if (currentSnapshot.get("heightCm") != null) {
            parts.add("height " + currentSnapshot.get("heightCm") + "cm");
        }
        return parts.isEmpty() ? "current health snapshot available" : String.join(", ", parts);
    }

    private String summarizeSelectionDetail(Object rawValue) {
        String detail = normalizeText(rawValue);
        return detail == null ? "" : " (" + detail + ")";
    }

    private String normalizeText(Object rawValue) {
        if (rawValue == null) return null;
        String text = String.valueOf(rawValue).trim();
        return text.isEmpty() ? null : text;
    }

    private String buildFoodCatalogContext() {
        try {
            List<Map<String, Object>> foods = jdbcTemplate.query("""
                    SELECT TOP (80) f.FoodName,
                           f.Calories,
                           f.Protein,
                           f.Carbs,
                           f.Fat
                    FROM dbo.Foods f
                    WHERE f.IsActive = 1
                    ORDER BY f.CreatedAt DESC, f.FoodName
                    """, (rs, rowNum) -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("name", rs.getString("FoodName"));
                row.put("calories", rs.getObject("Calories"));
                row.put("protein", rs.getObject("Protein"));
                row.put("carbs", rs.getObject("Carbs"));
                row.put("fat", rs.getObject("Fat"));
                return row;
            });
            if (foods.isEmpty()) return "- No active foods in database.";

            StringBuilder builder = new StringBuilder();
            for (Map<String, Object> food : foods) {
                String name = String.valueOf(food.getOrDefault("name", "")).trim();
                if (!StringUtils.hasText(name)) continue;
                builder.append("- ").append(name)
                        .append(" | Cal: ").append(formatNumber(food.get("calories")))
                        .append(" | P: ").append(formatNumber(food.get("protein")))
                        .append(" | C: ").append(formatNumber(food.get("carbs")))
                        .append(" | F: ").append(formatNumber(food.get("fat")))
                        .append('\n');
            }
            String text = builder.toString().trim();
            return text.isEmpty() ? "- No active foods in database." : text;
        } catch (RuntimeException exception) {
            log.warn("Failed to build food catalog context: {}", exception.getMessage());
            return "- Food catalog is temporarily unavailable.";
        }
    }

    private static String formatNumber(Object value) {
        if (value == null) return "-";
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? "-" : text;
    }

    private List<Map<String, Object>> mapMessages(List<Map<String, Object>> messages) {
        if (messages == null || messages.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Messages are required.");
        }

        List<Map<String, Object>> contents = new ArrayList<>();
        for (Map<String, Object> msg : messages) {
            if (msg == null) continue;
            String role = String.valueOf(msg.getOrDefault("role", "")).trim().toLowerCase();
            String content = String.valueOf(msg.getOrDefault("content", "")).trim();
            if (content.isEmpty()) continue;

            String geminiRole = switch (role) {
                case "assistant", "model" -> "model";
                default -> "user";
            };

            contents.add(Map.of(
                    "role", geminiRole,
                    "parts", List.of(Map.of("text", content))));
        }

        if (contents.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Messages are required.");
        }
        return contents;
    }
    @PostConstruct
    public void debugGemini() {
        log.info("Gemini initialized. model='{}', apiKeyConfigured={}",
                String.valueOf(model),
                StringUtils.hasText(apiKey));
    }

    @SuppressWarnings("rawtypes")
    private String extractTextResponse(Map parsed) {
        if (parsed == null || parsed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider returned empty response.");
        }
        try {
            Object candidatesObj = parsed.get("candidates");
            if (!(candidatesObj instanceof List<?> candidates) || candidates.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider returned no candidates.");
            }
            Object firstCandidateObj = candidates.get(0);
            if (!(firstCandidateObj instanceof Map<?, ?> firstCandidate)) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider response is invalid.");
            }
            Object contentObj = firstCandidate.get("content");
            if (!(contentObj instanceof Map<?, ?> content)) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider response is invalid.");
            }
            Object partsObj = content.get("parts");
            if (!(partsObj instanceof List<?> parts) || parts.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider response is invalid.");
            }
            Object firstPartObj = parts.get(0);
            if (!(firstPartObj instanceof Map<?, ?> firstPart)) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider response is invalid.");
            }
            Object textObj = firstPart.get("text");
            String text = textObj == null ? "" : String.valueOf(textObj).trim();
            if (text.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider returned empty text.");
            }
            return text;
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider response could not be parsed.");
        }
    }
}

