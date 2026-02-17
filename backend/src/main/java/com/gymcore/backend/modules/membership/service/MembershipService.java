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

        // Verify HMAC signature using PayOS checksum key.
        payOsService.verifyWebhookSignature(headers, body);

        Object paymentIdRaw = body.get("paymentId");
        Object statusRaw = body.getOrDefault("status", body.getOrDefault("payosStatus", ""));

        int paymentId = requirePositiveInt(paymentIdRaw, "paymentId is required.");
        String status = statusRaw == null ? "" : String.valueOf(statusRaw).trim().toUpperCase();

        if (!"PAID".equals(status) && !"SUCCESS".equals(status)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("handled", false);
            response.put("reason", "Ignored non-success payment status: " + status);
            return response;
        }

        try {
            jdbcTemplate.update("EXEC dbo.sp_ConfirmPaymentSuccess ?", paymentId);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to confirm payment.", exception);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("handled", true);
        response.put("paymentId", paymentId);
        response.put("status", "SUCCESS");
        return response;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castToMap(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
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
}


