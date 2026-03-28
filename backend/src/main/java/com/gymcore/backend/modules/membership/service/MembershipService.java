package com.gymcore.backend.modules.membership.service;

import com.gymcore.backend.common.service.UserNotificationService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import com.gymcore.backend.modules.auth.service.CurrentUserService.UserInfo;
import com.gymcore.backend.modules.coach.service.CoachBookingService;
import com.gymcore.backend.modules.product.service.OrderInvoiceService;
import com.gymcore.backend.modules.product.service.PayOsService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MembershipService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final int CHECKOUT_REUSE_WINDOW_MINUTES = 5;

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final PayOsService payOsService;
    private final UserNotificationService notificationService;
    private final OrderInvoiceService orderInvoiceService;
    private final CoachBookingService coachBookingService;

    public MembershipService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService,
            PayOsService payOsService, UserNotificationService notificationService,
            OrderInvoiceService orderInvoiceService, CoachBookingService coachBookingService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.payOsService = payOsService;
        this.notificationService = notificationService;
        this.orderInvoiceService = orderInvoiceService;
        this.coachBookingService = coachBookingService;
    }

    public Map<String, Object> execute(String action, String authorizationHeader, Object payload) {
        Map<String, Object> safePayload = payload == null ? Map.of() : castToMap(payload);
        return switch (action) {
            case "customer-get-plans" -> customerGetPlans();
            case "customer-get-plan-detail" -> customerGetPlanDetail(safePayload);
            case "customer-get-current-membership" -> customerGetCurrentMembership(authorizationHeader);
            case "customer-get-membership-history" -> customerGetMembershipHistory(authorizationHeader);
            case "customer-purchase-membership" -> customerCreateCheckout(authorizationHeader, safePayload, CheckoutMode.PURCHASE);
            case "customer-renew-membership" -> customerCreateCheckout(authorizationHeader, safePayload, CheckoutMode.RENEW);
            case "customer-upgrade-membership" -> customerCreateCheckout(authorizationHeader, safePayload, CheckoutMode.UPGRADE);
            case "customer-upgrade-scheduled-membership" -> customerCreateCheckout(authorizationHeader, safePayload, CheckoutMode.UPGRADE_SCHEDULED);
            case "customer-upgrade-renew-membership" -> customerCreateCheckout(authorizationHeader, safePayload, CheckoutMode.UPGRADE_RENEW);
            case "customer-switch-membership-now" -> customerSwitchMembershipNow(authorizationHeader, safePayload);
            case "customer-confirm-payment-return" -> customerConfirmPaymentReturn(authorizationHeader, safePayload);
            case "payment-webhook" -> handlePaymentWebhook(safePayload);
            case "admin-get-plans" -> adminGetPlans(authorizationHeader);
            case "admin-create-plan" -> adminCreatePlan(authorizationHeader, safePayload);
            case "admin-update-plan" -> adminUpdatePlan(authorizationHeader, safePayload);
            default ->
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported membership action: " + action);
        };
    }

    private Map<String, Object> customerGetPlans() {
        String sql = """
                SELECT
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking,
                    mp.IsActive
                FROM dbo.MembershipPlans mp
                WHERE mp.IsActive = 1
                ORDER BY
                    CASE mp.PlanType
                        WHEN 'DAY_PASS' THEN 1
                        WHEN 'GYM_ONLY' THEN 2
                        WHEN 'GYM_PLUS_COACH' THEN 3
                        ELSE 4
                    END,
                    mp.DurationDays ASC,
                    mp.MembershipPlanID ASC
                """;
        List<Map<String, Object>> plans = jdbcTemplate.query(sql, (rs, rowNum) -> mapPlan(rs));
        return Map.of("plans", plans);
    }

    private Map<String, Object> customerGetPlanDetail(Map<String, Object> payload) {
        int planId = requirePositiveInt(firstNonNull(payload.get("planId"), payload.get("membershipPlanId")),
                "Membership plan ID is required.");

        String sql = """
                SELECT
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking,
                    mp.IsActive,
                    mp.CreatedAt,
                    mp.UpdatedAt
                FROM dbo.MembershipPlans mp
                WHERE mp.MembershipPlanID = ?
                  AND mp.IsActive = 1
                """;
        List<Map<String, Object>> plans = jdbcTemplate.query(sql, (rs, rowNum) -> mapPlan(rs), planId);
        if (plans.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership plan not found.");
        }
        return Map.of("plan", plans.get(0));
    }

    private Map<String, Object> customerGetCurrentMembership(String authorizationHeader) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        expireStalePendingCheckouts(user.userId());
        List<Map<String, Object>> expiredMembershipHistory = findExpiredMembershipHistory(user.userId());

        String sql = """
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    CASE
                        WHEN cm.EndDate < CAST(GETDATE() AS DATE) THEN 'EXPIRED'
                        ELSE cm.Status
                    END AS Status,
                    cm.StartDate,
                    cm.EndDate,
                    cm.CreatedAt AS MembershipCreatedAt,
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking,
                    pay.PaymentID,
                    pay.Status AS PaymentStatus,
                    pay.PaymentMethod AS PaymentMethod,
                    pay.PayOS_Status,
                    pay.PayOS_CheckoutUrl,
                    pay.OriginalAmount AS OriginalAmount,
                    pay.DiscountAmount AS DiscountAmount,
                    pay.Amount AS PaymentAmount,
                    pay.ClaimID AS ClaimID,
                    pay.PromoCode AS PromoCode,
                    pay.ApplyTarget AS ApplyTarget,
                    pay.BonusDurationMonths AS BonusDurationMonths,
                    pay.CreatedAt AS PaymentCreatedAt
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                OUTER APPLY (
                    SELECT TOP (1)
                        p.PaymentID,
                        p.Status,
                        p.PaymentMethod,
                        p.PayOS_Status,
                        p.PayOS_CheckoutUrl,
                        p.OriginalAmount,
                        p.DiscountAmount,
                        p.Amount,
                        p.ClaimID,
                        promo.PromoCode,
                        promo.ApplyTarget,
                        promo.BonusDurationMonths,
                        p.CreatedAt
                    FROM dbo.Payments p
                    LEFT JOIN dbo.UserPromotionClaims c ON c.ClaimID = p.ClaimID
                    LEFT JOIN dbo.Promotions promo ON promo.PromotionID = c.PromotionID
                    WHERE p.CustomerMembershipID = cm.CustomerMembershipID
                    ORDER BY p.PaymentID DESC
                ) pay
                WHERE cm.CustomerID = ?
                  AND (
                      cm.Status IN ('ACTIVE', 'SCHEDULED', 'EXPIRED')
                      OR cm.EndDate < CAST(GETDATE() AS DATE)
                  )
                ORDER BY
                    CASE
                        WHEN cm.EndDate >= CAST(GETDATE() AS DATE) AND cm.Status = 'ACTIVE' THEN 1
                        WHEN cm.Status = 'SCHEDULED' THEN 2
                        WHEN cm.EndDate < CAST(GETDATE() AS DATE) THEN 3
                        WHEN cm.Status = 'EXPIRED' THEN 3
                        ELSE 4
                    END,
                    cm.EndDate DESC,
                    cm.CustomerMembershipID DESC
                """;

        List<Map<String, Object>> rows = jdbcTemplate.query(sql, (rs, rowNum) -> mapMembershipStatusRow(rs), user.userId());
        if (rows.isEmpty()) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("membership", Map.of());
            response.put("validForCheckin", false);
            response.put("reason", "Customer does not have a membership.");
            response.put("expiredMembershipHistory", expiredMembershipHistory);
            return response;
        }

        Map<String, Object> response = new LinkedHashMap<>(rows.get(0));
        response.put("expiredMembershipHistory", expiredMembershipHistory);
        @SuppressWarnings("unchecked")
        Map<String, Object> membership = (Map<String, Object>) response.get("membership");
        if (membership != null && "ACTIVE".equalsIgnoreCase(String.valueOf(membership.get("status")))) {
            Map<String, Object> queuedMembership = findQueuedMembership(user.userId());
            if (!queuedMembership.isEmpty()) {
                response.put("queuedMembership", queuedMembership);
            }
        }
        return response;
    }

    private Map<String, Object> findQueuedMembership(int customerId) {
        String sql = """
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    cm.Status,
                    cm.StartDate,
                    cm.EndDate,
                    cm.CreatedAt AS MembershipCreatedAt,
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking,
                    pay.PaymentID,
                    pay.Status AS PaymentStatus,
                    pay.PaymentMethod AS PaymentMethod,
                    pay.PayOS_Status,
                    pay.PayOS_CheckoutUrl,
                    pay.OriginalAmount AS OriginalAmount,
                    pay.DiscountAmount AS DiscountAmount,
                    pay.Amount AS PaymentAmount,
                    pay.ClaimID AS ClaimID,
                    pay.PromoCode AS PromoCode,
                    pay.ApplyTarget AS ApplyTarget,
                    pay.BonusDurationMonths AS BonusDurationMonths,
                    pay.CreatedAt AS PaymentCreatedAt
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                OUTER APPLY (
                    SELECT TOP (1)
                        p.PaymentID,
                        p.Status,
                        p.PaymentMethod,
                        p.PayOS_Status,
                        p.PayOS_CheckoutUrl,
                        p.OriginalAmount,
                        p.DiscountAmount,
                        p.Amount,
                        p.ClaimID,
                        promo.PromoCode,
                        promo.ApplyTarget,
                        promo.BonusDurationMonths,
                        p.CreatedAt
                    FROM dbo.Payments p
                    LEFT JOIN dbo.UserPromotionClaims c ON c.ClaimID = p.ClaimID
                    LEFT JOIN dbo.Promotions promo ON promo.PromotionID = c.PromotionID
                    WHERE p.CustomerMembershipID = cm.CustomerMembershipID
                    ORDER BY p.PaymentID DESC
                ) pay
                WHERE cm.CustomerID = ?
                  AND cm.Status = 'SCHEDULED'
                ORDER BY cm.StartDate ASC, cm.CustomerMembershipID DESC
                """;

        List<Map<String, Object>> rows = jdbcTemplate.query(sql, (rs, rowNum) -> mapMembershipStatusRow(rs), customerId);
        if (rows.isEmpty()) {
            return Map.of();
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> membership = (Map<String, Object>) rows.get(0).get("membership");
        return membership == null ? Map.of() : membership;
    }

    private Map<String, Object> customerCreateCheckout(
            String authorizationHeader,
            Map<String, Object> payload,
            CheckoutMode mode) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        String paymentMethod = normalizePaymentMethod(payload.get("paymentMethod"));
        int planId = requirePositiveInt(firstNonNull(payload.get("planId"), payload.get("membershipPlanId")),
                "Membership plan ID is required.");
        MembershipPlan plan = requireActivePlan(planId);
        MembershipSnapshot activeMembership = findTopMembership(user.userId(), "ACTIVE");
        MembershipSnapshot scheduledMembership = findTopMembership(user.userId(), "SCHEDULED");
        MembershipSnapshot expiredMembership = findTopMembership(user.userId(), "EXPIRED");
        String returnUrl = asNullableString(payload.get("returnUrl"));
        String cancelUrl = asNullableString(payload.get("cancelUrl"));
        String promoCode = asNullableString(payload.get("promoCode"));

        if (mode == CheckoutMode.UPGRADE_RENEW && "DAY_PASS".equalsIgnoreCase(plan.planType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Day Pass cannot use upgrade instantly and renew.");
        }

        LocalDate startDate = resolveStartDate(mode, activeMembership, scheduledMembership, expiredMembership, planId);
        if (plan.price().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Membership plan price must be greater than zero for PayOS checkout.");
        }

        BigDecimal subtotal = plan.price();
        CouponApplication coupon = resolveMembershipCoupon(user.userId(), promoCode, subtotal);
        BigDecimal discount = coupon == null ? BigDecimal.ZERO : coupon.discountAmount();
        BigDecimal totalAmount = subtotal.subtract(discount);
        int bonusDurationMonths = coupon == null ? 0 : coupon.bonusDurationMonths();
        if ("DAY_PASS".equalsIgnoreCase(plan.planType()) && bonusDurationMonths > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Day Pass cannot use bonus membership months.");
        }
        Integer claimId = coupon == null ? null : coupon.claimId();
        LocalDate endDate = resolveCheckoutEndDate(mode, plan, startDate, bonusDurationMonths, activeMembership);
        expireStalePendingCheckouts(user.userId());

        Map<String, Object> existingPending = findExistingPendingCheckout(
                user.userId(),
                plan,
                startDate,
                endDate,
                mode,
                claimId);
        if (!existingPending.isEmpty()) {
            return existingPending;
        }

        CheckoutContact contact = loadCheckoutContact(user.userId());

        int customerMembershipId = insertCustomerMembership(plan, user.userId(), startDate, endDate);
        int paymentId = insertPaymentForMembership(customerMembershipId, claimId, subtotal, discount, totalAmount,
                paymentMethod);

        if (totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return completeZeroAmountMembershipCheckout(
                    paymentId,
                    customerMembershipId,
                    subtotal,
                    discount,
                    totalAmount,
                    paymentMethod,
                    mode,
                    plan,
                    startDate,
                    endDate);
        }

        List<PayOsService.PayOsItem> payOsItems = List.of(
                new PayOsService.PayOsItem(
                        plan.planName(),
                        1,
                        toPayOsAmount(totalAmount),
                        "package",
                        0));

        String description = switch (mode) {
            case RENEW -> "Renew #" + customerMembershipId;
            case UPGRADE -> "Upgrade #" + customerMembershipId;
            case UPGRADE_SCHEDULED -> "UpgradeScheduled #" + customerMembershipId;
            case UPGRADE_RENEW -> "UpgradeRenew #" + customerMembershipId;
            default -> "Membership #" + customerMembershipId;
        };

        PayOsService.PayOsLink link;
        try {
            link = payOsService.createPaymentLink(
                    paymentId,
                    totalAmount,
                    description,
                    contact.buyerName(),
                    contact.buyerPhone(),
                    contact.buyerEmail(),
                    "GymCore Membership",
                    payOsItems,
                    returnUrl,
                    cancelUrl);
        } catch (RuntimeException exception) {
            markCheckoutCreationFailed(customerMembershipId, paymentId);
            throw exception;
        }

        int updatedRows = jdbcTemplate.update("""
                UPDATE dbo.Payments
                SET PayOS_PaymentLinkId = ?, PayOS_CheckoutUrl = ?, PayOS_Status = ?
                WHERE PaymentID = ? AND Status = 'PENDING'
                """, link.paymentLinkId(), link.checkoutUrl(), link.status(), paymentId);
        if (updatedRows == 0) {
            markCheckoutCreationFailed(customerMembershipId, paymentId);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Payment state changed unexpectedly during checkout.");
        }

        return buildCheckoutResponse(
                paymentId,
                customerMembershipId,
                link.checkoutUrl(),
                subtotal,
                discount,
                totalAmount,
                paymentMethod,
                mode,
                plan,
                startDate,
                endDate,
                false);
    }

    private Map<String, Object> completeZeroAmountMembershipCheckout(
            int paymentId,
            int customerMembershipId,
            BigDecimal subtotal,
            BigDecimal discount,
            BigDecimal totalAmount,
            String paymentMethod,
            CheckoutMode mode,
            MembershipPlan plan,
            LocalDate startDate,
            LocalDate endDate) {
        try {
            jdbcTemplate.update("""
                    UPDATE dbo.Payments
                    SET PayOS_Status = ?,
                        PaymentMethod = ?
                    WHERE PaymentID = ? AND Status = 'PENDING'
                    """, "SUCCESS", paymentMethod, paymentId);
            jdbcTemplate.update("EXEC dbo.sp_ConfirmPaymentSuccess ?", paymentId);
            applyImmediateUpgradeActivationIfNeeded(paymentId);
            applyScheduledUpgradeReplacementIfNeeded(paymentId);
            syncCoachBookingCoverageIfNeeded(paymentId);
            markMembershipClaimUsageIfNeeded(paymentId);
            notifySuccessfulPayment(paymentId);
        } catch (Exception exception) {
            markCheckoutCreationFailed(customerMembershipId, paymentId);
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to complete zero-amount membership checkout.",
                    exception);
        }

        Map<String, Object> response = buildCheckoutResponse(
                paymentId,
                customerMembershipId,
                null,
                subtotal,
                discount,
                totalAmount.max(BigDecimal.ZERO),
                paymentMethod,
                mode,
                plan,
                startDate,
                endDate,
                false);
        response.put("status", "SUCCESS");
        response.put("completedWithoutPayment", true);
        response.put("message", "Membership activated successfully.");
        @SuppressWarnings("unchecked")
        Map<String, Object> membership = (Map<String, Object>) response.get("membership");
        if (membership != null) {
            membership.put("status", "ACTIVE");
        }
        return response;
    }

    private Map<String, Object> customerGetMembershipHistory(String authorizationHeader) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        expireStalePendingCheckouts(user.userId());

        String sql = """
                SELECT
                    cm.CustomerMembershipID,
                    CASE
                        WHEN cm.EndDate < CAST(GETDATE() AS DATE) THEN 'EXPIRED'
                        ELSE cm.Status
                    END AS Status,
                    cm.StartDate,
                    cm.EndDate,
                    cm.CreatedAt AS MembershipCreatedAt,
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking,
                    pay.PaymentID,
                    pay.Status AS PaymentStatus,
                    pay.PaymentMethod AS PaymentMethod,
                    pay.PayOS_Status,
                    pay.PayOS_CheckoutUrl,
                    pay.OriginalAmount AS OriginalAmount,
                    pay.DiscountAmount AS DiscountAmount,
                    pay.Amount AS PaymentAmount,
                    pay.ClaimID AS ClaimID,
                    pay.PromoCode AS PromoCode,
                    pay.ApplyTarget AS ApplyTarget,
                    pay.BonusDurationMonths AS BonusDurationMonths,
                    pay.CreatedAt AS PaymentCreatedAt
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                OUTER APPLY (
                    SELECT TOP (1)
                        p.PaymentID,
                        p.Status,
                        p.PaymentMethod,
                        p.PayOS_Status,
                        p.PayOS_CheckoutUrl,
                        p.OriginalAmount,
                        p.DiscountAmount,
                        p.Amount,
                        p.ClaimID,
                        promo.PromoCode,
                        promo.ApplyTarget,
                        promo.BonusDurationMonths,
                        p.CreatedAt
                    FROM dbo.Payments p
                    LEFT JOIN dbo.UserPromotionClaims c ON c.ClaimID = p.ClaimID
                    LEFT JOIN dbo.Promotions promo ON promo.PromotionID = c.PromotionID
                    WHERE p.CustomerMembershipID = cm.CustomerMembershipID
                    ORDER BY p.PaymentID DESC
                ) pay
                WHERE cm.CustomerID = ?
                  AND (
                      pay.PaymentID IS NOT NULL
                      OR cm.Status IN ('ACTIVE', 'SCHEDULED', 'EXPIRED', 'CANCELLED')
                      OR cm.EndDate < CAST(GETDATE() AS DATE)
                  )
                ORDER BY
                    COALESCE(pay.CreatedAt, cm.CreatedAt) DESC,
                    cm.CustomerMembershipID DESC
                """;

        List<Map<String, Object>> rows = jdbcTemplate.query(sql, (rs, rowNum) -> mapMembershipStatusRow(rs), user.userId());
        List<Map<String, Object>> memberships = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            @SuppressWarnings("unchecked")
            Map<String, Object> membership = (Map<String, Object>) row.get("membership");
            if (membership != null && !membership.isEmpty()) {
                membership.put("validForCheckin", row.get("validForCheckin"));
                membership.put("reason", row.get("reason"));
                memberships.add(membership);
            }
        }

        return Map.of("memberships", memberships);
    }

    private Map<String, Object> customerSwitchMembershipNow(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        expireStalePendingCheckouts(user.userId());

        Integer requestedMembershipId = tryParsePositiveInt(firstNonNull(
                payload.get("customerMembershipId"),
                payload.get("membershipId")));

        MembershipSnapshot activeMembership = findTopMembership(user.userId(), "ACTIVE");
        MembershipSnapshot scheduledMembership = findTopMembership(user.userId(), "SCHEDULED");

        if (activeMembership == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Customer does not have an ACTIVE membership to replace.");
        }
        if (scheduledMembership == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Customer does not have a queued membership to switch to.");
        }
        if (requestedMembershipId != null && requestedMembershipId.intValue() != scheduledMembership.customerMembershipId()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Queued membership does not match the requested membership.");
        }
        String activePlanType = loadMembershipPlanType(activeMembership.customerMembershipId());
        String scheduledPlanType = loadMembershipPlanType(scheduledMembership.customerMembershipId());
        if (membershipTierRank(scheduledPlanType) <= membershipTierRank(activePlanType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Switch now is only available when the queued membership is a higher tier plan.");
        }

        LocalDate today = LocalDate.now();
        LocalDate scheduledStartDate = scheduledMembership.startDate();
        LocalDate scheduledEndDate = scheduledMembership.endDate();
        long preservedDurationDays = 0;
        if (scheduledStartDate != null && scheduledEndDate != null) {
            preservedDurationDays = ChronoUnit.DAYS.between(scheduledStartDate, scheduledEndDate);
        }
        LocalDate newEndDate = today.plusDays(Math.max(0L, preservedDurationDays));

        jdbcTemplate.update("""
                UPDATE dbo.CustomerMemberships
                SET Status = 'EXPIRED',
                    EndDate = CASE WHEN EndDate > CAST(SYSDATETIME() AS DATE) THEN CAST(SYSDATETIME() AS DATE) ELSE EndDate END,
                    UpdatedAt = SYSDATETIME()
                WHERE CustomerMembershipID = ?
                  AND CustomerID = ?
                  AND Status = 'ACTIVE'
                """, activeMembership.customerMembershipId(), user.userId());

        jdbcTemplate.update("""
                UPDATE dbo.CustomerMemberships
                SET Status = 'ACTIVE',
                    StartDate = ?,
                    EndDate = ?,
                    UpdatedAt = SYSDATETIME()
                WHERE CustomerMembershipID = ?
                  AND CustomerID = ?
                  AND Status = 'SCHEDULED'
                """, java.sql.Date.valueOf(today), java.sql.Date.valueOf(newEndDate),
                scheduledMembership.customerMembershipId(), user.userId());

        return customerGetCurrentMembership(authorizationHeader);
    }

    private String loadMembershipPlanType(int customerMembershipId) {
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT mp.PlanType
                    FROM dbo.CustomerMemberships cm
                    JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                    WHERE cm.CustomerMembershipID = ?
                    """, String.class, customerMembershipId);
        } catch (org.springframework.dao.EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Membership plan not found.");
        }
    }

    private int membershipTierRank(String planType) {
        String normalized = upperText(planType);
        return switch (normalized) {
            case "DAY_PASS" -> 1;
            case "GYM_ONLY" -> 2;
            case "GYM_PLUS_COACH" -> 3;
            default -> 0;
        };
    }

    private List<Map<String, Object>> findExpiredMembershipHistory(int customerId) {
        String sql = """
                SELECT
                    cm.CustomerMembershipID,
                    CASE
                        WHEN cm.EndDate < CAST(GETDATE() AS DATE) THEN 'EXPIRED'
                        ELSE cm.Status
                    END AS Status,
                    cm.StartDate,
                    cm.EndDate,
                    cm.CreatedAt AS MembershipCreatedAt,
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking,
                    pay.PaymentID,
                    pay.Status AS PaymentStatus,
                    pay.PaymentMethod AS PaymentMethod,
                    pay.PayOS_Status,
                    pay.PayOS_CheckoutUrl,
                    pay.OriginalAmount AS OriginalAmount,
                    pay.DiscountAmount AS DiscountAmount,
                    pay.Amount AS PaymentAmount,
                    pay.ClaimID AS ClaimID,
                    pay.PromoCode AS PromoCode,
                    pay.ApplyTarget AS ApplyTarget,
                    pay.BonusDurationMonths AS BonusDurationMonths,
                    pay.CreatedAt AS PaymentCreatedAt
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                OUTER APPLY (
                    SELECT TOP (1)
                        p.PaymentID,
                        p.Status,
                        p.PaymentMethod,
                        p.PayOS_Status,
                        p.PayOS_CheckoutUrl,
                        p.OriginalAmount,
                        p.DiscountAmount,
                        p.Amount,
                        p.ClaimID,
                        promo.PromoCode,
                        promo.ApplyTarget,
                        promo.BonusDurationMonths,
                        p.CreatedAt
                    FROM dbo.Payments p
                    LEFT JOIN dbo.UserPromotionClaims c ON c.ClaimID = p.ClaimID
                    LEFT JOIN dbo.Promotions promo ON promo.PromotionID = c.PromotionID
                    WHERE p.CustomerMembershipID = cm.CustomerMembershipID
                    ORDER BY p.PaymentID DESC
                ) pay
                WHERE cm.CustomerID = ?
                  AND (
                      cm.Status = 'EXPIRED'
                      OR (cm.Status = 'ACTIVE' AND cm.EndDate < CAST(GETDATE() AS DATE))
                  )
                ORDER BY cm.EndDate DESC, cm.CustomerMembershipID DESC
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            @SuppressWarnings("unchecked")
            Map<String, Object> membership = (Map<String, Object>) mapMembershipStatusRow(rs).get("membership");
            return membership == null ? Map.of() : membership;
        }, customerId);
    }

    private Map<String, Object> customerConfirmPaymentReturn(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;

        String status = upperText(firstNonNull(
                safePayload.get("status"),
                safePayload.get("payosStatus"),
                safePayload.get("paymentStatus")));
        String code = upperText(safePayload.get("code"));
        String cancel = upperText(safePayload.get("cancel"));
        Object successRaw = safePayload.get("success");

        if (!isSuccessReturnStatus(status, code, cancel, successRaw)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("handled", false);
            response.put("reason", "Ignored non-success return status.");
            return response;
        }

        Integer paymentId = resolvePaymentIdFromReturnPayload(safePayload);
        if (paymentId == null || paymentId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to resolve payment ID from PayOS return.");
        }

        Integer ownershipCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.Payments p
                JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = p.CustomerMembershipID
                WHERE p.PaymentID = ?
                  AND cm.CustomerID = ?
                """, Integer.class, paymentId, user.userId());

        if (ownershipCount == null || ownershipCount == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Payment does not belong to current customer.");
        }

        try {
            jdbcTemplate.update("EXEC dbo.sp_ConfirmPaymentSuccess ?", paymentId);
            applyImmediateUpgradeActivationIfNeeded(paymentId);
            applyScheduledUpgradeReplacementIfNeeded(paymentId);
            syncCoachBookingCoverageIfNeeded(paymentId);
            markMembershipClaimUsageIfNeeded(paymentId);
            notifySuccessfulPayment(paymentId);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to confirm payment from return URL.", exception);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("handled", true);
        response.put("paymentId", paymentId);
        response.put("status", "SUCCESS");
        return response;
    }

    /**
     * Handle PayOS webhook callback for both membership payments and product orders.
     *
     * Expected minimal payload:
     * - paymentId: numeric PaymentID in our database, or an encoded PayOS orderCode
     * - status / payosStatus: PayOS status string, we treat "PAID" or "SUCCESS" as success.
     * - headers: HttpHeaders from the original request, used for signature verification.
     */
    private Map<String, Object> handlePaymentWebhook(Map<String, Object> payload) {
        Object headersRaw = payload.get("headers");
        if (!(headersRaw instanceof HttpHeaders headers)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook headers are required.");
        }

        Object bodyRaw = payload.get("body");
        Map<String, Object> body = castToMap(bodyRaw);
        Map<String, Object> data = castToMap(body.get("data"));

        // Verify HMAC signature using PayOS checksum key.
        payOsService.verifyWebhookSignature(headers, body);

        Object paymentIdRaw = firstNonNull(
                body.get("paymentId"),
                body.get("orderCode"),
                data.get("paymentId"),
                data.get("orderCode"),
                body.get("paymentLinkId"),
                body.get("id"),
                data.get("paymentLinkId"),
                data.get("id"));
        String status = resolveStatus(body, data);

        int paymentId = resolvePaymentId(paymentIdRaw);
        if (!isSuccessfulStatus(status, body, data)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("handled", false);
            response.put("reason", "Ignored non-success payment status: " + status);
            return response;
        }

        try {
            jdbcTemplate.update("""
                    UPDATE dbo.Payments
                    SET PayOS_Status = ?
                    WHERE PaymentID = ? AND Status = 'PENDING'
                    """, normalizedSuccessStatus(status), paymentId);
            jdbcTemplate.update("EXEC dbo.sp_ConfirmPaymentSuccess ?", paymentId);
            applyImmediateUpgradeActivationIfNeeded(paymentId);
            applyScheduledUpgradeReplacementIfNeeded(paymentId);
            syncCoachBookingCoverageIfNeeded(paymentId);
            markMembershipClaimUsageIfNeeded(paymentId);
            notifySuccessfulPayment(paymentId);
            orderInvoiceService.handleSuccessfulProductPayment(paymentId);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to confirm payment.", exception);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("handled", true);
        response.put("paymentId", paymentId);
        response.put("status", normalizedSuccessStatus(status));
        return response;
    }

    private void applyImmediateUpgradeActivationIfNeeded(int paymentId) {
        UpgradeCandidate candidate;
        try {
            candidate = jdbcTemplate.queryForObject("""
                    SELECT TOP (1)
                        cm.CustomerMembershipID,
                        cm.CustomerID
                    FROM dbo.Payments p
                    JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = p.CustomerMembershipID
                    WHERE p.PaymentID = ?
                      AND cm.Status IN ('SCHEDULED', 'ACTIVE')
                      AND cm.StartDate <= CAST(SYSDATETIME() AS DATE)
                    """, (rs, rowNum) -> new UpgradeCandidate(
                    rs.getInt("CustomerMembershipID"),
                    rs.getInt("CustomerID")), paymentId);
        } catch (org.springframework.dao.EmptyResultDataAccessException ignored) {
            return;
        }
        if (candidate == null) {
            return;
        }

        Integer activeCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.CustomerMemberships
                WHERE CustomerID = ?
                  AND Status = 'ACTIVE'
                  AND CustomerMembershipID <> ?
                """, Integer.class, candidate.customerId(), candidate.customerMembershipId());
        if (activeCount == null || activeCount == 0) {
            return;
        }

        jdbcTemplate.update("""
                UPDATE dbo.CustomerMemberships
                SET Status = 'EXPIRED',
                    EndDate = CASE WHEN EndDate > CAST(SYSDATETIME() AS DATE) THEN CAST(SYSDATETIME() AS DATE) ELSE EndDate END,
                    UpdatedAt = SYSDATETIME()
                WHERE CustomerID = ?
                  AND Status = 'ACTIVE'
                  AND CustomerMembershipID <> ?
                """, candidate.customerId(), candidate.customerMembershipId());

        jdbcTemplate.update("""
                UPDATE dbo.CustomerMemberships
                SET Status = 'ACTIVE',
                    UpdatedAt = SYSDATETIME()
                WHERE CustomerMembershipID = ?
                  AND Status IN ('SCHEDULED', 'PENDING')
                """, candidate.customerMembershipId());
    }

    private void applyScheduledUpgradeReplacementIfNeeded(int paymentId) {
        UpgradeCandidate candidate;
        try {
            candidate = jdbcTemplate.queryForObject("""
                    SELECT TOP (1)
                        cm.CustomerMembershipID,
                        cm.CustomerID
                    FROM dbo.Payments p
                    JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = p.CustomerMembershipID
                    WHERE p.PaymentID = ?
                      AND cm.Status = 'SCHEDULED'
                      AND cm.StartDate > CAST(SYSDATETIME() AS DATE)
                    """, (rs, rowNum) -> new UpgradeCandidate(
                    rs.getInt("CustomerMembershipID"),
                    rs.getInt("CustomerID")), paymentId);
        } catch (org.springframework.dao.EmptyResultDataAccessException ignored) {
            return;
        }
        if (candidate == null) {
            return;
        }

        Integer otherScheduledCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.CustomerMemberships
                WHERE CustomerID = ?
                  AND Status = 'SCHEDULED'
                  AND CustomerMembershipID <> ?
                """, Integer.class, candidate.customerId(), candidate.customerMembershipId());
        if (otherScheduledCount == null || otherScheduledCount == 0) {
            return;
        }

        jdbcTemplate.update("""
                UPDATE dbo.CustomerMemberships
                SET Status = 'CANCELLED',
                    UpdatedAt = SYSDATETIME()
                WHERE CustomerID = ?
                  AND Status = 'SCHEDULED'
                  AND CustomerMembershipID <> ?
                """, candidate.customerId(), candidate.customerMembershipId());
    }

    private void syncCoachBookingCoverageIfNeeded(int paymentId) {
        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT TOP (1)
                    cm.CustomerID,
                    cm.CustomerMembershipID,
                    cm.StartDate,
                    cm.EndDate,
                    mp.PlanType,
                    mp.AllowsCoachBooking
                FROM dbo.Payments p
                JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = p.CustomerMembershipID
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE p.PaymentID = ?
                  AND p.CustomerMembershipID IS NOT NULL
                ORDER BY cm.CustomerMembershipID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("customerId", rs.getInt("CustomerID"));
            item.put("customerMembershipId", rs.getInt("CustomerMembershipID"));
            item.put("startDate", toLocalDate(rs, "StartDate"));
            item.put("endDate", toLocalDate(rs, "EndDate"));
            item.put("planType", rs.getString("PlanType"));
            item.put("allowsCoachBooking", rs.getBoolean("AllowsCoachBooking"));
            return item;
        }, paymentId);
        if (rows == null || rows.isEmpty()) {
            return;
        }

        Map<String, Object> membership = rows.getFirst();
        boolean allowsCoachBooking = Boolean.TRUE.equals(membership.get("allowsCoachBooking"));
        String planType = upperText(membership.get("planType"));
        if (!allowsCoachBooking || (!"GYM_PLUS_COACH".equals(planType) && !"GYM_COACH".equals(planType))) {
            return;
        }

        Integer customerId = tryParsePositiveInt(membership.get("customerId"));
        Integer customerMembershipId = tryParsePositiveInt(membership.get("customerMembershipId"));
        LocalDate startDate = (LocalDate) membership.get("startDate");
        LocalDate endDate = (LocalDate) membership.get("endDate");
        if (customerId == null || customerMembershipId == null || startDate == null || endDate == null) {
            return;
        }

        coachBookingService.extendApprovedPtCoverageIfNeeded(customerId, customerMembershipId, startDate, endDate);
    }

    private Map<String, Object> adminGetPlans(String authorizationHeader) {
        currentUserService.requireAdmin(authorizationHeader);
        String sql = """
                SELECT
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking,
                    mp.IsActive,
                    mp.CreatedAt,
                    mp.UpdatedAt
                FROM dbo.MembershipPlans mp
                ORDER BY
                    mp.IsActive DESC,
                    CASE mp.PlanType
                        WHEN 'DAY_PASS' THEN 1
                        WHEN 'GYM_ONLY' THEN 2
                        WHEN 'GYM_PLUS_COACH' THEN 3
                        ELSE 4
                    END,
                    mp.DurationDays ASC,
                    mp.MembershipPlanID DESC
                """;
        return Map.of("plans", jdbcTemplate.query(sql, (rs, rowNum) -> mapPlan(rs)));
    }

    private void notifySuccessfulPayment(int paymentId) {
        Integer membershipCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.Payments
                WHERE PaymentID = ? AND CustomerMembershipID IS NOT NULL
                """, Integer.class, paymentId);
        if (membershipCount != null && membershipCount > 0) {
            notifyMembershipPaymentSuccess(paymentId);
            return;
        }
        Integer orderCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.Payments
                WHERE PaymentID = ? AND OrderID IS NOT NULL
                """, Integer.class, paymentId);
        if (orderCount != null && orderCount > 0) {
            notifyOrderPaymentSuccess(paymentId);
        }
    }

    private void notifyMembershipPaymentSuccess(int paymentId) {
        jdbcTemplate.query("""
                SELECT TOP (1)
                    cm.CustomerID,
                    mp.PlanName,
                    p.Amount,
                    promo.PromoCode,
                    promo.BonusDurationMonths
                FROM dbo.Payments p
                JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = p.CustomerMembershipID
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                LEFT JOIN dbo.UserPromotionClaims c ON c.ClaimID = p.ClaimID
                LEFT JOIN dbo.Promotions promo ON promo.PromotionID = c.PromotionID
                WHERE p.PaymentID = ?
                """, rs -> {
            int customerId = rs.getInt("CustomerID");
            String planName = rs.getString("PlanName");
            BigDecimal amount = rs.getBigDecimal("Amount");
            String promoCode = asNullableString(rs.getString("PromoCode"));
            int bonusMonths = tryParsePositiveInt(rs.getObject("BonusDurationMonths")) == null ? 0
                    : tryParsePositiveInt(rs.getObject("BonusDurationMonths"));

            StringBuilder message = new StringBuilder("Your ")
                    .append(planName)
                    .append(" membership payment was confirmed");
            if (amount != null) {
                message.append(" for ").append(amount.stripTrailingZeros().toPlainString()).append(" VND");
            }
            if (promoCode != null) {
                message.append(". Coupon applied: ").append(promoCode);
                if (bonusMonths > 0) {
                    message.append(" (+").append(bonusMonths).append(" month");
                    if (bonusMonths != 1) {
                        message.append('s');
                    }
                    message.append(')');
                }
            } else {
                message.append(".");
            }

            notificationService.notifyUser(
                    customerId,
                    "MEMBERSHIP_PAYMENT_SUCCESS",
                    "Membership payment successful",
                    message.toString(),
                    "/customer/current-membership",
                    paymentId,
                    "PAYMENT_SUCCESS_" + paymentId);
        }, paymentId);
    }

    private void notifyOrderPaymentSuccess(int paymentId) {
        jdbcTemplate.query("""
                SELECT TOP (1)
                    o.CustomerID,
                    o.OrderID,
                    p.Amount
                FROM dbo.Payments p
                JOIN dbo.Orders o ON o.OrderID = p.OrderID
                WHERE p.PaymentID = ?
                """, rs -> {
            int customerId = rs.getInt("CustomerID");
            int orderId = rs.getInt("OrderID");
            BigDecimal amount = rs.getBigDecimal("Amount");
            String message = "Your product order #" + orderId + " payment was confirmed"
                    + (amount == null ? "." : " for " + amount.stripTrailingZeros().toPlainString() + " VND.");
            notificationService.notifyUser(
                    customerId,
                    "ORDER_PAYMENT_SUCCESS",
                    "Order payment successful",
                    message,
                    "/customer/shop",
                    orderId,
                    "ORDER_PAYMENT_SUCCESS_" + paymentId);
        }, paymentId);
    }

    private Map<String, Object> adminCreatePlan(String authorizationHeader, Map<String, Object> payload) {
        UserInfo admin = currentUserService.requireAdmin(authorizationHeader);
        PlanDraft draft = resolvePlanDraft(payload, null);

        Integer planId = jdbcTemplate.queryForObject("""
                INSERT INTO dbo.MembershipPlans
                    (PlanName, PlanType, Price, DurationDays, AllowsCoachBooking, IsActive, UpdatedAt, UpdatedBy)
                OUTPUT INSERTED.MembershipPlanID
                VALUES (?, ?, ?, ?, ?, ?, SYSDATETIME(), ?)
                """, Integer.class,
                draft.planName(),
                draft.planType(),
                draft.price(),
                draft.durationDays(),
                draft.allowsCoachBooking(),
                draft.active(),
                admin.userId());

        if (planId == null || planId <= 0) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create membership plan.");
        }
        return Map.of("plan", requireAdminPlanMap(planId));
    }

    private Map<String, Object> adminUpdatePlan(String authorizationHeader, Map<String, Object> payload) {
        UserInfo admin = currentUserService.requireAdmin(authorizationHeader);
        int planId = requirePositiveInt(payload.get("planId"), "Membership plan ID is required.");
        AdminMembershipPlan currentPlan = requireAdminPlan(planId);
        PlanDraft draft = resolvePlanDraft(castToMap(payload.get("body")), currentPlan);

        int updatedRows = jdbcTemplate.update("""
                UPDATE dbo.MembershipPlans
                SET PlanName = ?,
                    PlanType = ?,
                    Price = ?,
                    DurationDays = ?,
                    AllowsCoachBooking = ?,
                    IsActive = ?,
                    UpdatedAt = SYSDATETIME(),
                    UpdatedBy = ?
                WHERE MembershipPlanID = ?
                """,
                draft.planName(),
                draft.planType(),
                draft.price(),
                draft.durationDays(),
                draft.allowsCoachBooking(),
                draft.active(),
                admin.userId(),
                planId);

        if (updatedRows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership plan not found.");
        }
        return Map.of("plan", requireAdminPlanMap(planId));
    }

    private AdminMembershipPlan requireAdminPlan(int planId) {
        String sql = """
                SELECT
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking,
                    mp.IsActive
                FROM dbo.MembershipPlans mp
                WHERE mp.MembershipPlanID = ?
                """;
        List<AdminMembershipPlan> rows = jdbcTemplate.query(sql, (rs, rowNum) -> new AdminMembershipPlan(
                rs.getInt("MembershipPlanID"),
                rs.getString("PlanName"),
                rs.getString("PlanType"),
                rs.getBigDecimal("Price"),
                rs.getInt("DurationDays"),
                rs.getBoolean("AllowsCoachBooking"),
                rs.getBoolean("IsActive")), planId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership plan not found.");
        }
        return rows.get(0);
    }

    private Map<String, Object> requireAdminPlanMap(int planId) {
        String sql = """
                SELECT
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking,
                    mp.IsActive,
                    mp.CreatedAt,
                    mp.UpdatedAt
                FROM dbo.MembershipPlans mp
                WHERE mp.MembershipPlanID = ?
                """;
        List<Map<String, Object>> rows = jdbcTemplate.query(sql, (rs, rowNum) -> mapPlan(rs), planId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership plan not found.");
        }
        return rows.get(0);
    }

    private PlanDraft resolvePlanDraft(Map<String, Object> payload, AdminMembershipPlan currentPlan) {
        boolean isCreate = currentPlan == null;
        String rawName = asNullableString(firstNonNull(payload.get("planName"), payload.get("name"),
                isCreate ? null : currentPlan.planName()));
        if (rawName == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plan name is required.");
        }
        String planName = rawName.trim();
        if (planName.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plan name must not exceed 100 characters.");
        }

        String rawType = asNullableString(firstNonNull(payload.get("planType"), isCreate ? null : currentPlan.planType()));
        String planType = normalizePlanType(rawType);

        BigDecimal price = resolvePrice(firstNonNull(payload.get("price"), isCreate ? null : currentPlan.price()));
        int durationDays = resolveDurationDays(firstNonNull(payload.get("durationDays"), isCreate ? null : currentPlan.durationDays()));
        boolean active = resolveActive(firstNonNull(payload.get("isActive"), payload.get("active"),
                isCreate ? Boolean.TRUE : currentPlan.active()));

        if ("DAY_PASS".equals(planType)) {
            durationDays = 1;
        }
        boolean allowsCoachBooking = "GYM_PLUS_COACH".equals(planType);

        return new PlanDraft(planName, planType, price, durationDays, allowsCoachBooking, active);
    }

    private String normalizePlanType(String planTypeRaw) {
        if (planTypeRaw == null || planTypeRaw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plan type is required.");
        }
        String normalized = planTypeRaw.trim().toUpperCase()
                .replace(' ', '_')
                .replace('-', '_')
                .replace('+', '_');
        return switch (normalized) {
            case "DAY_PASS" -> "DAY_PASS";
            case "GYM_ONLY" -> "GYM_ONLY";
            case "GYM_PLUS_COACH", "GYM_COACH" -> "GYM_PLUS_COACH";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Plan type must be one of: DAY_PASS, GYM_ONLY, GYM_PLUS_COACH.");
        };
    }

    private BigDecimal resolvePrice(Object value) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Price is required.");
        }
        BigDecimal price;
        try {
            if (value instanceof BigDecimal decimal) {
                price = decimal;
            } else {
                price = new BigDecimal(String.valueOf(value).trim());
            }
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Price is invalid.");
        }
        if (price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Price must be greater than 0.");
        }
        return price.setScale(2, RoundingMode.HALF_UP);
    }

    private int resolveDurationDays(Object value) {
        Integer parsed = tryParsePositiveInt(value);
        if (parsed == null || parsed <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duration days must be a positive integer.");
        }
        return parsed;
    }

    private boolean resolveActive(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value == null) {
            return true;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return true;
        }
        if ("1".equals(text) || "TRUE".equalsIgnoreCase(text)) {
            return true;
        }
        if ("0".equals(text) || "FALSE".equalsIgnoreCase(text)) {
            return false;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Active flag must be true/false.");
    }

    private Map<String, Object> buildCheckoutResponse(
            int paymentId,
            int customerMembershipId,
            String checkoutUrl,
            BigDecimal subtotal,
            BigDecimal discount,
            BigDecimal totalAmount,
            String paymentMethod,
            CheckoutMode mode,
            MembershipPlan plan,
            LocalDate startDate,
            LocalDate endDate,
            boolean reusedCheckout) {
        Map<String, Object> planMap = new LinkedHashMap<>();
        planMap.put("planId", plan.planId());
        planMap.put("name", plan.planName());
        planMap.put("planType", plan.planType());
        planMap.put("price", plan.price());
        planMap.put("durationDays", plan.durationDays());
        planMap.put("allowsCoachBooking", plan.allowsCoachBooking());

        Map<String, Object> membershipMap = new LinkedHashMap<>();
        membershipMap.put("customerMembershipId", customerMembershipId);
        membershipMap.put("status", "PENDING");
        membershipMap.put("startDate", dateToString(startDate));
        membershipMap.put("endDate", dateToString(endDate));
        membershipMap.put("plan", planMap);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("paymentId", paymentId);
        response.put("checkoutUrl", checkoutUrl);
        response.put("subtotal", subtotal);
        response.put("discount", discount);
        response.put("totalAmount", totalAmount);
        response.put("currency", "VND");
        response.put("paymentMethod", paymentMethod);
        response.put("mode", mode.name());
        response.put("reusedCheckout", reusedCheckout);
        response.put("membership", membershipMap);
        return response;
    }

    private Map<String, Object> findExistingPendingCheckout(
            int customerId,
            MembershipPlan requestedPlan,
            LocalDate requestedStartDate,
            LocalDate requestedEndDate,
            CheckoutMode requestedMode,
            Integer requestedClaimId) {
        String sql = """
                SELECT TOP (1)
                    p.PaymentID,
                    p.ClaimID,
                    p.PayOS_CheckoutUrl,
                    p.PayOS_Status,
                    p.PaymentMethod,
                    p.OriginalAmount,
                    p.DiscountAmount,
                    p.Amount,
                    p.CreatedAt AS PaymentCreatedAt,
                    cm.CustomerMembershipID,
                    cm.StartDate,
                    cm.EndDate,
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking
                FROM dbo.Payments p
                JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = p.CustomerMembershipID
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ?
                  AND cm.Status = 'PENDING'
                  AND p.Status = 'PENDING'
                ORDER BY p.PaymentID DESC
                """;
        List<PendingCheckout> rows = jdbcTemplate.query(sql, (rs, rowNum) -> {
            MembershipPlan pendingPlan = new MembershipPlan(
                    rs.getInt("MembershipPlanID"),
                    rs.getString("PlanName"),
                    rs.getString("PlanType"),
                    rs.getBigDecimal("Price"),
                    rs.getInt("DurationDays"),
                    rs.getBoolean("AllowsCoachBooking"));
            return new PendingCheckout(
                    rs.getInt("PaymentID"),
                    (Integer) rs.getObject("ClaimID"),
                    rs.getInt("CustomerMembershipID"),
                    pendingPlan,
                    toLocalDate(rs, "StartDate"),
                    toLocalDate(rs, "EndDate"),
                    rs.getBigDecimal("OriginalAmount"),
                    rs.getBigDecimal("DiscountAmount"),
                    rs.getBigDecimal("Amount"),
                    asNullableString(rs.getString("PaymentMethod")) == null ? "PAYOS" : rs.getString("PaymentMethod"),
                    asNullableString(rs.getString("PayOS_CheckoutUrl")),
                    rs.getTimestamp("PaymentCreatedAt"));
        }, customerId);
        if (rows.isEmpty()) {
            return Map.of();
        }

        PendingCheckout pending = rows.get(0);
        if (isPendingCheckoutExpired(pending.paymentCreatedAt())) {
            cancelPendingCheckout(pending.customerMembershipId(), pending.paymentId(), "EXPIRED");
            return Map.of();
        }

        boolean isSameRequestedCheckout = pending.plan().planId() == requestedPlan.planId()
                && requestedStartDate.equals(pending.startDate())
                && requestedEndDate.equals(pending.endDate())
                && java.util.Objects.equals(pending.claimId(), requestedClaimId);
        if (!isSameRequestedCheckout) {
            cancelPendingCheckout(pending.customerMembershipId(), pending.paymentId(), "CANCELLED");
            return Map.of();
        }

        if (pending.checkoutUrl() == null) {
            cancelPendingCheckout(pending.customerMembershipId(), pending.paymentId(), "CANCELLED");
            return Map.of();
        }

        return buildCheckoutResponse(
                pending.paymentId(),
                pending.customerMembershipId(),
                pending.checkoutUrl(),
                pending.originalAmount(),
                pending.discountAmount(),
                pending.amount(),
                pending.paymentMethod(),
                requestedMode,
                pending.plan(),
                pending.startDate(),
                pending.endDate(),
                true);
    }

    private CouponApplication resolveMembershipCoupon(int customerId, String promoCode, BigDecimal subtotal) {
        if (promoCode == null || promoCode.isBlank()) {
            return null;
        }

        List<Map<String, Object>> claims = jdbcTemplate.queryForList("""
                SELECT TOP (1)
                    c.ClaimID,
                    p.ApplyTarget,
                    p.DiscountPercent,
                    p.DiscountAmount,
                    p.BonusDurationMonths
                FROM dbo.UserPromotionClaims c
                JOIN dbo.Promotions p ON p.PromotionID = c.PromotionID
                WHERE c.UserID = ?
                  AND p.PromoCode = ?
                  AND c.UsedAt IS NULL
                  AND p.IsActive = 1
                  AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(p.ValidFrom AS DATE) AND CAST(p.ValidTo AS DATE)
                ORDER BY c.ClaimID DESC
                """, customerId, promoCode);
        if (claims.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired promo code.");
        }

        Map<String, Object> claim = claims.get(0);
        String applyTarget = upperText(claim.get("ApplyTarget"));
        if (!"MEMBERSHIP".equals(applyTarget)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This coupon applies to product orders only.");
        }

        BigDecimal discountPercent = optionalDecimal(claim.get("DiscountPercent"), "Invalid discount percent.");
        BigDecimal discountAmount = optionalDecimal(claim.get("DiscountAmount"), "Invalid discount amount.");
        Integer parsedBonusMonths = tryParsePositiveInt(claim.get("BonusDurationMonths"));
        int bonusDurationMonths = parsedBonusMonths == null ? 0 : parsedBonusMonths;

        BigDecimal effectiveDiscount = BigDecimal.ZERO;
        if (discountPercent != null && discountPercent.compareTo(BigDecimal.ZERO) > 0) {
            effectiveDiscount = subtotal.multiply(discountPercent)
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        } else if (discountAmount != null && discountAmount.compareTo(BigDecimal.ZERO) > 0) {
            effectiveDiscount = discountAmount;
        }
        if (effectiveDiscount.compareTo(subtotal) > 0) {
            effectiveDiscount = subtotal;
        }

        return new CouponApplication(
                ((Number) claim.get("ClaimID")).intValue(),
                promoCode,
                effectiveDiscount,
                bonusDurationMonths);
    }

    private void markMembershipClaimUsageIfNeeded(int paymentId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT PaymentID, ClaimID, CustomerMembershipID
                FROM dbo.Payments
                WHERE PaymentID = ?
                """, paymentId);
        if (rows.isEmpty()) {
            return;
        }

        Map<String, Object> row = rows.get(0);
        Integer claimId = tryParsePositiveInt(row.get("ClaimID"));
        Integer customerMembershipId = tryParsePositiveInt(row.get("CustomerMembershipID"));
        if (claimId == null || customerMembershipId == null) {
            return;
        }

        jdbcTemplate.update("""
                UPDATE dbo.UserPromotionClaims
                SET UsedAt = COALESCE(UsedAt, SYSDATETIME()),
                    UsedPaymentID = COALESCE(UsedPaymentID, ?),
                    UsedOnMembershipID = COALESCE(UsedOnMembershipID, ?)
                WHERE ClaimID = ?
                """, paymentId, customerMembershipId, claimId);
    }

    private void expireStalePendingCheckouts(int customerId) {
        String sql = """
                SELECT
                    p.PaymentID,
                    cm.CustomerMembershipID
                FROM dbo.Payments p
                JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = p.CustomerMembershipID
                WHERE cm.CustomerID = ?
                  AND cm.Status = 'PENDING'
                  AND p.Status = 'PENDING'
                  AND p.CreatedAt < DATEADD(MINUTE, -?, SYSDATETIME())
                """;
        List<PendingCheckoutRef> staleRows = jdbcTemplate.query(sql, (rs, rowNum) -> new PendingCheckoutRef(
                rs.getInt("PaymentID"),
                rs.getInt("CustomerMembershipID")), customerId, CHECKOUT_REUSE_WINDOW_MINUTES);
        for (PendingCheckoutRef stale : staleRows) {
            cancelPendingCheckout(stale.customerMembershipId(), stale.paymentId(), "EXPIRED");
        }
    }

    private boolean isPendingCheckoutExpired(Timestamp paymentCreatedAt) {
        if (paymentCreatedAt == null) {
            return false;
        }
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(CHECKOUT_REUSE_WINDOW_MINUTES);
        return paymentCreatedAt.toLocalDateTime().isBefore(cutoff);
    }

    private void cancelPendingCheckout(int customerMembershipId, int paymentId, String payOsStatusFallback) {
        String safeFallback = asNullableString(payOsStatusFallback) == null ? "CANCELLED" : payOsStatusFallback;
        normalizePendingDayPassDates(customerMembershipId);
        jdbcTemplate.update("""
                UPDATE dbo.Payments
                SET Status = 'CANCELLED',
                    PayOS_Status = COALESCE(NULLIF(PayOS_Status, ''), ?)
                WHERE PaymentID = ? AND Status = 'PENDING'
                """, safeFallback, paymentId);
        jdbcTemplate.update("""
                UPDATE dbo.CustomerMemberships
                SET Status = 'CANCELLED',
                    UpdatedAt = SYSDATETIME()
                WHERE CustomerMembershipID = ? AND Status = 'PENDING'
                """, customerMembershipId);
    }

    private void normalizePendingDayPassDates(int customerMembershipId) {
        jdbcTemplate.update("""
                UPDATE cm
                SET cm.EndDate = cm.StartDate,
                    cm.UpdatedAt = SYSDATETIME()
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerMembershipID = ?
                  AND cm.Status = 'PENDING'
                  AND mp.PlanType = 'DAY_PASS'
                  AND cm.StartDate <> cm.EndDate
                """, customerMembershipId);
    }

    private MembershipPlan requireActivePlan(int planId) {
        String sql = """
                SELECT
                    mp.MembershipPlanID,
                    mp.PlanName,
                    mp.PlanType,
                    mp.Price,
                    mp.DurationDays,
                    mp.AllowsCoachBooking
                FROM dbo.MembershipPlans mp
                WHERE mp.MembershipPlanID = ?
                  AND mp.IsActive = 1
                """;
        List<MembershipPlan> rows = jdbcTemplate.query(sql, (rs, rowNum) -> new MembershipPlan(
                rs.getInt("MembershipPlanID"),
                rs.getString("PlanName"),
                rs.getString("PlanType"),
                rs.getBigDecimal("Price"),
                rs.getInt("DurationDays"),
                rs.getBoolean("AllowsCoachBooking")), planId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Membership plan is not available.");
        }
        return rows.get(0);
    }

    private MembershipSnapshot findTopMembership(int customerId, String status) {
        String sql = """
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    cm.MembershipPlanID,
                    cm.Status,
                    cm.StartDate,
                    cm.EndDate
                FROM dbo.CustomerMemberships cm
                WHERE cm.CustomerID = ?
                  AND cm.Status = ?
                ORDER BY cm.EndDate DESC, cm.CustomerMembershipID DESC
                """;
        List<MembershipSnapshot> rows = jdbcTemplate.query(sql, (rs, rowNum) -> new MembershipSnapshot(
                rs.getInt("CustomerMembershipID"),
                rs.getInt("MembershipPlanID"),
                rs.getString("Status"),
                toLocalDate(rs, "StartDate"),
                toLocalDate(rs, "EndDate")), customerId, status);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private LocalDate resolveStartDate(
            CheckoutMode mode,
            MembershipSnapshot activeMembership,
            MembershipSnapshot scheduledMembership,
            MembershipSnapshot expiredMembership,
            int requestedPlanId) {
        LocalDate today = LocalDate.now();

        if (mode == CheckoutMode.PURCHASE) {
            if (activeMembership != null && scheduledMembership != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Customer already has the maximum of 2 memberships (current + queued).");
            }
            if (activeMembership != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Customer already has an ACTIVE membership. Use renew or upgrade.");
            }
            if (scheduledMembership != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Customer already has the maximum of 2 memberships (current + queued).");
            }
            return today;
        }

        if (mode == CheckoutMode.RENEW) {
            if (scheduledMembership != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Customer already has the maximum of 2 memberships (current + queued).");
            }
            if (activeMembership != null) {
                return activeMembership.endDate().plusDays(1);
            }
            if (expiredMembership != null && expiredMembership.membershipPlanId() == requestedPlanId) {
                return today;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Renew requires an ACTIVE membership or the same expired plan.");
        }

        if (mode == CheckoutMode.UPGRADE_RENEW) {
            if (activeMembership == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Upgrade instantly and renew requires an ACTIVE membership.");
            }
            if (scheduledMembership != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Customer already has the maximum of 2 memberships (current + queued).");
            }
            return today;
        }

        if (mode == CheckoutMode.UPGRADE_SCHEDULED) {
            if (activeMembership == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Upgrade scheduled requires an ACTIVE membership.");
            }
            if (scheduledMembership == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Upgrade scheduled requires an existing queued membership.");
            }
            return scheduledMembership.startDate();
        }

        if (activeMembership == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Upgrade requires an ACTIVE membership.");
        }
        // Upgrade starts now; webhook will switch ACTIVE membership immediately after success.
        return today;
    }

    private LocalDate resolveCheckoutEndDate(
            CheckoutMode mode,
            MembershipPlan plan,
            LocalDate startDate,
            int bonusDurationMonths,
            MembershipSnapshot activeMembership) {
        if (mode == CheckoutMode.UPGRADE_RENEW && activeMembership != null) {
            LocalDate renewedStartDate = activeMembership.endDate().plusDays(1);
            return resolveEndDate(renewedStartDate, plan.planType(), plan.durationDays(), bonusDurationMonths);
        }
        return resolveEndDate(startDate, plan.planType(), plan.durationDays(), bonusDurationMonths);
    }

    private LocalDate resolveEndDate(LocalDate startDate, String planType, int durationDays) {
        return resolveEndDate(startDate, planType, durationDays, 0);
    }

    private LocalDate resolveEndDate(LocalDate startDate, String planType, int durationDays, int bonusDurationMonths) {
        LocalDate endDate;
        if ("DAY_PASS".equalsIgnoreCase(planType)) {
            endDate = startDate;
        } else {
            endDate = startDate.plusDays(Math.max(0, durationDays - 1L));
        }
        if (bonusDurationMonths > 0) {
            endDate = endDate.plusMonths(bonusDurationMonths);
        }
        return endDate;
    }

    private int insertCustomerMembership(MembershipPlan plan, int customerId, LocalDate startDate, LocalDate endDate) {
        LocalDate safeEndDate = "DAY_PASS".equalsIgnoreCase(plan.planType()) ? startDate : endDate;
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO dbo.CustomerMemberships (CustomerID, MembershipPlanID, Status, StartDate, EndDate)
                    VALUES (?, ?, 'PENDING', ?, ?)
                    """, new String[] { "CustomerMembershipID" });
            statement.setInt(1, customerId);
            statement.setInt(2, plan.planId());
            statement.setDate(3, java.sql.Date.valueOf(startDate));
            statement.setDate(4, java.sql.Date.valueOf(safeEndDate));
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create membership checkout.");
        }
        return key.intValue();
    }

    private int insertPaymentForMembership(int customerMembershipId, Integer claimId, BigDecimal originalAmount,
            BigDecimal discountAmount, BigDecimal amount, String paymentMethod) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO dbo.Payments (OriginalAmount, DiscountAmount, Amount, Status, PaymentMethod, CustomerMembershipID, ClaimID)
                    VALUES (?, ?, ?, 'PENDING', ?, ?, ?)
                    """, new String[] { "PaymentID" });
            statement.setBigDecimal(1, originalAmount);
            statement.setBigDecimal(2, discountAmount);
            statement.setBigDecimal(3, amount);
            statement.setString(4, paymentMethod);
            statement.setInt(5, customerMembershipId);
            if (claimId == null) {
                statement.setNull(6, java.sql.Types.INTEGER);
            } else {
                statement.setInt(6, claimId);
            }
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create payment.");
        }
        return key.intValue();
    }

    private void markCheckoutCreationFailed(int customerMembershipId, int paymentId) {
        jdbcTemplate.update("""
                UPDATE dbo.Payments
                SET Status = 'FAILED',
                    PayOS_Status = COALESCE(PayOS_Status, 'FAILED')
                WHERE PaymentID = ? AND Status = 'PENDING'
                """, paymentId);
        jdbcTemplate.update("""
                UPDATE dbo.CustomerMemberships
                SET Status = 'CANCELLED',
                    UpdatedAt = SYSDATETIME()
                WHERE CustomerMembershipID = ? AND Status = 'PENDING'
                """, customerMembershipId);
    }

    private CheckoutContact loadCheckoutContact(int customerId) {
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT FullName, Phone, Email
                    FROM dbo.Users
                    WHERE UserID = ?
                    """, (rs, rowNum) -> {
                String buyerName = asNullableString(rs.getString("FullName"));
                String buyerPhone = asNullableString(rs.getString("Phone"));
                String buyerEmail = asNullableString(rs.getString("Email"));
                return new CheckoutContact(
                        buyerName != null ? buyerName : "GymCore Customer",
                        buyerPhone != null ? buyerPhone : "0000000000",
                        buyerEmail != null ? buyerEmail : "customer@gymcore.local");
            }, customerId);
        } catch (org.springframework.dao.EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Customer account not found.");
        }
    }

    private Map<String, Object> mapPlan(ResultSet rs) throws SQLException {
        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("planId", rs.getInt("MembershipPlanID"));
        plan.put("name", rs.getString("PlanName"));
        plan.put("planType", rs.getString("PlanType"));
        plan.put("price", rs.getBigDecimal("Price"));
        plan.put("durationDays", rs.getInt("DurationDays"));
        plan.put("allowsCoachBooking", rs.getBoolean("AllowsCoachBooking"));
        plan.put("active", rs.getBoolean("IsActive"));
        if (columnExists(rs, "CreatedAt")) {
            plan.put("createdAt", rs.getTimestamp("CreatedAt"));
        }
        if (columnExists(rs, "UpdatedAt")) {
            plan.put("updatedAt", rs.getTimestamp("UpdatedAt"));
        }
        return plan;
    }

    private Map<String, Object> mapMembershipStatusRow(ResultSet rs) throws SQLException {
        LocalDate startDate = toLocalDate(rs, "StartDate");
        LocalDate endDate = toLocalDate(rs, "EndDate");
        LocalDate today = LocalDate.now();
        String status = rs.getString("Status");

        boolean validForCheckin = "ACTIVE".equalsIgnoreCase(status)
                && startDate != null
                && endDate != null
                && !today.isBefore(startDate)
                && !today.isAfter(endDate);

        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("planId", rs.getInt("MembershipPlanID"));
        plan.put("name", rs.getString("PlanName"));
        plan.put("planType", rs.getString("PlanType"));
        plan.put("price", rs.getBigDecimal("Price"));
        plan.put("durationDays", rs.getInt("DurationDays"));
        plan.put("allowsCoachBooking", rs.getBoolean("AllowsCoachBooking"));

        Map<String, Object> payment = new LinkedHashMap<>();
        Integer paymentId = tryParsePositiveInt(rs.getObject("PaymentID"));
        if (paymentId != null) {
            payment.put("paymentId", paymentId);
            payment.put("status", rs.getString("PaymentStatus"));
            payment.put("paymentMethod", rs.getString("PaymentMethod"));
            payment.put("payOsStatus", rs.getString("PayOS_Status"));
            payment.put("checkoutUrl", rs.getString("PayOS_CheckoutUrl"));
            payment.put("originalAmount", optionalDecimal(rs.getObject("OriginalAmount"), "Invalid original amount."));
            payment.put("discountAmount", optionalDecimal(rs.getObject("DiscountAmount"), "Invalid discount amount."));
            payment.put("amount", rs.getBigDecimal("PaymentAmount"));
            payment.put("createdAt", rs.getTimestamp("PaymentCreatedAt"));

            Integer claimId = tryParsePositiveInt(rs.getObject("ClaimID"));
            String promoCode = asNullableString(rs.getString("PromoCode"));
            String applyTarget = asNullableString(rs.getString("ApplyTarget"));
            Integer bonusDurationMonths = tryParsePositiveInt(rs.getObject("BonusDurationMonths"));
            if (claimId != null || promoCode != null || bonusDurationMonths != null) {
                Map<String, Object> coupon = new LinkedHashMap<>();
                coupon.put("claimId", claimId);
                coupon.put("promoCode", promoCode);
                coupon.put("applyTarget", applyTarget);
                coupon.put("bonusDurationMonths", bonusDurationMonths == null ? 0 : bonusDurationMonths);
                payment.put("coupon", coupon);
            }
        }

        Map<String, Object> membership = new LinkedHashMap<>();
        membership.put("customerMembershipId", rs.getInt("CustomerMembershipID"));
        membership.put("status", status);
        membership.put("startDate", dateToString(startDate));
        membership.put("endDate", dateToString(endDate));
        membership.put("plan", plan);
        membership.put("createdAt", rs.getTimestamp("MembershipCreatedAt"));
        if (!payment.isEmpty()) {
            membership.put("payment", payment);
        }

        if ("ACTIVE".equalsIgnoreCase(status) && endDate != null) {
            long daysRemaining = Math.max(0, ChronoUnit.DAYS.between(today, endDate));
            membership.put("daysRemaining", daysRemaining);
        }
        if ("SCHEDULED".equalsIgnoreCase(status) && startDate != null) {
            long daysUntilActive = Math.max(0, ChronoUnit.DAYS.between(today, startDate));
            membership.put("daysUntilActive", daysUntilActive);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("membership", membership);
        response.put("validForCheckin", validForCheckin);
        response.put("reason", validForCheckin ? null : resolveInvalidReason(status, startDate, endDate));
        return response;
    }

    private String resolveInvalidReason(String status, LocalDate startDate, LocalDate endDate) {
        if (status == null) {
            return "Customer does not have a valid membership.";
        }
        return switch (status.toUpperCase()) {
            case "SCHEDULED" -> "Membership not active yet. It is scheduled to start on " + dateToString(startDate) + ".";
            case "PENDING" -> "Membership payment is pending and not active yet.";
            case "EXPIRED" -> "Membership expired on " + dateToString(endDate) + ".";
            case "CANCELLED" -> "Membership has been cancelled.";
            default -> "Membership is not valid for check-in.";
        };
    }

    private boolean columnExists(ResultSet rs, String columnName) {
        try {
            rs.findColumn(columnName);
            return true;
        } catch (SQLException ignored) {
            return false;
        }
    }

    private LocalDate toLocalDate(ResultSet rs, String column) throws SQLException {
        java.sql.Date date = rs.getDate(column);
        return date == null ? null : date.toLocalDate();
    }

    private String dateToString(LocalDate value) {
        return value == null ? null : value.format(DATE_FORMAT);
    }

    private int toPayOsAmount(BigDecimal amount) {
        try {
            return amount.setScale(0, RoundingMode.HALF_UP).intValueExact();
        } catch (ArithmeticException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid amount for PayOS checkout.");
        }
    }

    private String normalizePaymentMethod(Object value) {
        String paymentMethod = asNullableString(value);
        if (paymentMethod == null) {
            return "PAYOS";
        }
        if ("PAYOS".equalsIgnoreCase(paymentMethod)) {
            return "PAYOS";
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PayOS payment method is supported.");
    }

    private String asNullableString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castToMap(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private Object firstNonNull(Object... values) {
        if (values == null) {
            return null;
        }
        for (Object value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String resolveStatus(Map<String, Object> body, Map<String, Object> data) {
        String status = upperText(body.get("status"));
        if (!status.isBlank()) {
            return status;
        }
        status = upperText(body.get("payosStatus"));
        if (!status.isBlank()) {
            return status;
        }
        status = upperText(data.get("status"));
        if (!status.isBlank()) {
            return status;
        }
        status = upperText(data.get("payosStatus"));
        if (!status.isBlank()) {
            return status;
        }
        status = upperText(data.get("paymentStatus"));
        if (!status.isBlank()) {
            return status;
        }
        status = upperText(body.get("code"));
        if (!status.isBlank()) {
            return status;
        }
        return upperText(data.get("code"));
    }

    private boolean isSuccessfulStatus(String status, Map<String, Object> body, Map<String, Object> data) {
        if ("PAID".equals(status) || "SUCCESS".equals(status) || "COMPLETED".equals(status) || "00".equals(status)) {
            return true;
        }
        Object successRaw = firstNonNull(body.get("success"), data.get("success"));
        if (successRaw instanceof Boolean value) {
            return value;
        }
        return "TRUE".equals(upperText(successRaw));
    }

    private String normalizedSuccessStatus(String status) {
        return "00".equals(status) || status.isBlank() ? "SUCCESS" : status;
    }

    private String upperText(Object value) {
        if (value == null) {
            return "";
        }
        return String.valueOf(value).trim().toUpperCase();
    }

    private int requirePositiveInt(Object value, String message) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        try {
            int result;
            if (value instanceof Number number) {
                result = number.intValue();
            } else {
                result = Integer.parseInt(String.valueOf(value));
            }
            if (result <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
            }
            return result;
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private int resolvePaymentId(Object rawValue) {
        Integer parsed = payOsService.resolvePaymentIdFromPayOsOrderCode(rawValue);
        if (parsed != null) {
            return parsed;
        }

        String paymentLinkId = rawValue == null ? null : String.valueOf(rawValue).trim();
        if (paymentLinkId == null || paymentLinkId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "paymentId/orderCode/paymentLinkId is required.");
        }

        try {
            Integer paymentId = jdbcTemplate.queryForObject("""
                    SELECT TOP 1 PaymentID
                    FROM dbo.Payments
                    WHERE PayOS_PaymentLinkId = ?
                    ORDER BY PaymentID DESC
                    """, Integer.class, paymentLinkId);
            if (paymentId == null || paymentId <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to resolve payment ID.");
            }
            return paymentId;
        } catch (org.springframework.dao.EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unable to resolve payment ID from paymentLinkId.");
        }
    }

    private Integer resolvePaymentIdFromReturnPayload(Map<String, Object> payload) {
        Object rawPaymentId = firstNonNull(payload.get("paymentId"), payload.get("orderCode"));
        Integer parsed = payOsService.resolvePaymentIdFromPayOsOrderCode(rawPaymentId);
        if (parsed != null) {
            return parsed;
        }

        String paymentLinkId = asNullableString(firstNonNull(
                payload.get("paymentLinkId"),
                payload.get("id"),
                payload.get("checkoutId")));
        if (paymentLinkId == null) {
            return null;
        }
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT TOP 1 PaymentID
                    FROM dbo.Payments
                    WHERE PayOS_PaymentLinkId = ?
                    ORDER BY PaymentID DESC
                    """, Integer.class, paymentLinkId);
        } catch (org.springframework.dao.EmptyResultDataAccessException ignored) {
            return null;
        }
    }

    private boolean isSuccessReturnStatus(String status, String code, String cancel, Object successRaw) {
        if ("TRUE".equals(cancel) || "1".equals(cancel)) {
            return false;
        }
        if ("PAID".equals(status) || "SUCCESS".equals(status) || "COMPLETED".equals(status)) {
            return true;
        }
        if ("00".equals(code)) {
            return true;
        }
        if (successRaw instanceof Boolean bool) {
            return bool;
        }
        return "TRUE".equals(upperText(successRaw));
    }

    private BigDecimal optionalDecimal(Object value, String message) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            if (value instanceof BigDecimal decimal) {
                return decimal;
            }
            if (value instanceof Number number) {
                return BigDecimal.valueOf(number.doubleValue());
            }
            return new BigDecimal(text);
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private Integer tryParsePositiveInt(Object value) {
        if (value == null) {
            return null;
        }
        try {
            int result;
            if (value instanceof Number number) {
                result = number.intValue();
            } else {
                result = Integer.parseInt(String.valueOf(value).trim());
            }
            return result > 0 ? result : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private record MembershipPlan(
            int planId,
            String planName,
            String planType,
            BigDecimal price,
            int durationDays,
            boolean allowsCoachBooking
    ) {
    }

    private record MembershipSnapshot(
            int customerMembershipId,
            int membershipPlanId,
            String status,
            LocalDate startDate,
            LocalDate endDate
    ) {
    }

    private record CheckoutContact(String buyerName, String buyerPhone, String buyerEmail) {
    }

    private record PendingCheckout(
            int paymentId,
            Integer claimId,
            int customerMembershipId,
            MembershipPlan plan,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal originalAmount,
            BigDecimal discountAmount,
            BigDecimal amount,
            String paymentMethod,
            String checkoutUrl,
            Timestamp paymentCreatedAt
    ) {
    }

    private record CouponApplication(
            int claimId,
            String promoCode,
            BigDecimal discountAmount,
            int bonusDurationMonths
    ) {
    }

    private record PendingCheckoutRef(int paymentId, int customerMembershipId) {
    }

    private record UpgradeCandidate(int customerMembershipId, int customerId) {
    }

    private record AdminMembershipPlan(
            int planId,
            String planName,
            String planType,
            BigDecimal price,
            int durationDays,
            boolean allowsCoachBooking,
            boolean active
    ) {
    }

    private record PlanDraft(
            String planName,
            String planType,
            BigDecimal price,
            int durationDays,
            boolean allowsCoachBooking,
            boolean active
    ) {
    }

    private enum CheckoutMode {
        PURCHASE,
        RENEW,
        UPGRADE,
        UPGRADE_SCHEDULED,
        UPGRADE_RENEW
    }
}
