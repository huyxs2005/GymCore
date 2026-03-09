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
import org.springframework.util.StringUtils;
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
            case "ai-food-personalized" -> getAiFoodPersonalized(safePayload);
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
        Map<String, Object> workout = new LinkedHashMap<>(rows.get(0));
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
        Map<String, Object> food = new LinkedHashMap<>(rows.get(0));
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

    private Map<String, Object> getAiFoodPersonalized(Map<String, Object> payload) {
        int limit = clampInt(payload.get("limitFoods"), 6, 1, 12);
        List<String> tags = parseStringList(payload.get("tags"));
        Map<String, Object> answers = payload.get("answers") instanceof Map<?, ?> rawAnswers
                ? rawAnswers.entrySet().stream()
                        .collect(Collectors.toMap(
                                entry -> String.valueOf(entry.getKey()),
                                Map.Entry::getValue,
                                (a, b) -> a,
                                LinkedHashMap::new))
                : Map.of();

        String goal = normalizeText(answers.get("goal"));
        String mealTime = normalizeText(answers.get("mealTime"));
        String avoid = normalizeText(answers.get("avoid"));

        List<Map<String, Object>> baseFoods = loadLatestFoods(200);
        Map<Integer, List<Map<String, Object>>> categoryMap = loadFoodCategoryMapByFoodIds(extractIds(baseFoods, "foodId"));

        List<Map<String, Object>> scored = new ArrayList<>();
        for (Map<String, Object> row : baseFoods) {
            Map<String, Object> food = new LinkedHashMap<>(row);
            int foodId = ((Number) food.get("foodId")).intValue();
            List<Map<String, Object>> categories = categoryMap.getOrDefault(foodId, List.of());
            food.put("categories", categories);

            ScoreResult result = scoreFood(food, categories, tags, goal, mealTime, avoid);
            if (result.score() <= 0) continue;
            food.put("matchScore", result.score());
            food.put("matchReasons", result.reasons());
            scored.add(food);
        }

        scored.sort((a, b) -> Integer.compare(
                ((Number) b.getOrDefault("matchScore", 0)).intValue(),
                ((Number) a.getOrDefault("matchScore", 0)).intValue()));
        if (scored.size() > limit) {
            scored = new ArrayList<>(scored.subList(0, limit));
        }

        List<Map<String, Object>> followUpQuestions = new ArrayList<>();
        if (!StringUtils.hasText(goal)) {
            followUpQuestions.add(Map.of(
                    "id", "goal",
                    "question", "Muc tieu cua ban la gi? (giam mo / tang co / giu dang)"));
        }
        if (!StringUtils.hasText(mealTime)) {
            followUpQuestions.add(Map.of(
                    "id", "mealTime",
                    "question", "Ban muon goi y cho bua nao? (truoc tap / sau tap / bua chinh)"));
        }

        String summary = buildPersonalizedSummary(tags, goal, mealTime, avoid, scored.size());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tags", tags);
        response.put("answers", answers);
        response.put("summary", summary);
        response.put("followUpQuestions", followUpQuestions);
        response.put("foods", scored);
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

    private static List<String> parseStringList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        List<String> output = new ArrayList<>();
        for (Object item : list) {
            String normalized = normalizeText(item);
            if (normalized != null) {
                output.add(normalized);
            }
        }
        return output.stream().distinct().toList();
    }

    private static String normalizeText(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static double decimalOrZero(Object value) {
        if (value instanceof BigDecimal decimal) return decimal.doubleValue();
        if (value instanceof Number number) return number.doubleValue();
        try {
            return value == null ? 0d : Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return 0d;
        }
    }

    private static int intOrZero(Object value) {
        if (value instanceof Number number) return number.intValue();
        try {
            return value == null ? 0 : Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static ScoreResult scoreFood(
            Map<String, Object> food,
            List<Map<String, Object>> categories,
            List<String> tags,
            String goal,
            String mealTime,
            String avoid) {
        int score = 1;
        List<String> reasons = new ArrayList<>();
        double protein = decimalOrZero(food.get("protein"));
        double carbs = decimalOrZero(food.get("carbs"));
        double fat = decimalOrZero(food.get("fat"));
        int calories = intOrZero(food.get("calories"));

        String categoryText = categories.stream()
                .map(category -> String.valueOf(category.getOrDefault("name", "")))
                .collect(Collectors.joining(" "))
                .toLowerCase(Locale.ROOT);
        String foodText = (String.valueOf(food.getOrDefault("name", "")) + " "
                + String.valueOf(food.getOrDefault("description", "")) + " "
                + categoryText).toLowerCase(Locale.ROOT);

        for (String rawTag : tags) {
            String tag = rawTag.toUpperCase(Locale.ROOT);
            switch (tag) {
                case "HIGH_PROTEIN" -> {
                    if (protein >= 20) {
                        score += 4;
                        reasons.add("Dam cao (>=20g)");
                    } else if (protein >= 12) {
                        score += 2;
                        reasons.add("Dam kha tot");
                    }
                }
                case "LOW_CARB" -> {
                    if (carbs <= 18) {
                        score += 3;
                        reasons.add("Carb thap");
                    }
                }
                case "HIGH_CARB" -> {
                    if (carbs >= 30) {
                        score += 3;
                        reasons.add("Carb cao phu hop nap nang luong");
                    }
                }
                case "LOW_FAT" -> {
                    if (fat <= 10) {
                        score += 3;
                        reasons.add("Chat beo thap");
                    }
                }
                case "LOW_CALORIE" -> {
                    if (calories > 0 && calories <= 350) {
                        score += 3;
                        reasons.add("Calo vua phai");
                    }
                }
                case "BALANCED" -> {
                    if (protein >= 15 && carbs >= 15 && carbs <= 55 && fat <= 20) {
                        score += 3;
                        reasons.add("Macro can bang");
                    }
                }
                default -> {
                }
            }
        }

        String lowerGoal = goal == null ? "" : goal.toLowerCase(Locale.ROOT);
        if (lowerGoal.contains("giam") || lowerGoal.contains("mo") || lowerGoal.contains("cut")) {
            if (protein >= 20) score += 3;
            if (calories > 0 && calories <= 350) score += 2;
            if (fat <= 12) score += 1;
        } else if (lowerGoal.contains("tang") || lowerGoal.contains("co") || lowerGoal.contains("bulk")) {
            if (protein >= 25) score += 3;
            if (carbs >= 30) score += 2;
            if (calories >= 350) score += 1;
        } else if (lowerGoal.contains("giu")) {
            if (protein >= 18) score += 2;
            if (calories >= 250 && calories <= 500) score += 2;
        }

        String lowerMealTime = mealTime == null ? "" : mealTime.toLowerCase(Locale.ROOT);
        if (lowerMealTime.contains("truoc")) {
            if (carbs >= 20 && fat <= 12) score += 2;
        } else if (lowerMealTime.contains("sau")) {
            if (protein >= 22) score += 3;
            if (fat <= 15) score += 1;
        }

        if (StringUtils.hasText(avoid)) {
            String[] tokens = avoid.toLowerCase(Locale.ROOT).split("[,;/\\s]+");
            for (String token : tokens) {
                if (token.length() < 2) continue;
                if (foodText.contains(token)) {
                    score -= 6;
                    reasons.add("Co nguyen lieu ban muon tranh: " + token);
                    break;
                }
            }
        }

        if (reasons.isEmpty()) {
            reasons.add("Phu hop thong tin da chon");
        }
        return new ScoreResult(score, reasons);
    }

    private static String buildPersonalizedSummary(
            List<String> tags,
            String goal,
            String mealTime,
            String avoid,
            int count) {
        StringBuilder sb = new StringBuilder("Da loc ").append(count).append(" mon theo tieu chi cua ban");
        if (!tags.isEmpty()) {
            sb.append(" | tags: ").append(String.join(", ", tags));
        }
        if (StringUtils.hasText(goal)) {
            sb.append(" | muc tieu: ").append(goal);
        }
        if (StringUtils.hasText(mealTime)) {
            sb.append(" | bua: ").append(mealTime);
        }
        if (StringUtils.hasText(avoid)) {
            sb.append(" | tranh: ").append(avoid);
        }
        sb.append(".");
        return sb.toString();
    }

    private record ScoreResult(int score, List<String> reasons) {
    }
}
