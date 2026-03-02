package com.gymcore.backend.modules.product.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.http.HttpEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

class PayOsServiceTest {

    private RestTemplate restTemplate;
    private PayOsService service;

    @BeforeEach
    void setUp() {
        restTemplate = Mockito.mock(RestTemplate.class);
        service = new PayOsService(restTemplate);
        ReflectionTestUtils.setField(service, "clientId", "client-id");
        ReflectionTestUtils.setField(service, "apiKey", "api-key");
        ReflectionTestUtils.setField(service, "checksumKey", "checksum-key");
        ReflectionTestUtils.setField(service, "baseUrl", "https://api.payos.money");
        ReflectionTestUtils.setField(service, "returnUrl", "http://localhost:5173/return");
        ReflectionTestUtils.setField(service, "cancelUrl", "http://localhost:5173/cancel");
    }

    @Test
    void createPaymentLink_shouldSendUniqueEncodedOrderCode() {
        when(restTemplate.postForObject(
                contains("/v2/payment-requests"),
                any(HttpEntity.class),
                Mockito.eq(Map.class)))
                .thenReturn(Map.of(
                        "code", "00",
                        "desc", "success",
                        "data", Map.of(
                                "id", "LINK-901",
                                "checkoutUrl", "https://payos.vn/checkout/901",
                                "status", "PENDING")));

        service.createPaymentLink(
                901,
                new BigDecimal("450000"),
                "Membership #901",
                "Customer Minh",
                "0900000004",
                "customer@gymcore.local",
                "GymCore Membership",
                List.of(new PayOsService.PayOsItem("Gym + Coach", 1, 450000, "package", 0)));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<HttpEntity<Map<String, Object>>> requestCaptor = ArgumentCaptor.forClass((Class) HttpEntity.class);
        Mockito.verify(restTemplate).postForObject(
                contains("/v2/payment-requests"),
                requestCaptor.capture(),
                Mockito.eq(Map.class));

        Map<String, Object> body = requestCaptor.getValue().getBody();
        long orderCode = ((Number) body.get("orderCode")).longValue();

        assertNotEquals(901L, orderCode);
        assertEquals(901, service.resolvePaymentIdFromPayOsOrderCode(orderCode));
        assertTrue(orderCode > 901L);
    }

    @Test
    void resolvePaymentIdFromPayOsOrderCode_shouldHandleLegacyAndEncodedFormats() {
        assertEquals(321, service.resolvePaymentIdFromPayOsOrderCode(321));
        assertEquals(321, service.resolvePaymentIdFromPayOsOrderCode("3321654321"));
    }
}
