package com.gymcore.backend.modules.content.service;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.math.BigDecimal;
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
public class ContentAdminService {

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;

    public ContentAdminService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
    }

    public Map<String, Object> getWorkouts(String authorizationHeader) {
        currentUserService.requireAdmin(authorizationHeader);
        List<Map<String, Object>> workouts = jdbcTemplate.query("""
                SELECT w.WorkoutID,
                       w.WorkoutName,
                       w.Description,
                       w.Instructions,
                       w.ImageUrl,
                       w.VideoUrl,
                       w.Difficulty,
                       w.IsActive,
                       w.CreatedAt
                FROM dbo.Workouts w
                ORDER BY w.CreatedAt DESC, w.WorkoutName
                """, (rs, rowNum) -> mapWorkoutAdmin(rs));

        Map<Integer, List<Map<String, Object>>> categoryMap =
                loadWorkoutCategoryMapByWorkoutIds(extractIds(workouts, "workoutId"));
        for (Map<String, Object> workout : workouts) {
            int workoutId = ((Number) workout.get("workoutId")).intValue();
            workout.put("categories", categoryMap.getOrDefault(workoutId, List.of()));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", workouts);
        response.put("categories", loadWorkoutCategories(true));
        return response;
    }

    public Map<String, Object> createWorkout(String authorizationHeader, Map<String, Object> payload) {
        currentUserService.requireAdmin(authorizationHeader);
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;

        String name = requireNonBlankString(safePayload.get("name"), "Workout name is required.");
        String instructions = requireNonBlankString(safePayload.get("instructions"), "Workout instructions are required.");
        String description = trimToNull(safePayload.get("description"));
        String imageUrl = trimToNull(safePayload.get("imageUrl"));
        String videoUrl = trimToNull(safePayload.get("videoUrl"));
        String difficulty = trimToNull(safePayload.get("difficulty"));
        boolean active = safePayload.get("active") == null || Boolean.TRUE.equals(toBoolean(safePayload.get("active")));

        List<Integer> categoryIds = requireIdList(safePayload.get("categoryIds"), "Select at least one workout category.");
        validateWorkoutCategoryIds(categoryIds);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("""
                    INSERT INTO dbo.Workouts (WorkoutName, Description, Instructions, ImageUrl, VideoUrl, Difficulty, IsActive)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, new String[] { "WorkoutID" });
            ps.setString(1, name);
            ps.setString(2, description);
            ps.setString(3, instructions);
            ps.setString(4, imageUrl);
            ps.setString(5, videoUrl);
            ps.setString(6, difficulty);
            ps.setBoolean(7, active);
            return ps;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not create workout.");
        }
        int workoutId = key.intValue();
        upsertWorkoutCategoryMap(workoutId, categoryIds);

        return getWorkoutDetailInternal(workoutId);
    }

    public Map<String, Object> updateWorkout(String authorizationHeader, int workoutId, Map<String, Object> payload) {
        currentUserService.requireAdmin(authorizationHeader);
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;

        String name = requireNonBlankString(safePayload.get("name"), "Workout name is required.");
        String instructions = requireNonBlankString(safePayload.get("instructions"), "Workout instructions are required.");
        String description = trimToNull(safePayload.get("description"));
        String imageUrl = trimToNull(safePayload.get("imageUrl"));
        String videoUrl = trimToNull(safePayload.get("videoUrl"));
        String difficulty = trimToNull(safePayload.get("difficulty"));
        boolean active = safePayload.get("active") == null || Boolean.TRUE.equals(toBoolean(safePayload.get("active")));

        List<Integer> categoryIds = requireIdList(safePayload.get("categoryIds"), "Select at least one workout category.");
        validateWorkoutCategoryIds(categoryIds);

        int updated = jdbcTemplate.update("""
                UPDATE dbo.Workouts
                SET WorkoutName = ?,
                    Description = ?,
                    Instructions = ?,
                    ImageUrl = ?,
                    VideoUrl = ?,
                    Difficulty = ?,
                    IsActive = ?
                WHERE WorkoutID = ?
                """, name, description, instructions, imageUrl, videoUrl, difficulty, active, workoutId);

        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found.");
        }

        upsertWorkoutCategoryMap(workoutId, categoryIds);
        return getWorkoutDetailInternal(workoutId);
    }

    public Map<String, Object> archiveWorkout(String authorizationHeader, int workoutId) {
        currentUserService.requireAdmin(authorizationHeader);
        int updated = jdbcTemplate.update("UPDATE dbo.Workouts SET IsActive = 0 WHERE WorkoutID = ?", workoutId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found.");
        }
        return Map.of("workoutId", workoutId, "active", false);
    }

    public Map<String, Object> restoreWorkout(String authorizationHeader, int workoutId) {
        currentUserService.requireAdmin(authorizationHeader);
        int updated = jdbcTemplate.update("UPDATE dbo.Workouts SET IsActive = 1 WHERE WorkoutID = ?", workoutId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found.");
        }
        return Map.of("workoutId", workoutId, "active", true);
    }

    public Map<String, Object> getFoods(String authorizationHeader) {
        currentUserService.requireAdmin(authorizationHeader);
        List<Map<String, Object>> foods = jdbcTemplate.query("""
                SELECT f.FoodID,
                       f.FoodName,
                       f.Description,
                       f.Recipe,
                       f.Calories,
                       f.Protein,
                       f.Carbs,
                       f.Fat,
                       f.ImageUrl,
                       f.IsActive,
                       f.CreatedAt
                FROM dbo.Foods f
                ORDER BY f.CreatedAt DESC, f.FoodName
                """, (rs, rowNum) -> mapFoodAdmin(rs));

        Map<Integer, List<Map<String, Object>>> categoryMap =
                loadFoodCategoryMapByFoodIds(extractIds(foods, "foodId"));
        for (Map<String, Object> food : foods) {
            int foodId = ((Number) food.get("foodId")).intValue();
            food.put("categories", categoryMap.getOrDefault(foodId, List.of()));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", foods);
        response.put("categories", loadFoodCategories(true));
        return response;
    }

    public Map<String, Object> createFood(String authorizationHeader, Map<String, Object> payload) {
        currentUserService.requireAdmin(authorizationHeader);
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;

        String name = requireNonBlankString(safePayload.get("name"), "Food name is required.");
        String description = trimToNull(safePayload.get("description"));
        String recipe = trimToNull(safePayload.get("recipe"));
        Integer calories = optionalNonNegativeInt(safePayload.get("calories"), "Calories must be a non-negative integer.");
        BigDecimal protein = optionalNonNegativeDecimal(safePayload.get("protein"), "Protein must be a non-negative number.");
        BigDecimal carbs = optionalNonNegativeDecimal(safePayload.get("carbs"), "Carbs must be a non-negative number.");
        BigDecimal fat = optionalNonNegativeDecimal(safePayload.get("fat"), "Fat must be a non-negative number.");
        String imageUrl = trimToNull(safePayload.get("imageUrl"));
        boolean active = safePayload.get("active") == null || Boolean.TRUE.equals(toBoolean(safePayload.get("active")));

        List<Integer> categoryIds = requireIdList(safePayload.get("categoryIds"), "Select at least one food category.");
        validateFoodCategoryIds(categoryIds);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("""
                    INSERT INTO dbo.Foods (FoodName, Description, Recipe, Calories, Protein, Carbs, Fat, ImageUrl, IsActive)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, new String[] { "FoodID" });
            ps.setString(1, name);
            ps.setString(2, description);
            ps.setString(3, recipe);
            if (calories == null) {
                ps.setObject(4, null);
            } else {
                ps.setInt(4, calories);
            }
            ps.setObject(5, protein);
            ps.setObject(6, carbs);
            ps.setObject(7, fat);
            ps.setString(8, imageUrl);
            ps.setBoolean(9, active);
            return ps;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not create food.");
        }
        int foodId = key.intValue();
        upsertFoodCategoryMap(foodId, categoryIds);

        return getFoodDetailInternal(foodId);
    }

    public Map<String, Object> updateFood(String authorizationHeader, int foodId, Map<String, Object> payload) {
        currentUserService.requireAdmin(authorizationHeader);
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;

        String name = requireNonBlankString(safePayload.get("name"), "Food name is required.");
        String description = trimToNull(safePayload.get("description"));
        String recipe = trimToNull(safePayload.get("recipe"));
        Integer calories = optionalNonNegativeInt(safePayload.get("calories"), "Calories must be a non-negative integer.");
        BigDecimal protein = optionalNonNegativeDecimal(safePayload.get("protein"), "Protein must be a non-negative number.");
        BigDecimal carbs = optionalNonNegativeDecimal(safePayload.get("carbs"), "Carbs must be a non-negative number.");
        BigDecimal fat = optionalNonNegativeDecimal(safePayload.get("fat"), "Fat must be a non-negative number.");
        String imageUrl = trimToNull(safePayload.get("imageUrl"));
        boolean active = safePayload.get("active") == null || Boolean.TRUE.equals(toBoolean(safePayload.get("active")));

        List<Integer> categoryIds = requireIdList(safePayload.get("categoryIds"), "Select at least one food category.");
        validateFoodCategoryIds(categoryIds);

        int updated = jdbcTemplate.update("""
                UPDATE dbo.Foods
                SET FoodName = ?,
                    Description = ?,
                    Recipe = ?,
                    Calories = ?,
                    Protein = ?,
                    Carbs = ?,
                    Fat = ?,
                    ImageUrl = ?,
                    IsActive = ?
                WHERE FoodID = ?
                """, name, description, recipe, calories, protein, carbs, fat, imageUrl, active, foodId);

        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Food not found.");
        }

        upsertFoodCategoryMap(foodId, categoryIds);
        return getFoodDetailInternal(foodId);
    }

    public Map<String, Object> archiveFood(String authorizationHeader, int foodId) {
        currentUserService.requireAdmin(authorizationHeader);
        int updated = jdbcTemplate.update("UPDATE dbo.Foods SET IsActive = 0 WHERE FoodID = ?", foodId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Food not found.");
        }
        return Map.of("foodId", foodId, "active", false);
    }

    public Map<String, Object> restoreFood(String authorizationHeader, int foodId) {
        currentUserService.requireAdmin(authorizationHeader);
        int updated = jdbcTemplate.update("UPDATE dbo.Foods SET IsActive = 1 WHERE FoodID = ?", foodId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Food not found.");
        }
        return Map.of("foodId", foodId, "active", true);
    }

    private Map<String, Object> getWorkoutDetailInternal(int workoutId) {
        try {
            Map<String, Object> workout = jdbcTemplate.queryForObject("""
                    SELECT w.WorkoutID,
                           w.WorkoutName,
                           w.Description,
                           w.Instructions,
                           w.ImageUrl,
                           w.VideoUrl,
                           w.Difficulty,
                           w.IsActive,
                           w.CreatedAt
                    FROM dbo.Workouts w
                    WHERE w.WorkoutID = ?
                    """, (rs, rowNum) -> mapWorkoutAdmin(rs), workoutId);
            if (workout == null) throw new EmptyResultDataAccessException(1);
            workout.put("categories", loadWorkoutCategoriesForWorkout(workoutId, true));
            return workout;
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found.");
        }
    }

    private Map<String, Object> getFoodDetailInternal(int foodId) {
        try {
            Map<String, Object> food = jdbcTemplate.queryForObject("""
                    SELECT f.FoodID,
                           f.FoodName,
                           f.Description,
                           f.Recipe,
                           f.Calories,
                           f.Protein,
                           f.Carbs,
                           f.Fat,
                           f.ImageUrl,
                           f.IsActive,
                           f.CreatedAt
                    FROM dbo.Foods f
                    WHERE f.FoodID = ?
                    """, (rs, rowNum) -> mapFoodAdmin(rs), foodId);
            if (food == null) throw new EmptyResultDataAccessException(1);
            food.put("categories", loadFoodCategoriesForFood(foodId, true));
            return food;
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Food not found.");
        }
    }

    private List<Map<String, Object>> loadWorkoutCategories(boolean includeInactive) {
        return jdbcTemplate.query("""
                SELECT WorkoutCategoryID,
                       CategoryName,
                       Description,
                       IsActive
                FROM dbo.WorkoutCategories
                WHERE (? = 1) OR IsActive = 1
                ORDER BY CategoryName
                """, (rs, rowNum) -> mapWorkoutCategoryAdmin(rs), includeInactive ? 1 : 0);
    }

    private List<Map<String, Object>> loadFoodCategories(boolean includeInactive) {
        return jdbcTemplate.query("""
                SELECT FoodCategoryID,
                       CategoryName,
                       Description,
                       IsActive
                FROM dbo.FoodCategories
                WHERE (? = 1) OR IsActive = 1
                ORDER BY CategoryName
                """, (rs, rowNum) -> mapFoodCategoryAdmin(rs), includeInactive ? 1 : 0);
    }

    private Map<Integer, List<Map<String, Object>>> loadWorkoutCategoryMapByWorkoutIds(Set<Integer> workoutIds) {
        if (workoutIds.isEmpty()) return Map.of();
        String placeholders = placeholders(workoutIds.size());
        String sql = """
                SELECT m.WorkoutID,
                       c.WorkoutCategoryID,
                       c.CategoryName,
                       c.Description,
                       c.IsActive
                FROM dbo.WorkoutCategoryMap m
                JOIN dbo.WorkoutCategories c ON c.WorkoutCategoryID = m.WorkoutCategoryID
                WHERE m.WorkoutID IN (%s)
                ORDER BY c.CategoryName
                """.formatted(placeholders);

        Map<Integer, List<Map<String, Object>>> map = new LinkedHashMap<>();
        jdbcTemplate.query(sql, rs -> {
            int workoutId = rs.getInt("WorkoutID");
            map.computeIfAbsent(workoutId, ignored -> new ArrayList<>()).add(mapWorkoutCategoryAdmin(rs));
        }, workoutIds.toArray());
        return map;
    }

    private Map<Integer, List<Map<String, Object>>> loadFoodCategoryMapByFoodIds(Set<Integer> foodIds) {
        if (foodIds.isEmpty()) return Map.of();
        String placeholders = placeholders(foodIds.size());
        String sql = """
                SELECT m.FoodID,
                       c.FoodCategoryID,
                       c.CategoryName,
                       c.Description,
                       c.IsActive
                FROM dbo.FoodCategoryMap m
                JOIN dbo.FoodCategories c ON c.FoodCategoryID = m.FoodCategoryID
                WHERE m.FoodID IN (%s)
                ORDER BY c.CategoryName
                """.formatted(placeholders);

        Map<Integer, List<Map<String, Object>>> map = new LinkedHashMap<>();
        jdbcTemplate.query(sql, rs -> {
            int foodId = rs.getInt("FoodID");
            map.computeIfAbsent(foodId, ignored -> new ArrayList<>()).add(mapFoodCategoryAdmin(rs));
        }, foodIds.toArray());
        return map;
    }

    private List<Map<String, Object>> loadWorkoutCategoriesForWorkout(int workoutId, boolean includeInactive) {
        return jdbcTemplate.query("""
                SELECT c.WorkoutCategoryID,
                       c.CategoryName,
                       c.Description,
                       c.IsActive
                FROM dbo.WorkoutCategoryMap m
                JOIN dbo.WorkoutCategories c ON c.WorkoutCategoryID = m.WorkoutCategoryID
                WHERE m.WorkoutID = ?
                  AND ((? = 1) OR c.IsActive = 1)
                ORDER BY c.CategoryName
                """, (rs, rowNum) -> mapWorkoutCategoryAdmin(rs), workoutId, includeInactive ? 1 : 0);
    }

    private List<Map<String, Object>> loadFoodCategoriesForFood(int foodId, boolean includeInactive) {
        return jdbcTemplate.query("""
                SELECT c.FoodCategoryID,
                       c.CategoryName,
                       c.Description,
                       c.IsActive
                FROM dbo.FoodCategoryMap m
                JOIN dbo.FoodCategories c ON c.FoodCategoryID = m.FoodCategoryID
                WHERE m.FoodID = ?
                  AND ((? = 1) OR c.IsActive = 1)
                ORDER BY c.CategoryName
                """, (rs, rowNum) -> mapFoodCategoryAdmin(rs), foodId, includeInactive ? 1 : 0);
    }

    private void upsertWorkoutCategoryMap(int workoutId, List<Integer> categoryIds) {
        jdbcTemplate.update("DELETE FROM dbo.WorkoutCategoryMap WHERE WorkoutID = ?", workoutId);
        for (Integer categoryId : categoryIds) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.WorkoutCategoryMap (WorkoutID, WorkoutCategoryID)
                    VALUES (?, ?)
                    """, workoutId, categoryId);
        }
    }

    private void upsertFoodCategoryMap(int foodId, List<Integer> categoryIds) {
        jdbcTemplate.update("DELETE FROM dbo.FoodCategoryMap WHERE FoodID = ?", foodId);
        for (Integer categoryId : categoryIds) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.FoodCategoryMap (FoodID, FoodCategoryID)
                    VALUES (?, ?)
                    """, foodId, categoryId);
        }
    }

    private void validateWorkoutCategoryIds(List<Integer> categoryIds) {
        if (categoryIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select at least one workout category.");
        }
        String placeholders = placeholders(categoryIds.size());
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.WorkoutCategories
                WHERE WorkoutCategoryID IN (%s)
                """.formatted(placeholders), Integer.class, categoryIds.toArray());
        if (count == null || count != categoryIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more workout categories are invalid.");
        }
    }

    private void validateFoodCategoryIds(List<Integer> categoryIds) {
        if (categoryIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select at least one food category.");
        }
        String placeholders = placeholders(categoryIds.size());
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.FoodCategories
                WHERE FoodCategoryID IN (%s)
                """.formatted(placeholders), Integer.class, categoryIds.toArray());
        if (count == null || count != categoryIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more food categories are invalid.");
        }
    }

    private static Map<String, Object> mapWorkoutAdmin(ResultSet rs) throws SQLException {
        Map<String, Object> workout = new LinkedHashMap<>();
        workout.put("workoutId", rs.getInt("WorkoutID"));
        workout.put("name", rs.getString("WorkoutName"));
        workout.put("description", rs.getString("Description"));
        workout.put("instructions", rs.getString("Instructions"));
        workout.put("imageUrl", rs.getString("ImageUrl"));
        workout.put("videoUrl", rs.getString("VideoUrl"));
        workout.put("difficulty", rs.getString("Difficulty"));
        workout.put("active", rs.getBoolean("IsActive"));
        workout.put("createdAt", rs.getTimestamp("CreatedAt"));
        return workout;
    }

    private static Map<String, Object> mapFoodAdmin(ResultSet rs) throws SQLException {
        Map<String, Object> food = new LinkedHashMap<>();
        food.put("foodId", rs.getInt("FoodID"));
        food.put("name", rs.getString("FoodName"));
        food.put("description", rs.getString("Description"));
        food.put("recipe", rs.getString("Recipe"));
        food.put("calories", rs.getObject("Calories") == null ? null : rs.getInt("Calories"));
        food.put("protein", (BigDecimal) rs.getObject("Protein"));
        food.put("carbs", (BigDecimal) rs.getObject("Carbs"));
        food.put("fat", (BigDecimal) rs.getObject("Fat"));
        food.put("imageUrl", rs.getString("ImageUrl"));
        food.put("active", rs.getBoolean("IsActive"));
        food.put("createdAt", rs.getTimestamp("CreatedAt"));
        return food;
    }

    private static Map<String, Object> mapWorkoutCategoryAdmin(ResultSet rs) throws SQLException {
        Map<String, Object> category = new LinkedHashMap<>();
        category.put("workoutCategoryId", rs.getInt("WorkoutCategoryID"));
        category.put("name", rs.getString("CategoryName"));
        category.put("description", rs.getString("Description"));
        category.put("active", rs.getBoolean("IsActive"));
        return category;
    }

    private static Map<String, Object> mapFoodCategoryAdmin(ResultSet rs) throws SQLException {
        Map<String, Object> category = new LinkedHashMap<>();
        category.put("foodCategoryId", rs.getInt("FoodCategoryID"));
        category.put("name", rs.getString("CategoryName"));
        category.put("description", rs.getString("Description"));
        category.put("active", rs.getBoolean("IsActive"));
        return category;
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

    private static String requireNonBlankString(Object value, String message) {
        String normalized = value == null ? "" : String.valueOf(value).trim();
        if (normalized.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return normalized;
    }

    private static String trimToNull(Object value) {
        if (value == null) return null;
        String trimmed = String.valueOf(value).trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Boolean toBoolean(Object value) {
        if (value == null) return null;
        if (value instanceof Boolean b) return b;
        String raw = String.valueOf(value).trim().toLowerCase();
        if (raw.equals("true") || raw.equals("1") || raw.equals("yes")) return true;
        if (raw.equals("false") || raw.equals("0") || raw.equals("no")) return false;
        return null;
    }

    private static List<Integer> requireIdList(Object raw, String message) {
        if (!(raw instanceof List<?> list)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        List<Integer> ids = list.stream()
                .map(ContentAdminService::parsePositiveInt)
                .collect(Collectors.toList());
        if (ids.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return ids.stream().distinct().toList();
    }

    private static Integer parsePositiveInt(Object value) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "IDs must be positive integers.");
        }
        try {
            int parsed = value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value));
            if (parsed <= 0) throw new NumberFormatException("not-positive");
            return parsed;
        } catch (NumberFormatException ignored) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "IDs must be positive integers.");
        }
    }

    private static Integer optionalNonNegativeInt(Object value, String message) {
        if (value == null) return null;
        try {
            int parsed = value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value));
            if (parsed < 0) throw new NumberFormatException("negative");
            return parsed;
        } catch (NumberFormatException ignored) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private static BigDecimal optionalNonNegativeDecimal(Object value, String message) {
        if (value == null) return null;
        try {
            BigDecimal parsed = value instanceof BigDecimal bd ? bd : new BigDecimal(String.valueOf(value));
            if (parsed.compareTo(BigDecimal.ZERO) < 0) {
                throw new NumberFormatException("negative");
            }
            return parsed;
        } catch (NumberFormatException ignored) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        } catch (ArithmeticException ignored) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }
}

