package com.gymcore.backend.modules.product.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.product.service.OrderInvoiceMailService.InvoiceMailModel;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class OrderInvoiceServiceTest {

    private JdbcTemplate jdbcTemplate;
    private CurrentUserService currentUserService;
    private OrderInvoiceMailService orderInvoiceMailService;
    private OrderInvoiceService orderInvoiceService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        orderInvoiceMailService = Mockito.mock(OrderInvoiceMailService.class);
        orderInvoiceService = new OrderInvoiceService(jdbcTemplate, currentUserService, orderInvoiceMailService);
    }

    @Test
    void handleSuccessfulProductPayment_shouldReuseExistingInvoiceWhenEmailAlreadySent() throws Exception {
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.OrderInvoices"),
                eq(Integer.class),
                eq(900)))
                .thenReturn(10);

        when(jdbcTemplate.query(
                contains("FROM dbo.OrderInvoices"),
                any(RowMapper.class),
                eq(10)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    Map<String, Object> invoiceRow = new LinkedHashMap<>();
                    invoiceRow.put("InvoiceID", 10);
                    invoiceRow.put("InvoiceCode", "INV-202603071000-900");
                    invoiceRow.put("OrderID", 17);
                    invoiceRow.put("PaymentID", 900);
                    invoiceRow.put("RecipientEmail", "customer@gymcore.local");
                    invoiceRow.put("RecipientName", "Customer Minh");
                    invoiceRow.put("ShippingPhone", "0900000004");
                    invoiceRow.put("ShippingAddress", "123 Gym Street");
                    invoiceRow.put("PaymentMethod", "PAYOS");
                    invoiceRow.put("Subtotal", new BigDecimal("4000"));
                    invoiceRow.put("DiscountAmount", new BigDecimal("400"));
                    invoiceRow.put("TotalAmount", new BigDecimal("3600"));
                    invoiceRow.put("PaidAt", Timestamp.from(Instant.parse("2026-03-07T10:00:00Z")));
                    invoiceRow.put("EmailSentAt", Timestamp.from(Instant.parse("2026-03-07T10:05:00Z")));
                    invoiceRow.put("EmailSendError", null);
                    return List.of(mapper.mapRow(resultSet(invoiceRow), 0));
                });

        when(jdbcTemplate.query(
                contains("FROM dbo.OrderItems"),
                any(RowMapper.class),
                eq(17)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "ProductName", "Whey Protein",
                            "Quantity", 2,
                            "UnitPrice", new BigDecimal("2000"),
                            "LineTotal", new BigDecimal("4000"))), 0));
                });

        Map<String, Object> response = orderInvoiceService.handleSuccessfulProductPayment(900);

        assertTrue(Boolean.TRUE.equals(response.get("invoiceCreated")));
        assertTrue(Boolean.TRUE.equals(response.get("invoiceEmailSent")));
        assertEquals("INV-202603071000-900", response.get("invoiceCode"));
        verify(orderInvoiceMailService, never()).sendProductInvoice(any());
    }

    @Test
    void handleSuccessfulProductPayment_shouldCreateInvoiceAndRecordEmailFailure() throws Exception {
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.OrderInvoices"),
                eq(Integer.class),
                eq(901)))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));

        when(jdbcTemplate.query(
                contains("JOIN dbo.Orders o ON o.OrderID = p.OrderID"),
                any(RowMapper.class),
                eq(901)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    Map<String, Object> sourceRow = new LinkedHashMap<>();
                    sourceRow.put("OrderID", 18);
                    sourceRow.put("PaymentID", 901);
                    sourceRow.put("CustomerID", 5);
                    sourceRow.put("RecipientEmail", "customer@gymcore.local");
                    sourceRow.put("RecipientName", "Customer Minh");
                    sourceRow.put("ShippingPhone", "0900000004");
                    sourceRow.put("ShippingAddress", "123 Gym Street");
                    sourceRow.put("PaymentMethod", "PAYOS");
                    sourceRow.put("Subtotal", new BigDecimal("4000"));
                    sourceRow.put("DiscountApplied", new BigDecimal("400"));
                    sourceRow.put("TotalAmount", new BigDecimal("3600"));
                    sourceRow.put("PaidAt", Timestamp.valueOf(LocalDateTime.of(2026, 3, 7, 10, 0)));
                    return List.of(mapper.mapRow(resultSet(sourceRow), 0));
                });

        when(jdbcTemplate.query(
                contains("FROM dbo.OrderItems"),
                any(RowMapper.class),
                eq(18)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(
                            mapper.mapRow(resultSet(Map.of(
                                    "ProductID", 7,
                                    "ProductName", "Whey Protein",
                                    "Quantity", 1,
                                    "UnitPrice", new BigDecimal("2000"),
                                    "LineTotal", new BigDecimal("2000"))), 0),
                            mapper.mapRow(resultSet(Map.of(
                                    "ProductID", 8,
                                    "ProductName", "Creatine Monohydrate",
                                    "Quantity", 2,
                                    "UnitPrice", new BigDecimal("1000"),
                                    "LineTotal", new BigDecimal("2000"))), 1));
                });

        when(jdbcTemplate.update(any(org.springframework.jdbc.core.PreparedStatementCreator.class), any(org.springframework.jdbc.support.KeyHolder.class)))
                .thenAnswer(invocation -> {
                    org.springframework.jdbc.support.KeyHolder keyHolder = invocation.getArgument(1);
                    keyHolder.getKeyList().add(Map.of("InvoiceID", 22));
                    return 1;
                });

        when(jdbcTemplate.query(
                contains("FROM dbo.OrderInvoices"),
                any(RowMapper.class),
                eq(22)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    Map<String, Object> invoiceRow = new LinkedHashMap<>();
                    invoiceRow.put("InvoiceID", 22);
                    invoiceRow.put("InvoiceCode", "INV-202603071000-901");
                    invoiceRow.put("OrderID", 18);
                    invoiceRow.put("PaymentID", 901);
                    invoiceRow.put("RecipientEmail", "customer@gymcore.local");
                    invoiceRow.put("RecipientName", "Customer Minh");
                    invoiceRow.put("ShippingPhone", "0900000004");
                    invoiceRow.put("ShippingAddress", "123 Gym Street");
                    invoiceRow.put("PaymentMethod", "PAYOS");
                    invoiceRow.put("Subtotal", new BigDecimal("4000"));
                    invoiceRow.put("DiscountAmount", new BigDecimal("400"));
                    invoiceRow.put("TotalAmount", new BigDecimal("3600"));
                    invoiceRow.put("PaidAt", Timestamp.from(Instant.parse("2026-03-07T10:00:00Z")));
                    invoiceRow.put("EmailSentAt", null);
                    invoiceRow.put("EmailSendError", null);
                    return List.of(mapper.mapRow(resultSet(invoiceRow), 0));
                });

        doThrow(new RuntimeException("SMTP down")).when(orderInvoiceMailService).sendProductInvoice(any(InvoiceMailModel.class));

        Map<String, Object> response = orderInvoiceService.handleSuccessfulProductPayment(901);

        assertTrue(Boolean.TRUE.equals(response.get("invoiceCreated")));
        assertEquals(Boolean.FALSE, response.get("invoiceEmailSent"));
        assertEquals("INV-202603071000-901", response.get("invoiceCode"));
        assertEquals("SMTP down", response.get("invoiceError"));
        verify(orderInvoiceMailService).sendProductInvoice(any(InvoiceMailModel.class));
        verify(jdbcTemplate).update(
                contains("INSERT INTO dbo.OrderInvoiceItems"),
                eq(22),
                eq(7),
                eq("Whey Protein"),
                eq(1),
                eq(new BigDecimal("2000")),
                eq(new BigDecimal("2000")));
        verify(jdbcTemplate).update(
                contains("INSERT INTO dbo.OrderInvoiceItems"),
                eq(22),
                eq(8),
                eq("Creatine Monohydrate"),
                eq(2),
                eq(new BigDecimal("1000")),
                eq(new BigDecimal("2000")));
        verify(jdbcTemplate).update(
                contains("UPDATE dbo.OrderInvoices"),
                eq(null),
                eq("SMTP down"),
                eq(22));
    }

    @Test
    void handleSuccessfulProductPayment_shouldSkipMailerWhenRecipientEmailMissing() throws Exception {
        when(jdbcTemplate.queryForObject(
                contains("FROM dbo.OrderInvoices"),
                eq(Integer.class),
                eq(902)))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));

        when(jdbcTemplate.query(
                contains("JOIN dbo.Orders o ON o.OrderID = p.OrderID"),
                any(RowMapper.class),
                eq(902)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    Map<String, Object> sourceRow = new LinkedHashMap<>();
                    sourceRow.put("OrderID", 19);
                    sourceRow.put("PaymentID", 902);
                    sourceRow.put("CustomerID", 5);
                    sourceRow.put("RecipientEmail", null);
                    sourceRow.put("RecipientName", "Customer Minh");
                    sourceRow.put("ShippingPhone", "0900000004");
                    sourceRow.put("ShippingAddress", "123 Gym Street");
                    sourceRow.put("PaymentMethod", "PAYOS");
                    sourceRow.put("Subtotal", new BigDecimal("2000"));
                    sourceRow.put("DiscountApplied", new BigDecimal("0"));
                    sourceRow.put("TotalAmount", new BigDecimal("2000"));
                    sourceRow.put("PaidAt", Timestamp.valueOf(LocalDateTime.of(2026, 3, 7, 10, 15)));
                    return List.of(mapper.mapRow(resultSet(sourceRow), 0));
                });

        when(jdbcTemplate.query(
                contains("FROM dbo.OrderItems"),
                any(RowMapper.class),
                eq(19)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet(Map.of(
                            "ProductID", 7,
                            "ProductName", "Creatine Monohydrate",
                            "Quantity", 1,
                            "UnitPrice", new BigDecimal("2000"),
                            "LineTotal", new BigDecimal("2000"))), 0));
                });

        when(jdbcTemplate.update(any(org.springframework.jdbc.core.PreparedStatementCreator.class), any(org.springframework.jdbc.support.KeyHolder.class)))
                .thenAnswer(invocation -> {
                    org.springframework.jdbc.support.KeyHolder keyHolder = invocation.getArgument(1);
                    keyHolder.getKeyList().add(Map.of("InvoiceID", 23));
                    return 1;
                });

        when(jdbcTemplate.query(
                contains("FROM dbo.OrderInvoices"),
                any(RowMapper.class),
                eq(23)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    Map<String, Object> invoiceRow = new LinkedHashMap<>();
                    invoiceRow.put("InvoiceID", 23);
                    invoiceRow.put("InvoiceCode", "INV-202603071015-902");
                    invoiceRow.put("OrderID", 19);
                    invoiceRow.put("PaymentID", 902);
                    invoiceRow.put("RecipientEmail", null);
                    invoiceRow.put("RecipientName", "Customer Minh");
                    invoiceRow.put("ShippingPhone", "0900000004");
                    invoiceRow.put("ShippingAddress", "123 Gym Street");
                    invoiceRow.put("PaymentMethod", "PAYOS");
                    invoiceRow.put("Subtotal", new BigDecimal("2000"));
                    invoiceRow.put("DiscountAmount", new BigDecimal("0"));
                    invoiceRow.put("TotalAmount", new BigDecimal("2000"));
                    invoiceRow.put("PaidAt", Timestamp.from(Instant.parse("2026-03-07T10:15:00Z")));
                    invoiceRow.put("EmailSentAt", null);
                    invoiceRow.put("EmailSendError", null);
                    return List.of(mapper.mapRow(resultSet(invoiceRow), 0));
                });

        Map<String, Object> response = orderInvoiceService.handleSuccessfulProductPayment(902);

        assertTrue(Boolean.TRUE.equals(response.get("invoiceCreated")));
        assertEquals(Boolean.FALSE, response.get("invoiceEmailSent"));
        assertEquals("Recipient email is missing.", response.get("invoiceError"));
        verify(orderInvoiceMailService, never()).sendProductInvoice(any(InvoiceMailModel.class));
        verify(jdbcTemplate).update(
                contains("UPDATE dbo.OrderInvoices"),
                eq(null),
                eq("Recipient email is missing."),
                eq(23));
    }

    @Test
    void adminGetInvoiceDetail_shouldThrowNotFoundWhenInvoiceMissing() {
        mockInvoiceSchema(true, true, true);
        when(jdbcTemplate.query(
                contains("WHERE i.InvoiceID = ?"),
                any(RowMapper.class),
                eq(404)))
                .thenReturn(List.of());

        ResponseStatusException exception =
                assertThrows(ResponseStatusException.class, () -> orderInvoiceService.adminGetInvoiceDetail("Bearer admin", 404));

        assertEquals(404, exception.getStatusCode().value());
        assertEquals("Invoice not found.", exception.getReason());
        verify(currentUserService).requireAdminOrReceptionist("Bearer admin");
    }

    @Test
    void adminGetInvoices_shouldFallbackWhenPickupColumnsAreMissing() throws Exception {
        mockInvoiceSchema(true, true, false);
        when(jdbcTemplate.query(
                contains("CAST(NULL AS DATETIME) AS PickedUpAt"),
                any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("InvoiceID", 10);
                    row.put("InvoiceCode", "INV-LEGACY");
                    row.put("OrderID", 17);
                    row.put("PaymentID", 900);
                    row.put("CustomerID", 5);
                    row.put("CustomerAccountName", "Customer Minh");
                    row.put("CustomerAccountEmail", "customer@gymcore.local");
                    row.put("RecipientName", "Customer Minh");
                    row.put("RecipientEmail", "customer@gymcore.local");
                    row.put("PaymentMethod", "PAYOS");
                    row.put("Subtotal", new BigDecimal("4000"));
                    row.put("DiscountAmount", new BigDecimal("400"));
                    row.put("TotalAmount", new BigDecimal("3600"));
                    row.put("Currency", "VND");
                    row.put("PaidAt", Timestamp.from(Instant.parse("2026-03-07T10:00:00Z")));
                    row.put("PickedUpAt", null);
                    row.put("PickedUpByUserID", null);
                    row.put("PickedUpByName", null);
                    row.put("EmailSentAt", Timestamp.from(Instant.parse("2026-03-07T10:05:00Z")));
                    row.put("EmailSendError", null);
                    row.put("ItemCount", 0);
                    return List.of(mapper.mapRow(resultSet(row), 0));
                });

        Map<String, Object> response = orderInvoiceService.adminGetInvoices("Bearer admin");

        assertEquals(Boolean.FALSE, response.get("pickupTrackingAvailable"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> invoices = (List<Map<String, Object>>) response.get("invoices");
        assertEquals(1, invoices.size());
        assertEquals("INV-LEGACY", invoices.get(0).get("invoiceCode"));
        assertEquals(null, invoices.get(0).get("pickedUpAt"));
    }

    @Test
    void adminGetInvoiceDetail_shouldReturnLegacyShapeWhenPickupColumnsAreMissing() throws Exception {
        mockInvoiceSchema(true, true, false);
        when(jdbcTemplate.query(
                contains("CAST(NULL AS DATETIME) AS PickedUpAt"),
                any(RowMapper.class),
                eq(22)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    Map<String, Object> invoiceRow = new LinkedHashMap<>();
                    invoiceRow.put("InvoiceID", 22);
                    invoiceRow.put("InvoiceCode", "INV-202603071000-901");
                    invoiceRow.put("OrderID", 17);
                    invoiceRow.put("PaymentID", 901);
                    invoiceRow.put("CustomerID", 5);
                    invoiceRow.put("CustomerAccountName", "Customer Minh");
                    invoiceRow.put("CustomerAccountEmail", "customer@gymcore.local");
                    invoiceRow.put("RecipientName", "Customer Minh");
                    invoiceRow.put("RecipientEmail", "customer@gymcore.local");
                    invoiceRow.put("ShippingPhone", "0900000004");
                    invoiceRow.put("ShippingAddress", null);
                    invoiceRow.put("PaymentMethod", "PAYOS");
                    invoiceRow.put("Subtotal", new BigDecimal("4000"));
                    invoiceRow.put("DiscountAmount", new BigDecimal("400"));
                    invoiceRow.put("TotalAmount", new BigDecimal("3600"));
                    invoiceRow.put("Currency", "VND");
                    invoiceRow.put("PaidAt", Timestamp.from(Instant.parse("2026-03-07T10:00:00Z")));
                    invoiceRow.put("PickedUpAt", null);
                    invoiceRow.put("PickedUpByUserID", null);
                    invoiceRow.put("PickedUpByName", null);
                    invoiceRow.put("EmailSentAt", Timestamp.from(Instant.parse("2026-03-07T10:05:00Z")));
                    invoiceRow.put("EmailSendError", null);
                    invoiceRow.put("CreatedAt", Timestamp.from(Instant.parse("2026-03-07T10:00:00Z")));
                    invoiceRow.put("UpdatedAt", Timestamp.from(Instant.parse("2026-03-07T10:00:00Z")));
                    return List.of(mapper.mapRow(resultSet(invoiceRow), 0));
                });
        when(jdbcTemplate.query(
                contains("FROM dbo.OrderInvoiceItems"),
                any(RowMapper.class),
                eq(22)))
                .thenReturn(List.of());

        Map<String, Object> response = orderInvoiceService.adminGetInvoiceDetail("Bearer admin", 22);

        assertEquals(Boolean.FALSE, response.get("pickupTrackingAvailable"));
        @SuppressWarnings("unchecked")
        Map<String, Object> invoice = (Map<String, Object>) response.get("invoice");
        assertEquals("INV-202603071000-901", invoice.get("invoiceCode"));
        assertEquals(null, invoice.get("pickedUpAt"));
    }

    @Test
    void adminConfirmInvoicePickup_shouldMarkInvoicePickedUpAndReturnDetail() throws Exception {
        when(currentUserService.requireAdminOrReceptionist("Bearer reception"))
                .thenReturn(new CurrentUserService.UserInfo(2, "Receptionist", "RECEPTIONIST"));
        mockInvoiceSchema(true, true, true);
        when(jdbcTemplate.query(
                anyString(),
                any(RowMapper.class),
                eq(22)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0);
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    if (sql.contains("JOIN dbo.Orders o ON o.OrderID = i.OrderID")) {
                        Map<String, Object> pickupRow = new LinkedHashMap<>();
                        pickupRow.put("InvoiceID", 22);
                        pickupRow.put("OrderID", 17);
                        pickupRow.put("PickedUpAt", null);
                        pickupRow.put("OrderStatus", "PAID");
                        return List.of(mapper.mapRow(resultSet(pickupRow), 0));
                    }
                    Map<String, Object> invoiceRow = new LinkedHashMap<>();
                    invoiceRow.put("InvoiceID", 22);
                    invoiceRow.put("InvoiceCode", "INV-202603071000-901");
                    invoiceRow.put("OrderID", 17);
                    invoiceRow.put("PaymentID", 901);
                    invoiceRow.put("CustomerID", 5);
                    invoiceRow.put("CustomerAccountName", "Customer Minh");
                    invoiceRow.put("CustomerAccountEmail", "customer@gymcore.local");
                    invoiceRow.put("RecipientName", "Customer Minh");
                    invoiceRow.put("RecipientEmail", "customer@gymcore.local");
                    invoiceRow.put("ShippingPhone", "0900000004");
                    invoiceRow.put("ShippingAddress", null);
                    invoiceRow.put("PaymentMethod", "PAYOS");
                    invoiceRow.put("Subtotal", new BigDecimal("4000"));
                    invoiceRow.put("DiscountAmount", new BigDecimal("400"));
                    invoiceRow.put("TotalAmount", new BigDecimal("3600"));
                    invoiceRow.put("Currency", "VND");
                    invoiceRow.put("PaidAt", Timestamp.from(Instant.parse("2026-03-07T10:00:00Z")));
                    invoiceRow.put("PickedUpAt", Timestamp.from(Instant.parse("2026-03-07T11:00:00Z")));
                    invoiceRow.put("PickedUpByUserID", 2);
                    invoiceRow.put("PickedUpByName", "Receptionist GymCore");
                    invoiceRow.put("EmailSentAt", Timestamp.from(Instant.parse("2026-03-07T10:05:00Z")));
                    invoiceRow.put("EmailSendError", null);
                    invoiceRow.put("CreatedAt", Timestamp.from(Instant.parse("2026-03-07T10:00:00Z")));
                    invoiceRow.put("UpdatedAt", Timestamp.from(Instant.parse("2026-03-07T11:00:00Z")));
                    return List.of(mapper.mapRow(resultSet(invoiceRow), 0));
                });
        when(jdbcTemplate.query(
                contains("FROM dbo.OrderInvoiceItems"),
                any(RowMapper.class),
                eq(22)))
                .thenReturn(List.of());

        Map<String, Object> response = orderInvoiceService.adminConfirmInvoicePickup("Bearer reception", 22);

        @SuppressWarnings("unchecked")
        Map<String, Object> invoice = (Map<String, Object>) response.get("invoice");
        assertEquals(22, invoice.get("invoiceId"));
        assertEquals("Receptionist GymCore", invoice.get("pickedUpByName"));
        verify(jdbcTemplate).update(
                contains("UPDATE dbo.OrderInvoices"),
                eq(2),
                eq(22));
    }

    @Test
    void adminConfirmInvoicePickup_shouldRejectWhenPickupTrackingColumnsAreMissing() {
        when(currentUserService.requireAdminOrReceptionist("Bearer reception"))
                .thenReturn(new CurrentUserService.UserInfo(2, "Receptionist", "RECEPTIONIST"));
        mockInvoiceSchema(true, true, false);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> orderInvoiceService.adminConfirmInvoicePickup("Bearer reception", 22));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals(
                "Pickup tracking is unavailable because the database is missing invoice pickup columns. Run docs/alter.txt and restart the backend.",
                exception.getReason());
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
        when(rs.getObject(anyString())).thenAnswer(invocation -> values.get(invocation.getArgument(0)));
        when(rs.getTimestamp(anyString())).thenAnswer(invocation -> (Timestamp) values.get(invocation.getArgument(0)));
        return rs;
    }

    private void mockInvoiceSchema(boolean invoicesTableExists, boolean invoiceItemsTableExists, boolean pickupTrackingAvailable) {
        when(jdbcTemplate.queryForObject(
                contains("FROM INFORMATION_SCHEMA.TABLES"),
                eq(Integer.class),
                eq("OrderInvoices")))
                .thenReturn(invoicesTableExists ? 1 : 0);
        when(jdbcTemplate.queryForObject(
                contains("FROM INFORMATION_SCHEMA.TABLES"),
                eq(Integer.class),
                eq("OrderInvoiceItems")))
                .thenReturn(invoiceItemsTableExists ? 1 : 0);
        when(jdbcTemplate.queryForObject(
                contains("FROM INFORMATION_SCHEMA.COLUMNS"),
                eq(Integer.class),
                eq("OrderInvoices"),
                eq("PickedUpAt")))
                .thenReturn(pickupTrackingAvailable ? 1 : 0);
        when(jdbcTemplate.queryForObject(
                contains("FROM INFORMATION_SCHEMA.COLUMNS"),
                eq(Integer.class),
                eq("OrderInvoices"),
                eq("PickedUpByUserID")))
                .thenReturn(pickupTrackingAvailable ? 1 : 0);
    }
}
