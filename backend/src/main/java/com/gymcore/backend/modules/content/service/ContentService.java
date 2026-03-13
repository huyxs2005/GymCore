package com.gymcore.backend.modules.content.service;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ContentService {

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;

    public ContentService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
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
            case "get-customer-goals" -> getCustomerGoals(safePayload);
            case "update-customer-goals" -> updateCustomerGoals(safePayload);
            case "resolve-ai-context" -> buildAiContextPayload(safePayload);
            case "ai-recommendations" -> getAiRecommendations(safePayload);
            case "ai-food-personalized" -> getAiFoodPersonalized(safePayload);
            case "ai-workout-assistant" -> getWorkoutAssistantAnswer(safePayload);
            case "ai-coach-booking-assistant" -> getCoachBookingAssistantAnswer(safePayload);
            default -> throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED,
                    "Unsupported content action: " + action);
        };
    }

    private Map<String, Object> getCustomerGoals(Map<String, Object> payload) {
        int customerId = requireCustomerUserId(payload);
        List<Map<String, Object>> items = loadCustomerGoals(customerId);
        return Map.of(
                "customerId", customerId,
                "items", items,
                "goalCodes", items.stream().map(item -> String.valueOf(item.get("goalCode"))).toList());
    }

    private Map<String, Object> updateCustomerGoals(Map<String, Object> payload) {
        int customerId = requireCustomerUserId(payload);
        List<Integer> goalIds = requireGoalIdList(payload.get("goalIds"));
        validateGoalIds(goalIds, true);

        jdbcTemplate.update("UPDATE dbo.CustomerGoals SET IsActive = 0 WHERE CustomerID = ?", customerId);
        for (Integer goalId : goalIds) {
            int reactivated = jdbcTemplate.update("""
                    UPDATE dbo.CustomerGoals
                    SET IsActive = 1
                    WHERE CustomerID = ?
                      AND GoalID = ?
                    """, customerId, goalId);
            if (reactivated == 0) {
                jdbcTemplate.update("""
                        INSERT INTO dbo.CustomerGoals (CustomerID, GoalID, IsActive)
                        VALUES (?, ?, 1)
                        """, customerId, goalId);
            }
        }

        List<Map<String, Object>> items = loadCustomerGoals(customerId);
        return Map.of(
                "customerId", customerId,
                "items", items,
                "goalCodes", items.stream().map(item -> String.valueOf(item.get("goalCode"))).toList());
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
        AiContextResolution aiContext = resolveAiContext(payload);
        int limitWorkouts = clampInt(payload.get("limitWorkouts"), 6, 1, 24);
        int limitFoods = clampInt(payload.get("limitFoods"), 6, 1, 24);

        List<Map<String, Object>> workouts = recommendWorkouts(aiContext, limitWorkouts);
        List<Map<String, Object>> foods = recommendFoods(aiContext, limitFoods);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("goalCodes", aiContext.goalSelection().goalCodes());
        response.put("source", aiContext.goalSelection().source());
        response.put("workouts", workouts);
        response.put("foods", foods);
        return withAiContext(response, aiContext, "ai-recommendations");
    }

    private Map<String, Object> getWorkoutAssistantAnswer(Map<String, Object> payload) {
        AiContextResolution aiContext = resolveAiContext(payload);
        int limit = clampInt(payload.get("limitWorkouts"), 4, 1, 8);
        List<Map<String, Object>> workouts = recommendWorkouts(aiContext, limit);
        String question = normalizeText(payload.get("question"));

        List<String> lines = new ArrayList<>();
        if (aiContext.goalSelection().goalCodes().isEmpty()) {
            lines.add("Chua co fitness goal nao duoc chon, nen toi de xuat workout theo noi dung moi nhat.");
        } else {
            lines.add("Workout goi y duoc loc theo goals: "
                    + String.join(", ", aiContext.goalSelection().goalCodes()) + ".");
        }
        String latestProgressSummary = normalizeText(aiContext.latestProgressSignal().get("summary"));
        if (StringUtils.hasText(latestProgressSummary) && !latestProgressSummary.startsWith("No ")) {
            lines.add("Tin hieu progress gan nhat: " + latestProgressSummary + ".");
        }
        String latestNoteSummary = normalizeText(aiContext.latestNoteSignal().get("summary"));
        if (StringUtils.hasText(latestNoteSummary) && !latestNoteSummary.startsWith("No ")) {
            lines.add("Coach note gan nhat: " + latestNoteSummary + ".");
        }
        if (StringUtils.hasText(question)) {
            lines.add("Cau hoi cua ban: " + question + ".");
        }
        if (workouts.isEmpty()) {
            lines.add("Hien chua tim thay workout phu hop trong database.");
        } else {
            lines.add("Nen uu tien cac bai sau:");
            for (Map<String, Object> workout : workouts) {
                String difficulty = normalizeText(workout.get("difficulty"));
                lines.add("- " + workout.get("name") + (difficulty == null ? "" : " (" + difficulty + ")"));
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("answer", String.join("\n", lines));
        response.put("goalCodes", aiContext.goalSelection().goalCodes());
        response.put("source", aiContext.goalSelection().source());
        response.put("workouts", workouts);
        return withAiContext(response, aiContext, "ai-workout-assistant");
    }

    private Map<String, Object> getCoachBookingAssistantAnswer(Map<String, Object> payload) {
        List<String> preferences = parseStringList(payload.get("preferences"));
        String question = normalizeText(payload.get("question"));
        String preferredTime = normalizeText(payload.get("preferredTime"));
        String preferredGender = normalizeText(payload.get("preferredGender"));
        AiContextResolution aiContext = resolveAiContext(payload);

        List<String> advice = new ArrayList<>();
        advice.add("De tang ti le match coach, hay chon nhieu slot lap lai theo tuan va giu start date cach it nhat 7 ngay.");
        if (!aiContext.goalSelection().goalCodes().isEmpty()) {
            advice.add("Goals dang ap dung: " + String.join(", ", aiContext.goalSelection().goalCodes()) + ".");
        }
        String latestProgressSummary = normalizeText(aiContext.latestProgressSignal().get("summary"));
        if (StringUtils.hasText(latestProgressSummary) && !latestProgressSummary.startsWith("No ")) {
            advice.add("Progress gan nhat: " + latestProgressSummary + ".");
        }
        if (StringUtils.hasText(preferredTime)) {
            advice.add("Khung gio uu tien: " + preferredTime + ".");
        }
        if (StringUtils.hasText(preferredGender)) {
            advice.add("Gioi tinh coach uu tien: " + preferredGender + ".");
        }
        if (!preferences.isEmpty()) {
            advice.add("Ghi chu them: " + String.join(", ", preferences) + ".");
        }
        if (StringUtils.hasText(question)) {
            advice.add("Ban co the dung man Coach Booking de preview matched coaches truoc khi gui request.");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("answer", String.join("\n", advice));
        response.put("goalCodes", aiContext.goalSelection().goalCodes());
        response.put("source", aiContext.goalSelection().source());
        response.put("nextStep", "/customer/coach-booking");
        return withAiContext(response, aiContext, "ai-coach-booking-assistant");
    }

    private Map<String, Object> getAiFoodPersonalized(Map<String, Object> payload) {
        AiContextResolution aiContext = resolveAiContext(payload);
        int limit = clampInt(payload.get("limitFoods"), 6, 1, 12);
        List<String> tags = mergePersonalizedFoodTags(parseStringList(payload.get("tags")), aiContext);
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
        return withAiContext(response, aiContext, "ai-food-personalized");
    }

    private List<Map<String, Object>> recommendWorkouts(AiContextResolution aiContext, int limit) {
        List<String> goalCodes = aiContext.goalSelection().goalCodes();
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
        return applyWorkoutContextSignals(workouts, aiContext, limit);
    }

    private List<Map<String, Object>> recommendFoods(AiContextResolution aiContext, int limit) {
        List<String> goalCodes = aiContext.goalSelection().goalCodes();
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
        return applyFoodContextSignals(foods, aiContext, limit);
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

    private List<Map<String, Object>> loadCustomerGoals(int customerId) {
        return jdbcTemplate.query("""
                SELECT g.GoalID,
                       g.GoalCode,
                       g.GoalName,
                       g.Description
                FROM dbo.CustomerGoals cg
                JOIN dbo.FitnessGoals g ON g.GoalID = cg.GoalID
                WHERE cg.CustomerID = ?
                  AND cg.IsActive = 1
                  AND g.IsActive = 1
                ORDER BY g.GoalName
                """, (rs, rowNum) -> {
            Map<String, Object> goal = new LinkedHashMap<>();
            goal.put("goalId", rs.getInt("GoalID"));
            goal.put("goalCode", rs.getString("GoalCode"));
            goal.put("name", rs.getString("GoalName"));
            goal.put("description", rs.getString("Description"));
            return goal;
        }, customerId);
    }

    private Map<String, Object> loadCustomerHealthCurrent(int customerId) {
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT HeightCm, WeightKg, BMI, UpdatedAt
                    FROM dbo.CustomerHealthCurrent
                    WHERE CustomerID = ?
                    """, (rs, rowNum) -> {
                Map<String, Object> health = new LinkedHashMap<>();
                health.put("heightCm", rs.getBigDecimal("HeightCm"));
                health.put("weightKg", rs.getBigDecimal("WeightKg"));
                health.put("bmi", rs.getBigDecimal("BMI"));
                health.put("updatedAt", timestampToIso(rs.getTimestamp("UpdatedAt")));
                return health;
            }, customerId);
        } catch (EmptyResultDataAccessException exception) {
            return Map.of();
        }
    }

    private List<Map<String, Object>> loadCustomerHealthHistory(int customerId) {
        return jdbcTemplate.query("""
                SELECT TOP (100)
                    HeightCm, WeightKg, BMI, RecordedAt
                FROM dbo.CustomerHealthHistory
                WHERE CustomerID = ?
                ORDER BY RecordedAt DESC
                """, (rs, rowNum) -> {
            Map<String, Object> health = new LinkedHashMap<>();
            health.put("heightCm", rs.getBigDecimal("HeightCm"));
            health.put("weightKg", rs.getBigDecimal("WeightKg"));
            health.put("bmi", rs.getBigDecimal("BMI"));
            health.put("recordedAt", timestampToIso(rs.getTimestamp("RecordedAt")));
            return health;
        }, customerId);
    }

    private List<Map<String, Object>> loadCustomerCoachNotes(int customerId) {
        return jdbcTemplate.query("""
                SELECT TOP (50)
                    n.PTSessionNoteID,
                    n.NoteContent,
                    n.CreatedAt,
                    s.SessionDate,
                    u.FullName AS CoachName
                FROM dbo.PTSessionNotes n
                JOIN dbo.PTSessions s ON s.PTSessionID = n.PTSessionID
                JOIN dbo.Users u ON u.UserID = s.CoachID
                WHERE s.CustomerID = ?
                ORDER BY n.CreatedAt DESC
                """, (rs, rowNum) -> {
            Map<String, Object> note = new LinkedHashMap<>();
            note.put("noteId", rs.getInt("PTSessionNoteID"));
            note.put("noteContent", rs.getString("NoteContent"));
            note.put("createdAt", timestampToIso(rs.getTimestamp("CreatedAt")));
            note.put("sessionDate", rs.getDate("SessionDate") == null
                    ? null
                    : rs.getDate("SessionDate").toLocalDate().toString());
            note.put("coachName", rs.getString("CoachName"));
            return note;
        }, customerId);
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
        return String.join(", ", Collections.nCopies(count, "?"));
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

    private int requireCustomerUserId(Map<String, Object> payload) {
        String authorizationHeader = normalizeText(payload.get("authorizationHeader"));
        return currentUserService.requireCustomer(authorizationHeader).userId();
    }

    private GoalSelection resolveGoalSelection(Map<String, Object> payload) {
        List<String> requestGoals = parseGoalCodes(payload);
        if (!requestGoals.isEmpty()) {
            return new GoalSelection(requestGoals, "REQUEST");
        }

        String authorizationHeader = normalizeText(payload.get("authorizationHeader"));
        if (authorizationHeader != null) {
            return currentUserService.findUser(authorizationHeader)
                    .filter(user -> "CUSTOMER".equals(user.roleApiName()))
                    .map(user -> {
                        List<String> savedGoalCodes = loadCustomerGoals(user.userId()).stream()
                                .map(item -> String.valueOf(item.get("goalCode")))
                                .distinct()
                                .toList();
                        return new GoalSelection(savedGoalCodes, savedGoalCodes.isEmpty() ? "NONE" : "SAVED_PROFILE");
                    })
                    .orElseGet(() -> new GoalSelection(List.of(), "NONE"));
        }
        return new GoalSelection(List.of(), "NONE");
    }

    private AiContextResolution resolveAiContext(Map<String, Object> payload) {
        List<String> requestGoalCodes = parseGoalCodes(payload);
        String authorizationHeader = normalizeText(payload.get("authorizationHeader"));
        CurrentUserService.UserInfo user = currentUserService.findUser(authorizationHeader)
                .filter(found -> "CUSTOMER".equals(found.roleApiName()))
                .orElse(null);

        Integer customerId = user == null ? null : user.userId();
        List<Map<String, Object>> savedGoals = customerId == null ? List.of() : loadCustomerGoals(customerId);
        List<String> savedGoalCodes = savedGoals.stream()
                .map(item -> String.valueOf(item.get("goalCode")))
                .distinct()
                .toList();
        GoalSelection goalSelection = !requestGoalCodes.isEmpty()
                ? new GoalSelection(requestGoalCodes, "REQUEST")
                : savedGoalCodes.isEmpty()
                        ? new GoalSelection(List.of(), "NONE")
                        : new GoalSelection(savedGoalCodes, "SAVED_PROFILE");

        Map<String, Object> currentHealth = customerId == null ? Map.of() : loadCustomerHealthCurrent(customerId);
        List<Map<String, Object>> healthHistoryItems = customerId == null ? List.of() : loadCustomerHealthHistory(customerId);
        List<Map<String, Object>> coachNoteItems = customerId == null ? List.of() : loadCustomerCoachNotes(customerId);

        Map<String, Object> latestProgressSignal = buildLatestProgressSignal(currentHealth, healthHistoryItems);
        Map<String, Object> latestNoteSignal = buildLatestNoteSignal(
                coachNoteItems.isEmpty() ? Map.of() : coachNoteItems.get(0));
        Map<String, Object> mostRecentSignal = selectLatestSignal(latestNoteSignal, latestProgressSignal);

        Map<String, Object> historySummary = new LinkedHashMap<>();
        historySummary.put("totalRecords", healthHistoryItems.size());
        historySummary.put("latestRecordedAt", firstItemValue(healthHistoryItems, "recordedAt"));
        historySummary.put("latestWeightKg", firstItemValue(healthHistoryItems, "weightKg"));
        historySummary.put("latestBmi", firstItemValue(healthHistoryItems, "bmi"));

        Map<String, Object> aiContext = new LinkedHashMap<>();
        aiContext.put("contractVersion", "ai-context.v1");
        aiContext.put("customerId", customerId);
        aiContext.put("goals", Map.of(
                "requestedGoalCodes", requestGoalCodes,
                "savedGoalCodes", savedGoalCodes,
                "effectiveGoalCodes", goalSelection.goalCodes(),
                "items", savedGoals,
                "source", goalSelection.source()));
        aiContext.put("health", Map.of(
                "currentSnapshot", currentHealth,
                "historySummary", historySummary,
                "history", Map.of("items", healthHistoryItems)));
        aiContext.put("progress", Map.of(
                "latestProgressSignal", latestProgressSignal,
                "latestNoteSignal", latestNoteSignal,
                "latestSignals", Map.of(
                        "latestNote", latestNoteSignal,
                        "latestProgress", latestProgressSignal,
                        "mostRecent", mostRecentSignal),
                "recentCoachNotes", Map.of("items", coachNoteItems)));

        List<String> usedSignals = new ArrayList<>();
        if (!goalSelection.goalCodes().isEmpty()) {
            usedSignals.add("goals");
        }
        if (!currentHealth.isEmpty() || !healthHistoryItems.isEmpty()) {
            usedSignals.add("health");
        }
        if (hasSignal(latestProgressSignal) || hasSignal(latestNoteSignal)) {
            usedSignals.add("progress");
        }

        List<String> missingSignals = new ArrayList<>();
        if (goalSelection.goalCodes().isEmpty()) {
            missingSignals.add("goals");
        }
        if (currentHealth.isEmpty() && healthHistoryItems.isEmpty()) {
            missingSignals.add("health");
        }
        if (!hasSignal(latestProgressSignal) && !hasSignal(latestNoteSignal)) {
            missingSignals.add("progress");
        }

        List<String> fallbackSignals = new ArrayList<>();
        if ("REQUEST".equals(goalSelection.source())) {
            fallbackSignals.add("goals");
        }
        if (customerId == null) {
            fallbackSignals.add("health");
            fallbackSignals.add("progress");
        }

        Map<String, Object> contextMeta = new LinkedHashMap<>();
        contextMeta.put("contractVersion", "ai-context.v1");
        contextMeta.put("goalSource", goalSelection.source());
        contextMeta.put("usedSignals", usedSignals);
        contextMeta.put("missingSignals", missingSignals);
        contextMeta.put("fallbackSignals", fallbackSignals.stream().distinct().toList());
        contextMeta.put("fallbackUsed", !fallbackSignals.isEmpty());
        contextMeta.put("signalSources", Map.of(
                "goals", "REQUEST".equals(goalSelection.source()) ? "request.goalCodes" : "dbo.CustomerGoals",
                "health", "phase-07.progress-hub.currentSnapshot",
                "progress", "phase-07.progress-hub.latestSignals"));
        contextMeta.put("signals", List.of(
                explainabilitySignal(
                        "goals",
                        !goalSelection.goalCodes().isEmpty(),
                        "REQUEST".equals(goalSelection.source()) ? "request.goalCodes" : "dbo.CustomerGoals",
                        "REQUEST".equals(goalSelection.source()),
                        goalSelection.goalCodes().isEmpty()
                                ? "No fitness goals available."
                                : "Using goals: " + String.join(", ", goalSelection.goalCodes()) + "."),
                explainabilitySignal(
                        "health",
                        !currentHealth.isEmpty() || !healthHistoryItems.isEmpty(),
                        "phase-07.progress-hub.currentSnapshot",
                        customerId == null,
                        currentHealth.isEmpty()
                                ? "No current health snapshot available."
                                : buildHealthSummary(currentHealth)),
                explainabilitySignal(
                        "progress",
                        hasSignal(latestProgressSignal) || hasSignal(latestNoteSignal),
                        "phase-07.progress-hub.latestSignals",
                        customerId == null,
                        normalizeText(mostRecentSignal.get("summary")) == null
                                ? "No progress signal recorded yet."
                                : String.valueOf(mostRecentSignal.get("summary")))));
        contextMeta.put("signalStatus", Map.of(
                "goalCount", goalSelection.goalCodes().size(),
                "hasCurrentHealth", !currentHealth.isEmpty(),
                "healthHistoryCount", healthHistoryItems.size(),
                "coachNoteCount", coachNoteItems.size()));

        return new AiContextResolution(
                goalSelection,
                latestProgressSignal,
                latestNoteSignal,
                aiContext,
                contextMeta);
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

    private void validateGoalIds(List<Integer> goalIds, boolean activeOnly) {
        if (goalIds.isEmpty()) {
            return;
        }
        String placeholders = placeholders(goalIds.size());
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.FitnessGoals
                WHERE GoalID IN (%s)
                  AND ((? = 0) OR IsActive = 1)
                """.formatted(placeholders), Integer.class, appendArgs(goalIds.toArray(), activeOnly ? 1 : 0));
        if (count == null || count != goalIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more fitness goals are invalid.");
        }
    }

    private static Object[] appendArgs(Object[] values, Object lastValue) {
        Object[] args = new Object[values.length + 1];
        System.arraycopy(values, 0, args, 0, values.length);
        args[values.length] = lastValue;
        return args;
    }

    private static List<Integer> requireGoalIdList(Object raw) {
        if (!(raw instanceof List<?> list)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "goalIds is required.");
        }
        List<Integer> ids = new ArrayList<>();
        for (Object item : list) {
            ids.add(requirePositiveInt(item, "Goal IDs must be positive integers."));
        }
        return ids.stream().distinct().toList();
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

    private List<String> mergePersonalizedFoodTags(List<String> tags, AiContextResolution aiContext) {
        LinkedHashSet<String> merged = new LinkedHashSet<>(tags);
        if (merged.isEmpty() && aiContext.goalSelection().goalCodes().contains("LOSE_FAT")) {
            merged.add("HIGH_PROTEIN");
            merged.add("LOW_CALORIE");
        }
        if (merged.isEmpty() && aiContext.goalSelection().goalCodes().contains("GAIN_MUSCLE")) {
            merged.add("HIGH_PROTEIN");
            merged.add("HIGH_CARB");
        }
        if (merged.isEmpty() && hasSignal(aiContext.latestProgressSignal())) {
            Object bmi = aiContext.latestProgressSignal().get("bmi");
            if (decimalOrZero(bmi) >= 27d) {
                merged.add("HIGH_PROTEIN");
                merged.add("LOW_CALORIE");
            }
        }
        return List.copyOf(merged);
    }

    private List<Map<String, Object>> applyWorkoutContextSignals(
            List<Map<String, Object>> workouts,
            AiContextResolution aiContext,
            int limit) {
        List<Map<String, Object>> scored = new ArrayList<>();
        for (Map<String, Object> workout : workouts) {
            Map<String, Object> copy = new LinkedHashMap<>(workout);
            ScoreResult scoreResult = scoreWorkout(copy, aiContext);
            copy.put("contextScore", scoreResult.score());
            copy.put("contextReasons", scoreResult.reasons());
            scored.add(copy);
        }
        scored.sort((left, right) -> Integer.compare(
                intOrZero(right.get("contextScore")),
                intOrZero(left.get("contextScore"))));
        return scored.size() > limit ? new ArrayList<>(scored.subList(0, limit)) : scored;
    }

    private List<Map<String, Object>> applyFoodContextSignals(
            List<Map<String, Object>> foods,
            AiContextResolution aiContext,
            int limit) {
        List<Map<String, Object>> scored = new ArrayList<>();
        for (Map<String, Object> food : foods) {
            Map<String, Object> copy = new LinkedHashMap<>(food);
            ScoreResult scoreResult = scoreFoodForContext(copy, aiContext);
            copy.put("contextScore", scoreResult.score());
            copy.put("contextReasons", scoreResult.reasons());
            scored.add(copy);
        }
        scored.sort((left, right) -> Integer.compare(
                intOrZero(right.get("contextScore")),
                intOrZero(left.get("contextScore"))));
        return scored.size() > limit ? new ArrayList<>(scored.subList(0, limit)) : scored;
    }

    private Map<String, Object> buildAiContextPayload(Map<String, Object> payload) {
        AiContextResolution aiContext = resolveAiContext(payload);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("aiContext", aiContext.aiContext());
        response.put("contextMeta", withEntryPoint(aiContext.contextMeta(), "resolve-ai-context"));
        return response;
    }

    private Map<String, Object> withAiContext(
            Map<String, Object> response,
            AiContextResolution aiContext,
            String entryPoint) {
        response.put("aiContext", aiContext.aiContext());
        response.put("contextMeta", withEntryPoint(aiContext.contextMeta(), entryPoint));
        return response;
    }

    private Map<String, Object> withEntryPoint(Map<String, Object> contextMeta, String entryPoint) {
        Map<String, Object> normalized = new LinkedHashMap<>(contextMeta);
        normalized.put("entryPoint", entryPoint);
        return normalized;
    }

    private static Map<String, Object> explainabilitySignal(
            String signal,
            boolean used,
            String source,
            boolean fallback,
            String summary) {
        Map<String, Object> explainability = new LinkedHashMap<>();
        explainability.put("signal", signal);
        explainability.put("used", used);
        explainability.put("source", source);
        explainability.put("fallback", fallback);
        explainability.put("summary", summary);
        return explainability;
    }

    private Map<String, Object> buildLatestProgressSignal(
            Map<String, Object> currentHealth,
            List<Map<String, Object>> historyItems) {
        Map<String, Object> source = currentHealth.isEmpty()
                ? (historyItems.isEmpty() ? Map.of() : historyItems.get(0))
                : currentHealth;
        if (source.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("sourceType", "HEALTH_SNAPSHOT");
            empty.put("recordedAt", null);
            empty.put("summary", "No progress signal recorded yet.");
            empty.put("heightCm", null);
            empty.put("weightKg", null);
            empty.put("bmi", null);
            return empty;
        }

        Map<String, Object> signal = new LinkedHashMap<>();
        signal.put("sourceType", "HEALTH_SNAPSHOT");
        signal.put("recordedAt", firstNonBlank(
                normalizeText(source.get("updatedAt")),
                normalizeText(source.get("recordedAt"))));
        signal.put("summary", buildHealthSummary(currentHealth.isEmpty() ? source : currentHealth));
        signal.put("heightCm", source.get("heightCm"));
        signal.put("weightKg", source.get("weightKg"));
        signal.put("bmi", source.get("bmi"));
        return signal;
    }

    private Map<String, Object> buildLatestNoteSignal(Map<String, Object> latestCoachNote) {
        if (latestCoachNote.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("sourceType", "COACH_NOTE");
            empty.put("recordedAt", null);
            empty.put("summary", "No coaching signal recorded yet.");
            empty.put("coachName", null);
            empty.put("sessionDate", null);
            empty.put("noteId", null);
            return empty;
        }

        Map<String, Object> signal = new LinkedHashMap<>();
        signal.put("sourceType", "COACH_NOTE");
        signal.put("recordedAt", latestCoachNote.get("createdAt"));
        signal.put("summary", latestCoachNote.get("noteContent"));
        signal.put("coachName", latestCoachNote.get("coachName"));
        signal.put("sessionDate", latestCoachNote.get("sessionDate"));
        signal.put("noteId", latestCoachNote.get("noteId"));
        return signal;
    }

    private Map<String, Object> selectLatestSignal(
            Map<String, Object> latestNoteSignal,
            Map<String, Object> latestProgressSignal) {
        String latestNoteAt = normalizeText(latestNoteSignal.get("recordedAt"));
        String latestProgressAt = normalizeText(latestProgressSignal.get("recordedAt"));
        if (latestNoteAt == null && latestProgressAt == null) {
            return new LinkedHashMap<>(latestProgressSignal);
        }
        if (latestNoteAt != null && (latestProgressAt == null || latestNoteAt.compareTo(latestProgressAt) >= 0)) {
            return new LinkedHashMap<>(latestNoteSignal);
        }
        return new LinkedHashMap<>(latestProgressSignal);
    }

    private static Object firstItemValue(List<Map<String, Object>> items, String key) {
        return items.isEmpty() ? null : items.get(0).get(key);
    }

    private static boolean hasSignal(Map<String, Object> signal) {
        return signal != null && normalizeText(signal.get("recordedAt")) != null;
    }

    private static String buildHealthSummary(Map<String, Object> healthSnapshot) {
        if (healthSnapshot == null || healthSnapshot.isEmpty()) {
            return "No progress signal recorded yet.";
        }
        List<String> parts = new ArrayList<>();
        if (healthSnapshot.get("weightKg") != null) {
            parts.add("weight " + healthSnapshot.get("weightKg") + "kg");
        }
        if (healthSnapshot.get("bmi") != null) {
            parts.add("BMI " + healthSnapshot.get("bmi"));
        }
        if (healthSnapshot.get("heightCm") != null) {
            parts.add("height " + healthSnapshot.get("heightCm") + "cm");
        }
        return parts.isEmpty()
                ? "Current health snapshot available."
                : "Latest health snapshot: " + String.join(", ", parts) + ".";
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private static String timestampToIso(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant().toString();
    }

    private ScoreResult scoreWorkout(Map<String, Object> workout, AiContextResolution aiContext) {
        int score = 1;
        List<String> reasons = new ArrayList<>();
        String text = workoutContextText(workout);

        if (aiContext.goalSelection().goalCodes().contains("GAIN_MUSCLE")
                && containsAny(text, "strength", "muscle", "hypertrophy", "resistance")) {
            score += 4;
            reasons.add("Matches muscle-gain goal.");
        }
        if (aiContext.goalSelection().goalCodes().contains("LOSE_FAT")
                && containsAny(text, "cardio", "hiit", "full body", "conditioning")) {
            score += 4;
            reasons.add("Supports fat-loss goal.");
        }
        if (containsAny(signalText(aiContext), "recovery", "mobility", "rest", "sore", "fatigue")
                && containsAny(text, "mobility", "stretch", "yoga", "recovery", "walk")) {
            score += 3;
            reasons.add("Aligned with recovery-focused progress signals.");
        }
        if (reasons.isEmpty()) {
            reasons.add("Aligned with current AI context.");
        }
        return new ScoreResult(score, reasons);
    }

    private ScoreResult scoreFoodForContext(Map<String, Object> food, AiContextResolution aiContext) {
        int score = 1;
        List<String> reasons = new ArrayList<>();
        double protein = decimalOrZero(food.get("protein"));
        int calories = intOrZero(food.get("calories"));

        if (aiContext.goalSelection().goalCodes().contains("GAIN_MUSCLE") && protein >= 20) {
            score += 4;
            reasons.add("High protein for muscle-gain context.");
        }
        if (aiContext.goalSelection().goalCodes().contains("LOSE_FAT")) {
            if (protein >= 18) {
                score += 3;
                reasons.add("Protein helps preserve lean mass.");
            }
            if (calories > 0 && calories <= 350) {
                score += 2;
                reasons.add("Moderate calories fit fat-loss context.");
            }
        }
        if (hasSignal(aiContext.latestProgressSignal()) && decimalOrZero(aiContext.latestProgressSignal().get("bmi")) >= 27d
                && protein >= 18) {
            score += 2;
            reasons.add("Higher protein supports current health signal.");
        }
        if (reasons.isEmpty()) {
            reasons.add("Aligned with current AI context.");
        }
        return new ScoreResult(score, reasons);
    }

    private static String workoutContextText(Map<String, Object> workout) {
        String categories = "";
        Object rawCategories = workout.get("categories");
        if (rawCategories instanceof List<?> list) {
            categories = list.stream()
                    .filter(Map.class::isInstance)
                    .map(Map.class::cast)
                    .map(category -> String.valueOf(category.getOrDefault("name", "")))
                    .collect(Collectors.joining(" "));
        }
        return (String.valueOf(workout.getOrDefault("name", "")) + " "
                + String.valueOf(workout.getOrDefault("description", "")) + " "
                + String.valueOf(workout.getOrDefault("difficulty", "")) + " "
                + categories).toLowerCase(Locale.ROOT);
    }

    private static String signalText(AiContextResolution aiContext) {
        return (String.valueOf(aiContext.latestProgressSignal().getOrDefault("summary", "")) + " "
                + String.valueOf(aiContext.latestNoteSignal().getOrDefault("summary", "")))
                        .toLowerCase(Locale.ROOT);
    }

    private static boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) {
                return true;
            }
        }
        return false;
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

    private record GoalSelection(List<String> goalCodes, String source) {
    }

    private record AiContextResolution(
            GoalSelection goalSelection,
            Map<String, Object> latestProgressSignal,
            Map<String, Object> latestNoteSignal,
            Map<String, Object> aiContext,
            Map<String, Object> contextMeta) {
    }
}
