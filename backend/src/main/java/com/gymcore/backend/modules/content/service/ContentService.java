package com.gymcore.backend.modules.content.service;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ContentService {

    private final JdbcTemplate jdbcTemplate;

    public ContentService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> execute(String action, Object payload) {
        Map<String, Object> safePayload = payload instanceof Map<?, ?> raw
                ? raw.entrySet().stream()
                        .collect(Collectors.toMap(
                                entry -> String.valueOf(entry.getKey()),
                                Map.Entry::getValue,
                                (a, b) -> a,
                                LinkedHashMap::new))
                : Map.of();

        return switch (action) {
            case "get-workout-categories" -> Map.of("items", loadActiveWorkoutCategoryCatalog());
            case "get-workouts" -> getWorkouts();
            case "get-workout-detail" -> getWorkoutDetail(requirePositiveInt(
                    safePayload.get("workoutId"), "Workout ID is required."));
            case "get-food-categories" -> Map.of("items", loadActiveFoodCategoryCatalog());
            case "get-foods" -> getFoods();
            case "get-food-detail" -> getFoodDetail(requirePositiveInt(
                    safePayload.get("foodId"), "Food ID is required."));
            case "get-fitness-goals" -> Map.of("items", loadActiveFitnessGoals());
            case "ai-recommendations" -> getAiRecommendations(safePayload);
            case "ai-workout-assistant" -> Map.of(
                    "answer",
                    "This endpoint is a placeholder. Use /api/v1/ai/recommendations for structured workout + food suggestions.");
            case "ai-coach-booking-assistant" -> Map.of(
                    "answer",
                    "This endpoint is a placeholder. Coach booking assistance is not implemented in this build.");
            default -> throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED,
                    "Unsupported content action: " + action);
        };
    }

    private Map<String, Object> getWorkouts() {
        List<Map<String, Object>> workouts = jdbcTemplate.query("""
                SELECT w.WorkoutID,
                       w.WorkoutName,
                       w.Description,
                       w.ImageUrl,
                       w.VideoUrl,
                       w.Difficulty,
                       w.CreatedAt
                FROM dbo.Workouts w
                WHERE w.IsActive = 1
                ORDER BY w.CreatedAt DESC, w.WorkoutName
                """, (rs, rowNum) -> mapWorkoutCatalog(rs));

        Map<Integer, List<Map<String, Object>>> categoryMap = loadWorkoutCategoryMapByWorkoutIds(extractIds(workouts, "workoutId"));
        for (Map<String, Object> workout : workouts) {
            int workoutId = ((Number) workout.get("workoutId")).intValue();
            workout.put("categories", categoryMap.getOrDefault(workoutId, List.of()));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", workouts);
        response.put("categories", loadActiveWorkoutCategoryCatalog());
        return response;
    }

    private Map<String, Object> getWorkoutDetail(int workoutId) {
        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT w.WorkoutID,
                       w.WorkoutName,
                       w.Description,
                       w.Instructions,
                       w.ImageUrl,
                       w.VideoUrl,
                       w.Difficulty,
                       w.CreatedAt
                FROM dbo.Workouts w
                WHERE w.WorkoutID = ? AND w.IsActive = 1
                """, (rs, rowNum) -> mapWorkoutDetail(rs), workoutId);

        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found.");
        }
        Map<String, Object> workout = new LinkedHashMap<>(rows.getFirst());
        workout.put("categories", loadWorkoutCategoriesForWorkout(workoutId));
        return workout;
    }

    private Map<String, Object> getFoods() {
        List<Map<String, Object>> foods = jdbcTemplate.query("""
                SELECT f.FoodID,
                       f.FoodName,
                       f.Description,
                       f.Calories,
                       f.Protein,
                       f.Carbs,
                       f.Fat,
                       f.ImageUrl,
                       f.CreatedAt
                FROM dbo.Foods f
                WHERE f.IsActive = 1
                ORDER BY f.CreatedAt DESC, f.FoodName
                """, (rs, rowNum) -> mapFoodCatalog(rs));

        Map<Integer, List<Map<String, Object>>> categoryMap = loadFoodCategoryMapByFoodIds(extractIds(foods, "foodId"));
        for (Map<String, Object> food : foods) {
            int foodId = ((Number) food.get("foodId")).intValue();
            food.put("categories", categoryMap.getOrDefault(foodId, List.of()));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", foods);
        response.put("categories", loadActiveFoodCategoryCatalog());
        return response;
    }

    private Map<String, Object> getFoodDetail(int foodId) {
        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT f.FoodID,
                       f.FoodName,
                       f.Description,
                       f.Recipe,
                       f.Calories,
                       f.Protein,
                       f.Carbs,
                       f.Fat,
                       f.ImageUrl,
                       f.CreatedAt
                FROM dbo.Foods f
                WHERE f.FoodID = ? AND f.IsActive = 1
                """, (rs, rowNum) -> mapFoodDetail(rs), foodId);

        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Food not found.");
        }
        Map<String, Object> food = new LinkedHashMap<>(rows.getFirst());
        food.put("categories", loadFoodCategoriesForFood(foodId));
        return food;
    }

    private Map<String, Object> getAiRecommendations(Map<String, Object> payload) {
        List<String> goalCodes = parseGoalCodes(payload);
        int limitWorkouts = clampInt(payload.get("limitWorkouts"), 6, 1, 24);
        int limitFoods = clampInt(payload.get("limitFoods"), 6, 1, 24);

        List<Map<String, Object>> workouts = recommendWorkouts(goalCodes, limitWorkouts);
        List<Map<String, Object>> foods = recommendFoods(goalCodes, limitFoods);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("goalCodes", goalCodes);
        response.put("workouts", workouts);
        response.put("foods", foods);
        return response;
    }

    private List<Map<String, Object>> recommendWorkouts(List<String> goalCodes, int limit) {
        List<Map<String, Object>> workouts = goalCodes.isEmpty()
                ? loadLatestWorkouts(limit)
                : loadWorkoutsByGoalMap(goalCodes, limit);

        if (!goalCodes.isEmpty() && workouts.isEmpty()) {
            workouts = loadWorkoutsByCategoryHeuristic(goalCodes, limit);
        }

        Map<Integer, List<Map<String, Object>>> categoryMap = loadWorkoutCategoryMapByWorkoutIds(extractIds(workouts, "workoutId"));
        for (Map<String, Object> workout : workouts) {
            int workoutId = ((Number) workout.get("workoutId")).intValue();
            workout.put("categories", categoryMap.getOrDefault(workoutId, List.of()));
        }
        return workouts;
    }

    private List<Map<String, Object>> recommendFoods(List<String> goalCodes, int limit) {
        List<Map<String, Object>> foods = goalCodes.isEmpty()
                ? loadLatestFoods(limit)
                : loadFoodsByGoalMap(goalCodes, limit);

        if (!goalCodes.isEmpty() && foods.isEmpty()) {
            foods = loadFoodsByCategoryHeuristic(goalCodes, limit);
        }

        Map<Integer, List<Map<String, Object>>> categoryMap = loadFoodCategoryMapByFoodIds(extractIds(foods, "foodId"));
        for (Map<String, Object> food : foods) {
            int foodId = ((Number) food.get("foodId")).intValue();
            food.put("categories", categoryMap.getOrDefault(foodId, List.of()));
        }
        return foods;
    }

    private List<Map<String, Object>> loadLatestWorkouts(int limit) {
        String sql = """
                SELECT TOP (%d) w.WorkoutID,
                               w.WorkoutName,
                               w.Description,
                               w.ImageUrl,
                               w.VideoUrl,
                               w.Difficulty,
                               w.CreatedAt
                FROM dbo.Workouts w
                WHERE w.IsActive = 1
                ORDER BY w.CreatedAt DESC, w.WorkoutName
                """.formatted(limit);
        return jdbcTemplate.query(sql, (rs, rowNum) -> mapWorkoutCatalog(rs));
    }

    private List<Map<String, Object>> loadLatestFoods(int limit) {
        String sql = """
                SELECT TOP (%d) f.FoodID,
                               f.FoodName,
                               f.Description,
                               f.Calories,
                               f.Protein,
                               f.Carbs,
                               f.Fat,
                               f.ImageUrl,
                               f.CreatedAt
                FROM dbo.Foods f
                WHERE f.IsActive = 1
                ORDER BY f.CreatedAt DESC, f.FoodName
                """.formatted(limit);
        return jdbcTemplate.query(sql, (rs, rowNum) -> mapFoodCatalog(rs));
    }

    private List<Map<String, Object>> loadWorkoutsByGoalMap(List<String> goalCodes, int limit) {
        String placeholders = placeholders(goalCodes.size());
        String sql = """
                SELECT DISTINCT TOP (%d) w.WorkoutID,
                                        w.WorkoutName,
                                        w.Description,
                                        w.ImageUrl,
                                        w.VideoUrl,
                                        w.Difficulty,
                                        w.CreatedAt
                FROM dbo.Workouts w
                JOIN dbo.WorkoutGoalMap gm ON gm.WorkoutID = w.WorkoutID
                JOIN dbo.FitnessGoals g ON g.GoalID = gm.GoalID
                WHERE w.IsActive = 1
                  AND g.IsActive = 1
                  AND g.GoalCode IN (%s)
                ORDER BY w.CreatedAt DESC, w.WorkoutName
                """.formatted(limit, placeholders);
        return jdbcTemplate.query(sql, (rs, rowNum) -> mapWorkoutCatalog(rs), goalCodes.toArray());
    }

    private List<Map<String, Object>> loadFoodsByGoalMap(List<String> goalCodes, int limit) {
        String placeholders = placeholders(goalCodes.size());
        String sql = """
                SELECT DISTINCT TOP (%d) f.FoodID,
                                        f.FoodName,
                                        f.Description,
                                        f.Calories,
                                        f.Protein,
                                        f.Carbs,
                                        f.Fat,
                                        f.ImageUrl,
                                        f.CreatedAt
                FROM dbo.Foods f
                JOIN dbo.FoodGoalMap gm ON gm.FoodID = f.FoodID
                JOIN dbo.FitnessGoals g ON g.GoalID = gm.GoalID
                WHERE f.IsActive = 1
                  AND g.IsActive = 1
                  AND g.GoalCode IN (%s)
                ORDER BY f.CreatedAt DESC, f.FoodName
                """.formatted(limit, placeholders);
        return jdbcTemplate.query(sql, (rs, rowNum) -> mapFoodCatalog(rs), goalCodes.toArray());
    }

    private List<Map<String, Object>> loadWorkoutsByCategoryHeuristic(List<String> goalCodes, int limit) {
        List<String> categoryNames = new ArrayList<>();
        for (String code : goalCodes) {
            if ("LOSE_FAT".equalsIgnoreCase(code)) categoryNames.add("HIIT");
            if ("GAIN_MUSCLE".equalsIgnoreCase(code)) categoryNames.add("Calisthenics");
        }
        if (categoryNames.isEmpty()) {
            return loadLatestWorkouts(limit);
        }
        String placeholders = placeholders(categoryNames.size());
        String sql = """
                SELECT DISTINCT TOP (%d) w.WorkoutID,
                                        w.WorkoutName,
                                        w.Description,
                                        w.ImageUrl,
                                        w.VideoUrl,
                                        w.Difficulty,
                                        w.CreatedAt
                FROM dbo.Workouts w
                JOIN dbo.WorkoutCategoryMap m ON m.WorkoutID = w.WorkoutID
                JOIN dbo.WorkoutCategories c ON c.WorkoutCategoryID = m.WorkoutCategoryID
                WHERE w.IsActive = 1
                  AND c.IsActive = 1
                  AND c.CategoryName IN (%s)
                ORDER BY w.CreatedAt DESC, w.WorkoutName
                """.formatted(limit, placeholders);
        return jdbcTemplate.query(sql, (rs, rowNum) -> mapWorkoutCatalog(rs), categoryNames.toArray());
    }

    private List<Map<String, Object>> loadFoodsByCategoryHeuristic(List<String> goalCodes, int limit) {
        List<String> categoryNames = new ArrayList<>();
        for (String code : goalCodes) {
            if ("LOSE_FAT".equalsIgnoreCase(code)) categoryNames.add("Lose Weight");
            if ("GAIN_MUSCLE".equalsIgnoreCase(code)) categoryNames.add("Increase Muscle");
            if ("MAINTAIN".equalsIgnoreCase(code)) categoryNames.add("Increase Muscle");
        }
        if (categoryNames.isEmpty()) {
            return loadLatestFoods(limit);
        }
        String placeholders = placeholders(categoryNames.size());
        String sql = """
                SELECT DISTINCT TOP (%d) f.FoodID,
                                        f.FoodName,
                                        f.Description,
                                        f.Calories,
                                        f.Protein,
                                        f.Carbs,
                                        f.Fat,
                                        f.ImageUrl,
                                        f.CreatedAt
                FROM dbo.Foods f
                JOIN dbo.FoodCategoryMap m ON m.FoodID = f.FoodID
                JOIN dbo.FoodCategories c ON c.FoodCategoryID = m.FoodCategoryID
                WHERE f.IsActive = 1
                  AND c.IsActive = 1
                  AND c.CategoryName IN (%s)
                ORDER BY f.CreatedAt DESC, f.FoodName
                """.formatted(limit, placeholders);
        return jdbcTemplate.query(sql, (rs, rowNum) -> mapFoodCatalog(rs), categoryNames.toArray());
    }

    private List<Map<String, Object>> loadActiveWorkoutCategoryCatalog() {
        return jdbcTemplate.query("""
                SELECT WorkoutCategoryID,
                       CategoryName,
                       Description
                FROM dbo.WorkoutCategories
                WHERE IsActive = 1
                ORDER BY CategoryName
                """, (rs, rowNum) -> mapWorkoutCategory(rs));
    }

    private List<Map<String, Object>> loadActiveFoodCategoryCatalog() {
        return jdbcTemplate.query("""
                SELECT FoodCategoryID,
                       CategoryName,
                       Description
                FROM dbo.FoodCategories
                WHERE IsActive = 1
                ORDER BY CategoryName
                """, (rs, rowNum) -> mapFoodCategory(rs));
    }

    private List<Map<String, Object>> loadActiveFitnessGoals() {
        return jdbcTemplate.query("""
                SELECT GoalID,
                       GoalCode,
                       GoalName,
                       Description
                FROM dbo.FitnessGoals
                WHERE IsActive = 1
                ORDER BY GoalName
                """, (rs, rowNum) -> {
            Map<String, Object> goal = new LinkedHashMap<>();
            goal.put("goalId", rs.getInt("GoalID"));
            goal.put("goalCode", rs.getString("GoalCode"));
            goal.put("name", rs.getString("GoalName"));
            goal.put("description", rs.getString("Description"));
            return goal;
        });
    }

    private Map<Integer, List<Map<String, Object>>> loadWorkoutCategoryMapByWorkoutIds(Set<Integer> workoutIds) {
        if (workoutIds.isEmpty()) return Map.of();

        String placeholders = placeholders(workoutIds.size());
        String sql = """
                SELECT m.WorkoutID,
                       c.WorkoutCategoryID,
                       c.CategoryName,
                       c.Description
                FROM dbo.WorkoutCategoryMap m
                JOIN dbo.WorkoutCategories c ON c.WorkoutCategoryID = m.WorkoutCategoryID
                WHERE c.IsActive = 1
                  AND m.WorkoutID IN (%s)
                ORDER BY c.CategoryName
                """.formatted(placeholders);

        Map<Integer, List<Map<String, Object>>> map = new LinkedHashMap<>();
        Object[] args = workoutIds.toArray();
        jdbcTemplate.query(sql, rs -> {
            int workoutId = rs.getInt("WorkoutID");
            map.computeIfAbsent(workoutId, ignored -> new ArrayList<>()).add(mapWorkoutCategory(rs));
        }, args);
        return map;
    }

    private List<Map<String, Object>> loadWorkoutCategoriesForWorkout(int workoutId) {
        return jdbcTemplate.query("""
                SELECT c.WorkoutCategoryID,
                       c.CategoryName,
                       c.Description
                FROM dbo.WorkoutCategoryMap m
                JOIN dbo.WorkoutCategories c ON c.WorkoutCategoryID = m.WorkoutCategoryID
                WHERE m.WorkoutID = ?
                  AND c.IsActive = 1
                ORDER BY c.CategoryName
                """, (rs, rowNum) -> mapWorkoutCategory(rs), workoutId);
    }

    private Map<Integer, List<Map<String, Object>>> loadFoodCategoryMapByFoodIds(Set<Integer> foodIds) {
        if (foodIds.isEmpty()) return Map.of();

        String placeholders = placeholders(foodIds.size());
        String sql = """
                SELECT m.FoodID,
                       c.FoodCategoryID,
                       c.CategoryName,
                       c.Description
                FROM dbo.FoodCategoryMap m
                JOIN dbo.FoodCategories c ON c.FoodCategoryID = m.FoodCategoryID
                WHERE c.IsActive = 1
                  AND m.FoodID IN (%s)
                ORDER BY c.CategoryName
                """.formatted(placeholders);

        Map<Integer, List<Map<String, Object>>> map = new LinkedHashMap<>();
        Object[] args = foodIds.toArray();
        jdbcTemplate.query(sql, rs -> {
            int foodId = rs.getInt("FoodID");
            map.computeIfAbsent(foodId, ignored -> new ArrayList<>()).add(mapFoodCategory(rs));
        }, args);
        return map;
    }

    private List<Map<String, Object>> loadFoodCategoriesForFood(int foodId) {
        return jdbcTemplate.query("""
                SELECT c.FoodCategoryID,
                       c.CategoryName,
                       c.Description
                FROM dbo.FoodCategoryMap m
                JOIN dbo.FoodCategories c ON c.FoodCategoryID = m.FoodCategoryID
                WHERE m.FoodID = ?
                  AND c.IsActive = 1
                ORDER BY c.CategoryName
                """, (rs, rowNum) -> mapFoodCategory(rs), foodId);
    }

    private static Map<String, Object> mapWorkoutCategory(ResultSet rs) throws SQLException {
        Map<String, Object> category = new LinkedHashMap<>();
        category.put("workoutCategoryId", rs.getInt("WorkoutCategoryID"));
        category.put("name", rs.getString("CategoryName"));
        category.put("description", rs.getString("Description"));
        return category;
    }

    private static Map<String, Object> mapFoodCategory(ResultSet rs) throws SQLException {
        Map<String, Object> category = new LinkedHashMap<>();
        category.put("foodCategoryId", rs.getInt("FoodCategoryID"));
        category.put("name", rs.getString("CategoryName"));
        category.put("description", rs.getString("Description"));
        return category;
    }

    private static Map<String, Object> mapWorkoutCatalog(ResultSet rs) throws SQLException {
        Map<String, Object> workout = new LinkedHashMap<>();
        workout.put("workoutId", rs.getInt("WorkoutID"));
        workout.put("name", rs.getString("WorkoutName"));
        workout.put("description", rs.getString("Description"));
        workout.put("imageUrl", rs.getString("ImageUrl"));
        workout.put("videoUrl", rs.getString("VideoUrl"));
        workout.put("difficulty", rs.getString("Difficulty"));
        workout.put("createdAt", rs.getTimestamp("CreatedAt"));
        return workout;
    }

    private static Map<String, Object> mapWorkoutDetail(ResultSet rs) throws SQLException {
        Map<String, Object> workout = mapWorkoutCatalog(rs);
        workout.put("instructions", rs.getString("Instructions"));
        return workout;
    }

    private static Map<String, Object> mapFoodCatalog(ResultSet rs) throws SQLException {
        Map<String, Object> food = new LinkedHashMap<>();
        food.put("foodId", rs.getInt("FoodID"));
        food.put("name", rs.getString("FoodName"));
        food.put("description", rs.getString("Description"));
        food.put("calories", rs.getObject("Calories") == null ? null : rs.getInt("Calories"));
        food.put("protein", (BigDecimal) rs.getObject("Protein"));
        food.put("carbs", (BigDecimal) rs.getObject("Carbs"));
        food.put("fat", (BigDecimal) rs.getObject("Fat"));
        food.put("imageUrl", rs.getString("ImageUrl"));
        food.put("createdAt", rs.getTimestamp("CreatedAt"));
        return food;
    }

    private static Map<String, Object> mapFoodDetail(ResultSet rs) throws SQLException {
        Map<String, Object> food = mapFoodCatalog(rs);
        food.put("recipe", rs.getString("Recipe"));
        return food;
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

    private static String placeholders(int count) {
        if (count <= 0) return "";
        return String.join(", ", java.util.Collections.nCopies(count, "?"));
    }

    private static int requirePositiveInt(Object value, String message) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        try {
            int parsed = value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value));
            if (parsed <= 0) throw new NumberFormatException("not-positive");
            return parsed;
        } catch (NumberFormatException ignored) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private static int clampInt(Object value, int fallback, int min, int max) {
        int parsed;
        try {
            parsed = value == null ? fallback : (value instanceof Number n ? n.intValue() : Integer.parseInt(String.valueOf(value)));
        } catch (NumberFormatException ignored) {
            parsed = fallback;
        }
        if (parsed < min) return min;
        if (parsed > max) return max;
        return parsed;
    }

    private static List<String> parseGoalCodes(Map<String, Object> payload) {
        Object raw = payload.get("goalCodes");
        List<String> codes = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object item : list) {
                String code = normalizeGoalCode(item);
                if (code != null) codes.add(code);
            }
        } else {
            String code = normalizeGoalCode(payload.getOrDefault("goalCode", payload.get("goal")));
            if (code != null) codes.add(code);
        }
        return codes.stream().distinct().toList();
    }

    private static String normalizeGoalCode(Object value) {
        if (value == null) return null;
        String normalized = String.valueOf(value).trim();
        if (normalized.isEmpty()) return null;
        String upper = normalized.toUpperCase(Locale.ROOT);
        if (upper.equals("LOSE_FAT") || upper.equals("GAIN_MUSCLE") || upper.equals("MAINTAIN")) return upper;
        // lightweight aliases for free-text inputs
        if (upper.contains("LOSE") || upper.contains("FAT") || upper.contains("CUT")) return "LOSE_FAT";
        if (upper.contains("GAIN") || upper.contains("MUSCLE") || upper.contains("BULK")) return "GAIN_MUSCLE";
        if (upper.contains("MAIN")) return "MAINTAIN";
        return null;
    }
}
