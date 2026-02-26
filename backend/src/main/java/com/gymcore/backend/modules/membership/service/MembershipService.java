package com.gymcore.backend.modules.membership.service;

import com.gymcore.backend.modules.product.service.PayOsService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MembershipService {

    private final JdbcTemplate jdbcTemplate;
    private final PayOsService payOsService;

    public MembershipService(JdbcTemplate jdbcTemplate, PayOsService payOsService) {
        this.jdbcTemplate = jdbcTemplate;
        this.payOsService = payOsService;
    }

    public Map<String, Object> execute(String action, Object payload) {
        Map<String, Object> safePayload = payload == null ? Map.of() : castToMap(payload);
        return switch (action) {
            case "payment-webhook" -> handlePaymentWebhook(safePayload);
            default -> {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("module", "membership");
                response.put("action", action);
                response.put("status", "TODO");
                response.put("payload", safePayload);
                yield response;
            }
        };
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
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to confirm payment.", exception);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("handled", true);
        response.put("paymentId", paymentId);
        response.put("status", normalizedSuccessStatus(status));
        return response;
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
}


