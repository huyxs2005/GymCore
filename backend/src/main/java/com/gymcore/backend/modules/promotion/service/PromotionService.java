package com.gymcore.backend.modules.promotion.service;

import com.gymcore.backend.modules.admin.service.ReportService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
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
            case "admin-get-revenue-report" -> adminGetRevenueReport(auth);
            case "customer-get-coupons" -> customerGetCoupons(auth);
            case "customer-claim-coupon" -> customerClaimCoupon(auth, payload);
            case "customer-get-my-claims" -> customerGetMyClaims(auth);
            case "customer-apply-coupon" -> customerApplyCoupon(auth, payload);
            case "customer-get-notifications" -> customerGetNotifications(auth);
            case "customer-mark-notification-read" -> customerMarkRead(auth, payload);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown action: " + action);
        };
    }

    private Map<String, Object> customerApplyCoupon(String auth, Map<String, Object> payload) {
        CurrentUserService.UserInfo user = currentUserService.requireCustomer(auth);
        String promoCode = String.valueOf(payload.get("promoCode"));

        List<Map<String, Object>> claims = jdbcTemplate.queryForList("""
                SELECT c.ClaimID, p.DiscountPercent, p.DiscountAmount, p.PromoCode, p.Description
                FROM dbo.UserPromotionClaims c
                JOIN dbo.Promotions p ON p.PromotionID = c.PromotionID
                WHERE c.UserID = ? AND p.PromoCode = ? AND c.UsedAt IS NULL
                AND p.IsActive = 1
                """, user.userId(), promoCode);

        if (claims.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This coupon is either invalid, not claimed, or already used.");
        }

        return Map.of("success", true, "claim", claims.get(0));
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
        java.math.BigDecimal[] discountValues = resolveDiscountValues(payload.get("discountPercent"),
                payload.get("discountAmount"));
        java.math.BigDecimal discountPercent = discountValues[0];
        java.math.BigDecimal discountAmount = discountValues[1];
        Timestamp validFrom = normalizeDateTime(payload.get("validFrom"), false, "Valid from date is required.");
        Timestamp validTo = normalizeDateTime(payload.get("validTo"), true, "Valid to date is required.");
        if (!validTo.after(validFrom)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid to date must be after valid from date.");
        }

        jdbcTemplate.update(
                """
                        INSERT INTO dbo.Promotions (PromoCode, Description, DiscountPercent, DiscountAmount, ValidFrom, ValidTo, IsActive)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                requireText(payload.get("promoCode"), "Coupon code is required."),
                optionalText(payload.get("description")),
                discountPercent,
                discountAmount,
                validFrom,
                validTo,
                requireBit(payload.getOrDefault("isActive", 1)));
        return Map.of("success", true);
    }

    private Map<String, Object> adminUpdateCoupon(String auth, Map<String, Object> payload) {
        currentUserService.requireAdmin(auth);
        int promotionId = requireInt(payload.get("promotionId"), "Promotion ID is required.");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.get("body");
        java.math.BigDecimal[] discountValues = resolveDiscountValues(body.get("discountPercent"), body.get("discountAmount"));
        java.math.BigDecimal discountPercent = discountValues[0];
        java.math.BigDecimal discountAmount = discountValues[1];
        Timestamp validFrom = normalizeDateTime(body.get("validFrom"), false, "Valid from date is required.");
        Timestamp validTo = normalizeDateTime(body.get("validTo"), true, "Valid to date is required.");
        if (!validTo.after(validFrom)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid to date must be after valid from date.");
        }

        jdbcTemplate.update(
                """
                        UPDATE dbo.Promotions
                        SET PromoCode = ?, Description = ?, DiscountPercent = ?, DiscountAmount = ?, ValidFrom = ?, ValidTo = ?, IsActive = ?
                        WHERE PromotionID = ?
                        """,
                requireText(body.get("promoCode"), "Coupon code is required."),
                optionalText(body.get("description")),
                discountPercent,
                discountAmount,
                validFrom,
                validTo,
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


    private Map<String, Object> customerGetCoupons(String auth) {
        CurrentUserService.UserInfo user = currentUserService.findUser(auth).orElse(null);
        String sql;
        List<Map<String, Object>> coupons;

        if (user != null) {
            sql = """
                    SELECT
                           r.PromotionID,
                           CONCAT('Coupon ', r.PromoCode) AS Title,
                           COALESCE(NULLIF(LTRIM(RTRIM(r.Description)), ''), 'Claim this coupon and use it during checkout.') AS Content,
                           CAST(NULL AS NVARCHAR(500)) AS BannerUrl,
                           r.ValidFrom AS StartAt,
                           r.ValidTo AS EndAt,
                           r.PromoCode,
                           r.DiscountPercent,
                           r.DiscountAmount,
                           CASE WHEN c.ClaimID IS NOT NULL THEN 1 ELSE 0 END as IsClaimed
                    FROM dbo.Promotions r
                    LEFT JOIN dbo.UserPromotionClaims c ON c.PromotionID = r.PromotionID AND c.UserID = ?
                    WHERE r.IsActive = 1
                    ORDER BY r.PromotionID DESC
                    """;
            coupons = jdbcTemplate.queryForList(sql, user.userId());
        } else {
            sql = """
                    SELECT
                           r.PromotionID,
                           CONCAT('Coupon ', r.PromoCode) AS Title,
                           COALESCE(NULLIF(LTRIM(RTRIM(r.Description)), ''), 'Claim this coupon and use it during checkout.') AS Content,
                           CAST(NULL AS NVARCHAR(500)) AS BannerUrl,
                           r.ValidFrom AS StartAt,
                           r.ValidTo AS EndAt,
                           r.PromoCode,
                           r.DiscountPercent,
                           r.DiscountAmount,
                           0 as IsClaimed
                    FROM dbo.Promotions r
                    WHERE r.IsActive = 1
                    ORDER BY r.PromotionID DESC
                    """;
            coupons = jdbcTemplate.queryForList(sql);
        }
        return Map.of("posts", coupons);
    }

   private Map<String, Object> customerClaimCoupon(String auth, Map<String, Object> payload) {
        CurrentUserService.UserInfo user = currentUserService.requireCustomer(auth);
        int promotionId = requireInt(payload.get("promotionId"), "Promotion ID is required.");

        Integer claimable = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.Promotions r
                WHERE r.PromotionID = ?
                  AND r.IsActive = 1
                """, Integer.class, promotionId);
        if (claimable == null || claimable == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This coupon is not available to claim.");
        }

        // Idempotency check
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dbo.UserPromotionClaims WHERE UserID = ? AND PromotionID = ?",
                Integer.class, user.userId(), promotionId);

        if (existing != null && existing > 0) {
            return Map.of("success", true, "message", "You have already claimed this coupon!");
        }

        jdbcTemplate.update("""
                INSERT INTO dbo.UserPromotionClaims (UserID, PromotionID, SourcePostID)
                VALUES (?, ?, NULL)
                """, user.userId(), promotionId);

        return Map.of("success", true, "message", "Coupon added to your wallet!");
    }

    private Map<String, Object> customerGetMyClaims(String auth) {
        CurrentUserService.UserInfo user = currentUserService.requireCustomer(auth);
        String sql = """
                SELECT c.*, p.PromoCode, p.Description, p.DiscountPercent, p.DiscountAmount
                FROM dbo.UserPromotionClaims c
                JOIN dbo.Promotions p ON p.PromotionID = c.PromotionID
                WHERE c.UserID = ? AND c.UsedAt IS NULL
                AND p.IsActive = 1
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

    private String requireText(Object value, String message) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        String s = String.valueOf(value).trim();
        if (s.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return s;
    }

    private String optionalText(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    private Timestamp normalizeDateTime(Object value, boolean endOfDay, String requiredMessage) {
        String raw = requireText(value, requiredMessage);
        try {
            if (raw.matches("\\d{4}-\\d{2}-\\d{2}")) {
                LocalDate date = LocalDate.parse(raw);
                LocalDateTime dateTime = endOfDay ? date.atTime(LocalTime.of(23, 59, 59)) : date.atStartOfDay();
                return Timestamp.valueOf(dateTime);
            }
            return Timestamp.valueOf(LocalDateTime.parse(raw.replace(" ", "T")));
        } catch (DateTimeParseException | IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, requiredMessage);
        }
    }

    private java.math.BigDecimal[] resolveDiscountValues(Object percentRaw, Object amountRaw) {
        java.math.BigDecimal percent = requireDecimal(percentRaw);
        java.math.BigDecimal amount = requireDecimal(amountRaw);

        if (percent != null && percent.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            percent = null;
        }
        if (amount != null && amount.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            amount = null;
        }

        if (percent != null && percent.compareTo(java.math.BigDecimal.valueOf(100)) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Discount percent must be at most 100.");
        }
        if (percent != null && amount != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Please provide only one discount type: percent or amount.");
        }
        if (percent == null && amount == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Please provide discount percent or discount amount.");
        }

        return new java.math.BigDecimal[] { percent, amount };
    }

}
