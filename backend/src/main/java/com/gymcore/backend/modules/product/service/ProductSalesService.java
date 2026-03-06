package com.gymcore.backend.modules.product.service;

import com.gymcore.backend.modules.auth.service.CurrentUserService;
import com.gymcore.backend.modules.auth.service.CurrentUserService.UserInfo;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProductSalesService {

    private static final Logger log = LoggerFactory.getLogger(ProductSalesService.class);

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final PayOsService payOsService;
    private final OrderInvoiceMailService orderInvoiceMailService;

    public ProductSalesService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService,
            PayOsService payOsService, OrderInvoiceMailService orderInvoiceMailService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.payOsService = payOsService;
        this.orderInvoiceMailService = orderInvoiceMailService;
    }

    public Map<String, Object> execute(String action, String authorizationHeader, Map<String, Object> payload) {
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;
        return switch (action) {
            // Customer: products
            case "customer-get-products" -> customerGetProducts();
            case "customer-get-product-detail" ->
                customerGetProductDetail(authorizationHeader, safePayload);
            case "customer-create-review" ->
                customerCreateReview(authorizationHeader, safePayload);

            // Customer: cart + orders
            case "customer-get-cart" -> customerGetCart(authorizationHeader);
            case "customer-add-cart-item" ->
                customerAddCartItem(authorizationHeader, safePayload);
            case "customer-update-cart-item" ->
                customerUpdateCartItem(authorizationHeader, safePayload);
            case "customer-delete-cart-item" ->
                customerDeleteCartItem(authorizationHeader, safePayload);
            case "customer-checkout" ->
                customerCheckout(authorizationHeader, safePayload);
            case "customer-confirm-payment-return" ->
                customerConfirmPaymentReturn(authorizationHeader, safePayload);
            case "customer-get-my-orders" ->
                customerGetMyOrders(authorizationHeader);

            // Admin: products + reviews + invoices
            case "admin-get-products" -> adminGetProducts(authorizationHeader);
            case "admin-create-product" ->
                adminCreateProduct(authorizationHeader, safePayload);
            case "admin-update-product" ->
                adminUpdateProduct(authorizationHeader, safePayload);
            case "admin-get-product-reviews" ->
                adminGetProductReviews(authorizationHeader);
            case "admin-get-invoices" ->
                adminGetInvoices(authorizationHeader);
            case "admin-get-invoice-detail" ->
                adminGetInvoiceDetail(authorizationHeader, safePayload);

            default ->
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported product action: " + action);
        };
    }

    public Map<String, Object> handleSuccessfulProductPayment(int paymentId) {
        return ensureOrderInvoiceAndSendEmail(paymentId);
    }

    // CUSTOMER: PRODUCTS

    private Map<String, Object> customerGetProducts() {
        String sql = """
                SELECT p.ProductID,
                       p.ProductName,
                       p.Description,
                       p.Price,
                       p.ImageUrl,
                       p.IsActive,
                       COALESCE(AVG(CAST(r.Rating AS FLOAT)), 0) AS AverageRating,
                       COUNT(r.ProductReviewID) AS ReviewCount
                FROM dbo.Products p
                LEFT JOIN dbo.ProductReviews r ON r.ProductID = p.ProductID
                WHERE p.IsActive = 1
                GROUP BY p.ProductID, p.ProductName, p.Description, p.Price, p.ImageUrl, p.IsActive
                ORDER BY p.ProductName
                """;

        List<Map<String, Object>> products = jdbcTemplate.query(sql, (rs, rowNum) -> mapProductWithRating(rs));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("products", products);
        return response;
    }

    private Map<String, Object> customerGetProductDetail(String authorizationHeader, Map<String, Object> payload) {
        // Authorization is currently not required to view product detail,
        // but we keep the parameter for future personalization.
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");

        String productSql = """
                SELECT p.ProductID,
                       p.ProductName,
                       p.Description,
                       p.Price,
                       p.ImageUrl,
                       p.IsActive,
                       COALESCE(AVG(CAST(r.Rating AS FLOAT)), 0) AS AverageRating,
                       COUNT(r.ProductReviewID) AS ReviewCount
                FROM dbo.Products p
                LEFT JOIN dbo.ProductReviews r ON r.ProductID = p.ProductID
                WHERE p.ProductID = ? AND p.IsActive = 1
                GROUP BY p.ProductID, p.ProductName, p.Description, p.Price, p.ImageUrl, p.IsActive
                """;

        List<Map<String, Object>> products = jdbcTemplate.query(productSql, (rs, rowNum) -> mapProductWithRating(rs),
                productId);
        if (products.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found.");
        }

        String reviewsSql = """
                SELECT r.ProductReviewID,
                       r.Rating,
                       r.Comment,
                       r.ReviewDate,
                       u.FullName AS CustomerName
                FROM dbo.ProductReviews r
                JOIN dbo.Customers c ON c.CustomerID = r.CustomerID
                JOIN dbo.Users u ON u.UserID = c.CustomerID
                WHERE r.ProductID = ?
                ORDER BY r.ReviewDate DESC
                """;

        List<Map<String, Object>> reviews = jdbcTemplate.query(reviewsSql, (rs, rowNum) -> {
            Map<String, Object> review = new LinkedHashMap<>();
            review.put("productReviewId", rs.getInt("ProductReviewID"));
            review.put("rating", rs.getInt("Rating"));
            review.put("comment", rs.getString("Comment"));
            review.put("reviewDate", rs.getTimestamp("ReviewDate"));
            review.put("customerName", rs.getString("CustomerName"));
            return review;
        }, productId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("product", products.get(0));
        response.put("reviews", reviews);
        return response;
    }

    private Map<String, Object> customerCreateReview(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.getOrDefault("body", Map.of());
        int rating = requireRating(body.get("rating"));
        String comment = asNullableString(body.get("comment"));

        if (!customerHasPaidOrderForProduct(user.userId(), productId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Review blocked: customer must have a PAID order for this product.");
        }

        String sql = """
                INSERT INTO dbo.ProductReviews (ProductID, CustomerID, Rating, Comment)
                VALUES (?, ?, ?, ?)
                """;
        try {
            jdbcTemplate.update(sql, productId, user.userId(), rating, comment);
        } catch (DataAccessException exception) {
            // Surface friendly messages for common constraint failures (purchase required,
            // one review per product, etc.)
            String message = exception.getMostSpecificCause() != null
                    ? exception.getMostSpecificCause().getMessage()
                    : exception.getMessage();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    message != null && message.contains("Review blocked")
                            ? "Review blocked: customer must have a PAID order for this product."
                            : "Unable to create review. You may have already reviewed this product.");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("created", true);
        return response;
    }

    // CUSTOMER: CART

    private Map<String, Object> customerGetCart(String authorizationHeader) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int cartId = ensureCartForCustomer(user.userId());

        String sql = """
                SELECT ci.ProductID,
                       p.ProductName,
                       p.Price,
                       p.ImageUrl,
                       ci.Quantity
                FROM dbo.CartItems ci
                JOIN dbo.Products p ON p.ProductID = ci.ProductID
                WHERE ci.CartID = ?
                ORDER BY p.ProductName
                """;

        List<Map<String, Object>> items = new ArrayList<>();
        final BigDecimal[] subtotalHolder = new BigDecimal[] { BigDecimal.ZERO };

        jdbcTemplate.query(sql, ps -> ps.setInt(1, cartId), new org.springframework.jdbc.core.RowCallbackHandler() {
            @Override
            public void processRow(ResultSet rs) throws SQLException {
                Map<String, Object> item = new LinkedHashMap<>();
                int productId = rs.getInt("ProductID");
                String name = rs.getString("ProductName");
                BigDecimal price = rs.getBigDecimal("Price");
                int quantity = rs.getInt("Quantity");

                item.put("productId", productId);
                item.put("name", name);
                item.put("price", price);
                item.put("imageUrl", rs.getString("ImageUrl"));
                item.put("quantity", quantity);
                item.put("lineTotal", price.multiply(BigDecimal.valueOf(quantity)));
                items.add(item);

                subtotalHolder[0] = subtotalHolder[0].add(price.multiply(BigDecimal.valueOf(quantity)));
            }
        });

        BigDecimal subtotal = subtotalHolder[0];

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", items);
        response.put("subtotal", subtotal);
        response.put("currency", "VND");
        return response;
    }

    private Map<String, Object> customerAddCartItem(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");
        int quantity = requirePositiveInt(payload.get("quantity"), "Quantity must be greater than zero.");

        verifyProductIsActive(productId);
        int cartId = ensureCartForCustomer(user.userId());

        // Upsert cart item
        int updated = jdbcTemplate.update("""
                UPDATE dbo.CartItems
                SET Quantity = Quantity + ?
                WHERE CartID = ? AND ProductID = ?
                """, quantity, cartId, productId);
        if (updated == 0) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.CartItems (CartID, ProductID, Quantity)
                    VALUES (?, ?, ?)
                    """, cartId, productId, quantity);
        }

        return customerGetCart(authorizationHeader);
    }

    private Map<String, Object> customerUpdateCartItem(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.getOrDefault("body", Map.of());
        int quantity = requireInt(body.get("quantity"), "Quantity is required.");

        int cartId = ensureCartForCustomer(user.userId());
        if (quantity <= 0) {
            jdbcTemplate.update("DELETE FROM dbo.CartItems WHERE CartID = ? AND ProductID = ?", cartId, productId);
        } else {
            verifyProductIsActive(productId);
            jdbcTemplate.update("""
                    UPDATE dbo.CartItems
                    SET Quantity = ?
                    WHERE CartID = ? AND ProductID = ?
                    """, quantity, cartId, productId);
        }

        return customerGetCart(authorizationHeader);
    }

    private Map<String, Object> customerDeleteCartItem(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");
        int cartId = ensureCartForCustomer(user.userId());
        jdbcTemplate.update("DELETE FROM dbo.CartItems WHERE CartID = ? AND ProductID = ?", cartId, productId);
        return customerGetCart(authorizationHeader);
    }

    // CUSTOMER: CHECKOUT + ORDERS

    private Map<String, Object> customerCheckout(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int customerId = user.userId();
        int cartId = ensureCartForCustomer(customerId);

        String fullName = asNullableString(payload.get("fullName"));
        String phone = asNullableString(payload.get("phone"));
        String email = asNullableString(payload.get("email"));
        String address = asNullableString(payload.get("address"));
        String paymentMethod = asNullableString(payload.get("paymentMethod"));

        String itemsSql = """
                SELECT ci.ProductID,
                       ci.Quantity,
                       p.ProductName,
                       p.Price
                FROM dbo.CartItems ci
                JOIN dbo.Products p ON p.ProductID = ci.ProductID
                WHERE ci.CartID = ?
                """;

        List<CartLine> lines = new ArrayList<>();
        jdbcTemplate.query(itemsSql, ps -> ps.setInt(1, cartId),
                new org.springframework.jdbc.core.RowCallbackHandler() {
                    @Override
                    public void processRow(ResultSet rs) throws SQLException {
                        lines.add(toCartLine(rs));
                    }
                });

        if (lines.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart is empty.");
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        for (CartLine line : lines) {
            subtotal = subtotal.add(line.price().multiply(BigDecimal.valueOf(line.quantity())));
        }

        BigDecimal discount = BigDecimal.ZERO;
        Integer claimId = null;

        String promoCode = asNullableString(payload.get("promoCode"));
        if (promoCode != null && !promoCode.isBlank()) {
            List<Map<String, Object>> claims = jdbcTemplate.queryForList("""
                    SELECT c.ClaimID, p.DiscountPercent, p.DiscountAmount
                    FROM dbo.UserPromotionClaims c
                    JOIN dbo.Promotions p ON p.PromotionID = c.PromotionID
                    WHERE c.UserID = ? AND p.PromoCode = ? AND c.UsedAt IS NULL
                    AND p.IsActive = 1
                    """, customerId, promoCode);

            if (claims.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired promo code.");
            }

            Map<String, Object> claim = claims.get(0);
            claimId = (Integer) claim.get("ClaimID");
            BigDecimal pct = parseNullableDecimal(claim.get("DiscountPercent"));
            BigDecimal amt = parseNullableDecimal(claim.get("DiscountAmount"));

            if (pct != null && pct.compareTo(BigDecimal.ZERO) > 0) {
                discount = subtotal.multiply(pct).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
            } else if (amt != null && amt.compareTo(BigDecimal.ZERO) > 0) {
                discount = amt;
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid promo code.");
            }

            if (discount.compareTo(subtotal) > 0) {
                discount = subtotal;
            }
        }

        BigDecimal total = subtotal.subtract(discount);

        // Create order with shipping info
        int orderId = insertOrder(customerId, subtotal, discount, total, fullName, phone, email, address, paymentMethod);

        // Upsert order items to match current cart
        jdbcTemplate.update("DELETE FROM dbo.OrderItems WHERE OrderID = ?", orderId);
        for (CartLine line : lines) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.OrderItems (OrderID, ProductID, Quantity, UnitPrice)
                    VALUES (?, ?, ?, ?)
                    """, orderId, line.productId(), line.quantity(), line.price());
        }

        // Create payment row and call PayOS
        int paymentId = insertPaymentForOrder(orderId, subtotal, discount, total);

        // Mark coupon as used if applied
        if (claimId != null) {
            jdbcTemplate.update("""
                    UPDATE dbo.UserPromotionClaims
                    SET UsedAt = SYSDATETIME(),
                        UsedPaymentID = ?,
                        UsedOnOrderID = ?
                    WHERE ClaimID = ?
                    """, paymentId, orderId, claimId);
        }

        List<PayOsService.PayOsItem> payOsItems = lines.stream()
                .map(l -> new PayOsService.PayOsItem(l.name(), l.quantity(), l.price().intValue(), "serving", 0))
                .toList();

        PayOsService.PayOsLink link = payOsService.createPaymentLink(
                paymentId, total, "Order #" + orderId,
                fullName, phone, email, address, payOsItems);

        jdbcTemplate.update("""
                UPDATE dbo.Payments
                SET PayOS_PaymentLinkId = ?, PayOS_CheckoutUrl = ?, PayOS_Status = ?
                WHERE PaymentID = ?
                """, link.paymentLinkId(), link.checkoutUrl(), link.status(), paymentId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("orderId", orderId);
        response.put("paymentId", paymentId);
        response.put("checkoutUrl", link.checkoutUrl());
        response.put("subtotal", subtotal);
        response.put("discount", discount);
        response.put("totalAmount", total);
        response.put("currency", "VND");
        return response;
    }

    private Map<String, Object> customerGetMyOrders(String authorizationHeader) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int customerId = user.userId();

        String ordersSql = """
                SELECT o.OrderID,
                       o.OrderDate,
                       o.Subtotal,
                       o.DiscountApplied,
                       o.TotalAmount,
                       o.Status,
                       i.InvoiceCode
                FROM dbo.Orders o
                LEFT JOIN dbo.OrderInvoices i ON i.OrderID = o.OrderID
                WHERE o.CustomerID = ?
                ORDER BY o.OrderDate DESC, o.OrderID DESC
                """;

        List<Map<String, Object>> orders = new ArrayList<>();
        jdbcTemplate.query(ordersSql, rs -> {
            Map<String, Object> order = new LinkedHashMap<>();
            int orderId = rs.getInt("OrderID");
            order.put("orderId", orderId);
            order.put("orderDate", rs.getTimestamp("OrderDate"));
            order.put("subtotal", rs.getBigDecimal("Subtotal"));
            order.put("discount", rs.getBigDecimal("DiscountApplied"));
            order.put("totalAmount", rs.getBigDecimal("TotalAmount"));
            order.put("status", rs.getString("Status"));
            order.put("invoiceCode", rs.getString("InvoiceCode"));
            order.put("currency", "VND");

            String itemsSql = """
                    SELECT oi.ProductID,
                           p.ProductName,
                           oi.Quantity,
                           oi.UnitPrice
                    FROM dbo.OrderItems oi
                    JOIN dbo.Products p ON p.ProductID = oi.ProductID
                    WHERE oi.OrderID = ?
                    """;
            List<Map<String, Object>> items = jdbcTemplate.query(itemsSql, (itemRs, rowNum) -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("productId", itemRs.getInt("ProductID"));
                item.put("name", itemRs.getString("ProductName"));
                item.put("quantity", itemRs.getInt("Quantity"));
                item.put("unitPrice", itemRs.getBigDecimal("UnitPrice"));
                return item;
            }, orderId);

            order.put("items", items);
            orders.add(order);
        }, customerId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("orders", orders);
        return response;
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
                JOIN dbo.Orders o ON o.OrderID = p.OrderID
                WHERE p.PaymentID = ?
                  AND o.CustomerID = ?
                """, Integer.class, paymentId, user.userId());

        if (ownershipCount == null || ownershipCount == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Payment does not belong to current customer.");
        }

        try {
            jdbcTemplate.update("EXEC dbo.sp_ConfirmPaymentSuccess ?", paymentId);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to confirm payment from return URL.", exception);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("handled", true);
        response.put("paymentId", paymentId);
        response.put("status", "SUCCESS");
        try {
            response.putAll(ensureOrderInvoiceAndSendEmail(paymentId));
        } catch (Exception exception) {
            log.warn("Payment {} confirmed but invoice processing failed: {}", paymentId, exception.getMessage());
            response.put("invoiceCreated", false);
            response.put("invoiceError", exception.getMessage());
        }
        return response;
    }

    // ADMIN

    private Map<String, Object> adminGetProducts(String authorizationHeader) {
        currentUserService.requireAdmin(authorizationHeader);
        String sql = """
                SELECT p.ProductID,
                       p.ProductName,
                       p.Description,
                       p.Price,
                       p.ImageUrl,
                       p.IsActive,
                       p.CreatedAt,
                       p.UpdatedAt
                FROM dbo.Products p
                ORDER BY p.ProductName
                """;
        List<Map<String, Object>> products = jdbcTemplate.query(sql, (rs, rowNum) -> {
            Map<String, Object> product = new LinkedHashMap<>();
            product.put("productId", rs.getInt("ProductID"));
            product.put("name", rs.getString("ProductName"));
            product.put("description", rs.getString("Description"));
            product.put("price", rs.getBigDecimal("Price"));
            product.put("imageUrl", rs.getString("ImageUrl"));
            product.put("active", rs.getBoolean("IsActive"));
            product.put("createdAt", rs.getTimestamp("CreatedAt"));
            product.put("updatedAt", rs.getTimestamp("UpdatedAt"));
            return product;
        });
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("products", products);
        return response;
    }

    private Map<String, Object> adminCreateProduct(String authorizationHeader, Map<String, Object> payload) {
        UserInfo admin = currentUserService.requireAdmin(authorizationHeader);
        String name = requireText(payload.get("name"), "Product name is required.");
        String description = asNullableString(payload.get("description"));
        BigDecimal price = requirePositiveDecimal(payload.get("price"), "Price is required.");
        String imageUrl = asNullableString(payload.get("imageUrl"));
        boolean active = requireBoolean(payload.getOrDefault("active", Boolean.TRUE));

        String sql = """
                INSERT INTO dbo.Products (ProductName, Description, Price, ImageUrl, IsActive, UpdatedBy)
                VALUES (?, ?, ?, ?, ?, ?)
                """;
        jdbcTemplate.update(sql, name, description, price, imageUrl, active, admin.userId());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("created", true);
        return response;
    }

    private Map<String, Object> adminUpdateProduct(String authorizationHeader, Map<String, Object> payload) {
        UserInfo admin = currentUserService.requireAdmin(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.getOrDefault("body", Map.of());

        String name = requireText(body.get("name"), "Product name is required.");
        String description = asNullableString(body.get("description"));
        BigDecimal price = requirePositiveDecimal(body.get("price"), "Price is required.");
        String imageUrl = asNullableString(body.get("imageUrl"));
        boolean active = requireBoolean(body.getOrDefault("active", Boolean.TRUE));

        String sql = """
                UPDATE dbo.Products
                SET ProductName = ?,
                    Description = ?,
                    Price = ?,
                    ImageUrl = ?,
                    IsActive = ?,
                    UpdatedAt = SYSDATETIME(),
                    UpdatedBy = ?
                WHERE ProductID = ?
                """;
        int updated = jdbcTemplate.update(sql, name, description, price, imageUrl, active, admin.userId(), productId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found.");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("updated", true);
        return response;
    }

    private Map<String, Object> adminGetProductReviews(String authorizationHeader) {
        currentUserService.requireAdmin(authorizationHeader);
        String sql = """
                SELECT r.ProductReviewID,
                       r.ProductID,
                       p.ProductName,
                       r.CustomerID,
                       u.FullName AS CustomerName,
                       r.Rating,
                       r.Comment,
                       r.ReviewDate
                FROM dbo.ProductReviews r
                JOIN dbo.Products p ON p.ProductID = r.ProductID
                JOIN dbo.Customers c ON c.CustomerID = r.CustomerID
                JOIN dbo.Users u ON u.UserID = c.CustomerID
                ORDER BY r.ReviewDate DESC
                """;
        List<Map<String, Object>> reviews = jdbcTemplate.query(sql, (rs, rowNum) -> {
            Map<String, Object> review = new LinkedHashMap<>();
            review.put("productReviewId", rs.getInt("ProductReviewID"));
            review.put("productId", rs.getInt("ProductID"));
            review.put("productName", rs.getString("ProductName"));
            review.put("customerId", rs.getInt("CustomerID"));
            review.put("customerName", rs.getString("CustomerName"));
            review.put("rating", rs.getInt("Rating"));
            review.put("comment", rs.getString("Comment"));
            review.put("reviewDate", rs.getTimestamp("ReviewDate"));
            return review;
        });
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("reviews", reviews);
        return response;
    }
    private Map<String, Object> adminGetInvoices(String authorizationHeader) {
        currentUserService.requireAdminOrReceptionist(authorizationHeader);
        String sql = """
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
                       i.EmailSentAt,
                       i.EmailSendError,
                       itemSummary.ItemCount
                FROM dbo.OrderInvoices i
                LEFT JOIN dbo.Users u ON u.UserID = i.CustomerID
                OUTER APPLY (
                    SELECT COUNT(1) AS ItemCount
                    FROM dbo.OrderInvoiceItems items
                    WHERE items.InvoiceID = i.InvoiceID
                ) itemSummary
                ORDER BY i.PaidAt DESC, i.InvoiceID DESC
                """;

        List<Map<String, Object>> invoices = jdbcTemplate.query(sql, (rs, rowNum) -> {
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
            invoice.put("emailSentAt", rs.getTimestamp("EmailSentAt"));
            invoice.put("emailSendError", rs.getString("EmailSendError"));
            invoice.put("itemCount", rs.getInt("ItemCount"));
            return invoice;
        });

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("invoices", invoices);
        return response;
    }

    private Map<String, Object> adminGetInvoiceDetail(String authorizationHeader, Map<String, Object> payload) {
        currentUserService.requireAdminOrReceptionist(authorizationHeader);
        int invoiceId = requirePositiveInt(payload.get("invoiceId"), "Invoice ID is required.");

        List<Map<String, Object>> invoices = jdbcTemplate.query("""
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
                       i.EmailSentAt,
                       i.EmailSendError,
                       i.CreatedAt,
                       i.UpdatedAt
                FROM dbo.OrderInvoices i
                LEFT JOIN dbo.Users u ON u.UserID = i.CustomerID
                WHERE i.InvoiceID = ?
                """, (rs, rowNum) -> {
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
            invoice.put("emailSentAt", rs.getTimestamp("EmailSentAt"));
            invoice.put("emailSendError", rs.getString("EmailSendError"));
            invoice.put("createdAt", rs.getTimestamp("CreatedAt"));
            invoice.put("updatedAt", rs.getTimestamp("UpdatedAt"));
            return invoice;
        }, invoiceId);

        if (invoices.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found.");
        }

        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT InvoiceItemID,
                       ProductID,
                       ProductName,
                       Quantity,
                       UnitPrice,
                       LineTotal
                FROM dbo.OrderInvoiceItems
                WHERE InvoiceID = ?
                ORDER BY InvoiceItemID
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("invoiceItemId", rs.getInt("InvoiceItemID"));
            item.put("productId", rs.getObject("ProductID"));
            item.put("productName", rs.getString("ProductName"));
            item.put("quantity", rs.getInt("Quantity"));
            item.put("unitPrice", rs.getBigDecimal("UnitPrice"));
            item.put("lineTotal", rs.getBigDecimal("LineTotal"));
            return item;
        }, invoiceId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("invoice", invoices.get(0));
        response.put("items", items);
        return response;
    }

    // HELPERS

    private Map<String, Object> mapProductWithRating(ResultSet rs) throws SQLException {
        Map<String, Object> product = new LinkedHashMap<>();
        product.put("productId", rs.getInt("ProductID"));
        product.put("name", rs.getString("ProductName"));
        product.put("description", rs.getString("Description"));
        product.put("price", rs.getBigDecimal("Price"));
        product.put("imageUrl", rs.getString("ImageUrl"));
        product.put("averageRating", rs.getDouble("AverageRating"));
        product.put("reviewCount", rs.getInt("ReviewCount"));
        product.put("active", rs.getBoolean("IsActive"));
        return product;
    }

    private record CartLine(int productId, String name, BigDecimal price, int quantity) {
    }

    private CartLine toCartLine(ResultSet rs) throws SQLException {
        return new CartLine(
                rs.getInt("ProductID"),
                rs.getString("ProductName"),
                rs.getBigDecimal("Price"),
                rs.getInt("Quantity"));
    }

    private int ensureCartForCustomer(int customerId) {
        Integer existing;
        try {
            existing = jdbcTemplate.queryForObject("""
                    SELECT CartID
                    FROM dbo.Carts
                    WHERE CustomerID = ?
                    """, Integer.class, customerId);
        } catch (org.springframework.dao.EmptyResultDataAccessException ignored) {
            existing = null;
        }
        if (existing != null) {
            return existing;
        }
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("""
                    INSERT INTO dbo.Carts (CustomerID)
                    VALUES (?)
                    """, new String[] { "CartID" });
            ps.setInt(1, customerId);
            return ps;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create cart.");
        }
        return key.intValue();
    }

    private void verifyProductIsActive(int productId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.Products
                WHERE ProductID = ? AND IsActive = 1
                """, Integer.class, productId);
        if (count == null || count == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product is not available.");
        }
    }

    private boolean customerHasPaidOrderForProduct(int customerId, int productId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.Orders o
                JOIN dbo.OrderItems oi ON oi.OrderID = o.OrderID
                WHERE o.CustomerID = ?
                  AND oi.ProductID = ?
                  AND o.Status = 'PAID'
                """, Integer.class, customerId, productId);
        return count != null && count > 0;
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

    private Integer tryParsePositiveInt(Object value) {
        if (value == null) {
            return null;
        }
        try {
            int parsed;
            if (value instanceof Number number) {
                parsed = number.intValue();
            } else {
                parsed = Integer.parseInt(String.valueOf(value).trim());
            }
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException exception) {
            return null;
        }
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

    private String upperText(Object value) {
        if (value == null) {
            return "";
        }
        return String.valueOf(value).trim().toUpperCase();
    }

    private int insertOrder(int customerId, BigDecimal subtotal, BigDecimal discount, BigDecimal total,
            String fullName, String phone, String email, String address, String paymentMethod) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("""
                    INSERT INTO dbo.Orders (CustomerID, Subtotal, DiscountApplied, TotalAmount, Status,
                                         ShippingFullName, ShippingPhone, ShippingEmail, ShippingAddress, PaymentMethod)
                    VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)
                    """, new String[] { "OrderID" });
            ps.setInt(1, customerId);
            ps.setBigDecimal(2, subtotal);
            ps.setBigDecimal(3, discount);
            ps.setBigDecimal(4, total);
            ps.setString(5, fullName);
            ps.setString(6, phone);
            ps.setString(7, email);
            ps.setString(8, address);
            ps.setString(9, paymentMethod);
            return ps;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create order.");
        }
        return key.intValue();
    }

    private int insertPaymentForOrder(int orderId, BigDecimal originalAmount, BigDecimal discount, BigDecimal amount) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("""
                    INSERT INTO dbo.Payments (OriginalAmount, DiscountAmount, Amount, Status, OrderID)
                    VALUES (?, ?, ?, 'PENDING', ?)
                    """, new String[] { "PaymentID" });
            ps.setBigDecimal(1, originalAmount);
            ps.setBigDecimal(2, discount);
            ps.setBigDecimal(3, amount);
            ps.setInt(4, orderId);
            return ps;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create payment.");
        }
        return key.intValue();
    }

    private int requirePositiveInt(Object value, String message) {
        int result = requireInt(value, message);
        if (result <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return result;
    }

    private int requireInt(Object value, String message) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        try {
            if (value instanceof Number number) {
                return number.intValue();
            }
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private BigDecimal requirePositiveDecimal(Object value, String message) {
        BigDecimal decimal = requireDecimal(value, message);
        if (decimal.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return decimal;
    }

    private BigDecimal requireDecimal(Object value, String message) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        try {
            if (value instanceof BigDecimal bigDecimal) {
                return bigDecimal;
            }
            if (value instanceof Number number) {
                return BigDecimal.valueOf(number.doubleValue());
            }
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private Map<String, Object> ensureOrderInvoiceAndSendEmail(int paymentId) {
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
        if (!emailSent) {
            emailSent = attemptInvoiceEmail(invoiceId, envelope.mailModel());
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("invoiceCreated", true);
        response.put("invoiceCode", envelope.mailModel().invoiceCode());
        response.put("invoiceEmailSent", emailSent);
        return response;
    }

    private Integer createInvoiceSnapshot(int paymentId) {
        Integer existingInvoiceId = findInvoiceIdByPaymentId(paymentId);
        if (existingInvoiceId != null) {
            return existingInvoiceId;
        }

        InvoiceSource source = loadInvoiceSource(paymentId);
        if (source == null) {
            return null;
        }

        List<OrderInvoiceMailService.InvoiceLineItem> items = loadInvoiceLineItems(source.orderId());
        if (items.isEmpty()) {
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
            throw exception;
        }

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create invoice.");
        }
        int invoiceId = key.intValue();

        for (OrderInvoiceMailService.InvoiceLineItem item : items) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.OrderInvoiceItems (InvoiceID, ProductID, ProductName, Quantity, UnitPrice, LineTotal)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    invoiceId,
                    null,
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
                       o.PaymentMethod,
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
                       oi.UnitPrice
                FROM dbo.OrderItems oi
                LEFT JOIN dbo.Products p ON p.ProductID = oi.ProductID
                WHERE oi.OrderID = ?
                ORDER BY oi.ProductID
                """, (rs, rowNum) -> {
            BigDecimal unitPrice = rs.getBigDecimal("UnitPrice");
            int quantity = rs.getInt("Quantity");
            return new OrderInvoiceMailService.InvoiceLineItem(
                    rs.getString("ProductName"),
                    quantity,
                    unitPrice,
                    unitPrice.multiply(BigDecimal.valueOf(quantity)));
        }, orderId);
    }

    private Integer findInvoiceIdByPaymentId(int paymentId) {
        List<Integer> ids = jdbcTemplate.query("""
                SELECT InvoiceID
                FROM dbo.OrderInvoices
                WHERE PaymentID = ?
                """, (rs, rowNum) -> rs.getInt("InvoiceID"), paymentId);
        return ids.isEmpty() ? null : ids.get(0);
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
                       EmailSentAt
                FROM dbo.OrderInvoices
                WHERE InvoiceID = ?
                """, (rs, rowNum) -> {
            List<OrderInvoiceMailService.InvoiceLineItem> items = jdbcTemplate.query("""
                    SELECT ProductName, Quantity, UnitPrice, LineTotal
                    FROM dbo.OrderInvoiceItems
                    WHERE InvoiceID = ?
                    ORDER BY InvoiceItemID
                    """, (itemRs, itemRowNum) -> new OrderInvoiceMailService.InvoiceLineItem(
                    itemRs.getString("ProductName"),
                    itemRs.getInt("Quantity"),
                    itemRs.getBigDecimal("UnitPrice"),
                    itemRs.getBigDecimal("LineTotal")), rs.getInt("InvoiceID"));

            return new InvoiceEnvelope(
                    rs.getInt("InvoiceID"),
                    rs.getTimestamp("EmailSentAt"),
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
                            items));
        }, invoiceId);
        return envelopes.isEmpty() ? null : envelopes.get(0);
    }

    private boolean attemptInvoiceEmail(int invoiceId, OrderInvoiceMailService.InvoiceMailModel model) {
        if (model.recipientEmail() == null || model.recipientEmail().isBlank()) {
            updateInvoiceEmailStatus(invoiceId, null, "Recipient email is missing.");
            return false;
        }

        try {
            orderInvoiceMailService.sendProductInvoice(model);
            updateInvoiceEmailStatus(invoiceId, Timestamp.valueOf(LocalDateTime.now()), null);
            return true;
        } catch (Exception exception) {
            log.warn("Failed to send invoice email for invoice {}: {}", model.invoiceCode(), exception.getMessage());
            updateInvoiceEmailStatus(invoiceId, null, exception.getMessage());
            return false;
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
        LocalDateTime baseTime = paidAt == null ? LocalDateTime.now() : paidAt;
        return "INV-%04d%02d%02d-%06d".formatted(
                baseTime.getYear(),
                baseTime.getMonthValue(),
                baseTime.getDayOfMonth(),
                paymentId);
    }

    private BigDecimal parseNullableDecimal(Object value) {
        if (value == null) {
            return null;
        }
        try {
            if (value instanceof BigDecimal bigDecimal) {
                return bigDecimal;
            }
            if (value instanceof Number number) {
                return BigDecimal.valueOf(number.doubleValue());
            }
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String requireText(Object value, String message) {
        String text = asNullableString(value);
        if (text == null || text.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return text;
    }

    private String asNullableString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private boolean requireBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value == null) {
            return false;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private int requireRating(Object value) {
        int rating = requireInt(value, "Rating is required.");
        if (rating < 1 || rating > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be between 1 and 5.");
        }
        return rating;
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

    private record InvoiceEnvelope(
            int invoiceId,
            Timestamp emailSentAt,
            OrderInvoiceMailService.InvoiceMailModel mailModel) {
    }
}









