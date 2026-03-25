package com.gymcore.backend.modules.promotion.service;

import com.gymcore.backend.common.service.UserNotificationService;
import com.gymcore.backend.modules.admin.service.ReportService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PromotionService {

    private static final java.math.BigDecimal MAX_DISCOUNT_PERCENT = new java.math.BigDecimal("100.00");
    private static final java.math.BigDecimal MAX_DISCOUNT_AMOUNT = new java.math.BigDecimal("9999999999.99");

    @Value("${app.promotion.image-dir:uploads/promotions}")
    private String promotionImageDir;

    @Value("${app.promotion.image-max-bytes:5242880}")
    private long promotionImageMaxBytes;

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final ReportService reportService;
    private final UserNotificationService notificationService;

    public PromotionService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService,
            ReportService reportService, UserNotificationService notificationService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.reportService = reportService;
        this.notificationService = notificationService;
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
            case "customer-claim-coupon-code" -> customerClaimCouponCode(auth, payload);
            case "customer-get-my-claims" -> customerGetMyClaims(auth);
            case "customer-apply-coupon" -> customerApplyCoupon(auth, payload);
            case "customer-get-notifications" -> customerGetNotifications(auth, payload);
            case "customer-mark-notification-read" -> customerMarkRead(auth, payload);
            case "customer-mark-notification-unread" -> customerMarkUnread(auth, payload);
            case "customer-mark-all-notifications-read" -> customerMarkAllRead(auth);
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
        String promoCode = requireText(payload.get("promoCode"), "Promo code is required.");
        java.math.BigDecimal discountPercent = requireDecimal(payload.get("discountPercent"));
        java.math.BigDecimal discountAmount = requireDecimal(payload.get("discountAmount"));
        String applyTarget = normalizeApplyTarget(payload.get("applyTarget"));
        int bonusDurationMonths = requireNonNegativeInt(payload.get("bonusDurationMonths"));
        java.time.LocalDate validFrom = requireDate(payload.get("validFrom"), "Valid from is required.");
        java.time.LocalDate validTo = requireDate(payload.get("validTo"), "Valid to is required.");
        validateCouponBenefit(discountPercent, discountAmount, bonusDurationMonths, applyTarget);
        validateCouponDateWindow(validFrom, validTo);

        jdbcTemplate.update(
                """
                        INSERT INTO dbo.Promotions (PromoCode, Description, DiscountPercent, DiscountAmount, ApplyTarget, BonusDurationMonths, ValidFrom, ValidTo, IsActive)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                promoCode,
                payload.get("description"),
                discountPercent,
                discountAmount,
                applyTarget,
                bonusDurationMonths,
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
        String promoCode = requireText(body.get("promoCode"), "Promo code is required.");
        java.math.BigDecimal discountPercent = requireDecimal(body.get("discountPercent"));
        java.math.BigDecimal discountAmount = requireDecimal(body.get("discountAmount"));
        String applyTarget = normalizeApplyTarget(body.get("applyTarget"));
        int bonusDurationMonths = requireNonNegativeInt(body.get("bonusDurationMonths"));
        java.time.LocalDate validFrom = requireDate(body.get("validFrom"), "Valid from is required.");
        java.time.LocalDate validTo = requireDate(body.get("validTo"), "Valid to is required.");
        validateCouponBenefit(discountPercent, discountAmount, bonusDurationMonths, applyTarget);
        validateCouponDateWindow(validFrom, validTo);

        jdbcTemplate.update(
                """
                        UPDATE dbo.Promotions
                        SET PromoCode = ?, Description = ?, DiscountPercent = ?, DiscountAmount = ?, ApplyTarget = ?, BonusDurationMonths = ?, ValidFrom = ?, ValidTo = ?, IsActive = ?
                        WHERE PromotionID = ?
                        """,
                promoCode,
                body.get("description"),
                discountPercent,
                discountAmount,
                applyTarget,
                bonusDurationMonths,
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

    public Map<String, Object> uploadPromotionBanner(String authorizationHeader, MultipartFile file) {
        currentUserService.requireAdmin(authorizationHeader);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Promotion banner file is required.");
        }
        if (file.getSize() > promotionImageMaxBytes) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, promotionBannerTooLargeMessage());
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to read promotion banner file.");
        }
        if (bytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Promotion banner file is required.");
        }

        String extension = detectImageExtension(bytes);
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only JPG, PNG, or WEBP images are allowed.");
        }

        Path baseDir = Paths.get(promotionImageDir).toAbsolutePath().normalize();
        Path imageDir = baseDir.resolve("banners").normalize();
        if (!imageDir.startsWith(baseDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid promotion banner storage location.");
        }

        try {
            Files.createDirectories(imageDir);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to create promotion banner storage folder.");
        }

        String filename = UUID.randomUUID().toString().replace("-", "") + "." + extension;
        Path storedPath = imageDir.resolve(filename).normalize();
        if (!storedPath.startsWith(imageDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid promotion banner file path.");
        }

        try {
            Files.write(storedPath, bytes);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to store promotion banner file.");
        }

        return Map.of("imageUrl", "/uploads/promotions/banners/" + filename);
    }

    public String promotionBannerTooLargeMessage() {
        long bytesPerMegabyte = 1024L * 1024L;
        long maxMegabytes = Math.max(1L, Math.round((double) promotionImageMaxBytes / bytesPerMegabyte));
        return "Promotion banner file is too large. Maximum size is " + maxMegabytes + " MB.";
    }

    public Map<String, Object> deleteUploadedPromotionBanner(String authorizationHeader, String imageUrl) {
        currentUserService.requireAdmin(authorizationHeader);
        String normalized = requireText(imageUrl, "Promotion banner URL is required.");
        boolean deleted = tryDeleteManagedPromotionBannerIfUnused(normalized);
        return Map.of("deleted", deleted, "imageUrl", normalized);
    }

    private Map<String, Object> adminCreatePost(String auth, Map<String, Object> payload) {
        CurrentUserService.UserInfo admin = currentUserService.requireAdmin(auth);
        int isActive = requireBit(payload.getOrDefault("isActive", 1));
        int isImportant = requireBit(payload.getOrDefault("isImportant", 0));
        jdbcTemplate.update(
                """
                        INSERT INTO dbo.PromotionPosts (Title, Content, BannerUrl, PromotionID, StartAt, EndAt, IsActive, IsImportant, CreatedBy)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                payload.get("title"),
                payload.get("content"),
                payload.get("bannerUrl"),
                requireInt(payload.get("promotionId"), "Promotion ID is required."),
                payload.get("startAt"),
                payload.get("endAt"),
                isActive,
                isImportant,
                admin.userId());
        Integer postId = jdbcTemplate.queryForObject("SELECT TOP (1) PromotionPostID FROM dbo.PromotionPosts ORDER BY PromotionPostID DESC",
                Integer.class);
        publishPromotionPostIfNeeded(postId, payload.get("title"), isActive, isImportant);
        return Map.of("success", true);
    }

    private Map<String, Object> adminUpdatePost(String auth, Map<String, Object> payload) {
        currentUserService.requireAdmin(auth);
        int postId = requireInt(payload.get("postId"), "Post ID is required.");
        Map<String, Object> existingPostState = findPromotionPostState(postId);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.get("body");
        int isActive = requireBit(body.getOrDefault("isActive", 1));
        int isImportant = requireBit(body.getOrDefault("isImportant", 0));

        jdbcTemplate.update("""
                UPDATE dbo.PromotionPosts
                SET Title = ?, Content = ?, BannerUrl = ?, StartAt = ?, EndAt = ?, IsActive = ?, IsImportant = ?, PromotionID = ?
                WHERE PromotionPostID = ?
                """,
                body.get("title"),
                body.get("content"),
                body.get("bannerUrl"),
                body.get("startAt"),
                body.get("endAt"),
                isActive,
                isImportant,
                requireInt(body.get("promotionId"), "Promotion ID is required."),
                postId);
        if (!isPromotionPostBroadcastEligible(existingPostState)) {
            publishPromotionPostIfNeeded(postId, body.get("title"), isActive, isImportant);
        }
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
                    SELECT p.*, r.PromoCode, r.DiscountPercent, r.DiscountAmount, r.ApplyTarget, r.BonusDurationMonths,
                           CASE WHEN c.ClaimID IS NOT NULL THEN 1 ELSE 0 END as IsClaimed
                    FROM dbo.PromotionPosts p
                    JOIN dbo.Promotions r ON r.PromotionID = p.PromotionID
                    LEFT JOIN dbo.UserPromotionClaims c ON c.PromotionID = r.PromotionID AND c.UserID = ?
                    WHERE p.IsActive = 1 AND r.IsActive = 1
                    AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(p.StartAt AS DATE) AND CAST(p.EndAt AS DATE)
                    AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(r.ValidFrom AS DATE) AND CAST(r.ValidTo AS DATE)
                    ORDER BY p.CreatedAt DESC
                    """;
            posts = jdbcTemplate.queryForList(sql, user.userId());
        } else {
            sql = """
                    SELECT p.*, r.PromoCode, r.DiscountPercent, r.DiscountAmount, r.ApplyTarget, r.BonusDurationMonths,
                           0 as IsClaimed
                    FROM dbo.PromotionPosts p
                    JOIN dbo.Promotions r ON r.PromotionID = p.PromotionID
                    WHERE p.IsActive = 1 AND r.IsActive = 1
                    AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(p.StartAt AS DATE) AND CAST(p.EndAt AS DATE)
                    AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(r.ValidFrom AS DATE) AND CAST(r.ValidTo AS DATE)
                    ORDER BY p.CreatedAt DESC
                    """;
            posts = jdbcTemplate.queryForList(sql);
        }
        return Map.of("posts", posts);
    }

    private Map<String, Object> customerClaimCoupon(String auth, Map<String, Object> payload) {
        CurrentUserService.UserInfo user = currentUserService.requireCustomer(auth);
        int promotionId = requireInt(payload.get("promotionId"), "Promotion ID is required.");
        int sourcePostId = requireInt(payload.get("sourcePostId"), "Source post ID is required.");

        Integer claimable = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.Promotions r
                JOIN dbo.PromotionPosts p ON p.PromotionID = r.PromotionID
                WHERE r.PromotionID = ?
                  AND p.PromotionPostID = ?
                  AND r.IsActive = 1
                  AND p.IsActive = 1
                  AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(r.ValidFrom AS DATE) AND CAST(r.ValidTo AS DATE)
                  AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(p.StartAt AS DATE) AND CAST(p.EndAt AS DATE)
                """, Integer.class, promotionId, sourcePostId);
        if (claimable == null || claimable == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This coupon is not available to claim.");
        }

        // Idempotency check
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dbo.UserPromotionClaims WHERE UserID = ? AND PromotionID = ?",
                Integer.class, user.userId(), promotionId);

        if (existing != null && existing > 0) {
            Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "You have already claimed this coupon!");
            response.putAll(buildCouponWalletResponse(user.userId()));
            return response;
        }

        jdbcTemplate.update("""
                INSERT INTO dbo.UserPromotionClaims (UserID, PromotionID, SourcePostID)
                VALUES (?, ?, ?)
                """, user.userId(), promotionId, sourcePostId);

        notificationService.notifyUser(
                user.userId(),
                "COUPON_CLAIMED",
                "Coupon added to your wallet",
                "Your promotion claim was saved successfully. You can use it at checkout before it expires.",
                "/customer/promotions",
                promotionId,
                "COUPON_CLAIM_" + promotionId);

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "Coupon added to your wallet!");
        response.putAll(buildCouponWalletResponse(user.userId()));
        return response;
    }

    private Map<String, Object> customerGetMyClaims(String auth) {
        CurrentUserService.UserInfo user = currentUserService.requireCustomer(auth);
        return buildCouponWalletResponse(user.userId());
    }

    private Map<String, Object> customerClaimCouponCode(String auth, Map<String, Object> payload) {
        CurrentUserService.UserInfo user = currentUserService.requireCustomer(auth);
        String promoCode = requireText(payload.get("promoCode"), "Promo code is required.");

        List<Map<String, Object>> promotions = jdbcTemplate.queryForList("""
                SELECT TOP (1) PromotionID, PromoCode
                FROM dbo.Promotions
                WHERE PromoCode = ?
                  AND IsActive = 1
                  AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(ValidFrom AS DATE) AND CAST(ValidTo AS DATE)
                ORDER BY PromotionID DESC
                """, promoCode);
        if (promotions.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coupon code is invalid or expired.");
        }

        Map<String, Object> promotion = promotions.get(0);
        int promotionId = requireInt(promotion.get("PromotionID"), "Promotion ID is required.");
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dbo.UserPromotionClaims WHERE UserID = ? AND PromotionID = ?",
                Integer.class, user.userId(), promotionId);
        if (existing != null && existing > 0) {
            Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "This coupon is already in your wallet.");
            response.putAll(buildCouponWalletResponse(user.userId()));
            return response;
        }

        jdbcTemplate.update("""
                INSERT INTO dbo.UserPromotionClaims (UserID, PromotionID, SourcePostID)
                VALUES (?, ?, NULL)
                """, user.userId(), promotionId);
        notificationService.notifyUser(
                user.userId(),
                "COUPON_CODE_CLAIMED",
                "Coupon code added to your wallet",
                "Your manually entered coupon code is now available in wallet and can be used at checkout.",
                "/customer/promotions",
                promotionId,
                "COUPON_CODE_CLAIM_" + promotionId);

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "Coupon code added to your wallet!");
        response.putAll(buildCouponWalletResponse(user.userId()));
        return response;
    }

    private Map<String, Object> customerApplyCoupon(String auth, Map<String, Object> payload) {
        CurrentUserService.UserInfo user = currentUserService.requireCustomer(auth);
        String promoCode = requireText(payload.get("promoCode"), "Promo code is required.");
        String target = normalizeApplyTarget(payload.get("target"));
        java.math.BigDecimal subtotal = optionalNonNegativeDecimal(payload.get("subtotal"), "Subtotal must be >= 0.");

        List<Map<String, Object>> claims = jdbcTemplate.queryForList("""
                SELECT TOP (1)
                    c.ClaimID,
                    p.PromoCode,
                    p.DiscountPercent,
                    p.DiscountAmount,
                    p.ApplyTarget,
                    p.BonusDurationMonths,
                    p.ValidFrom,
                    p.ValidTo
                FROM dbo.UserPromotionClaims c
                JOIN dbo.Promotions p ON p.PromotionID = c.PromotionID
                WHERE c.UserID = ?
                  AND p.PromoCode = ?
                  AND c.UsedAt IS NULL
                  AND p.IsActive = 1
                  AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(p.ValidFrom AS DATE) AND CAST(p.ValidTo AS DATE)
                ORDER BY c.ClaimID DESC
                """, user.userId(), promoCode);
        if (claims.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired promo code.");
        }

        Map<String, Object> claim = claims.get(0);
        java.math.BigDecimal discountPercent = requireDecimal(claim.get("DiscountPercent"));
        java.math.BigDecimal discountAmount = requireDecimal(claim.get("DiscountAmount"));
        String applyTarget = normalizeApplyTarget(claim.get("ApplyTarget"));
        int bonusDurationMonths = requireNonNegativeInt(claim.get("BonusDurationMonths"));
        if (!applyTarget.equals(target)) {
            if ("MEMBERSHIP".equals(applyTarget)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "This coupon applies to membership purchases only.");
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This coupon applies to product orders only.");
        }

        java.math.BigDecimal estimatedDiscount = java.math.BigDecimal.ZERO;
        java.math.BigDecimal estimatedFinalAmount = null;
        if (subtotal != null) {
            estimatedDiscount = calculateDiscount(subtotal, discountPercent, discountAmount);
            estimatedFinalAmount = subtotal.subtract(estimatedDiscount);
        }

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("valid", true);
        response.put("claimId", claim.get("ClaimID"));
        response.put("promoCode", claim.get("PromoCode"));
        response.put("target", target);
        response.put("applyTarget", applyTarget);
        response.put("discountPercent", discountPercent);
        response.put("discountAmount", discountAmount);
        response.put("bonusDurationMonths", bonusDurationMonths);
        response.put("estimatedDiscount", estimatedDiscount);
        response.put("estimatedFinalAmount", estimatedFinalAmount);
        response.put("currency", "VND");
        response.put("membershipOnly", "MEMBERSHIP".equals(applyTarget));
        return response;
    }

    private Map<String, Object> buildCouponWalletResponse(int userId) {
        List<Map<String, Object>> activeClaims = loadActiveClaims(userId);
        List<Map<String, Object>> walletClaims = jdbcTemplate.query("""
                SELECT
                    c.ClaimID,
                    c.PromotionID,
                    c.SourcePostID,
                    c.ClaimedAt,
                    c.UsedAt,
                    c.UsedPaymentID,
                    p.PromoCode,
                    p.Description,
                    p.DiscountPercent,
                    p.DiscountAmount,
                    p.ApplyTarget,
                    p.BonusDurationMonths,
                    p.ValidFrom,
                    p.ValidTo,
                    p.IsActive,
                    CASE
                        WHEN c.UsedAt IS NOT NULL THEN 'USED'
                        WHEN p.IsActive = 1
                             AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(p.ValidFrom AS DATE) AND CAST(p.ValidTo AS DATE)
                             THEN 'ACTIVE'
                        ELSE 'EXPIRED'
                    END AS WalletState
                FROM dbo.UserPromotionClaims c
                JOIN dbo.Promotions p ON p.PromotionID = c.PromotionID
                WHERE c.UserID = ?
                ORDER BY c.ClaimedAt DESC, c.ClaimID DESC
                """, (rs, rowNum) -> mapWalletClaim(rs), userId);

        List<Map<String, Object>> claimableOffers = jdbcTemplate.query("""
                SELECT
                    p.PromotionID,
                    p.PromoCode,
                    p.Description,
                    p.DiscountPercent,
                    p.DiscountAmount,
                    p.ApplyTarget,
                    p.BonusDurationMonths,
                    p.ValidFrom,
                    p.ValidTo,
                    post.PromotionPostID,
                    post.Title,
                    post.BannerUrl,
                    post.StartAt,
                    post.EndAt
                FROM dbo.PromotionPosts post
                JOIN dbo.Promotions p ON p.PromotionID = post.PromotionID
                LEFT JOIN dbo.UserPromotionClaims c
                    ON c.PromotionID = p.PromotionID
                   AND c.UserID = ?
                WHERE post.IsActive = 1
                  AND p.IsActive = 1
                  AND c.ClaimID IS NULL
                  AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(post.StartAt AS DATE) AND CAST(post.EndAt AS DATE)
                  AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(p.ValidFrom AS DATE) AND CAST(p.ValidTo AS DATE)
                ORDER BY post.CreatedAt DESC, post.PromotionPostID DESC
                """, (rs, rowNum) -> mapClaimableOffer(rs), userId);

        List<Map<String, Object>> usedClaims = walletClaims.stream()
                .filter(claim -> "USED".equals(claim.get("walletState")))
                .toList();
        List<Map<String, Object>> expiredClaims = walletClaims.stream()
                .filter(claim -> "EXPIRED".equals(claim.get("walletState")))
                .toList();

        Map<String, Object> wallet = new java.util.LinkedHashMap<>();
        wallet.put("claimableOffers", claimableOffers);
        wallet.put("activeClaims", walletClaims.stream()
                .filter(claim -> "ACTIVE".equals(claim.get("walletState")))
                .toList());
        wallet.put("usedClaims", usedClaims);
        wallet.put("expiredClaims", expiredClaims);
        wallet.put("allClaims", walletClaims);

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("claims", activeClaims);
        response.put("claimableOffers", claimableOffers);
        response.put("wallet", wallet);
        return response;
    }

    private List<Map<String, Object>> loadActiveClaims(int userId) {
        return jdbcTemplate.queryForList("""
                SELECT c.*, p.PromoCode, p.Description, p.DiscountPercent, p.DiscountAmount, p.ApplyTarget, p.BonusDurationMonths
                FROM dbo.UserPromotionClaims c
                JOIN dbo.Promotions p ON p.PromotionID = c.PromotionID
                WHERE c.UserID = ? AND c.UsedAt IS NULL
                AND p.IsActive = 1
                AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(p.ValidFrom AS DATE) AND CAST(p.ValidTo AS DATE)
                """, userId);
    }

    private Map<String, Object> mapWalletClaim(java.sql.ResultSet rs) throws java.sql.SQLException {
        Map<String, Object> claim = new java.util.LinkedHashMap<>();
        claim.put("claimId", rs.getInt("ClaimID"));
        claim.put("promotionId", rs.getInt("PromotionID"));
        claim.put("sourcePostId", rs.getObject("SourcePostID"));
        claim.put("claimedAt", rs.getTimestamp("ClaimedAt"));
        claim.put("usedAt", rs.getTimestamp("UsedAt"));
        claim.put("usedPaymentId", rs.getObject("UsedPaymentID"));
        claim.put("promoCode", rs.getString("PromoCode"));
        claim.put("description", rs.getString("Description"));
        claim.put("discountPercent", rs.getBigDecimal("DiscountPercent"));
        claim.put("discountAmount", rs.getBigDecimal("DiscountAmount"));
        claim.put("applyTarget", rs.getString("ApplyTarget"));
        claim.put("bonusDurationMonths", rs.getInt("BonusDurationMonths"));
        claim.put("validFrom", rs.getObject("ValidFrom"));
        claim.put("validTo", rs.getObject("ValidTo"));
        claim.put("walletState", rs.getString("WalletState"));
        claim.put("entrySource", rs.getObject("SourcePostID") == null ? "MANUAL" : "POST");
        claim.put("claimableNow", "ACTIVE".equals(rs.getString("WalletState")));
        return claim;
    }

    private Map<String, Object> mapClaimableOffer(java.sql.ResultSet rs) throws java.sql.SQLException {
        Map<String, Object> offer = new java.util.LinkedHashMap<>();
        offer.put("promotionId", rs.getInt("PromotionID"));
        offer.put("promotionPostId", rs.getInt("PromotionPostID"));
        offer.put("promoCode", rs.getString("PromoCode"));
        offer.put("description", rs.getString("Description"));
        offer.put("discountPercent", rs.getBigDecimal("DiscountPercent"));
        offer.put("discountAmount", rs.getBigDecimal("DiscountAmount"));
        offer.put("applyTarget", rs.getString("ApplyTarget"));
        offer.put("bonusDurationMonths", rs.getInt("BonusDurationMonths"));
        offer.put("validFrom", rs.getObject("ValidFrom"));
        offer.put("validTo", rs.getObject("ValidTo"));
        offer.put("title", rs.getString("Title"));
        offer.put("bannerUrl", rs.getString("BannerUrl"));
        offer.put("startAt", rs.getObject("StartAt"));
        offer.put("endAt", rs.getObject("EndAt"));
        offer.put("walletState", "CLAIMABLE");
        return offer;
    }

    private Map<String, Object> customerGetNotifications(String auth, Map<String, Object> payload) {
        boolean unreadOnly = payload != null && Boolean.TRUE.equals(payload.get("unreadOnly"));
        String view = payload == null ? "all" : String.valueOf(payload.getOrDefault("view", "all"));
        return notificationService.getCurrentUserNotifications(auth, unreadOnly, view);
    }

    private Map<String, Object> customerMarkRead(String auth, Map<String, Object> payload) {
        int notificationId = requireInt(payload.get("notificationId"), "Notification ID is required.");
        return notificationService.markNotificationReadState(auth, notificationId, true);
    }

    private Map<String, Object> customerMarkUnread(String auth, Map<String, Object> payload) {
        int notificationId = requireInt(payload.get("notificationId"), "Notification ID is required.");
        return notificationService.markNotificationReadState(auth, notificationId, false);
    }

    private Map<String, Object> customerMarkAllRead(String auth) {
        return notificationService.markAllNotificationsRead(auth);
    }

    private Map<String, Object> findPromotionPostState(int postId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT TOP (1) IsActive, IsImportant
                FROM dbo.PromotionPosts
                WHERE PromotionPostID = ?
                """, postId);
        if (rows.isEmpty()) {
            return Map.of("IsActive", 0, "IsImportant", 0);
        }
        return rows.get(0);
    }

    private boolean isPromotionPostBroadcastEligible(Map<String, Object> postState) {
        if (postState == null) {
            return false;
        }
        return requireBit(postState.get("IsActive")) == 1 && requireBit(postState.get("IsImportant")) == 1;
    }

    private void publishPromotionPostIfNeeded(Integer postId, Object title, int isActive, int isImportant) {
        if (postId == null || isActive != 1 || isImportant != 1) {
            return;
        }
        String normalizedTitle = String.valueOf(title == null ? "New promotion" : title);
        notificationService.notifyAllCustomers(
                "PROMOTION_POST_PUBLISHED",
                "New promotion available",
                normalizedTitle + " is now live. Open Promotions to claim it before it expires.",
                "/customer/promotions",
                postId,
                "PROMOTION_POST_" + postId);
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
                return new java.math.BigDecimal(String.valueOf(number));
            }
            return new java.math.BigDecimal(String.valueOf(value).trim());
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid decimal value.");
        } catch (ArithmeticException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid decimal value.");
        }
    }

    private java.math.BigDecimal optionalNonNegativeDecimal(Object value, String message) {
        java.math.BigDecimal decimal = requireDecimal(value);
        if (decimal == null) {
            return null;
        }
        if (decimal.compareTo(java.math.BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return decimal;
    }

    private int requireNonNegativeInt(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return 0;
        }
        try {
            int parsed;
            if (value instanceof Number number) {
                parsed = number.intValue();
            } else {
                parsed = Integer.parseInt(String.valueOf(value).trim());
            }
            if (parsed < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bonus duration months cannot be negative.");
            }
            return parsed;
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bonus duration months must be an integer.");
        }
    }

    private void validateCouponBenefit(java.math.BigDecimal discountPercent, java.math.BigDecimal discountAmount,
            int bonusDurationMonths, String applyTarget) {
        if (discountPercent != null && discountAmount != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only one discount type is allowed (percent or amount).");
        }
        validateDecimalScale(discountPercent, "Discount percent");
        validateDecimalScale(discountAmount, "Discount amount");

        if (discountPercent != null) {
            if (discountPercent.compareTo(java.math.BigDecimal.ZERO) < 0
                    || discountPercent.compareTo(MAX_DISCOUNT_PERCENT) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Discount percent must be between 0 and 100.");
            }
        }

        if (discountAmount != null) {
            if (discountAmount.compareTo(java.math.BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Discount amount must be greater than or equal to 0.");
            }
            if (discountAmount.compareTo(MAX_DISCOUNT_AMOUNT) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Discount amount exceeds the maximum supported value.");
            }
        }

        boolean hasDiscountPercent = discountPercent != null
                && discountPercent.compareTo(java.math.BigDecimal.ZERO) > 0;
        boolean hasDiscountAmount = discountAmount != null
                && discountAmount.compareTo(java.math.BigDecimal.ZERO) > 0;
        if (!hasDiscountPercent && !hasDiscountAmount && bonusDurationMonths == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Coupon must include discount or bonus duration.");
        }
        if ("ORDER".equals(applyTarget) && bonusDurationMonths > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Product coupons cannot include bonus membership months.");
        }
    }

    private void validateDecimalScale(java.math.BigDecimal value, String fieldName) {
        if (value == null) {
            return;
        }
        if (value.scale() > 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    fieldName + " must have at most 2 decimal places.");
        }
    }

    private java.time.LocalDate requireDate(Object value, String message) {
        String text = requireText(value, message);
        try {
            return java.time.LocalDate.parse(text);
        } catch (java.time.format.DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private void validateCouponDateWindow(java.time.LocalDate validFrom, java.time.LocalDate validTo) {
        if (validTo.isBefore(validFrom)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Valid to must be on or after valid from.");
        }
    }

    private String normalizeApplyTarget(Object value) {
        if (value == null) {
            return "ORDER";
        }
        String normalized = String.valueOf(value).trim().toUpperCase();
        if (normalized.isBlank()) {
            return "ORDER";
        }
        if (!"ORDER".equals(normalized) && !"MEMBERSHIP".equals(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target must be ORDER or MEMBERSHIP.");
        }
        return normalized;
    }

    private String detectImageExtension(byte[] bytes) {
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47
                && bytes[4] == 0x0D
                && bytes[5] == 0x0A
                && bytes[6] == 0x1A
                && bytes[7] == 0x0A) {
            return "png";
        }
        if (bytes.length >= 12
                && bytes[0] == 0x52
                && bytes[1] == 0x49
                && bytes[2] == 0x46
                && bytes[3] == 0x46
                && bytes[8] == 0x57
                && bytes[9] == 0x45
                && bytes[10] == 0x42
                && bytes[11] == 0x50) {
            return "webp";
        }
        return null;
    }

    private boolean tryDeleteManagedPromotionBannerIfUnused(String imageUrl) {
        Path storedPath = resolveManagedPromotionBannerPath(imageUrl);
        if (storedPath == null) {
            return false;
        }

        Integer usageCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.PromotionPosts
                WHERE BannerUrl = ?
                """, Integer.class, imageUrl);
        if (usageCount != null && usageCount > 0) {
            return false;
        }

        try {
            return Files.deleteIfExists(storedPath);
        } catch (Exception ignored) {
            return false;
        }
    }

    private Path resolveManagedPromotionBannerPath(String imageUrl) {
        String normalizedUrl = imageUrl == null ? null : String.valueOf(imageUrl).trim();
        if (normalizedUrl == null || !normalizedUrl.startsWith("/uploads/promotions/")) {
            return null;
        }

        String relative = normalizedUrl.substring("/uploads/promotions/".length());
        Path configuredRoot = Paths.get(promotionImageDir).toAbsolutePath().normalize();
        Path resolved = configuredRoot.resolve(relative.replace("/", java.io.File.separator)).normalize();
        if (!resolved.startsWith(configuredRoot)) {
            return null;
        }
        return resolved;
    }

    private java.math.BigDecimal calculateDiscount(java.math.BigDecimal subtotal, java.math.BigDecimal discountPercent,
            java.math.BigDecimal discountAmount) {
        if (subtotal.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            return java.math.BigDecimal.ZERO;
        }
        java.math.BigDecimal discount = java.math.BigDecimal.ZERO;
        if (discountPercent != null && discountPercent.compareTo(java.math.BigDecimal.ZERO) > 0) {
            discount = subtotal.multiply(discountPercent)
                    .divide(java.math.BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        } else if (discountAmount != null && discountAmount.compareTo(java.math.BigDecimal.ZERO) > 0) {
            discount = discountAmount;
        }
        if (discount.compareTo(subtotal) > 0) {
            return subtotal;
        }
        return discount;
    }

    private String requireText(Object value, String message) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        String text = String.valueOf(value).trim();
        if (text.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return text;
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
