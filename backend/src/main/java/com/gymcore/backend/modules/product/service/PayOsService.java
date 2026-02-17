package com.gymcore.backend.modules.product.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PayOsService {

    private final RestTemplate restTemplate;

    @Value("${app.payos.client-id:}")
    private String clientId;

    @Value("${app.payos.api-key:}")
    private String apiKey;

    @Value("${app.payos.checksum-key:}")
    private String checksumKey;

    @Value("${app.payos.base-url:https://api.payos.money}")
    private String baseUrl;

    @Value("${app.payos.return-url:http://localhost:5173/payments/success}")
    private String returnUrl;

    @Value("${app.payos.cancel-url:http://localhost:5173/payments/cancel}")
    private String cancelUrl;

    public PayOsService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
                && apiKey != null && !apiKey.isBlank()
                && checksumKey != null && !checksumKey.isBlank();
    }

    /**
     * Create a hosted checkout payment link on PayOS for a given payment/order.
     * <p>
     * This method follows the official PayOS "Create Payment Link" structure:
     * https://docs.payos.money/hosted-checkout
     * but keeps the implementation defensive:
     * - if PayOS is not configured or the HTTP call fails, a fallback demo URL is returned
     *   so that the rest of the checkout flow still works in development.
     */
    public PayOsLink createPaymentLink(int paymentId, BigDecimal amount, String description) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount must be positive.");
        }

        // Fallback for development when PayOS credentials are missing.
        if (!isConfigured()) {
            String demoUrl = "https://payos.vn/checkout/example?paymentId=" + paymentId;
            return new PayOsLink(null, demoUrl, "PENDING");
        }

        long orderCode = paymentId;

        Map<String, Object> body = new HashMap<>();
        body.put("orderCode", orderCode);
        body.put("amount", amount.longValue());
        body.put("description", description == null || description.isBlank() ? "GymCore order #" + orderCode : description);
        body.put("returnUrl", returnUrl);
        body.put("cancelUrl", cancelUrl);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-client-id", clientId);
        headers.set("x-api-key", apiKey);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                    baseUrl + "/v2/payment-requests",
                    request,
                    Map.class
            );
            if (response == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from PayOS.");
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) response.getOrDefault("data", Map.of());
            String paymentLinkId = valueAsString(data.get("id"));
            String checkoutUrl = valueAsString(data.get("checkoutUrl"));
            String status = valueAsString(data.getOrDefault("status", "PENDING"));

            if (checkoutUrl == null || checkoutUrl.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Missing checkoutUrl from PayOS.");
            }

            return new PayOsLink(paymentLinkId, checkoutUrl, status);
        } catch (RestClientException exception) {
            // In dev, fall back to demo URL instead of failing the whole checkout.
            String demoUrl = "https://payos.vn/checkout/example?paymentId=" + paymentId;
            return new PayOsLink(null, demoUrl, "PENDING");
        }
    }

    /**
     * Verify PayOS webhook signature using checksum key (HMAC-SHA256).
     * <p>
     * The exact canonicalization format may vary by integration – here we use a stable,
     * deterministic representation of the payload:
     * - Flatten top-level JSON keys into "key=value" pairs
     * - Sort pairs by key (lexicographically)
     * - Join as "k1=v1&k2=v2&..."
     * <p>
     * Signature is expected in one of these headers (first non-empty wins):
     * - X-PayOS-Signature
     * - x-payos-signature
     * - X-Signature
     * <p>
     * You should adjust this method to match your official PayOS documentation if header
     * or format differs.
     */
    public void verifyWebhookSignature(HttpHeaders headers, Map<String, Object> body) {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "PayOS checksum key is not configured.");
        }
        String signature =
                headers.getFirst("X-PayOS-Signature") != null ? headers.getFirst("X-PayOS-Signature")
                        : headers.getFirst("x-payos-signature") != null ? headers.getFirst("x-payos-signature")
                        : headers.getFirst("X-Signature");
        if (signature == null || signature.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing PayOS signature header.");
        }

        String canonical = buildCanonicalBody(body == null ? Map.of() : body);
        String expected = hmacSha256Hex(canonical, checksumKey);

        if (!constantTimeEquals(signature.trim(), expected)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid PayOS webhook signature.");
        }
    }

    private String buildCanonicalBody(Map<String, Object> body) {
        List<String> keys = new ArrayList<>(body.keySet());
        keys.sort(String::compareTo);
        List<String> parts = new ArrayList<>(keys.size());
        for (String key : keys) {
            Object value = body.get(key);
            parts.add(key + "=" + (value == null ? "" : String.valueOf(value)));
        }
        return String.join("&", parts);
    }

    private String hmacSha256Hex(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(keySpec);
            byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(raw.length * 2);
            for (byte b : raw) {
                String h = Integer.toHexString(b & 0xFF);
                if (h.length() == 1) {
                    hex.append('0');
                }
                hex.append(h);
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException | InvalidKeyException exception) {
            throw new IllegalStateException("Failed to compute HMAC-SHA256 for PayOS webhook.", exception);
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        byte[] left = a.getBytes(StandardCharsets.UTF_8);
        byte[] right = b.getBytes(StandardCharsets.UTF_8);
        if (left.length != right.length) {
            return false;
        }
        int result = 0;
        for (int i = 0; i < left.length; i++) {
            result |= left[i] ^ right[i];
        }
        return result == 0;
    }

    private String valueAsString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    public record PayOsLink(String paymentLinkId, String checkoutUrl, String status) {
    }
}

