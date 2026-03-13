package com.gymcore.backend.modules.content.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class ContentServiceTest {

    @Test
    void execute_shouldReturnNotImplementedForUnsupportedAction() {
        ContentService contentService = new ContentService(
                org.mockito.Mockito.mock(JdbcTemplate.class),
                org.mockito.Mockito.mock(CurrentUserService.class));
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> contentService.execute("unsupported-action", null));

        assertEquals(HttpStatus.NOT_IMPLEMENTED, exception.getStatusCode());
        assertEquals("Unsupported content action: unsupported-action", exception.getReason());
    }

    @Test
    @SuppressWarnings("unchecked")
    void execute_shouldResolveSavedGoalsHealthAndProgressIntoAiContext() {
        JdbcTemplate jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
        CurrentUserService currentUserService = org.mockito.Mockito.mock(CurrentUserService.class);
        ContentService contentService = new ContentService(jdbcTemplate, currentUserService);

        when(currentUserService.findUser("Bearer customer-token"))
                .thenReturn(Optional.of(new CurrentUserService.UserInfo(42, "Customer", "CUSTOMER")));
        when(jdbcTemplate.query(
                anyString(),
                ArgumentMatchers.<RowMapper<Map<String, Object>>>any(),
                anyInt())).thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    if (sql.contains("FROM dbo.CustomerGoals")) {
                        return List.of(Map.of(
                                "goalId", 7,
                                "goalCode", "LOSE_FAT",
                                "name", "Lose fat",
                                "description", "Fat loss goal"));
                    }
                    if (sql.contains("FROM dbo.CustomerHealthHistory")) {
                        return List.of(Map.of(
                                "heightCm", new BigDecimal("170.0"),
                                "weightKg", new BigDecimal("74.5"),
                                "bmi", new BigDecimal("25.8"),
                                "recordedAt", "2026-03-11T09:00:00Z"));
                    }
                    if (sql.contains("FROM dbo.PTSessionNotes")) {
                        return List.of(Map.of(
                                "noteId", 15,
                                "noteContent", "Focus on recovery and mobility this week",
                                "createdAt", "2026-03-12T10:30:00Z",
                                "sessionDate", "2026-03-12",
                                "coachName", "Coach Linh"));
                    }
                    throw new AssertionError("Unexpected query: " + sql);
                });
        when(jdbcTemplate.queryForObject(
                anyString(),
                ArgumentMatchers.<RowMapper<Map<String, Object>>>any(),
                anyInt())).thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    if (sql.contains("FROM dbo.CustomerHealthCurrent")) {
                        return Map.of(
                                "heightCm", new BigDecimal("170.0"),
                                "weightKg", new BigDecimal("75.0"),
                                "bmi", new BigDecimal("26.0"),
                                "updatedAt", "2026-03-12T08:00:00Z");
                    }
                    throw new AssertionError("Unexpected queryForObject: " + sql);
                });

        Map<String, Object> response = contentService.execute(
                "resolve-ai-context",
                Map.of("authorizationHeader", "Bearer customer-token"));

        Map<String, Object> aiContext = (Map<String, Object>) response.get("aiContext");
        Map<String, Object> goals = (Map<String, Object>) aiContext.get("goals");
        Map<String, Object> health = (Map<String, Object>) aiContext.get("health");
        Map<String, Object> progress = (Map<String, Object>) aiContext.get("progress");
        Map<String, Object> currentSnapshot = (Map<String, Object>) health.get("currentSnapshot");
        Map<String, Object> latestProgressSignal = (Map<String, Object>) progress.get("latestProgressSignal");
        Map<String, Object> latestNoteSignal = (Map<String, Object>) progress.get("latestNoteSignal");
        Map<String, Object> contextMeta = (Map<String, Object>) response.get("contextMeta");

        assertEquals("ai-context.v1", aiContext.get("contractVersion"));
        assertEquals(List.of("LOSE_FAT"), goals.get("effectiveGoalCodes"));
        assertEquals("SAVED_PROFILE", goals.get("source"));
        assertEquals(new BigDecimal("75.0"), currentSnapshot.get("weightKg"));
        assertEquals("2026-03-12T08:00:00Z", latestProgressSignal.get("recordedAt"));
        assertEquals("2026-03-12T10:30:00Z", latestNoteSignal.get("recordedAt"));
        assertEquals(List.of("goals", "health", "progress"), contextMeta.get("usedSignals"));
        assertEquals("resolve-ai-context", contextMeta.get("entryPoint"));
        assertEquals("dbo.CustomerGoals", ((Map<?, ?>) contextMeta.get("signalSources")).get("goals"));
        assertEquals(1, ((Map<?, ?>) contextMeta.get("signalStatus")).get("goalCount"));
        assertTrue(((List<?>) contextMeta.get("missingSignals")).isEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void execute_shouldMarkFallbackSignalsWhenOnlyRequestGoalsAreAvailable() {
        JdbcTemplate jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
        CurrentUserService currentUserService = org.mockito.Mockito.mock(CurrentUserService.class);
        ContentService contentService = new ContentService(jdbcTemplate, currentUserService);

        when(currentUserService.findUser(any())).thenReturn(Optional.empty());

        Map<String, Object> response = contentService.execute(
                "resolve-ai-context",
                Map.of("authorizationHeader", "Bearer guest", "goal", "lose fat"));

        Map<String, Object> contextMeta = (Map<String, Object>) response.get("contextMeta");

        assertEquals("REQUEST", contextMeta.get("goalSource"));
        assertEquals(List.of("goals"), contextMeta.get("usedSignals"));
        assertEquals(List.of("health", "progress"), contextMeta.get("missingSignals"));
        assertEquals(List.of("goals", "health", "progress"), contextMeta.get("fallbackSignals"));
        assertEquals(Boolean.TRUE, contextMeta.get("fallbackUsed"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void execute_shouldReturnExplainableRecommendationContract() {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        CurrentUserService currentUserService = Mockito.mock(CurrentUserService.class);
        ContentService contentService = new ContentService(jdbcTemplate, currentUserService);
        stubAiContext(jdbcTemplate, currentUserService);
        stubCatalogQueries(jdbcTemplate);

        Map<String, Object> response = contentService.execute(
                "ai-recommendations",
                Map.of("authorizationHeader", "Bearer customer-token"));

        assertEquals("ai-recommendations.v2", response.get("contractVersion"));
        assertEquals("Strength and protein support", ((Map<String, Object>) response.get("summary")).get("focus"));
        assertEquals(2, ((List<?>) response.get("sections")).size());
        assertTrue(((List<?>) response.get("contextHighlights")).size() >= 2);

        Map<String, Object> workout = ((List<Map<String, Object>>) response.get("workouts")).get(0);
        assertEquals(List.of("Matches muscle-gain goal."), workout.get("reasons"));
        assertEquals("/customer/knowledge/workouts/11", ((Map<String, Object>) workout.get("action")).get("route"));

        Map<String, Object> food = ((List<Map<String, Object>>) response.get("foods")).get(0);
        assertTrue(((List<String>) food.get("reasons")).contains("High protein for muscle-gain context."));
        assertEquals("/customer/progress-hub",
                ((Map<String, Object>) ((List<?>) response.get("nextActions")).get(2)).get("route"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void execute_shouldReturnStructuredWeeklyPlanWithinGuidanceScope() {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        CurrentUserService currentUserService = Mockito.mock(CurrentUserService.class);
        ContentService contentService = new ContentService(jdbcTemplate, currentUserService);
        stubAiContext(jdbcTemplate, currentUserService);
        stubCatalogQueries(jdbcTemplate);

        Map<String, Object> response = contentService.execute(
                "ai-weekly-plan",
                Map.of("authorizationHeader", "Bearer customer-token"));

        assertEquals("ai-weekly-plan.v1", response.get("contractVersion"));
        assertEquals(3, ((List<?>) response.get("sections")).size());
        assertEquals("guidance-only", ((Map<String, Object>) response.get("scopeGuardrails")).get("level"));
        assertEquals("ai-weekly-plan", ((Map<String, Object>) response.get("contextMeta")).get("entryPoint"));
        assertTrue(((String) ((Map<String, Object>) response.get("summary")).get("headline")).contains("guidance-level"));
        assertEquals("/customer/coach-booking",
                ((Map<String, Object>) ((List<?>) response.get("nextActions")).get(3)).get("route"));
    }

    private static void stubAiContext(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService) {
        when(currentUserService.findUser("Bearer customer-token"))
                .thenReturn(Optional.of(new CurrentUserService.UserInfo(42, "Customer", "CUSTOMER")));

        when(jdbcTemplate.query(
                anyString(),
                ArgumentMatchers.<RowMapper<Map<String, Object>>>any(),
                anyInt())).thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    if (sql.contains("FROM dbo.CustomerGoals")) {
                        return List.of(Map.of(
                                "goalId", 9,
                                "goalCode", "GAIN_MUSCLE",
                                "name", "Gain muscle",
                                "description", "Build more lean mass"));
                    }
                    if (sql.contains("FROM dbo.CustomerHealthHistory")) {
                        return List.of(Map.of(
                                "heightCm", new BigDecimal("170.0"),
                                "weightKg", new BigDecimal("74.5"),
                                "bmi", new BigDecimal("25.8"),
                                "recordedAt", "2026-03-11T09:00:00Z"));
                    }
                    if (sql.contains("FROM dbo.PTSessionNotes")) {
                        return List.of(Map.of(
                                "noteId", 18,
                                "noteContent", "Keep one lighter recovery block after heavy lifting",
                                "createdAt", "2026-03-12T10:30:00Z",
                                "sessionDate", "2026-03-12",
                                "coachName", "Coach Linh"));
                    }
                    throw new AssertionError("Unexpected query: " + sql);
                });

        when(jdbcTemplate.queryForObject(
                anyString(),
                ArgumentMatchers.<RowMapper<Map<String, Object>>>any(),
                anyInt())).thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    if (sql.contains("FROM dbo.CustomerHealthCurrent")) {
                        return Map.of(
                                "heightCm", new BigDecimal("170.0"),
                                "weightKg", new BigDecimal("75.0"),
                                "bmi", new BigDecimal("26.0"),
                                "updatedAt", "2026-03-12T08:00:00Z");
                    }
                    throw new AssertionError("Unexpected queryForObject: " + sql);
                });
    }

    private static void stubCatalogQueries(JdbcTemplate jdbcTemplate) {
        when(jdbcTemplate.query(
                anyString(),
                ArgumentMatchers.<RowMapper<Map<String, Object>>>any(),
                ArgumentMatchers.<Object[]>any())).thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    if (sql.contains("FROM dbo.Workouts")) {
                        return List.of(Map.of(
                                "workoutId", 11,
                                "name", "Upper Strength Builder",
                                "description", "Strength-focused resistance session",
                                "difficulty", "Intermediate",
                                "imageUrl", "",
                                "videoUrl", "",
                                "createdAt", "2026-03-01T08:00:00Z"));
                    }
                    if (sql.contains("FROM dbo.Foods")) {
                        return List.of(Map.of(
                                "foodId", 21,
                                "name", "Chicken Rice Bowl",
                                "description", "High protein post-workout meal",
                                "calories", 420,
                                "protein", new BigDecimal("32.0"),
                                "carbs", new BigDecimal("35.0"),
                                "fat", new BigDecimal("10.0"),
                                "imageUrl", "",
                                "createdAt", "2026-03-01T08:00:00Z"));
                    }
                    throw new AssertionError("Unexpected catalog query with args: " + sql);
                });

        when(jdbcTemplate.query(
                anyString(),
                ArgumentMatchers.<RowMapper<Map<String, Object>>>any())).thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    if (sql.contains("FROM dbo.Workouts")) {
                        return List.of(Map.of(
                                "workoutId", 11,
                                "name", "Upper Strength Builder",
                                "description", "Strength-focused resistance session",
                                "difficulty", "Intermediate",
                                "imageUrl", "",
                                "videoUrl", "",
                                "createdAt", "2026-03-01T08:00:00Z"));
                    }
                    if (sql.contains("FROM dbo.Foods")) {
                        return List.of(Map.of(
                                "foodId", 21,
                                "name", "Chicken Rice Bowl",
                                "description", "High protein post-workout meal",
                                "calories", 420,
                                "protein", new BigDecimal("32.0"),
                                "carbs", new BigDecimal("35.0"),
                                "fat", new BigDecimal("10.0"),
                                "imageUrl", "",
                                "createdAt", "2026-03-01T08:00:00Z"));
                    }
                    throw new AssertionError("Unexpected catalog query: " + sql);
                });

        when(jdbcTemplate.query(
                anyString(),
                ArgumentMatchers.<ResultSetExtractor<Object>>any(),
                ArgumentMatchers.<Object[]>any())).thenReturn(null);
    }
}
