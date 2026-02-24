package com.gymcore.backend.modules.promotion.service;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class PromotionService {

<<<<<<< Updated upstream
    public Map<String, Object> execute(String action, Object payload) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("module", "promotion");
        response.put("action", action);
        response.put("status", "TODO");
        response.put("payload", payload == null ? Map.of() : payload);
        return response;
=======
    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final ReportService reportService;

    public PromotionService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService,
            ReportService reportService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.reportService = reportService;
    }

    public Map<String, Object> execute(String action, String auth, Map<String, Object> payload) {
        return switch (action) {
            case "admin-get-coupons" -> adminGetCoupons(auth);
            case "admin-create-coupon" -> adminCreateCoupon(auth, payload);
            case "admin-update-coupon" -> adminUpdateCoupon(auth, payload);
            case "admin-create-promotion-post" -> adminCreatePost(auth, payload);
            case "admin-update-promotion-post" -> adminUpdatePost(auth, payload);
            case "admin-get-revenue-report" -> adminGetRevenueReport(auth);
            case "admin-export-revenue-pdf" -> adminGetRevenuePdf(auth);
            case "customer-get-promotion-posts" -> customerGetPosts(auth);
            case "customer-claim-coupon" -> customerClaimCoupon(auth, payload);
            case "customer-get-my-claims" -> customerGetMyClaims(auth);
            case "customer-get-notifications" -> customerGetNotifications(auth);
            case "customer-mark-notification-read" -> customerMarkRead(auth, payload);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown action: " + action);
        };
    }

    private Map<String, Object> adminGetRevenueReport(String auth) {
        currentUserService.requireAdmin(auth);
        return reportService.getRevenueReport();
    }

    private Map<String, Object> adminGetRevenuePdf(String auth) {
        currentUserService.requireAdmin(auth);
        byte[] pdfBytes = reportService.exportRevenueToPdf();
        return Map.of("pdf", pdfBytes);
    }

    private Map<String, Object> adminGetCoupons(String auth) {
        currentUserService.requireAdmin(auth);
        String sql = "SELECT * FROM dbo.Promotions ORDER BY CreatedAt DESC";
        // Note: I'll assume CreatedAt exists or just order by ID if not.
        // Actually, let's use PromotionID DESC.
        sql = "SELECT * FROM dbo.Promotions ORDER BY PromotionID DESC";
        return Map.of("coupons", jdbcTemplate.queryForList(sql));
    }

    private Map<String, Object> adminCreateCoupon(String auth, Map<String, Object> payload) {
        currentUserService.requireAdmin(auth);
        jdbcTemplate.update(
                """
                        INSERT INTO dbo.Promotions (PromoCode, Description, DiscountPercent, DiscountAmount, ValidFrom, ValidTo, IsActive)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                payload.get("promoCode"),
                payload.get("description"),
                payload.get("discountPercent"),
                payload.get("discountAmount"),
                payload.get("validFrom"),
                payload.get("validTo"),
                payload.getOrDefault("isActive", 1));
        return Map.of("success", true);
    }

    private Map<String, Object> adminUpdateCoupon(String auth, Map<String, Object> payload) {
        currentUserService.requireAdmin(auth);
        int promotionId = (int) payload.get("promotionId");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.get("body");

        jdbcTemplate.update(
                """
                        UPDATE dbo.Promotions
                        SET PromoCode = ?, Description = ?, DiscountPercent = ?, DiscountAmount = ?, ValidFrom = ?, ValidTo = ?, IsActive = ?
                        WHERE PromotionID = ?
                        """,
                body.get("promoCode"),
                body.get("description"),
                body.get("discountPercent"),
                body.get("discountAmount"),
                body.get("validFrom"),
                body.get("validTo"),
                body.get("isActive"),
                promotionId);
        return Map.of("success", true);
    }

    private Map<String, Object> adminCreatePost(String auth, Map<String, Object> payload) {
        CurrentUserService.UserInfo admin = currentUserService.requireAdmin(auth);
        jdbcTemplate.update(
                """
                        INSERT INTO dbo.PromotionPosts (Title, Content, BannerUrl, PromotionID, StartAt, EndAt, IsActive, CreatedBy)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                payload.get("title"),
                payload.get("content"),
                payload.get("bannerUrl"),
                payload.get("promotionId"),
                payload.get("startAt"),
                payload.get("endAt"),
                payload.getOrDefault("isActive", 1),
                admin.userId());
        return Map.of("success", true);
    }

    private Map<String, Object> adminUpdatePost(String auth, Map<String, Object> payload) {
        currentUserService.requireAdmin(auth);
        int postId = (int) payload.get("postId");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.get("body");

        jdbcTemplate.update("""
                UPDATE dbo.PromotionPosts
                SET Title = ?, Content = ?, BannerUrl = ?, StartAt = ?, EndAt = ?, IsActive = ?
                WHERE PromotionPostID = ?
                """,
                body.get("title"),
                body.get("content"),
                body.get("bannerUrl"),
                body.get("startAt"),
                body.get("endAt"),
                body.get("isActive"),
                postId);
        return Map.of("success", true);
    }

    private Map<String, Object> customerGetPosts(String auth) {
        // External users can see posts too, but auth is optional
        String sql = """
                SELECT p.*, r.PromoCode, r.DiscountPercent, r.DiscountAmount
                FROM dbo.PromotionPosts p
                JOIN dbo.Promotions r ON r.PromotionID = p.PromotionID
                WHERE p.IsActive = 1 AND r.IsActive = 1
                AND SYSDATETIME() BETWEEN p.StartAt AND p.EndAt
                ORDER BY p.CreatedAt DESC
                """;
        return Map.of("posts", jdbcTemplate.queryForList(sql));
    }

    private Map<String, Object> customerClaimCoupon(String auth, Map<String, Object> payload) {
        CurrentUserService.UserInfo user = currentUserService.requireCustomer(auth);
        int promotionId = (int) payload.get("promotionId");
        int sourcePostId = (int) payload.get("sourcePostId");

        // Idempotent check: check if already claimed to avoid UNIQUE constraint
        // violation
        String checkSql = "SELECT COUNT(*) FROM dbo.UserPromotionClaims WHERE UserID = ? AND PromotionID = ?";
        Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, user.userId(), promotionId);

        if (count != null && count > 0) {
            return Map.of("success", true, "message", "Coupon already in your wallet!");
        }

        jdbcTemplate.update("""
                INSERT INTO dbo.UserPromotionClaims (UserID, PromotionID, SourcePostID)
                VALUES (?, ?, ?)
                """, user.userId(), promotionId, sourcePostId);

        return Map.of("success", true, "message", "Coupon added to your wallet!");
    }

    private Map<String, Object> customerGetMyClaims(String auth) {
        CurrentUserService.UserInfo user = currentUserService.requireCustomer(auth);
        String sql = """
                SELECT c.*, p.PromoCode, p.Description, p.DiscountPercent, p.DiscountAmount
                FROM dbo.UserPromotionClaims c
                JOIN dbo.Promotions p ON p.PromotionID = c.PromotionID
                WHERE c.UserID = ? AND c.UsedAt IS NULL
                AND p.IsActive = 1 AND SYSDATETIME() BETWEEN p.ValidFrom AND p.ValidTo
                """;
        return Map.of("claims", jdbcTemplate.queryForList(sql, user.userId()));
    }

    private Map<String, Object> customerGetNotifications(String auth) {
        CurrentUserService.UserInfo user = currentUserService.requireUser(auth);
        String sql = "SELECT * FROM dbo.Notifications WHERE UserID = ? ORDER BY CreatedAt DESC";
        List<Map<String, Object>> list = jdbcTemplate.queryForList(sql, user.userId());
        long unreadCount = list.stream().filter(n -> !(boolean) n.getOrDefault("IsRead", false)).count();
        return Map.of("notifications", list, "unreadCount", unreadCount);
    }

    private Map<String, Object> customerMarkRead(String auth, Map<String, Object> payload) {
        CurrentUserService.UserInfo user = currentUserService.requireUser(auth);
        int notificationId = (int) payload.get("notificationId");
        jdbcTemplate.update("UPDATE dbo.Notifications SET IsRead = 1 WHERE NotificationID = ? AND UserID = ?",
                notificationId, user.userId());
        return Map.of("success", true);
>>>>>>> Stashed changes
    }
}
