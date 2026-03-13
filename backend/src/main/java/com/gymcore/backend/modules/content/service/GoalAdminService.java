package com.gymcore.backend.modules.content.service;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GoalAdminService {

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;

    public GoalAdminService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
    }

    public Map<String, Object> getGoals(String authorizationHeader) {
        currentUserService.requireAdmin(authorizationHeader);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT GoalID,
                       GoalCode,
                       GoalName,
                       Description,
                       IsActive,
                       CreatedAt
                FROM dbo.FitnessGoals
                ORDER BY CreatedAt DESC, GoalName
                """, (rs, rowNum) -> mapGoal(rs));

        hydrateGoalMappings(items);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", items);
        response.put("workouts", loadWorkoutCatalog());
        response.put("foods", loadFoodCatalog());
        return response;
    }

    public Map<String, Object> createGoal(String authorizationHeader, Map<String, Object> payload) {
        currentUserService.requireAdmin(authorizationHeader);
        GoalDraft draft = parseDraft(payload, null);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO dbo.FitnessGoals (GoalCode, GoalName, Description, IsActive)
                    VALUES (?, ?, ?, ?)
                    """, new String[] { "GoalID" });
            statement.setString(1, draft.goalCode());
            statement.setString(2, draft.name());
            statement.setString(3, draft.description());
            statement.setBoolean(4, draft.active());
            return statement;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not create goal.");
        }

        int goalId = key.intValue();
        upsertWorkoutGoalMap(goalId, draft.workoutIds());
        upsertFoodGoalMap(goalId, draft.foodIds());
        return getGoalDetailInternal(goalId);
    }

    public Map<String, Object> updateGoal(String authorizationHeader, int goalId, Map<String, Object> payload) {
        currentUserService.requireAdmin(authorizationHeader);
        GoalDraft draft = parseDraft(payload, goalId);

        int updated = jdbcTemplate.update("""
                UPDATE dbo.FitnessGoals
                SET GoalCode = ?,
                    GoalName = ?,
                    Description = ?,
                    IsActive = ?
                WHERE GoalID = ?
                """, draft.goalCode(), draft.name(), draft.description(), draft.active(), goalId);

        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found.");
        }

        upsertWorkoutGoalMap(goalId, draft.workoutIds());
        upsertFoodGoalMap(goalId, draft.foodIds());
        return getGoalDetailInternal(goalId);
    }

    public Map<String, Object> archiveGoal(String authorizationHeader, int goalId) {
        currentUserService.requireAdmin(authorizationHeader);
        int updated = jdbcTemplate.update("UPDATE dbo.FitnessGoals SET IsActive = 0 WHERE GoalID = ?", goalId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found.");
        }
        return Map.of("goalId", goalId, "active", false);
    }

    public Map<String, Object> restoreGoal(String authorizationHeader, int goalId) {
        currentUserService.requireAdmin(authorizationHeader);
        int updated = jdbcTemplate.update("UPDATE dbo.FitnessGoals SET IsActive = 1 WHERE GoalID = ?", goalId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found.");
        }
        return Map.of("goalId", goalId, "active", true);
    }

    private Map<String, Object> getGoalDetailInternal(int goalId) {
        try {
            Map<String, Object> goal = jdbcTemplate.queryForObject("""
                    SELECT GoalID,
                           GoalCode,
                           GoalName,
                           Description,
                           IsActive,
                           CreatedAt
                    FROM dbo.FitnessGoals
                    WHERE GoalID = ?
                    """, (rs, rowNum) -> mapGoal(rs), goalId);
            if (goal == null) {
                throw new EmptyResultDataAccessException(1);
            }
            hydrateGoalMappings(List.of(goal));
            return goal;
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found.");
        }
    }

    private GoalDraft parseDraft(Map<String, Object> payload, Integer existingGoalId) {
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;
        String goalCode = normalizeGoalCode(requireNonBlankString(safePayload.get("goalCode"), "Goal code is required."));
        String name = requireNonBlankString(safePayload.get("name"), "Goal name is required.");
        String description = trimToNull(safePayload.get("description"));
        boolean active = safePayload.get("active") == null || Boolean.TRUE.equals(toBoolean(safePayload.get("active")));
        List<Integer> workoutIds = requireIdList(safePayload.get("workoutIds"));
        List<Integer> foodIds = requireIdList(safePayload.get("foodIds"));

        ensureGoalCodeUnique(goalCode, existingGoalId);
        validateWorkoutIds(workoutIds);
        validateFoodIds(foodIds);

        return new GoalDraft(goalCode, name, description, active, workoutIds, foodIds);
    }

    private void ensureGoalCodeUnique(String goalCode, Integer existingGoalId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.FitnessGoals
                WHERE UPPER(GoalCode) = ?
                  AND (? IS NULL OR GoalID <> ?)
                """, Integer.class, goalCode, existingGoalId, existingGoalId);
        if (count != null && count > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Goal code already exists.");
        }
    }

    private void validateWorkoutIds(List<Integer> workoutIds) {
        if (workoutIds.isEmpty()) {
            return;
        }
        String placeholders = placeholders(workoutIds.size());
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.Workouts
                WHERE WorkoutID IN (%s)
                """.formatted(placeholders), Integer.class, workoutIds.toArray());
        if (count == null || count != workoutIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more workouts are invalid.");
        }
    }

    private void validateFoodIds(List<Integer> foodIds) {
        if (foodIds.isEmpty()) {
            return;
        }
        String placeholders = placeholders(foodIds.size());
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.Foods
                WHERE FoodID IN (%s)
                """.formatted(placeholders), Integer.class, foodIds.toArray());
        if (count == null || count != foodIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more foods are invalid.");
        }
    }

    private void hydrateGoalMappings(List<Map<String, Object>> goals) {
        Map<Integer, List<Map<String, Object>>> workoutMap = loadWorkoutMapByGoalIds(extractIds(goals, "goalId"));
        Map<Integer, List<Map<String, Object>>> foodMap = loadFoodMapByGoalIds(extractIds(goals, "goalId"));
        for (Map<String, Object> goal : goals) {
            int goalId = ((Number) goal.get("goalId")).intValue();
            List<Map<String, Object>> workouts = workoutMap.getOrDefault(goalId, List.of());
            List<Map<String, Object>> foods = foodMap.getOrDefault(goalId, List.of());
            goal.put("workouts", workouts);
            goal.put("foods", foods);
            goal.put("workoutIds", workouts.stream()
                    .map(item -> ((Number) item.get("workoutId")).intValue())
                    .toList());
            goal.put("foodIds", foods.stream()
                    .map(item -> ((Number) item.get("foodId")).intValue())
                    .toList());
        }
    }

    private List<Map<String, Object>> loadWorkoutCatalog() {
        return jdbcTemplate.query("""
                SELECT WorkoutID,
                       WorkoutName,
                       IsActive
                FROM dbo.Workouts
                ORDER BY WorkoutName
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("workoutId", rs.getInt("WorkoutID"));
            item.put("name", rs.getString("WorkoutName"));
            item.put("active", rs.getBoolean("IsActive"));
            return item;
        });
    }

    private List<Map<String, Object>> loadFoodCatalog() {
        return jdbcTemplate.query("""
                SELECT FoodID,
                       FoodName,
                       IsActive
                FROM dbo.Foods
                ORDER BY FoodName
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("foodId", rs.getInt("FoodID"));
            item.put("name", rs.getString("FoodName"));
            item.put("active", rs.getBoolean("IsActive"));
            return item;
        });
    }

    private Map<Integer, List<Map<String, Object>>> loadWorkoutMapByGoalIds(Set<Integer> goalIds) {
        if (goalIds.isEmpty()) {
            return Map.of();
        }
        String sql = """
                SELECT m.GoalID,
                       w.WorkoutID,
                       w.WorkoutName,
                       w.IsActive
                FROM dbo.WorkoutGoalMap m
                JOIN dbo.Workouts w ON w.WorkoutID = m.WorkoutID
                WHERE m.GoalID IN (%s)
                ORDER BY w.WorkoutName
                """.formatted(placeholders(goalIds.size()));

        Map<Integer, List<Map<String, Object>>> map = new LinkedHashMap<>();
        jdbcTemplate.query(sql, rs -> {
            int goalId = rs.getInt("GoalID");
            map.computeIfAbsent(goalId, ignored -> new ArrayList<>()).add(mapWorkoutReference(rs));
        }, goalIds.toArray());
        return map;
    }

    private Map<Integer, List<Map<String, Object>>> loadFoodMapByGoalIds(Set<Integer> goalIds) {
        if (goalIds.isEmpty()) {
            return Map.of();
        }
        String sql = """
                SELECT m.GoalID,
                       f.FoodID,
                       f.FoodName,
                       f.IsActive
                FROM dbo.FoodGoalMap m
                JOIN dbo.Foods f ON f.FoodID = m.FoodID
                WHERE m.GoalID IN (%s)
                ORDER BY f.FoodName
                """.formatted(placeholders(goalIds.size()));

        Map<Integer, List<Map<String, Object>>> map = new LinkedHashMap<>();
        jdbcTemplate.query(sql, rs -> {
            int goalId = rs.getInt("GoalID");
            map.computeIfAbsent(goalId, ignored -> new ArrayList<>()).add(mapFoodReference(rs));
        }, goalIds.toArray());
        return map;
    }

    private void upsertWorkoutGoalMap(int goalId, List<Integer> workoutIds) {
        jdbcTemplate.update("DELETE FROM dbo.WorkoutGoalMap WHERE GoalID = ?", goalId);
        for (Integer workoutId : workoutIds) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.WorkoutGoalMap (GoalID, WorkoutID)
                    VALUES (?, ?)
                    """, goalId, workoutId);
        }
    }

    private void upsertFoodGoalMap(int goalId, List<Integer> foodIds) {
        jdbcTemplate.update("DELETE FROM dbo.FoodGoalMap WHERE GoalID = ?", goalId);
        for (Integer foodId : foodIds) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.FoodGoalMap (GoalID, FoodID)
                    VALUES (?, ?)
                    """, goalId, foodId);
        }
    }

    private static Map<String, Object> mapGoal(ResultSet rs) throws SQLException {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("goalId", rs.getInt("GoalID"));
        item.put("goalCode", rs.getString("GoalCode"));
        item.put("name", rs.getString("GoalName"));
        item.put("description", rs.getString("Description"));
        item.put("active", rs.getBoolean("IsActive"));
        item.put("createdAt", rs.getTimestamp("CreatedAt"));
        return item;
    }

    private static Map<String, Object> mapWorkoutReference(ResultSet rs) throws SQLException {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("workoutId", rs.getInt("WorkoutID"));
        item.put("name", rs.getString("WorkoutName"));
        item.put("active", rs.getBoolean("IsActive"));
        return item;
    }

    private static Map<String, Object> mapFoodReference(ResultSet rs) throws SQLException {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("foodId", rs.getInt("FoodID"));
        item.put("name", rs.getString("FoodName"));
        item.put("active", rs.getBoolean("IsActive"));
        return item;
    }

    private static Set<Integer> extractIds(List<Map<String, Object>> items, String key) {
        Set<Integer> ids = new LinkedHashSet<>();
        for (Map<String, Object> item : items) {
            Object value = item.get(key);
            if (value instanceof Number number) {
                ids.add(number.intValue());
            }
        }
        return ids;
    }

    private static String requireNonBlankString(Object value, String message) {
        String normalized = value == null ? "" : String.valueOf(value).trim();
        if (normalized.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return normalized;
    }

    private static String trimToNull(Object value) {
        if (value == null) {
            return null;
        }
        String trimmed = String.valueOf(value).trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Boolean toBoolean(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        String raw = String.valueOf(value).trim().toLowerCase();
        if ("true".equals(raw) || "1".equals(raw) || "yes".equals(raw)) {
            return true;
        }
        if ("false".equals(raw) || "0".equals(raw) || "no".equals(raw)) {
            return false;
        }
        return null;
    }

    private static String normalizeGoalCode(String value) {
        String normalized = value.trim().replaceAll("[^A-Za-z0-9]+", "_").replaceAll("_+", "_");
        normalized = normalized.replaceAll("^_+|_+$", "");
        if (normalized.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Goal code is required.");
        }
        return normalized.toUpperCase();
    }

    private static List<Integer> requireIdList(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        return list.stream()
                .map(GoalAdminService::parsePositiveInt)
                .distinct()
                .collect(Collectors.toList());
    }

    private static Integer parsePositiveInt(Object value) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "IDs must be positive integers.");
        }
        try {
            int parsed = value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value));
            if (parsed <= 0) {
                throw new NumberFormatException("not-positive");
            }
            return parsed;
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "IDs must be positive integers.");
        }
    }

    private static String placeholders(int count) {
        if (count <= 0) {
            return "";
        }
        return String.join(", ", java.util.Collections.nCopies(count, "?"));
    }

    private record GoalDraft(
            String goalCode,
            String name,
            String description,
            boolean active,
            List<Integer> workoutIds,
            List<Integer> foodIds) {
    }
}
