package com.gymcore.backend.modules.product.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class PayOsService {

    private static final Logger log = LoggerFactory.getLogger(PayOsService.class);
    private static final long ORDER_CODE_OFFSET = 3_000_000_000L;
    private static final long ORDER_CODE_MULTIPLIER = 1_000_000L;
    private static final int ORDER_CODE_SUFFIX_MIN = 100_000;
    private static final int ORDER_CODE_SUFFIX_MAX_EXCLUSIVE = 1_000_000;

    private final RestTemplate restTemplate;

    @Value("${app.payos.client-id:}")
    private String clientId;

    @Value("${app.payos.api-key:}")
    private String apiKey;

    @Value("${app.payos.checksum-key:}")
    private String checksumKey;

    @Value("${app.payos.base-url:https://api.payos.money}")
    private String baseUrl;

    @Value("${app.payos.return-url:http://localhost:5173/customer/shop}")
    private String returnUrl;

    @Value("${app.payos.cancel-url:http://localhost:5173/customer/shop?status=CANCELLED}")
    private String cancelUrl;

    public PayOsService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
                && apiKey != null && !apiKey.isBlank()
                && checksumKey != null && !checksumKey.isBlank();
    }

    public record PayOsItem(String name, int quantity, int price, String unit, Integer taxPercentage) {
    }

    public PayOsLink createPaymentLink(int paymentId, BigDecimal amount, String description,
            String buyerName, String buyerPhone, String buyerEmail, String buyerAddress,
            List<PayOsItem> items) {
        return createPaymentLink(paymentId, amount, description, buyerName, buyerPhone, buyerEmail, buyerAddress,
                items, null, null);
    }

    public PayOsLink createPaymentLink(int paymentId, BigDecimal amount, String description,
            String buyerName, String buyerPhone, String buyerEmail, String buyerAddress,
            List<PayOsItem> items, String overrideReturnUrl, String overrideCancelUrl) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount must be positive.");
        }

        if (!isConfigured()) {
            log.warn("PayOS configuration missing (clientId present: {}, apiKey present: {}, checksumKey present: {}).",
                    clientId != null && !clientId.isBlank(),
                    apiKey != null && !apiKey.isBlank(),
                    checksumKey != null && !checksumKey.isBlank());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "PayOS is not configured. Please check .env file and restart server.");
        }

        long orderCode = buildPayOsOrderCode(paymentId);
        long amountVal = amount.longValue();
        String descStr = description == null || description.isBlank() ? "Gym #" + orderCode : description;
        if (descStr.length() > 25) {
            descStr = descStr.substring(0, 25);
        }
        String effectiveReturnUrl = valueAsString(overrideReturnUrl);
        if (effectiveReturnUrl == null || effectiveReturnUrl.isBlank()) {
            effectiveReturnUrl = returnUrl;
        }
        String effectiveCancelUrl = valueAsString(overrideCancelUrl);
        if (effectiveCancelUrl == null || effectiveCancelUrl.isBlank()) {
            effectiveCancelUrl = cancelUrl;
        }

        Map<String, Object> body = new HashMap<>();
        body.put("orderCode", orderCode);
        body.put("amount", amountVal);
        body.put("description", descStr);
        body.put("buyerName", buyerName);
        body.put("buyerPhone", buyerPhone);
        body.put("buyerEmail", buyerEmail);
        body.put("buyerAddress", buyerAddress);
        body.put("items", items);
        body.put("returnUrl", effectiveReturnUrl);
        body.put("cancelUrl", effectiveCancelUrl);

        // Sign the data (PayOS v2 requires signing a specific subset of fields)
        // Signature =
        // hmac_sha256(amount=VAL&cancelUrl=VAL&description=VAL&orderCode=VAL&returnUrl=VAL,
        // checksumKey)
        String signData = String.format("amount=%d&cancelUrl=%s&description=%s&orderCode=%d&returnUrl=%s",
                amountVal, effectiveCancelUrl, descStr, orderCode, effectiveReturnUrl);
        String signature = hmacSha256Hex(signData, checksumKey);
        body.put("signature", signature);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-client-id", clientId);
        headers.set("x-api-key", apiKey);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            log.info("Creating PayOS payment link for paymentId={} with orderCode={}.", paymentId, orderCode);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                    baseUrl + "/v2/payment-requests",
                    request,
                    Map.class);

            if (response == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from PayOS.");
            }

            String code = valueAsString(response.get("code"));
            String desc = valueAsString(response.get("desc"));
            if (!"00".equals(code)) {
                log.warn("PayOS API returned non-success code={} desc={}.", code, desc);
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "PayOS Error: " + desc + " (Code: " + code + ")");
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
        } catch (org.springframework.web.client.HttpStatusCodeException exception) {
            String errorBody = exception.getResponseBodyAsString();
            log.error("PayOS API HTTP {}: {}", exception.getStatusCode(), errorBody);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "PayOS API Error: " + errorBody);
        } catch (RestClientException exception) {
            log.error("PayOS connection error: {}", exception.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Failed to connect to PayOS: " + exception.getMessage());
        }
    }

    /**
     * Verify PayOS webhook signature using checksum key (HMAC-SHA256).
     * <p>
     * The exact canonicalization format may vary by integration – here we use a
     * stable,
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
     * You should adjust this method to match your official PayOS documentation if
     * header
     * or format differs.
     */
    public void verifyWebhookSignature(HttpHeaders headers, Map<String, Object> body) {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "PayOS checksum key is not configured.");
        }
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        String signature = headers.getFirst("X-PayOS-Signature") != null ? headers.getFirst("X-PayOS-Signature")
                : headers.getFirst("x-payos-signature") != null ? headers.getFirst("x-payos-signature")
                        : headers.getFirst("X-Signature") != null ? headers.getFirst("X-Signature")
                                : valueAsString(safeBody.get("signature"));
        if (signature == null || signature.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing PayOS signature (header/body).");
        }

        Map<String, Object> payloadData = castToMap(safeBody.get("data"));
        List<String> canonicalCandidates = new ArrayList<>();
        canonicalCandidates.add(buildCanonicalBody(withoutSignatureFields(safeBody)));
        if (!payloadData.isEmpty()) {
            canonicalCandidates.add(buildCanonicalBody(withoutSignatureFields(payloadData)));
        }

        boolean valid = false;
        for (String candidate : canonicalCandidates) {
            String expected = hmacSha256Hex(candidate, checksumKey);
            if (constantTimeEquals(signature.trim(), expected)) {
                valid = true;
                break;
            }
        }

        if (!valid) {
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

    @SuppressWarnings("unchecked")
    private Map<String, Object> castToMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private Map<String, Object> withoutSignatureFields(Map<String, Object> input) {
        Map<String, Object> cleaned = new HashMap<>(input);
        cleaned.remove("signature");
        cleaned.remove("Signature");
        cleaned.remove("x-payos-signature");
        cleaned.remove("X-PayOS-Signature");
        cleaned.remove("x-signature");
        cleaned.remove("X-Signature");
        return cleaned;
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
        byte[] left = a.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
        byte[] right = b.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
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

    long buildPayOsOrderCode(int paymentId) {
        if (paymentId <= 0) {
            throw new IllegalArgumentException("paymentId must be positive.");
        }
        long suffix = ThreadLocalRandom.current().nextInt(ORDER_CODE_SUFFIX_MIN, ORDER_CODE_SUFFIX_MAX_EXCLUSIVE);
        return ORDER_CODE_OFFSET + (paymentId * ORDER_CODE_MULTIPLIER) + suffix;
    }

    public Integer resolvePaymentIdFromPayOsOrderCode(Object rawOrderCode) {
        Long parsed = tryParsePositiveLong(rawOrderCode);
        if (parsed == null) {
            return null;
        }
        if (parsed < ORDER_CODE_OFFSET) {
            return parsed.intValue();
        }
        long paymentId = (parsed - ORDER_CODE_OFFSET) / ORDER_CODE_MULTIPLIER;
        if (paymentId <= 0 || paymentId > Integer.MAX_VALUE) {
            return null;
        }
        return (int) paymentId;
    }

    private Long tryParsePositiveLong(Object value) {
        if (value == null) {
            return null;
        }
        try {
            long parsed;
            if (value instanceof Number number) {
                parsed = number.longValue();
            } else {
                parsed = Long.parseLong(String.valueOf(value).trim());
            }
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    public record PayOsLink(String paymentLinkId, String checkoutUrl, String status) {
    }
}
