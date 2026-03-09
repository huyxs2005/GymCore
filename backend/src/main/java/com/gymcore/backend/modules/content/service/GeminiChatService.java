package com.gymcore.backend.modules.content.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class GeminiChatService {

    private final RestTemplate restTemplate;
    private static final Pattern RETRY_DELAY_SECONDS_PATTERN = Pattern.compile("\"retryDelay\"\\s*:\\s*\"(\\d+)s\"");
    private static final Pattern RETRY_HINT_SECONDS_PATTERN = Pattern.compile("Please\\s+retry\\s+in\\s+([0-9]+(?:\\.[0-9]+)?)s", Pattern.CASE_INSENSITIVE);

    @Value("${app.ai.gemini.api-key:}")
    private String apiKey;

    @Value("${app.ai.gemini.model:gemini-1.5-flash}")
    private String model;

    public GeminiChatService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String chat(List<Map<String, Object>> messages, Map<String, Object> context) {
        if (!StringUtils.hasText(apiKey)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI chat is not configured on the server.");
        }

        String preferredModel = StringUtils.hasText(model) ? model.trim() : "gemini-2.0-flash";
        Map<String, Object> body = buildRequestBody(messages, context);

        try {
            return callGenerateContent(preferredModel, body);
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
        body.put("systemInstruction", Map.of(
                "parts", List.of(Map.of("text",
                        buildSystemInstruction(context)))));
        body.put("contents", mapMessages(messages));
        body.put("generationConfig", Map.of(
                "temperature", 0.6,
                "maxOutputTokens", 512));
        return body;
    }

    @SuppressWarnings("rawtypes")
    private String callGenerateContent(String resolvedModel, Map<String, Object> body) {
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
                    .fromUriString("https://generativelanguage.googleapis.com/v1beta/models")
                    .queryParam("key", apiKey.trim())
                    .toUriString();

            ResponseEntity<Map> response = restTemplate.exchange(listUrl, HttpMethod.GET, new HttpEntity<>(new HttpHeaders()), Map.class);
            Map body = response.getBody();
            if (body == null) return Optional.empty();
            Object modelsObj = body.get("models");
            if (!(modelsObj instanceof List<?> models) || models.isEmpty()) return Optional.empty();

            String best = null;
            for (Object modelObj : models) {
                if (!(modelObj instanceof Map<?, ?> modelMap)) continue;
                Object nameObj = modelMap.get("name"); // "models/gemini-2.0-flash"
                if (nameObj == null) continue;
                String name = String.valueOf(nameObj).trim();
                if (!name.startsWith("models/")) continue;
                String id = name.substring("models/".length());

                Object methodsObj = modelMap.get("supportedGenerationMethods");
                boolean supportsGenerate = methodsObj instanceof List<?> list
                        && list.stream().anyMatch(v -> "generateContent".equalsIgnoreCase(String.valueOf(v)));
                if (!supportsGenerate) continue;

                if (best == null) best = id;
                if (id.toLowerCase().contains("flash")) {
                    best = id;
                    if (id.toLowerCase().contains("2.0")) break;
                }
            }
            return Optional.ofNullable(best);
        } catch (RuntimeException ignored) {
            return Optional.empty();
        }
    }

    private String buildSystemInstruction(Map<String, Object> context) {
        String mode = context == null ? "" : String.valueOf(context.getOrDefault("mode", "")).trim();
        return """
                You are GymCore AI assistant.

                Respond in Vietnamese. Be concise and practical.
                Scope: workouts, foods, basic fitness guidance.
                If user asks for medical advice, respond with general guidance and advise consulting a professional.

                Current screen: %s
                """.formatted(mode);
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

