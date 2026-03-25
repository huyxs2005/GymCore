package com.gymcore.backend.modules.content.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.client.RestTemplate;

class GeminiChatServiceTest {

    private RestTemplate restTemplate;
    private JdbcTemplate jdbcTemplate;
    private GeminiChatService service;
    private Path tempWorkingDirectory;
    private String originalUserDir;

    @BeforeEach
    void setUp() throws Exception {
        restTemplate = Mockito.mock(RestTemplate.class);
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        service = new GeminiChatService(restTemplate, jdbcTemplate);
        setField("apiKey", "test-key");
        setField("model", "gemini-2.5-flash");
    }

    @AfterEach
    void tearDown() throws Exception {
        if (originalUserDir != null) {
            System.setProperty("user.dir", originalUserDir);
        }
        if (tempWorkingDirectory != null) {
            Files.deleteIfExists(tempWorkingDirectory.resolve(".env"));
            Files.deleteIfExists(tempWorkingDirectory);
        }
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void chat_shouldEmbedResolvedContextAndAllowedActionsIntoSystemInstruction() {
        when(jdbcTemplate.query(any(String.class), any(org.springframework.jdbc.core.RowMapper.class)))
                .thenReturn(List.of(Map.of(
                        "name", "Chicken Rice Bowl",
                        "calories", 520,
                        "protein", new BigDecimal("42"),
                        "carbs", new BigDecimal("48"),
                        "fat", new BigDecimal("12"))));
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "candidates", List.of(Map.of(
                                "content", Map.of(
                                        "parts", List.of(Map.of("text", "Tap trung 2 buoi suc manh va mo Progress Hub de xem tin hieu gan nhat."))))))));

        String reply = service.chat(
                List.of(Map.of("role", "user", "content", "Toi nen tap gi tuan nay?")),
                Map.of(
                        "mode", "WORKOUTS",
                        "selectedWorkout", Map.of(
                                "workoutId", 11,
                                "name", "Barbell Back Squat",
                                "description", "Heavy lower-body strength work."),
                        "selectedFood", Map.of(
                                "foodId", 21,
                                "name", "Chicken Rice Bowl",
                                "calories", 520,
                                "protein", 42,
                                "carbs", 48,
                                "fat", 12),
                        "availableActions", List.of(
                                Map.of(
                                        "id", "review-progress-hub",
                                        "label", "Review latest progress signals",
                                        "route", "/customer/progress-hub",
                                        "type", "route"),
                                Map.of(
                                        "id", "open-coach-booking",
                                        "label", "Get coach support if the week feels overloaded",
                                        "route", "/customer/coach-booking",
                                        "type", "route")),
                        "contextMeta", Map.of(
                                "usedSignals", List.of("goals", "health", "progress"),
                                "missingSignals", List.of(),
                                "entryPoint", "ai-chat"),
                        "aiContext", Map.of(
                                "goals", Map.of(
                                        "effectiveGoalCodes", List.of("GAIN_MUSCLE"),
                                        "source", "SAVED_PROFILE"),
                                "health", Map.of(
                                        "currentSnapshot", Map.of(
                                                "weightKg", new BigDecimal("70.2"),
                                                "bmi", new BigDecimal("23.6"),
                                                "heightCm", new BigDecimal("172.5"))),
                                "progress", Map.of(
                                        "latestProgressSignal", Map.of(
                                                "summary", "Weight trend is stable and recovery looks manageable."),
                                        "latestNoteSignal", Map.of(
                                                "summary", "Coach noted strong squat depth progress.")))));

        assertEquals("Tap trung 2 buoi suc manh va mo Progress Hub de xem tin hieu gan nhat.", reply);

        ArgumentCaptor<HttpEntity> requestCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(
                Mockito.contains("gemini-2.5-flash:generateContent"),
                eq(HttpMethod.POST),
                requestCaptor.capture(),
                eq(Map.class));

        Map<String, Object> body = (Map<String, Object>) requestCaptor.getValue().getBody();
        Map<String, Object> systemInstruction = (Map<String, Object>) body.get("systemInstruction");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) systemInstruction.get("parts");
        String prompt = String.valueOf(parts.get(0).get("text"));

        assertTrue(prompt.contains("Active customer signals: goals, health, progress."));
        assertTrue(prompt.contains("Effective goals: GAIN_MUSCLE."));
        assertTrue(prompt.contains("Latest progress signal: Weight trend is stable and recovery looks manageable."));
        assertTrue(prompt.contains("Latest coach note: Coach noted strong squat depth progress."));
        assertTrue(prompt.contains("Selected workout: Barbell Back Squat (Heavy lower-body strength work.)"));
        assertTrue(prompt.contains("Selected food: Chicken Rice Bowl (calories 520, protein 42, carbs 48, fat 12)"));
        assertTrue(prompt.contains("review-progress-hub -> /customer/progress-hub (Review latest progress signals)"));
        assertTrue(prompt.contains("open-coach-booking -> /customer/coach-booking (Get coach support if the week feels overloaded)"));
        assertTrue(prompt.contains("Chicken Rice Bowl | Cal: 520 | P: 42 | C: 48 | F: 12"));
        assertTrue(prompt.contains("Reply in English."));
        assertTrue(prompt.contains("Use plain text only."));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void chat_shouldSwitchPromptLanguageToVietnameseForVietnameseUserMessage() {
        when(jdbcTemplate.query(any(String.class), any(org.springframework.jdbc.core.RowMapper.class)))
                .thenReturn(List.of());
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "candidates", List.of(Map.of(
                                "content", Map.of(
                                        "parts", List.of(Map.of("text", "Ban nen uu tien bua an giau protein."))))))));

        service.chat(
                List.of(Map.of("role", "user", "content", "giam can")),
                Map.of(
                        "mode", "FOODS",
                        "preferredLanguage", "en",
                        "conversationMessages", List.of(
                                Map.of("role", "assistant", "content", "Hello"),
                                Map.of("role", "user", "content", "giam can"))));

        ArgumentCaptor<HttpEntity> requestCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(
                Mockito.contains("gemini-2.5-flash:generateContent"),
                eq(HttpMethod.POST),
                requestCaptor.capture(),
                eq(Map.class));

        Map<String, Object> body = (Map<String, Object>) requestCaptor.getValue().getBody();
        Map<String, Object> systemInstruction = (Map<String, Object>) body.get("systemInstruction");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) systemInstruction.get("parts");
        String prompt = String.valueOf(parts.get(0).get("text"));

        assertTrue(prompt.contains("Reply in Vietnamese."));
    }

    @Test
    void initializeConfig_shouldFallbackToDotEnvWhenInjectedPropertiesAreBlank() throws Exception {
        tempWorkingDirectory = Files.createTempDirectory("gemini-config-test");
        Files.writeString(tempWorkingDirectory.resolve(".env"),
                "APP_AI_GEMINI_API_KEY=dotenv-key\nAPP_AI_GEMINI_MODEL=gemini-dotenv-test\n");
        originalUserDir = System.getProperty("user.dir");
        System.setProperty("user.dir", tempWorkingDirectory.toString());

        setField("apiKey", "");
        setField("model", "");

        service.initializeConfig();

        assertFalse(String.valueOf(readField("apiKey")).isBlank());
        assertFalse(String.valueOf(readField("model")).isBlank());
    }

    @Test
    void initializeConfig_shouldKeepInjectedValuesWhenAlreadyPresent() throws Exception {
        setField("apiKey", "spring-key");
        setField("model", "gemini-2.0-flash");

        service.initializeConfig();

        assertEquals("spring-key", readField("apiKey"));
        assertEquals("gemini-2.0-flash", readField("model"));
        assertFalse(String.valueOf(readField("apiKey")).isBlank());
    }

    private void setField(String name, String value) throws Exception {
        Field field = GeminiChatService.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(service, value);
    }

    private Object readField(String name) throws Exception {
        Field field = GeminiChatService.class.getDeclaredField(name);
        field.setAccessible(true);
        return field.get(service);
    }
}
