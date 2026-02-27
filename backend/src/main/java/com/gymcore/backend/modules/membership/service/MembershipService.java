package com.gymcore.backend.modules.membership.service;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import com.gymcore.backend.modules.auth.service.CurrentUserService.UserInfo;
import com.gymcore.backend.modules.product.service.PayOsService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
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

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final PayOsService payOsService;

    public MembershipService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService,
            PayOsService payOsService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.payOsService = payOsService;
    }

    public Map<String, Object> execute(String action, String authorizationHeader, Object payload) {
        Map<String, Object> safePayload = payload == null ? Map.of() : castToMap(payload);
        return switch (action) {
            case "customer-get-plans" -> customerGetPlans();
            case "customer-get-plan-detail" -> customerGetPlanDetail(safePayload);
            case "customer-get-current-membership" -> customerGetCurrentMembership(authorizationHeader);
            case "customer-purchase-membership" -> customerCreateCheckout(authorizationHeader, safePayload, CheckoutMode.PURCHASE);
            case "customer-renew-membership" -> customerCreateCheckout(authorizationHeader, safePayload, CheckoutMode.RENEW);
            case "customer-upgrade-membership" -> customerCreateCheckout(authorizationHeader, safePayload, CheckoutMode.UPGRADE);
            case "customer-confirm-payment-return" -> customerConfirmPaymentReturn(authorizationHeader, safePayload);
            case "payment-webhook" -> handlePaymentWebhook(safePayload);
            case "admin-get-plans", "admin-create-plan", "admin-update-plan" ->
                adminTodo(action, authorizationHeader, safePayload);
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
                    pay.Amount AS PaymentAmount,
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
                        p.Amount,
                        p.CreatedAt
                    FROM dbo.Payments p
                    WHERE p.CustomerMembershipID = cm.CustomerMembershipID
                    ORDER BY p.PaymentID DESC
                ) pay
                WHERE cm.CustomerID = ?
                ORDER BY
                    CASE cm.Status
                        WHEN 'ACTIVE' THEN 1
                        WHEN 'SCHEDULED' THEN 2
                        WHEN 'PENDING' THEN 3
                        WHEN 'EXPIRED' THEN 4
                        WHEN 'CANCELLED' THEN 5
                        ELSE 6
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
            return response;
        }
        return rows.get(0);
    }

    private Map<String, Object> customerCreateCheckout(
            String authorizationHeader,
            Map<String, Object> payload,
            CheckoutMode mode) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        String paymentMethod = normalizePaymentMethod(payload.get("paymentMethod"));

        Map<String, Object> existingPending = findExistingPendingCheckout(user.userId());
        if (!existingPending.isEmpty()) {
            Map<String, Object> response = new LinkedHashMap<>(existingPending);
            response.put("reusedCheckout", true);
            response.put("mode", mode.name());
            return response;
        }

        int planId = requirePositiveInt(firstNonNull(payload.get("planId"), payload.get("membershipPlanId")),
                "Membership plan ID is required.");
        MembershipPlan plan = requireActivePlan(planId);
        MembershipSnapshot activeMembership = findTopMembership(user.userId(), "ACTIVE");
        MembershipSnapshot scheduledMembership = findTopMembership(user.userId(), "SCHEDULED");
        String returnUrl = asNullableString(payload.get("returnUrl"));
        String cancelUrl = asNullableString(payload.get("cancelUrl"));

        LocalDate startDate = resolveStartDate(mode, activeMembership, scheduledMembership);
        LocalDate endDate = resolveEndDate(startDate, plan.planType(), plan.durationDays());

        if (plan.price().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Membership plan price must be greater than zero for PayOS checkout.");
        }

        CheckoutContact contact = loadCheckoutContact(user.userId());
        BigDecimal subtotal = plan.price();
        BigDecimal discount = BigDecimal.ZERO;
        BigDecimal totalAmount = subtotal;

        int customerMembershipId = insertCustomerMembership(user.userId(), plan.planId(), startDate, endDate);
        int paymentId = insertPaymentForMembership(customerMembershipId, subtotal, discount, totalAmount, paymentMethod);

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
     * - paymentId: numeric PaymentID in our database (we use PaymentID as PayOS orderCode)
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
                      AND cm.Status = 'SCHEDULED'
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
                  AND Status = 'SCHEDULED'
                """, candidate.customerMembershipId());
    }

    private Map<String, Object> adminTodo(String action, String authorizationHeader, Map<String, Object> payload) {
        currentUserService.requireAdmin(authorizationHeader);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("module", "membership");
        response.put("action", action);
        response.put("status", "TODO");
        response.put("payload", payload == null ? Map.of() : payload);
        return response;
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

    private Map<String, Object> findExistingPendingCheckout(int customerId) {
        String sql = """
                SELECT TOP (1)
                    p.PaymentID,
                    p.PayOS_CheckoutUrl,
                    p.PaymentMethod,
                    p.OriginalAmount,
                    p.DiscountAmount,
                    p.Amount,
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
        List<Map<String, Object>> rows = jdbcTemplate.query(sql, (rs, rowNum) -> {
            MembershipPlan plan = new MembershipPlan(
                    rs.getInt("MembershipPlanID"),
                    rs.getString("PlanName"),
                    rs.getString("PlanType"),
                    rs.getBigDecimal("Price"),
                    rs.getInt("DurationDays"),
                    rs.getBoolean("AllowsCoachBooking"));
            LocalDate startDate = toLocalDate(rs, "StartDate");
            LocalDate endDate = toLocalDate(rs, "EndDate");
            return buildCheckoutResponse(
                    rs.getInt("PaymentID"),
                    rs.getInt("CustomerMembershipID"),
                    rs.getString("PayOS_CheckoutUrl"),
                    rs.getBigDecimal("OriginalAmount"),
                    rs.getBigDecimal("DiscountAmount"),
                    rs.getBigDecimal("Amount"),
                    asNullableString(rs.getString("PaymentMethod")) == null ? "PAYOS" : rs.getString("PaymentMethod"),
                    CheckoutMode.PURCHASE,
                    plan,
                    startDate,
                    endDate,
                    true);
        }, customerId);
        if (rows.isEmpty()) {
            return Map.of();
        }
        Map<String, Object> existing = rows.get(0);
        if (asNullableString(existing.get("checkoutUrl")) == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A pending membership payment already exists. Please contact support.");
        }
        return existing;
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
                rs.getString("Status"),
                toLocalDate(rs, "StartDate"),
                toLocalDate(rs, "EndDate")), customerId, status);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private LocalDate resolveStartDate(
            CheckoutMode mode,
            MembershipSnapshot activeMembership,
            MembershipSnapshot scheduledMembership) {
        LocalDate today = LocalDate.now();

        if (mode == CheckoutMode.PURCHASE) {
            if (activeMembership != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Customer already has an ACTIVE membership. Use renew or upgrade.");
            }
            if (scheduledMembership != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Customer already has a queued membership.");
            }
            return today;
        }

        if (mode == CheckoutMode.RENEW) {
            if (activeMembership == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Renew requires an ACTIVE membership.");
            }
            if (scheduledMembership != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Customer already has a queued membership.");
            }
            return activeMembership.endDate().plusDays(1);
        }

        if (activeMembership == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Upgrade requires an ACTIVE membership.");
        }
        if (scheduledMembership != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot upgrade while another membership is queued.");
        }
        // Upgrade starts now; webhook will switch ACTIVE membership immediately after success.
        return today;
    }

    private LocalDate resolveEndDate(LocalDate startDate, String planType, int durationDays) {
        if ("DAY_PASS".equalsIgnoreCase(planType)) {
            return startDate;
        }
        return startDate.plusDays(Math.max(0, durationDays - 1L));
    }

    private int insertCustomerMembership(int customerId, int planId, LocalDate startDate, LocalDate endDate) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO dbo.CustomerMemberships (CustomerID, MembershipPlanID, Status, StartDate, EndDate)
                    VALUES (?, ?, 'PENDING', ?, ?)
                    """, new String[] { "CustomerMembershipID" });
            statement.setInt(1, customerId);
            statement.setInt(2, planId);
            statement.setDate(3, java.sql.Date.valueOf(startDate));
            statement.setDate(4, java.sql.Date.valueOf(endDate));
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create membership checkout.");
        }
        return key.intValue();
    }

    private int insertPaymentForMembership(int customerMembershipId, BigDecimal originalAmount, BigDecimal discountAmount,
            BigDecimal amount, String paymentMethod) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO dbo.Payments (OriginalAmount, DiscountAmount, Amount, Status, PaymentMethod, CustomerMembershipID)
                    VALUES (?, ?, ?, 'PENDING', ?, ?)
                    """, new String[] { "PaymentID" });
            statement.setBigDecimal(1, originalAmount);
            statement.setBigDecimal(2, discountAmount);
            statement.setBigDecimal(3, amount);
            statement.setString(4, paymentMethod);
            statement.setInt(5, customerMembershipId);
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
            payment.put("amount", rs.getBigDecimal("PaymentAmount"));
            payment.put("createdAt", rs.getTimestamp("PaymentCreatedAt"));
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
        Integer parsed = tryParsePositiveInt(rawValue);
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
        Integer parsed = tryParsePositiveInt(rawPaymentId);
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
            String status,
            LocalDate startDate,
            LocalDate endDate
    ) {
    }

    private record CheckoutContact(String buyerName, String buyerPhone, String buyerEmail) {
    }

    private record UpgradeCandidate(int customerMembershipId, int customerId) {
    }

    private enum CheckoutMode {
        PURCHASE,
        RENEW,
        UPGRADE
    }
}
