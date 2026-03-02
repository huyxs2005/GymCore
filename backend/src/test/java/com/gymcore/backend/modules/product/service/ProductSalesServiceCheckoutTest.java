package com.gymcore.backend.modules.product.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class ProductSalesServiceCheckoutTest {

    private JdbcTemplate jdbcTemplate;
    private CurrentUserService currentUserService;
    private PayOsService payOsService;
    private ProductSalesService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        payOsService = Mockito.mock(PayOsService.class);
        service = new ProductSalesService(jdbcTemplate, currentUserService, payOsService);
    }

    @Test
    void checkout_shouldRejectMembershipOnlyCouponForProductOrders() throws Exception {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));

        // Existing cart
        when(jdbcTemplate.queryForObject(contains("SELECT CartID"), eq(Integer.class), eq(5)))
                .thenReturn(1);

        // Checkout contact
        when(jdbcTemplate.queryForObject(contains("SELECT FullName, Phone, Email"), any(RowMapper.class), eq(5)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return mapper.mapRow(resultSet(Map.of(
                            "FullName", "Customer Minh",
                            "Phone", "0900000004",
                            "Email", "customer@gymcore.local")), 0);
                });

        // Cart has 1 item
        Mockito.doAnswer(invocation -> {
            RowCallbackHandler rowCallbackHandler = invocation.getArgument(2);
            rowCallbackHandler.processRow(resultSet(Map.of(
                    "ProductID", 7,
                    "Quantity", 1,
                    "ProductName", "Creatine Monohydrate",
                    "Price", new BigDecimal("350000"))));
            return null;
        }).when(jdbcTemplate).query(contains("FROM dbo.CartItems"), any(PreparedStatementSetter.class),
                any(RowCallbackHandler.class));

        Map<String, Object> bonusOnlyClaim = new HashMap<>();
        bonusOnlyClaim.put("ClaimID", 321);
        bonusOnlyClaim.put("ApplyTarget", "MEMBERSHIP");
        bonusOnlyClaim.put("DiscountPercent", null);
        bonusOnlyClaim.put("DiscountAmount", null);
        bonusOnlyClaim.put("BonusDurationMonths", 1);

        when(jdbcTemplate.queryForList(contains("FROM dbo.UserPromotionClaims"), eq(5), eq("SUMMERPLUS1M")))
                .thenReturn(List.of(bonusOnlyClaim));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.execute("customer-checkout", "Bearer customer", Map.of(
                        "promoCode", "SUMMERPLUS1M",
                        "paymentMethod", "PAYOS")));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertTrue(String.valueOf(exception.getReason()).contains("membership purchases only"));
        verify(payOsService, never()).createPaymentLink(anyInt(), any(), anyString(), anyString(), anyString(),
                anyString(), anyString(), any());
    }

    @Test
    void confirmPaymentReturn_shouldDecodeEncodedPayOsOrderCode() {
        when(currentUserService.requireCustomer("Bearer customer"))
                .thenReturn(new CurrentUserService.UserInfo(5, "Customer", "CUSTOMER"));
        when(payOsService.resolvePaymentIdFromPayOsOrderCode(eq("555123456"))).thenReturn(555);

        when(jdbcTemplate.queryForObject(
                contains("JOIN dbo.Orders o ON o.OrderID = p.OrderID"),
                eq(Integer.class),
                eq(555),
                eq(5)))
                .thenReturn(1);

        when(jdbcTemplate.update(eq("EXEC dbo.sp_ConfirmPaymentSuccess ?"), eq(555))).thenReturn(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = service.execute(
                "customer-confirm-payment-return",
                "Bearer customer",
                Map.of("orderCode", "555123456", "status", "SUCCESS"));

        assertTrue(Boolean.TRUE.equals(response.get("handled")));
        assertEquals(555, response.get("paymentId"));
    }

    private ResultSet resultSet(Map<String, Object> values) throws Exception {
        ResultSet rs = Mockito.mock(ResultSet.class);
        when(rs.getString(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            return value == null ? null : String.valueOf(value);
        });
        when(rs.getInt(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            return value == null ? 0 : ((Number) value).intValue();
        });
        when(rs.getBigDecimal(anyString())).thenAnswer(invocation -> {
            Object value = values.get(invocation.getArgument(0));
            if (value instanceof BigDecimal decimal) {
                return decimal;
            }
            if (value instanceof Number number) {
                return BigDecimal.valueOf(number.doubleValue());
            }
            return null;
        });
        return rs;
    }
}
