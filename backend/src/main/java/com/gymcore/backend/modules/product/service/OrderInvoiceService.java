package com.gymcore.backend.modules.product.service;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrderInvoiceService {

    private static final Logger log = LoggerFactory.getLogger(OrderInvoiceService.class);
    private static final DateTimeFormatter INVOICE_CODE_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    private static final String INVOICE_SCHEMA_UNAVAILABLE_MESSAGE =
            "Invoice tables are unavailable in the database. Run docs/alter.txt and restart the backend.";
    private static final String PICKUP_TRACKING_UNAVAILABLE_MESSAGE =
            "Pickup tracking is unavailable because the database is missing invoice pickup columns. Run docs/alter.txt and restart the backend.";

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final OrderInvoiceMailService orderInvoiceMailService;

    public OrderInvoiceService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService,
            OrderInvoiceMailService orderInvoiceMailService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.orderInvoiceMailService = orderInvoiceMailService;
    }

    public Map<String, Object> adminGetInvoices(String authorizationHeader) {
        currentUserService.requireAdminOrReceptionist(authorizationHeader);
        if (!tableExists("OrderInvoices")) {
            return Map.of("invoices", List.of(), "pickupTrackingAvailable", false);
        }

        boolean pickupTrackingAvailable = hasPickupTracking();
        boolean invoiceItemsAvailable = tableExists("OrderInvoiceItems");
        List<Map<String, Object>> invoices = invoiceItemsAvailable
                ? jdbcTemplate.query(buildInvoiceListSql(pickupTrackingAvailable), this::mapInvoiceListRow)
                : jdbcTemplate.query(buildInvoiceListWithoutItemsSql(pickupTrackingAvailable), this::mapInvoiceListRow);
        return Map.of("invoices", invoices, "pickupTrackingAvailable", pickupTrackingAvailable);
    }

    public Map<String, Object> adminGetInvoiceDetail(String authorizationHeader, int invoiceId) {
        currentUserService.requireAdminOrReceptionist(authorizationHeader);
        if (!tableExists("OrderInvoices")) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, INVOICE_SCHEMA_UNAVAILABLE_MESSAGE);
        }

        boolean pickupTrackingAvailable = hasPickupTracking();
        List<Map<String, Object>> invoices = jdbcTemplate.query(
                buildInvoiceDetailSql(pickupTrackingAvailable),
                this::mapInvoiceDetailRow,
                invoiceId);
        if (invoices.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found.");
        }

        List<Map<String, Object>> items = tableExists("OrderInvoiceItems")
                ? jdbcTemplate.query("""
                        SELECT InvoiceItemID,
                               ProductID,
                               ProductName,
                               Quantity,
                               UnitPrice,
                               LineTotal
                        FROM dbo.OrderInvoiceItems
                        WHERE InvoiceID = ?
                        ORDER BY InvoiceItemID ASC
                        """, this::mapInvoiceItemRow, invoiceId)
                : List.of();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("invoice", invoices.get(0));
        response.put("items", items);
        response.put("pickupTrackingAvailable", pickupTrackingAvailable);
        return response;
    }

    public Map<String, Object> adminConfirmInvoicePickup(String authorizationHeader, int invoiceId) {
        CurrentUserService.UserInfo actor = currentUserService.requireAdminOrReceptionist(authorizationHeader);
        if (!hasPickupTracking()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, PICKUP_TRACKING_UNAVAILABLE_MESSAGE);
        }

        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT i.InvoiceID,
                       i.OrderID,
                       i.PickedUpAt,
                       o.Status AS OrderStatus
                FROM dbo.OrderInvoices i
                JOIN dbo.Orders o ON o.OrderID = i.OrderID
                WHERE i.InvoiceID = ?
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("invoiceId", rs.getInt("InvoiceID"));
            row.put("orderId", rs.getInt("OrderID"));
            row.put("pickedUpAt", rs.getTimestamp("PickedUpAt"));
            row.put("orderStatus", rs.getString("OrderStatus"));
            return row;
        }, invoiceId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found.");
        }

        Map<String, Object> invoice = rows.get(0);
        if (!"PAID".equalsIgnoreCase(String.valueOf(invoice.get("orderStatus")))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only paid orders can be marked as picked up.");
        }

        if (invoice.get("pickedUpAt") == null) {
            jdbcTemplate.update("""
                    UPDATE dbo.OrderInvoices
                    SET PickedUpAt = SYSDATETIME(),
                        PickedUpByUserID = ?,
                        UpdatedAt = SYSDATETIME()
                    WHERE InvoiceID = ?
                    """, actor.userId(), invoiceId);
        }

        return adminGetInvoiceDetail(authorizationHeader, invoiceId);
    }

    public Map<String, Object> adminResendInvoiceEmail(String authorizationHeader, int invoiceId) {
        currentUserService.requireAdminOrReceptionist(authorizationHeader);
        if (!tableExists("OrderInvoices")) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, INVOICE_SCHEMA_UNAVAILABLE_MESSAGE);
        }

        InvoiceEnvelope envelope = loadInvoiceEnvelope(invoiceId);
        if (envelope == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found.");
        }

        boolean alreadySent = envelope.emailSentAt() != null
                && (envelope.emailError() == null || envelope.emailError().isBlank());
        if (!alreadySent) {
            attemptInvoiceEmail(invoiceId, envelope.mailModel());
        }

        return adminGetInvoiceDetail(authorizationHeader, invoiceId);
    }

    public Map<String, Object> handleSuccessfulProductPayment(int paymentId) {
        Integer invoiceId = findInvoiceIdByPaymentId(paymentId);
        if (invoiceId == null) {
            invoiceId = createInvoiceSnapshot(paymentId);
        }
        if (invoiceId == null) {
            return Map.of("invoiceCreated", false);
        }

        InvoiceEnvelope envelope = loadInvoiceEnvelope(invoiceId);
        if (envelope == null) {
            return Map.of("invoiceCreated", false);
        }

        boolean emailSent = envelope.emailSentAt() != null;
        String emailError = envelope.emailError();
        if (!emailSent) {
            InvoiceEmailResult emailResult = attemptInvoiceEmail(invoiceId, envelope.mailModel());
            emailSent = emailResult.sent();
            emailError = emailResult.errorMessage();
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("invoiceCreated", true);
        response.put("invoiceCode", envelope.mailModel().invoiceCode());
        response.put("invoiceEmailSent", emailSent);
        if (emailError != null && !emailError.isBlank()) {
            response.put("invoiceError", emailError);
        }
        return response;
    }

    private Integer findInvoiceIdByPaymentId(int paymentId) {
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT TOP (1) InvoiceID
                    FROM dbo.OrderInvoices
                    WHERE PaymentID = ?
                    ORDER BY InvoiceID DESC
                    """, Integer.class, paymentId);
        } catch (org.springframework.dao.EmptyResultDataAccessException ignored) {
            return null;
        }
    }

    private Integer createInvoiceSnapshot(int paymentId) {
        InvoiceSource source = loadInvoiceSource(paymentId);
        if (source == null) {
            return null;
        }

        String invoiceCode = generateInvoiceCode(source.paidAt(), paymentId);
        KeyHolder keyHolder = new GeneratedKeyHolder();
        try {
            jdbcTemplate.update(connection -> {
                var ps = connection.prepareStatement("""
                        INSERT INTO dbo.OrderInvoices (
                            InvoiceCode, OrderID, PaymentID, CustomerID, RecipientEmail, RecipientName,
                            ShippingPhone, ShippingAddress, PaymentMethod, Currency, Subtotal,
                            DiscountAmount, TotalAmount, PaidAt
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'VND', ?, ?, ?, ?)
                        """, new String[] { "InvoiceID" });
                ps.setString(1, invoiceCode);
                ps.setInt(2, source.orderId());
                ps.setInt(3, source.paymentId());
                ps.setInt(4, source.customerId());
                ps.setString(5, source.recipientEmail());
                ps.setString(6, source.recipientName());
                ps.setString(7, source.shippingPhone());
                ps.setString(8, source.shippingAddress());
                ps.setString(9, source.paymentMethod());
                ps.setBigDecimal(10, source.subtotal());
                ps.setBigDecimal(11, source.discountAmount());
                ps.setBigDecimal(12, source.totalAmount());
                ps.setTimestamp(13, Timestamp.valueOf(source.paidAt()));
                return ps;
            }, keyHolder);
        } catch (DataAccessException exception) {
            Integer concurrentInvoiceId = findInvoiceIdByPaymentId(paymentId);
            if (concurrentInvoiceId != null) {
                return concurrentInvoiceId;
            }
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create invoice.", exception);
        }

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create invoice.");
        }
        int invoiceId = key.intValue();

        List<InvoiceSnapshotItem> snapshotItems = loadInvoiceSnapshotItems(source.orderId());
        for (InvoiceSnapshotItem item : snapshotItems) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.OrderInvoiceItems (
                        InvoiceID, ProductID, ProductName, Quantity, UnitPrice, LineTotal
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    invoiceId,
                    item.productId(),
                    item.productName(),
                    item.quantity(),
                    item.unitPrice(),
                    item.lineTotal());
        }
        return invoiceId;
    }

    private InvoiceSource loadInvoiceSource(int paymentId) {
        List<InvoiceSource> sources = jdbcTemplate.query("""
                SELECT p.PaymentID,
                       p.PaidAt,
                       o.OrderID,
                       o.CustomerID,
                       COALESCE(o.ShippingEmail, u.Email) AS RecipientEmail,
                       COALESCE(o.ShippingFullName, u.FullName) AS RecipientName,
                       o.ShippingPhone,
                       o.ShippingAddress,
                       p.PaymentMethod,
                       o.Subtotal,
                       o.DiscountApplied,
                       o.TotalAmount
                FROM dbo.Payments p
                JOIN dbo.Orders o ON o.OrderID = p.OrderID
                LEFT JOIN dbo.Users u ON u.UserID = o.CustomerID
                WHERE p.PaymentID = ?
                  AND p.Status = 'SUCCESS'
                """, (rs, rowNum) -> new InvoiceSource(
                rs.getInt("OrderID"),
                rs.getInt("PaymentID"),
                rs.getInt("CustomerID"),
                rs.getString("RecipientEmail"),
                rs.getString("RecipientName"),
                rs.getString("ShippingPhone"),
                rs.getString("ShippingAddress"),
                rs.getString("PaymentMethod"),
                rs.getBigDecimal("Subtotal"),
                rs.getBigDecimal("DiscountApplied"),
                rs.getBigDecimal("TotalAmount"),
                rs.getTimestamp("PaidAt") == null ? LocalDateTime.now() : rs.getTimestamp("PaidAt").toLocalDateTime()),
                paymentId);
        return sources.isEmpty() ? null : sources.get(0);
    }

    private List<OrderInvoiceMailService.InvoiceLineItem> loadInvoiceLineItems(int orderId) {
        return jdbcTemplate.query("""
                SELECT COALESCE(p.ProductName, CONCAT('Product #', oi.ProductID)) AS ProductName,
                       oi.Quantity,
                       oi.UnitPrice,
                       CAST(oi.Quantity * oi.UnitPrice AS DECIMAL(18,2)) AS LineTotal
                FROM dbo.OrderItems oi
                LEFT JOIN dbo.Products p ON p.ProductID = oi.ProductID
                WHERE oi.OrderID = ?
                ORDER BY oi.ProductID ASC
                """, (rs, rowNum) -> new OrderInvoiceMailService.InvoiceLineItem(
                rs.getString("ProductName"),
                rs.getInt("Quantity"),
                rs.getBigDecimal("UnitPrice"),
                rs.getBigDecimal("LineTotal")), orderId);
    }

    private List<InvoiceSnapshotItem> loadInvoiceSnapshotItems(int orderId) {
        return jdbcTemplate.query("""
                SELECT oi.ProductID,
                       COALESCE(p.ProductName, CONCAT('Product #', oi.ProductID)) AS ProductName,
                       oi.Quantity,
                       oi.UnitPrice,
                       CAST(oi.Quantity * oi.UnitPrice AS DECIMAL(18,2)) AS LineTotal
                FROM dbo.OrderItems oi
                LEFT JOIN dbo.Products p ON p.ProductID = oi.ProductID
                WHERE oi.OrderID = ?
                ORDER BY oi.ProductID ASC
                """, (rs, rowNum) -> new InvoiceSnapshotItem(
                rs.getInt("ProductID"),
                rs.getString("ProductName"),
                rs.getInt("Quantity"),
                rs.getBigDecimal("UnitPrice"),
                rs.getBigDecimal("LineTotal")), orderId);
    }

    private InvoiceEnvelope loadInvoiceEnvelope(int invoiceId) {
        List<InvoiceEnvelope> envelopes = jdbcTemplate.query("""
                SELECT InvoiceID,
                       InvoiceCode,
                       OrderID,
                       PaymentID,
                       RecipientEmail,
                       RecipientName,
                       ShippingPhone,
                       ShippingAddress,
                       PaymentMethod,
                       Subtotal,
                       DiscountAmount,
                       TotalAmount,
                       PaidAt,
                       EmailSentAt,
                       EmailSendError
                FROM dbo.OrderInvoices
                WHERE InvoiceID = ?
                """, (rs, rowNum) -> new InvoiceEnvelope(
                rs.getInt("InvoiceID"),
                rs.getTimestamp("EmailSentAt"),
                rs.getString("EmailSendError"),
                new OrderInvoiceMailService.InvoiceMailModel(
                        rs.getString("InvoiceCode"),
                        rs.getInt("OrderID"),
                        rs.getInt("PaymentID"),
                        rs.getString("RecipientEmail"),
                        rs.getString("RecipientName"),
                        rs.getString("ShippingPhone"),
                        rs.getString("ShippingAddress"),
                        rs.getString("PaymentMethod"),
                        rs.getBigDecimal("Subtotal"),
                        rs.getBigDecimal("DiscountAmount"),
                        rs.getBigDecimal("TotalAmount"),
                        rs.getTimestamp("PaidAt") == null ? LocalDateTime.now() : rs.getTimestamp("PaidAt").toLocalDateTime(),
                        loadInvoiceLineItems(rs.getInt("OrderID")))),
                invoiceId);
        return envelopes.isEmpty() ? null : envelopes.get(0);
    }

    private InvoiceEmailResult attemptInvoiceEmail(int invoiceId, OrderInvoiceMailService.InvoiceMailModel model) {
        if (model.recipientEmail() == null || model.recipientEmail().isBlank()) {
            String error = "Recipient email is missing.";
            updateInvoiceEmailStatus(invoiceId, null, error);
            return new InvoiceEmailResult(false, error);
        }

        try {
            orderInvoiceMailService.sendProductInvoice(model);
            updateInvoiceEmailStatus(invoiceId, Timestamp.valueOf(LocalDateTime.now()), null);
            return new InvoiceEmailResult(true, null);
        } catch (Exception exception) {
            log.warn("Failed to send invoice email for invoice {}: {}", model.invoiceCode(), exception.getMessage());
            updateInvoiceEmailStatus(invoiceId, null, exception.getMessage());
            return new InvoiceEmailResult(false, exception.getMessage());
        }
    }

    private void updateInvoiceEmailStatus(int invoiceId, Timestamp emailSentAt, String errorMessage) {
        jdbcTemplate.update("""
                UPDATE dbo.OrderInvoices
                SET EmailSentAt = ?,
                    EmailSendError = ?,
                    UpdatedAt = SYSDATETIME()
                WHERE InvoiceID = ?
                """, emailSentAt, errorMessage, invoiceId);
    }

    private String generateInvoiceCode(LocalDateTime paidAt, int paymentId) {
        LocalDateTime safePaidAt = paidAt == null ? LocalDateTime.now() : paidAt;
        return "INV-" + INVOICE_CODE_TIME.format(safePaidAt) + "-" + paymentId;
    }

    private String buildInvoiceListSql(boolean pickupTrackingAvailable) {
        if (!pickupTrackingAvailable) {
            return buildInvoiceListWithoutItemsSql(false);
        }

        return """
                SELECT i.InvoiceID,
                       i.InvoiceCode,
                       i.OrderID,
                       i.PaymentID,
                       i.CustomerID,
                       u.FullName AS CustomerAccountName,
                       u.Email AS CustomerAccountEmail,
                       i.RecipientName,
                       i.RecipientEmail,
                       i.PaymentMethod,
                       i.Subtotal,
                       i.DiscountAmount,
                       i.TotalAmount,
                       i.Currency,
                       i.PaidAt,
                       i.PickedUpAt,
                       i.PickedUpByUserID,
                       pickupUser.FullName AS PickedUpByName,
                       i.EmailSentAt,
                       i.EmailSendError,
                       COUNT(ii.InvoiceItemID) AS ItemCount
                FROM dbo.OrderInvoices i
                LEFT JOIN dbo.Users u ON u.UserID = i.CustomerID
                LEFT JOIN dbo.Users pickupUser ON pickupUser.UserID = i.PickedUpByUserID
                LEFT JOIN dbo.OrderInvoiceItems ii ON ii.InvoiceID = i.InvoiceID
                GROUP BY i.InvoiceID, i.InvoiceCode, i.OrderID, i.PaymentID, i.CustomerID,
                         u.FullName, u.Email, i.RecipientName, i.RecipientEmail, i.PaymentMethod,
                         i.Subtotal, i.DiscountAmount, i.TotalAmount, i.Currency, i.PaidAt,
                         i.PickedUpAt, i.PickedUpByUserID, pickupUser.FullName,
                         i.EmailSentAt, i.EmailSendError
                ORDER BY i.PaidAt DESC, i.InvoiceID DESC
                """;
    }

    private String buildInvoiceListWithoutItemsSql(boolean pickupTrackingAvailable) {
        if (pickupTrackingAvailable) {
            return """
                    SELECT i.InvoiceID,
                           i.InvoiceCode,
                           i.OrderID,
                           i.PaymentID,
                           i.CustomerID,
                           u.FullName AS CustomerAccountName,
                           u.Email AS CustomerAccountEmail,
                           i.RecipientName,
                           i.RecipientEmail,
                           i.PaymentMethod,
                           i.Subtotal,
                           i.DiscountAmount,
                           i.TotalAmount,
                           i.Currency,
                           i.PaidAt,
                           i.PickedUpAt,
                           i.PickedUpByUserID,
                           pickupUser.FullName AS PickedUpByName,
                           i.EmailSentAt,
                           i.EmailSendError,
                           0 AS ItemCount
                    FROM dbo.OrderInvoices i
                    LEFT JOIN dbo.Users u ON u.UserID = i.CustomerID
                    LEFT JOIN dbo.Users pickupUser ON pickupUser.UserID = i.PickedUpByUserID
                    ORDER BY i.PaidAt DESC, i.InvoiceID DESC
                    """;
        }

        return """
                SELECT i.InvoiceID,
                       i.InvoiceCode,
                       i.OrderID,
                       i.PaymentID,
                       i.CustomerID,
                       u.FullName AS CustomerAccountName,
                       u.Email AS CustomerAccountEmail,
                       i.RecipientName,
                       i.RecipientEmail,
                       i.PaymentMethod,
                       i.Subtotal,
                       i.DiscountAmount,
                       i.TotalAmount,
                       i.Currency,
                       i.PaidAt,
                       CAST(NULL AS DATETIME) AS PickedUpAt,
                       CAST(NULL AS INT) AS PickedUpByUserID,
                       CAST(NULL AS NVARCHAR(255)) AS PickedUpByName,
                       i.EmailSentAt,
                       i.EmailSendError,
                       0 AS ItemCount
                FROM dbo.OrderInvoices i
                LEFT JOIN dbo.Users u ON u.UserID = i.CustomerID
                ORDER BY i.PaidAt DESC, i.InvoiceID DESC
                """;
    }

    private String buildInvoiceDetailSql(boolean pickupTrackingAvailable) {
        if (pickupTrackingAvailable) {
            return """
                    SELECT i.InvoiceID,
                           i.InvoiceCode,
                           i.OrderID,
                           i.PaymentID,
                           i.CustomerID,
                           u.FullName AS CustomerAccountName,
                           u.Email AS CustomerAccountEmail,
                           i.RecipientName,
                           i.RecipientEmail,
                           i.ShippingPhone,
                           i.ShippingAddress,
                           i.PaymentMethod,
                           i.Subtotal,
                           i.DiscountAmount,
                           i.TotalAmount,
                           i.Currency,
                           i.PaidAt,
                           i.PickedUpAt,
                           i.PickedUpByUserID,
                           pickupUser.FullName AS PickedUpByName,
                           promo.PromoCode,
                           i.EmailSentAt,
                           i.EmailSendError,
                           i.CreatedAt,
                           i.UpdatedAt
                    FROM dbo.OrderInvoices i
                    LEFT JOIN dbo.Users u ON u.UserID = i.CustomerID
                    LEFT JOIN dbo.Orders o ON o.OrderID = i.OrderID
                    LEFT JOIN dbo.UserPromotionClaims claim ON claim.ClaimID = o.ClaimID
                    LEFT JOIN dbo.Promotions promo ON promo.PromotionID = claim.PromotionID
                    LEFT JOIN dbo.Users pickupUser ON pickupUser.UserID = i.PickedUpByUserID
                    WHERE i.InvoiceID = ?
                    """;
        }

        return """
                SELECT i.InvoiceID,
                       i.InvoiceCode,
                       i.OrderID,
                       i.PaymentID,
                       i.CustomerID,
                       u.FullName AS CustomerAccountName,
                       u.Email AS CustomerAccountEmail,
                       i.RecipientName,
                       i.RecipientEmail,
                       i.ShippingPhone,
                       i.ShippingAddress,
                       i.PaymentMethod,
                       i.Subtotal,
                       i.DiscountAmount,
                       i.TotalAmount,
                       i.Currency,
                       i.PaidAt,
                       CAST(NULL AS DATETIME) AS PickedUpAt,
                       CAST(NULL AS INT) AS PickedUpByUserID,
                       CAST(NULL AS NVARCHAR(255)) AS PickedUpByName,
                       promo.PromoCode,
                       i.EmailSentAt,
                       i.EmailSendError,
                       i.CreatedAt,
                       i.UpdatedAt
                FROM dbo.OrderInvoices i
                LEFT JOIN dbo.Users u ON u.UserID = i.CustomerID
                LEFT JOIN dbo.Orders o ON o.OrderID = i.OrderID
                LEFT JOIN dbo.UserPromotionClaims claim ON claim.ClaimID = o.ClaimID
                LEFT JOIN dbo.Promotions promo ON promo.PromotionID = claim.PromotionID
                WHERE i.InvoiceID = ?
                """;
    }

    private Map<String, Object> mapInvoiceListRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        Map<String, Object> invoice = new LinkedHashMap<>();
        invoice.put("invoiceId", rs.getInt("InvoiceID"));
        invoice.put("invoiceCode", rs.getString("InvoiceCode"));
        invoice.put("orderId", rs.getInt("OrderID"));
        invoice.put("paymentId", rs.getInt("PaymentID"));
        invoice.put("customerId", rs.getInt("CustomerID"));
        invoice.put("customerAccountName", rs.getString("CustomerAccountName"));
        invoice.put("customerAccountEmail", rs.getString("CustomerAccountEmail"));
        invoice.put("recipientName", rs.getString("RecipientName"));
        invoice.put("recipientEmail", rs.getString("RecipientEmail"));
        invoice.put("paymentMethod", rs.getString("PaymentMethod"));
        invoice.put("subtotal", rs.getBigDecimal("Subtotal"));
        invoice.put("discountAmount", rs.getBigDecimal("DiscountAmount"));
        invoice.put("totalAmount", rs.getBigDecimal("TotalAmount"));
        invoice.put("currency", rs.getString("Currency"));
        invoice.put("paidAt", rs.getTimestamp("PaidAt"));
        invoice.put("pickedUpAt", rs.getTimestamp("PickedUpAt"));
        invoice.put("pickedUpByUserId", rs.getObject("PickedUpByUserID"));
        invoice.put("pickedUpByName", rs.getString("PickedUpByName"));
        invoice.put("emailSentAt", rs.getTimestamp("EmailSentAt"));
        invoice.put("emailSendError", rs.getString("EmailSendError"));
        invoice.put("itemCount", rs.getInt("ItemCount"));
        return invoice;
    }

    private Map<String, Object> mapInvoiceDetailRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        Map<String, Object> invoice = new LinkedHashMap<>();
        invoice.put("invoiceId", rs.getInt("InvoiceID"));
        invoice.put("invoiceCode", rs.getString("InvoiceCode"));
        invoice.put("orderId", rs.getInt("OrderID"));
        invoice.put("paymentId", rs.getInt("PaymentID"));
        invoice.put("customerId", rs.getInt("CustomerID"));
        invoice.put("customerAccountName", rs.getString("CustomerAccountName"));
        invoice.put("customerAccountEmail", rs.getString("CustomerAccountEmail"));
        invoice.put("recipientName", rs.getString("RecipientName"));
        invoice.put("recipientEmail", rs.getString("RecipientEmail"));
        invoice.put("shippingPhone", rs.getString("ShippingPhone"));
        invoice.put("shippingAddress", rs.getString("ShippingAddress"));
        invoice.put("paymentMethod", rs.getString("PaymentMethod"));
        invoice.put("subtotal", rs.getBigDecimal("Subtotal"));
        invoice.put("discountAmount", rs.getBigDecimal("DiscountAmount"));
        invoice.put("totalAmount", rs.getBigDecimal("TotalAmount"));
        invoice.put("currency", rs.getString("Currency"));
        invoice.put("paidAt", rs.getTimestamp("PaidAt"));
        invoice.put("pickedUpAt", rs.getTimestamp("PickedUpAt"));
        invoice.put("pickedUpByUserId", rs.getObject("PickedUpByUserID"));
        invoice.put("pickedUpByName", rs.getString("PickedUpByName"));
        invoice.put("promoCode", rs.getString("PromoCode"));
        invoice.put("emailSentAt", rs.getTimestamp("EmailSentAt"));
        invoice.put("emailSendError", rs.getString("EmailSendError"));
        invoice.put("createdAt", rs.getTimestamp("CreatedAt"));
        invoice.put("updatedAt", rs.getTimestamp("UpdatedAt"));
        return invoice;
    }

    private Map<String, Object> mapInvoiceItemRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("invoiceItemId", rs.getInt("InvoiceItemID"));
        item.put("productId", rs.getObject("ProductID"));
        item.put("productName", rs.getString("ProductName"));
        item.put("quantity", rs.getInt("Quantity"));
        item.put("unitPrice", rs.getBigDecimal("UnitPrice"));
        item.put("lineTotal", rs.getBigDecimal("LineTotal"));
        return item;
    }

    private boolean hasPickupTracking() {
        return columnExists("OrderInvoices", "PickedUpAt") && columnExists("OrderInvoices", "PickedUpByUserID");
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = 'dbo'
                  AND TABLE_NAME = ?
                """, Integer.class, tableName);
        return count != null && count > 0;
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'dbo'
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """, Integer.class, tableName, columnName);
        return count != null && count > 0;
    }

    private record InvoiceSource(
            int orderId,
            int paymentId,
            int customerId,
            String recipientEmail,
            String recipientName,
            String shippingPhone,
            String shippingAddress,
            String paymentMethod,
            BigDecimal subtotal,
            BigDecimal discountAmount,
            BigDecimal totalAmount,
            LocalDateTime paidAt) {
    }

    private record InvoiceSnapshotItem(
            int productId,
            String productName,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal) {
    }

    private record InvoiceEnvelope(
            int invoiceId,
            Timestamp emailSentAt,
            String emailError,
            OrderInvoiceMailService.InvoiceMailModel mailModel) {
    }

    private record InvoiceEmailResult(boolean sent, String errorMessage) {
    }
}
