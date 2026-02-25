package com.gymcore.backend.modules.promotion.service;

import com.gymcore.backend.modules.admin.service.ReportService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PromotionService {

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
            case "admin-delete-coupon" -> adminDeleteCoupon(auth, payload);
            case "admin-get-posts" -> adminGetPosts(auth);
            case "admin-create-promotion-post" -> adminCreatePost(auth, payload);
            case "admin-update-promotion-post" -> adminUpdatePost(auth, payload);
            case "admin-delete-promotion-post" -> adminDeletePost(auth, payload);
            case "admin-get-revenue-report" -> adminGetRevenueReport(auth);
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

    public org.springframework.http.ResponseEntity<byte[]> exportRevenuePdf(String auth) {
        currentUserService.requireAdmin(auth);
        byte[] pdfBytes = reportService.exportRevenueToPdf();

        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=revenue_report.pdf")
                .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    private Map<String, Object> adminGetCoupons(String auth) {
        currentUserService.requireAdmin(auth);
        String sql = "SELECT * FROM dbo.Promotions ORDER BY PromotionID DESC";
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
                requireDecimal(payload.get("discountPercent")),
                requireDecimal(payload.get("discountAmount")),
                payload.get("validFrom"),
                payload.get("validTo"),
                requireBit(payload.getOrDefault("isActive", 1)));
        return Map.of("success", true);
    }

    private Map<String, Object> adminUpdateCoupon(String auth, Map<String, Object> payload) {
        currentUserService.requireAdmin(auth);
        int promotionId = requireInt(payload.get("promotionId"), "Promotion ID is required.");
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
                requireDecimal(body.get("discountPercent")),
                requireDecimal(body.get("discountAmount")),
                body.get("validFrom"),
                body.get("validTo"),
                requireBit(body.getOrDefault("isActive", 1)),
                promotionId);
        return Map.of("success", true);
    }

    private Map<String, Object> adminDeleteCoupon(String auth, Map<String, Object> payload) {
        currentUserService.requireAdmin(auth);
        int promotionId = requireInt(payload.get("promotionId"), "Promotion ID is required.");
        jdbcTemplate.update("UPDATE dbo.Promotions SET IsActive = 0 WHERE PromotionID = ?", promotionId);
        return Map.of("success", true);
    }

    private Map<String, Object> adminGetPosts(String auth) {
        currentUserService.requireAdmin(auth);
        String sql = """
                SELECT p.*, r.PromoCode
                FROM dbo.PromotionPosts p
                JOIN dbo.Promotions r ON r.PromotionID = p.PromotionID
                ORDER BY p.PromotionPostID DESC
                """;
        return Map.of("posts", jdbcTemplate.queryForList(sql));
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
                requireInt(payload.get("promotionId"), "Promotion ID is required."),
                payload.get("startAt"),
                payload.get("endAt"),
                requireBit(payload.getOrDefault("isActive", 1)),
                admin.userId());
        return Map.of("success", true);
    }

    private Map<String, Object> adminUpdatePost(String auth, Map<String, Object> payload) {
        currentUserService.requireAdmin(auth);
        int postId = requireInt(payload.get("postId"), "Post ID is required.");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.get("body");

        jdbcTemplate.update("""
                UPDATE dbo.PromotionPosts
                SET Title = ?, Content = ?, BannerUrl = ?, StartAt = ?, EndAt = ?, IsActive = ?, PromotionID = ?
                WHERE PromotionPostID = ?
                """,
                body.get("title"),
                body.get("content"),
                body.get("bannerUrl"),
                body.get("startAt"),
                body.get("endAt"),
                requireBit(body.getOrDefault("isActive", 1)),
                requireInt(body.get("promotionId"), "Promotion ID is required."),
                postId);
        return Map.of("success", true);
    }

    private Map<String, Object> adminDeletePost(String auth, Map<String, Object> payload) {
        currentUserService.requireAdmin(auth);
        int postId = requireInt(payload.get("postId"), "Post ID is required.");
        jdbcTemplate.update("UPDATE dbo.PromotionPosts SET IsActive = 0 WHERE PromotionPostID = ?", postId);
        return Map.of("success", true);
    }

    private Map<String, Object> customerGetPosts(String auth) {
        CurrentUserService.UserInfo user = currentUserService.findUser(auth).orElse(null);
        String sql;
        List<Map<String, Object>> posts;

        if (user != null) {
            sql = """
                    SELECT p.*, r.PromoCode, r.DiscountPercent, r.DiscountAmount,
                           CASE WHEN c.ClaimID IS NOT NULL THEN 1 ELSE 0 END as IsClaimed
                    FROM dbo.PromotionPosts p
                    JOIN dbo.Promotions r ON r.PromotionID = p.PromotionID
                    LEFT JOIN dbo.UserPromotionClaims c ON c.PromotionID = r.PromotionID AND c.UserID = ?
                    WHERE p.IsActive = 1 AND r.IsActive = 1
                    AND SYSDATETIME() BETWEEN p.StartAt AND p.EndAt
                    ORDER BY p.CreatedAt DESC
                    """;
            posts = jdbcTemplate.queryForList(sql, user.userId());
        } else {
            sql = """
                    SELECT p.*, r.PromoCode, r.DiscountPercent, r.DiscountAmount,
                           0 as IsClaimed
                    FROM dbo.PromotionPosts p
                    JOIN dbo.Promotions r ON r.PromotionID = p.PromotionID
                    WHERE p.IsActive = 1 AND r.IsActive = 1
                    AND SYSDATETIME() BETWEEN p.StartAt AND p.EndAt
                    ORDER BY p.CreatedAt DESC
                    """;
            posts = jdbcTemplate.queryForList(sql);
        }
        return Map.of("posts", posts);
    }

    private Map<String, Object> customerClaimCoupon(String auth, Map<String, Object> payload) {
        CurrentUserService.UserInfo user = currentUserService.requireCustomer(auth);
        int promotionId = (int) payload.get("promotionId");
        int sourcePostId = (int) payload.get("sourcePostId");

        // Idempotency check
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dbo.UserPromotionClaims WHERE UserID = ? AND PromotionID = ?",
                Integer.class, user.userId(), promotionId);

        if (existing != null && existing > 0) {
            return Map.of("success", true, "message", "You have already claimed this coupon!");
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
        int notificationId = requireInt(payload.get("notificationId"), "Notification ID is required.");
        jdbcTemplate.update("UPDATE dbo.Notifications SET IsRead = 1 WHERE NotificationID = ? AND UserID = ?",
                notificationId, user.userId());
        return Map.of("success", true);
    }

    private int requireInt(Object value, String message) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        try {
            if (value instanceof Number number) {
                return number.intValue();
            }
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private java.math.BigDecimal requireDecimal(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        try {
            if (value instanceof java.math.BigDecimal decimal) {
                return decimal;
            }
            if (value instanceof Number number) {
                return java.math.BigDecimal.valueOf(number.doubleValue());
            }
            return new java.math.BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private int requireBit(Object value) {
        if (value instanceof Boolean bool) {
            return bool ? 1 : 0;
        }
        if (value instanceof Number number) {
            return number.intValue() > 0 ? 1 : 0;
        }
        if (value == null) {
            return 0;
        }
        String s = String.valueOf(value).trim().toLowerCase();
        return s.equals("true") || s.equals("1") || s.equals("on") ? 1 : 0;
    }
}
