package com.gymcore.backend.modules.content.service;

import java.util.ArrayList;
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
        return """
                You are GymCore AI assistant.

                Respond in Vietnamese. Be concise and practical.
                Scope: workouts, foods, basic fitness guidance.
                If user asks for medical advice, respond with general guidance and advise consulting a professional.
                
                IMPORTANT FOOD CONSTRAINT:
                - When suggesting foods, you MUST ONLY recommend food names from the allowed catalog below.
                - Do NOT invent new food names.
                - If no suitable item exists in the catalog, clearly say no suitable database food was found.
                - Prefer answers in bullet points with exact food names.

                Current screen: %s
                
                Allowed food catalog from database:
                %s
                """.formatted(mode, foodCatalog);
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

