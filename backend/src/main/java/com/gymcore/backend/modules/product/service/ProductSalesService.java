package com.gymcore.backend.modules.product.service;

import com.gymcore.backend.common.service.UserNotificationService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import com.gymcore.backend.modules.auth.service.CurrentUserService.UserInfo;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProductSalesService {

    @Value("${app.product.image-dir:uploads/products}")
    private String productImageDir;

    @Value("${app.product.image-max-bytes:5242880}")
    private long productImageMaxBytes;

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final PayOsService payOsService;
    private final UserNotificationService notificationService;
    private final OrderInvoiceService orderInvoiceService;

    public ProductSalesService(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService,
            PayOsService payOsService, UserNotificationService notificationService,
            OrderInvoiceService orderInvoiceService) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.payOsService = payOsService;
        this.notificationService = notificationService;
        this.orderInvoiceService = orderInvoiceService;
    }

    public Map<String, Object> execute(String action, String authorizationHeader, Map<String, Object> payload) {
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;
        return switch (action) {
            case "customer-get-products" -> customerGetProducts();
            case "customer-get-product-detail" -> customerGetProductDetail(authorizationHeader, safePayload);
            case "customer-create-review" -> customerCreateReview(authorizationHeader, safePayload);
            case "customer-update-review" -> customerUpdateReview(authorizationHeader, safePayload);
            case "customer-delete-review" -> customerDeleteReview(authorizationHeader, safePayload);
            case "customer-get-cart" -> customerGetCart(authorizationHeader);
            case "customer-add-cart-item" -> customerAddCartItem(authorizationHeader, safePayload);
            case "customer-update-cart-item" -> customerUpdateCartItem(authorizationHeader, safePayload);
            case "customer-delete-cart-item" -> customerDeleteCartItem(authorizationHeader, safePayload);
            case "customer-checkout" -> customerCheckout(authorizationHeader, safePayload);
            case "customer-confirm-payment-return" -> customerConfirmPaymentReturn(authorizationHeader, safePayload);
            case "customer-get-my-orders" -> customerGetMyOrders(authorizationHeader);
            case "admin-get-products" -> adminGetProducts(authorizationHeader);
            case "admin-create-product" -> adminCreateProduct(authorizationHeader, safePayload);
            case "admin-update-product" -> adminUpdateProduct(authorizationHeader, safePayload);
            case "admin-archive-product" -> adminArchiveProduct(authorizationHeader, safePayload);
            case "admin-restore-product" -> adminRestoreProduct(authorizationHeader, safePayload);
            case "admin-get-product-reviews" -> adminGetProductReviews(authorizationHeader);
            case "admin-get-invoices" -> orderInvoiceService.adminGetInvoices(authorizationHeader);
            case "admin-get-invoice-detail" -> orderInvoiceService.adminGetInvoiceDetail(
                    authorizationHeader,
                    requirePositiveInt(safePayload.get("invoiceId"), "Invoice ID is required."));
            case "admin-confirm-invoice-pickup" -> orderInvoiceService.adminConfirmInvoicePickup(
                    authorizationHeader,
                    requirePositiveInt(safePayload.get("invoiceId"), "Invoice ID is required."));
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unsupported product action: " + action);
        };
    }

    private Map<String, Object> customerGetProducts() {
        List<Map<String, Object>> products = jdbcTemplate.query("""
                SELECT p.ProductID,
                       p.ProductName,
                       p.ShortDescription,
                       p.Description,
                       p.Price,
                       COALESCE(NULLIF(p.ThumbnailUrl, ''), NULLIF(p.ImageUrl, ''), primaryImage.ImageUrl) AS ThumbnailUrl,
                       COALESCE(stats.AverageRating, 0) AS AverageRating,
                       COALESCE(stats.ReviewCount, 0) AS ReviewCount,
                       p.IsActive
                FROM dbo.Products p
                LEFT JOIN (
                    SELECT ProductID, AVG(CAST(Rating AS FLOAT)) AS AverageRating, COUNT(*) AS ReviewCount
                    FROM dbo.ProductReviews
                    GROUP BY ProductID
                ) stats ON stats.ProductID = p.ProductID
                LEFT JOIN dbo.ProductImages primaryImage
                    ON primaryImage.ProductID = p.ProductID AND primaryImage.IsPrimary = 1
                WHERE p.IsActive = 1
                ORDER BY p.ProductName
                """, (rs, rowNum) -> mapCatalogProduct(rs));

        Map<Integer, List<Map<String, Object>>> categoryMap = loadCategoryMapByProductIds(extractProductIds(products));
        for (Map<String, Object> product : products) {
            int productId = ((Number) product.get("productId")).intValue();
            product.put("categories", categoryMap.getOrDefault(productId, List.of()));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("categories", loadActiveCategoryCatalog());
        response.put("products", products);
        return response;
    }

    private Map<String, Object> customerGetProductDetail(String authorizationHeader, Map<String, Object> payload) {
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");

        List<Map<String, Object>> products = jdbcTemplate.query("""
                SELECT p.ProductID,
                       p.ProductName,
                       p.ShortDescription,
                       p.Description,
                       p.UsageInstructions,
                       p.Price,
                       COALESCE(NULLIF(p.ThumbnailUrl, ''), NULLIF(p.ImageUrl, ''), primaryImage.ImageUrl) AS ThumbnailUrl,
                       COALESCE(NULLIF(p.ImageUrl, ''), COALESCE(NULLIF(p.ThumbnailUrl, ''), primaryImage.ImageUrl)) AS ImageUrl,
                       COALESCE(stats.AverageRating, 0) AS AverageRating,
                       COALESCE(stats.ReviewCount, 0) AS ReviewCount,
                       p.IsActive
                FROM dbo.Products p
                LEFT JOIN (
                    SELECT ProductID, AVG(CAST(Rating AS FLOAT)) AS AverageRating, COUNT(*) AS ReviewCount
                    FROM dbo.ProductReviews
                    GROUP BY ProductID
                ) stats ON stats.ProductID = p.ProductID
                LEFT JOIN dbo.ProductImages primaryImage
                    ON primaryImage.ProductID = p.ProductID AND primaryImage.IsPrimary = 1
                WHERE p.ProductID = ? AND p.IsActive = 1
                """, (rs, rowNum) -> mapProductDetail(rs), productId);
        if (products.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found.");
        }

        Map<String, Object> product = products.get(0);
        product.put("categories", loadCategoryMapByProductIds(Set.of(productId)).getOrDefault(productId, List.of()));
        product.put("images", loadImageMapByProductIds(Set.of(productId)).getOrDefault(productId, List.of()));

        List<Map<String, Object>> reviews = jdbcTemplate.query("""
                SELECT r.ProductReviewID,
                       r.Rating,
                       r.Comment,
                       r.ReviewDate,
                       u.FullName AS CustomerName,
                       u.AvatarUrl
                FROM dbo.ProductReviews r
                JOIN dbo.Customers c ON c.CustomerID = r.CustomerID
                JOIN dbo.Users u ON u.UserID = c.CustomerID
                WHERE r.ProductID = ?
                ORDER BY r.ReviewDate DESC
                """, (rs, rowNum) -> {
            Map<String, Object> review = new LinkedHashMap<>();
            review.put("productReviewId", rs.getInt("ProductReviewID"));
            review.put("rating", rs.getInt("Rating"));
            review.put("comment", rs.getString("Comment"));
            review.put("reviewDate", rs.getTimestamp("ReviewDate"));
            review.put("customerName", rs.getString("CustomerName"));
            review.put("avatarUrl", rs.getString("AvatarUrl"));
            return review;
        }, productId);

        currentUserService.findUser(authorizationHeader)
                .filter(user -> "CUSTOMER".equals(user.roleApiName()))
                .ifPresent(user -> product.putAll(loadCustomerReviewContext(user.userId(), productId)));

        return Map.of("product", product, "reviews", reviews);
    }

    private Map<String, Object> customerCreateReview(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.getOrDefault("body", Map.of());
        int rating = requireRating(body.get("rating"));
        String comment = requireReviewComment(body.get("comment"));

        if (!customerHasPaidOrderForProduct(user.userId(), productId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Review blocked: customer must have a PAID order for this product.");
        }

        try {
            jdbcTemplate.update("""
                    INSERT INTO dbo.ProductReviews (ProductID, CustomerID, Rating, Comment)
                    VALUES (?, ?, ?, ?)
                    """, productId, user.userId(), rating, comment);
        } catch (DataAccessException exception) {
            String message = exception.getMostSpecificCause() != null
                    ? exception.getMostSpecificCause().getMessage()
                    : exception.getMessage();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    message != null && message.contains("Review blocked")
                            ? "Review blocked: customer must have a PAID order for this product."
                            : "Unable to create review. You may have already reviewed this product.");
        }

        return Map.of("created", true);
    }

    private Map<String, Object> customerUpdateReview(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.getOrDefault("body", Map.of());
        int rating = requireRating(body.get("rating"));
        String comment = requireReviewComment(body.get("comment"));

        if (!customerHasPaidOrderForProduct(user.userId(), productId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Review blocked: customer must have a PAID order for this product.");
        }

        int updated = jdbcTemplate.update("""
                UPDATE dbo.ProductReviews
                SET Rating = ?,
                    Comment = ?,
                    ReviewDate = SYSDATETIME()
                WHERE ProductID = ?
                  AND CustomerID = ?
                """, rating, comment, productId, user.userId());
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found.");
        }

        return Map.of("updated", true);
    }

    private Map<String, Object> customerDeleteReview(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");

        int deleted = jdbcTemplate.update("""
                DELETE FROM dbo.ProductReviews
                WHERE ProductID = ?
                  AND CustomerID = ?
                """, productId, user.userId());
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found.");
        }

        return Map.of("deleted", true);
    }

    private Map<String, Object> customerGetCart(String authorizationHeader) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int cartId = ensureCartForCustomer(user.userId());

        List<Map<String, Object>> items = new ArrayList<>();
        BigDecimal[] subtotalHolder = new BigDecimal[] { BigDecimal.ZERO };

        jdbcTemplate.query("""
                SELECT ci.ProductID,
                       p.ProductName,
                       p.Price,
                       COALESCE(NULLIF(p.ThumbnailUrl, ''), NULLIF(p.ImageUrl, ''), primaryImage.ImageUrl) AS ThumbnailUrl,
                       ci.Quantity
                FROM dbo.CartItems ci
                JOIN dbo.Products p ON p.ProductID = ci.ProductID
                LEFT JOIN dbo.ProductImages primaryImage
                    ON primaryImage.ProductID = p.ProductID AND primaryImage.IsPrimary = 1
                WHERE ci.CartID = ?
                ORDER BY p.ProductName
                """, ps -> ps.setInt(1, cartId), rs -> {
            BigDecimal price = rs.getBigDecimal("Price");
            int quantity = rs.getInt("Quantity");
            BigDecimal lineTotal = price.multiply(BigDecimal.valueOf(quantity));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("productId", rs.getInt("ProductID"));
            item.put("name", rs.getString("ProductName"));
            item.put("price", price);
            item.put("thumbnailUrl", rs.getString("ThumbnailUrl"));
            item.put("imageUrl", rs.getString("ThumbnailUrl"));
            item.put("quantity", quantity);
            item.put("lineTotal", lineTotal);
            items.add(item);
            subtotalHolder[0] = subtotalHolder[0].add(lineTotal);
        });

        return Map.of(
                "items", items,
                "subtotal", subtotalHolder[0],
                "currency", "VND");
    }
    private Map<String, Object> customerAddCartItem(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");
        int quantity = requirePositiveInt(payload.get("quantity"), "Quantity must be greater than zero.");

        verifyProductIsActive(productId);
        int cartId = ensureCartForCustomer(user.userId());

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
            return customerGetCart(authorizationHeader);
        }

        verifyProductIsActive(productId);
        jdbcTemplate.update("""
                UPDATE dbo.CartItems
                SET Quantity = ?
                WHERE CartID = ? AND ProductID = ?
                """, quantity, cartId, productId);

        return customerGetCart(authorizationHeader);
    }

    private Map<String, Object> customerDeleteCartItem(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");
        int cartId = ensureCartForCustomer(user.userId());
        jdbcTemplate.update("DELETE FROM dbo.CartItems WHERE CartID = ? AND ProductID = ?", cartId, productId);
        return customerGetCart(authorizationHeader);
    }

    private Map<String, Object> customerCheckout(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int customerId = user.userId();
        int cartId = ensureCartForCustomer(customerId);

        CheckoutContact contact = loadCheckoutContact(customerId);
        OrderRecipient recipient = resolveOrderRecipient(payload, contact);
        String paymentMethod = normalizePaymentMethod(payload.get("paymentMethod"));
        List<CartLine> lines = loadCartLines(cartId);

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
        if (promoCode != null) {
            Map<String, Object> claim = loadOrderClaim(customerId, promoCode);
            claimId = ((Number) claim.get("ClaimID")).intValue();
            BigDecimal pct = optionalDecimal(claim.get("DiscountPercent"), "Invalid percent");
            BigDecimal amt = optionalDecimal(claim.get("DiscountAmount"), "Invalid amount");
            String applyTarget = upperText(claim.get("ApplyTarget"));
            if (!"ORDER".equals(applyTarget)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "This coupon applies to membership purchases only.");
            }

            if (pct != null && pct.compareTo(BigDecimal.ZERO) > 0) {
                discount = subtotal.multiply(pct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            } else if (amt != null) {
                discount = amt;
            }

            if (discount.compareTo(subtotal) > 0) {
                discount = subtotal;
            }
        }

        BigDecimal total = subtotal.subtract(discount);
        int orderId = insertOrder(customerId, claimId, subtotal, discount, total, recipient, paymentMethod);

        jdbcTemplate.update("DELETE FROM dbo.OrderItems WHERE OrderID = ?", orderId);
        for (CartLine line : lines) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.OrderItems (OrderID, ProductID, Quantity, UnitPrice)
                    VALUES (?, ?, ?, ?)
                    """, orderId, line.productId(), line.quantity(), line.price());
        }

        int paymentId = insertPaymentForOrder(orderId, claimId, subtotal, discount, total, paymentMethod);
        List<PayOsService.PayOsItem> payOsItems = lines.stream()
                .map(line -> new PayOsService.PayOsItem(line.name(), line.quantity(), line.price().intValue(), "unit", 0))
                .toList();

        PayOsService.PayOsLink link;
        try {
            link = payOsService.createPaymentLink(
                    paymentId,
                    total,
                    "Order #" + orderId,
                    contact.buyerName(),
                    contact.buyerPhone(),
                    contact.buyerEmail(),
                    "PICKUP_AT_STORE",
                    payOsItems);
        } catch (RuntimeException exception) {
            markCheckoutCreationFailed(orderId, paymentId);
            throw exception;
        }

        int updatedRows = jdbcTemplate.update("""
                UPDATE dbo.Payments
                SET PayOS_PaymentLinkId = ?, PayOS_CheckoutUrl = ?, PayOS_Status = ?
                WHERE PaymentID = ? AND Status = 'PENDING'
                """, link.paymentLinkId(), link.checkoutUrl(), link.status(), paymentId);
        if (updatedRows == 0) {
            markCheckoutCreationFailed(orderId, paymentId);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Payment state changed unexpectedly during checkout.");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("orderId", orderId);
        response.put("paymentId", paymentId);
        response.put("checkoutUrl", link.checkoutUrl());
        response.put("subtotal", subtotal);
        response.put("discount", discount);
        response.put("totalAmount", total);
        response.put("currency", "VND");
        response.put("fulfillmentMethod", "PICKUP_AT_STORE");
        return response;
    }

    private Map<String, Object> customerGetMyOrders(String authorizationHeader) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        int customerId = user.userId();

        List<Map<String, Object>> orders = new ArrayList<>();
        jdbcTemplate.query("""
                SELECT o.OrderID,
                       o.OrderDate,
                       o.Subtotal,
                       o.DiscountApplied,
                       o.TotalAmount,
                       o.Status,
                       p.PaymentID,
                       p.PaidAt,
                       p.PaymentMethod,
                       i.InvoiceID,
                       i.InvoiceCode,
                       i.EmailSentAt,
                       i.EmailSendError,
                       i.PickedUpAt
                FROM dbo.Orders o
                LEFT JOIN dbo.Payments p
                    ON p.OrderID = o.OrderID
                   AND p.Status = 'SUCCESS'
                LEFT JOIN dbo.OrderInvoices i
                    ON i.OrderID = o.OrderID
                WHERE o.CustomerID = ?
                ORDER BY o.OrderDate DESC, o.OrderID DESC
                """, rs -> {
            int orderId = rs.getInt("OrderID");
            Map<String, Object> order = new LinkedHashMap<>();
            order.put("orderId", orderId);
            order.put("orderDate", rs.getTimestamp("OrderDate"));
            order.put("subtotal", rs.getBigDecimal("Subtotal"));
            order.put("discount", rs.getBigDecimal("DiscountApplied"));
            order.put("totalAmount", rs.getBigDecimal("TotalAmount"));
            order.put("status", rs.getString("Status"));
            order.put("currency", "VND");
            order.put("fulfillmentMethod", "PICKUP_AT_STORE");
            order.put("paymentId", rs.getObject("PaymentID"));
            order.put("paidAt", rs.getTimestamp("PaidAt"));
            order.put("paymentMethod", rs.getString("PaymentMethod"));
            order.put("invoiceId", rs.getObject("InvoiceID"));
            order.put("invoiceCode", rs.getString("InvoiceCode"));
            order.put("emailSentAt", rs.getTimestamp("EmailSentAt"));
            order.put("emailSendError", rs.getString("EmailSendError"));
            order.put("pickedUpAt", rs.getTimestamp("PickedUpAt"));
            order.put("pickupStatus", rs.getTimestamp("PickedUpAt") == null ? "AWAITING_PICKUP" : "PICKED_UP");

            List<Map<String, Object>> items = jdbcTemplate.query("""
                    SELECT oi.ProductID,
                           p.ProductName,
                           COALESCE(NULLIF(p.ThumbnailUrl, ''), NULLIF(p.ImageUrl, ''), primaryImage.ImageUrl) AS ThumbnailUrl,
                           oi.Quantity,
                           oi.UnitPrice,
                           r.ProductReviewID,
                           r.Rating AS ReviewRating,
                           r.Comment AS ReviewComment
                    FROM dbo.OrderItems oi
                    JOIN dbo.Products p ON p.ProductID = oi.ProductID
                    LEFT JOIN dbo.ProductImages primaryImage
                        ON primaryImage.ProductID = p.ProductID AND primaryImage.IsPrimary = 1
                    LEFT JOIN dbo.ProductReviews r
                        ON r.ProductID = oi.ProductID AND r.CustomerID = ?
                    WHERE oi.OrderID = ?
                    ORDER BY oi.ProductID ASC
                    """, (itemRs, rowNum) -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("productId", itemRs.getInt("ProductID"));
                item.put("name", itemRs.getString("ProductName"));
                item.put("thumbnailUrl", itemRs.getString("ThumbnailUrl"));
                item.put("quantity", itemRs.getInt("Quantity"));
                item.put("unitPrice", itemRs.getBigDecimal("UnitPrice"));
                Integer reviewId = (Integer) itemRs.getObject("ProductReviewID");
                item.put("hasReview", reviewId != null);
                item.put("reviewId", reviewId);
                item.put("reviewRating", itemRs.getObject("ReviewRating"));
                item.put("reviewComment", itemRs.getString("ReviewComment"));
                return item;
            }, customerId, orderId);

            order.put("items", items);
            orders.add(order);
        }, customerId);

        return Map.of("orders", orders);
    }

    private Map<String, Object> customerConfirmPaymentReturn(String authorizationHeader, Map<String, Object> payload) {
        UserInfo user = currentUserService.requireCustomer(authorizationHeader);
        String status = upperText(firstNonNull(
                payload.get("status"),
                payload.get("payosStatus"),
                payload.get("paymentStatus")));
        String code = upperText(payload.get("code"));
        String cancel = upperText(payload.get("cancel"));
        Object successRaw = payload.get("success");

        if (!isSuccessReturnStatus(status, code, cancel, successRaw)) {
            return Map.of("handled", false, "reason", "Ignored non-success return status.");
        }

        Integer paymentId = resolvePaymentIdFromReturnPayload(payload);
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
            notifyOrderPaymentSuccess(paymentId);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to confirm payment from return URL.", exception);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("handled", true);
        response.put("paymentId", paymentId);
        response.put("status", "SUCCESS");
        response.putAll(orderInvoiceService.handleSuccessfulProductPayment(paymentId));
        return response;
    }
    private Map<String, Object> adminGetProducts(String authorizationHeader) {
        currentUserService.requireAdmin(authorizationHeader);

        List<Map<String, Object>> products = jdbcTemplate.query("""
                SELECT p.ProductID,
                       p.ProductName,
                       p.ShortDescription,
                       p.Description,
                       p.UsageInstructions,
                       p.Price,
                       COALESCE(NULLIF(p.ThumbnailUrl, ''), NULLIF(p.ImageUrl, ''), primaryImage.ImageUrl) AS ThumbnailUrl,
                       COALESCE(NULLIF(p.ImageUrl, ''), COALESCE(NULLIF(p.ThumbnailUrl, ''), primaryImage.ImageUrl)) AS ImageUrl,
                       p.IsActive,
                       p.CreatedAt,
                       p.UpdatedAt,
                       COALESCE(stats.AverageRating, 0) AS AverageRating,
                       COALESCE(stats.ReviewCount, 0) AS ReviewCount
                FROM dbo.Products p
                LEFT JOIN dbo.ProductImages primaryImage
                    ON primaryImage.ProductID = p.ProductID AND primaryImage.IsPrimary = 1
                LEFT JOIN (
                    SELECT ProductID,
                           AVG(CAST(Rating AS FLOAT)) AS AverageRating,
                           COUNT(*) AS ReviewCount
                    FROM dbo.ProductReviews
                    GROUP BY ProductID
                ) stats ON stats.ProductID = p.ProductID
                ORDER BY p.ProductName
                """, (rs, rowNum) -> {
            Map<String, Object> product = mapProductDetail(rs);
            product.put("createdAt", rs.getTimestamp("CreatedAt"));
            product.put("updatedAt", rs.getTimestamp("UpdatedAt"));
            product.put("reviewCount", rs.getInt("ReviewCount"));
            return product;
        });

        Set<Integer> productIds = extractProductIds(products);
        Map<Integer, List<Map<String, Object>>> categoryMap = loadCategoryMapByProductIds(productIds);
        Map<Integer, List<Map<String, Object>>> imageMap = loadImageMapByProductIds(productIds);
        for (Map<String, Object> product : products) {
            int productId = ((Number) product.get("productId")).intValue();
            product.put("categories", categoryMap.getOrDefault(productId, List.of()));
            product.put("images", imageMap.getOrDefault(productId, List.of()));
        }

        return Map.of(
                "categories", loadAllCategoryCatalog(),
                "products", products);
    }

    private Map<String, Object> adminCreateProduct(String authorizationHeader, Map<String, Object> payload) {
        UserInfo admin = currentUserService.requireAdmin(authorizationHeader);
        ProductUpsertPayload normalized = normalizeProductPayload(payload);
        validateProductPayload(normalized);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("""
                    INSERT INTO dbo.Products (
                        ProductName, ShortDescription, Description, UsageInstructions, Price,
                        ImageUrl, ThumbnailUrl, IsActive, UpdatedBy
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, new String[] { "ProductID" });
            ps.setString(1, normalized.name());
            ps.setString(2, normalized.shortDescription());
            ps.setString(3, normalized.description());
            ps.setString(4, normalized.usageInstructions());
            ps.setBigDecimal(5, normalized.price());
            ps.setString(6, normalized.primaryImageUrl());
            ps.setString(7, normalized.thumbnailUrl());
            ps.setBoolean(8, normalized.active());
            ps.setInt(9, admin.userId());
            return ps;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create product.");
        }
        int productId = key.intValue();

        replaceProductCategories(productId, normalized.categoryIds());
        replaceProductImages(productId, normalized.images());
        return Map.of("created", true, "productId", productId);
    }

    private Map<String, Object> adminUpdateProduct(String authorizationHeader, Map<String, Object> payload) {
        UserInfo admin = currentUserService.requireAdmin(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) payload.getOrDefault("body", Map.of());

        ProductUpsertPayload normalized = normalizeProductPayload(body);
        validateProductPayload(normalized);

        int updated = jdbcTemplate.update("""
                UPDATE dbo.Products
                SET ProductName = ?,
                    ShortDescription = ?,
                    Description = ?,
                    UsageInstructions = ?,
                    Price = ?,
                    ImageUrl = ?,
                    ThumbnailUrl = ?,
                    IsActive = ?,
                    UpdatedAt = SYSDATETIME(),
                    UpdatedBy = ?
                WHERE ProductID = ?
                """,
                normalized.name(),
                normalized.shortDescription(),
                normalized.description(),
                normalized.usageInstructions(),
                normalized.price(),
                normalized.primaryImageUrl(),
                normalized.thumbnailUrl(),
                normalized.active(),
                admin.userId(),
                productId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found.");
        }

        replaceProductCategories(productId, normalized.categoryIds());
        replaceProductImages(productId, normalized.images());
        return Map.of("updated", true, "productId", productId);
    }

    private Map<String, Object> adminArchiveProduct(String authorizationHeader, Map<String, Object> payload) {
        UserInfo admin = currentUserService.requireAdmin(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");

        int updated = jdbcTemplate.update("""
                UPDATE dbo.Products
                SET IsActive = 0,
                    UpdatedAt = SYSDATETIME(),
                    UpdatedBy = ?
                WHERE ProductID = ?
                """, admin.userId(), productId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found.");
        }

        return Map.of("archived", true, "productId", productId);
    }

    private Map<String, Object> adminRestoreProduct(String authorizationHeader, Map<String, Object> payload) {
        UserInfo admin = currentUserService.requireAdmin(authorizationHeader);
        int productId = requirePositiveInt(payload.get("productId"), "Product ID is required.");

        int updated = jdbcTemplate.update("""
                UPDATE dbo.Products
                SET IsActive = 1,
                    UpdatedAt = SYSDATETIME(),
                    UpdatedBy = ?
                WHERE ProductID = ?
                """, admin.userId(), productId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found.");
        }

        return Map.of("restored", true, "productId", productId);
    }

    public Map<String, Object> uploadProductImage(String authorizationHeader, MultipartFile file) {
        currentUserService.requireAdmin(authorizationHeader);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product image file is required.");
        }
        if (file.getSize() > productImageMaxBytes) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product image file is too large.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to read product image file.");
        }
        if (bytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product image file is required.");
        }

        String extension = detectImageExtension(bytes);
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only JPG, PNG, or WEBP images are allowed.");
        }

        Path baseDir = Paths.get(productImageDir).toAbsolutePath().normalize();
        Path imageDir = baseDir.resolve("catalog").normalize();
        if (!imageDir.startsWith(baseDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid product image storage location.");
        }

        try {
            Files.createDirectories(imageDir);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to create product image storage folder.");
        }

        String filename = UUID.randomUUID().toString().replace("-", "") + "." + extension;
        Path storedPath = imageDir.resolve(filename).normalize();
        if (!storedPath.startsWith(imageDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid product image file path.");
        }

        try {
            Files.write(storedPath, bytes);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store product image file.");
        }

        return Map.of("imageUrl", "/uploads/products/catalog/" + filename);
    }

    public Map<String, Object> deleteUploadedProductImage(String authorizationHeader, String imageUrl) {
        currentUserService.requireAdmin(authorizationHeader);
        String normalized = requireText(imageUrl, "Product image URL is required.");
        boolean deleted = tryDeleteManagedImageIfUnused(normalized);
        return Map.of("deleted", deleted, "imageUrl", normalized);
    }

    private Map<String, Object> adminGetProductReviews(String authorizationHeader) {
        currentUserService.requireAdmin(authorizationHeader);
        List<Map<String, Object>> reviews = jdbcTemplate.query("""
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
                """, (rs, rowNum) -> {
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
        return Map.of("reviews", reviews);
    }

    private Map<String, Object> mapCatalogProduct(ResultSet rs) throws SQLException {
        Map<String, Object> product = new LinkedHashMap<>();
        product.put("productId", rs.getInt("ProductID"));
        product.put("name", rs.getString("ProductName"));
        product.put("shortDescription", rs.getString("ShortDescription"));
        product.put("description", rs.getString("Description"));
        product.put("price", rs.getBigDecimal("Price"));
        product.put("thumbnailUrl", rs.getString("ThumbnailUrl"));
        product.put("imageUrl", rs.getString("ThumbnailUrl"));
        product.put("averageRating", rs.getDouble("AverageRating"));
        product.put("reviewCount", rs.getInt("ReviewCount"));
        product.put("active", rs.getBoolean("IsActive"));
        return product;
    }

    private Map<String, Object> mapProductDetail(ResultSet rs) throws SQLException {
        Map<String, Object> product = new LinkedHashMap<>();
        product.put("productId", rs.getInt("ProductID"));
        product.put("name", rs.getString("ProductName"));
        product.put("shortDescription", rs.getString("ShortDescription"));
        product.put("description", rs.getString("Description"));
        product.put("usageInstructions", rs.getString("UsageInstructions"));
        product.put("price", rs.getBigDecimal("Price"));
        product.put("thumbnailUrl", rs.getString("ThumbnailUrl"));
        product.put("imageUrl", rs.getString("ImageUrl"));
        try {
            product.put("averageRating", rs.getDouble("AverageRating"));
        } catch (SQLException ignored) {
            product.put("averageRating", 0D);
        }
        try {
            product.put("reviewCount", rs.getInt("ReviewCount"));
        } catch (SQLException ignored) {
            product.put("reviewCount", 0);
        }
        product.put("active", rs.getBoolean("IsActive"));
        return product;
    }

    private Set<Integer> extractProductIds(List<Map<String, Object>> products) {
        return products.stream()
                .map(product -> product.get("productId"))
                .filter(Number.class::isInstance)
                .map(value -> ((Number) value).intValue())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
    private Map<Integer, List<Map<String, Object>>> loadCategoryMapByProductIds(Set<Integer> productIds) {
        if (productIds.isEmpty()) {
            return Map.of();
        }

        String sql = """
                SELECT pcm.ProductID, c.ProductCategoryID, c.CategoryName
                FROM dbo.ProductCategoryMap pcm
                JOIN dbo.ProductCategories c ON c.ProductCategoryID = pcm.ProductCategoryID
                WHERE pcm.ProductID IN (%s)
                ORDER BY c.SortOrder, c.CategoryName
                """.formatted(repeatPlaceholders(productIds.size()));

        Map<Integer, List<Map<String, Object>>> result = new LinkedHashMap<>();
        jdbcTemplate.query(sql, productIds.toArray(), rs -> {
            int productId = rs.getInt("ProductID");
            result.computeIfAbsent(productId, ignored -> new ArrayList<>()).add(Map.of(
                    "productCategoryId", rs.getInt("ProductCategoryID"),
                    "name", rs.getString("CategoryName")));
        });
        return result;
    }

    private Map<Integer, List<Map<String, Object>>> loadImageMapByProductIds(Set<Integer> productIds) {
        if (productIds.isEmpty()) {
            return Map.of();
        }

        String sql = """
                SELECT ProductID, ProductImageID, ImageUrl, AltText, DisplayOrder, IsPrimary
                FROM dbo.ProductImages
                WHERE ProductID IN (%s)
                ORDER BY ProductID, DisplayOrder, ProductImageID
                """.formatted(repeatPlaceholders(productIds.size()));

        Map<Integer, List<Map<String, Object>>> result = new LinkedHashMap<>();
        jdbcTemplate.query(sql, productIds.toArray(), rs -> {
            int productId = rs.getInt("ProductID");
            Map<String, Object> image = new LinkedHashMap<>();
            image.put("productImageId", rs.getInt("ProductImageID"));
            image.put("imageUrl", rs.getString("ImageUrl"));
            image.put("altText", rs.getString("AltText"));
            image.put("displayOrder", rs.getInt("DisplayOrder"));
            image.put("isPrimary", rs.getBoolean("IsPrimary"));
            result.computeIfAbsent(productId, ignored -> new ArrayList<>()).add(image);
        });
        return result;
    }

    private List<Map<String, Object>> loadActiveCategoryCatalog() {
        return jdbcTemplate.query("""
                SELECT ProductCategoryID, CategoryName, Description, SortOrder
                FROM dbo.ProductCategories
                WHERE IsActive = 1
                ORDER BY SortOrder, CategoryName
                """, (rs, rowNum) -> mapCategory(rs));
    }

    private List<Map<String, Object>> loadAllCategoryCatalog() {
        return jdbcTemplate.query("""
                SELECT ProductCategoryID, CategoryName, Description, SortOrder, IsActive
                FROM dbo.ProductCategories
                ORDER BY SortOrder, CategoryName
                """, (rs, rowNum) -> {
            Map<String, Object> category = mapCategory(rs);
            category.put("active", rs.getBoolean("IsActive"));
            return category;
        });
    }

    private Map<String, Object> mapCategory(ResultSet rs) throws SQLException {
        Map<String, Object> category = new LinkedHashMap<>();
        category.put("productCategoryId", rs.getInt("ProductCategoryID"));
        category.put("name", rs.getString("CategoryName"));
        category.put("description", rs.getString("Description"));
        category.put("sortOrder", rs.getInt("SortOrder"));
        return category;
    }

    private List<CartLine> loadCartLines(int cartId) {
        List<CartLine> lines = new ArrayList<>();
        jdbcTemplate.query("""
                SELECT ci.ProductID,
                       ci.Quantity,
                       p.ProductName,
                       p.Price,
                       COALESCE(NULLIF(p.ThumbnailUrl, ''), NULLIF(p.ImageUrl, ''), primaryImage.ImageUrl) AS ThumbnailUrl
                FROM dbo.CartItems ci
                JOIN dbo.Products p ON p.ProductID = ci.ProductID
                LEFT JOIN dbo.ProductImages primaryImage
                    ON primaryImage.ProductID = p.ProductID AND primaryImage.IsPrimary = 1
                WHERE ci.CartID = ?
                """, ps -> ps.setInt(1, cartId), new org.springframework.jdbc.core.RowCallbackHandler() {
            @Override
            public void processRow(ResultSet rs) throws SQLException {
                lines.add(new CartLine(
                        rs.getInt("ProductID"),
                        rs.getString("ProductName"),
                        rs.getBigDecimal("Price"),
                        rs.getInt("Quantity"),
                        rs.getString("ThumbnailUrl")));
            }
        });
        return lines;
    }

    private Map<String, Object> loadOrderClaim(int customerId, String promoCode) {
        List<Map<String, Object>> claims = jdbcTemplate.queryForList("""
                SELECT c.ClaimID, p.DiscountPercent, p.DiscountAmount, p.ApplyTarget, p.BonusDurationMonths
                FROM dbo.UserPromotionClaims c
                JOIN dbo.Promotions p ON p.PromotionID = c.PromotionID
                WHERE c.UserID = ? AND p.PromoCode = ? AND c.UsedAt IS NULL
                  AND p.IsActive = 1
                  AND CAST(SYSDATETIME() AS DATE) BETWEEN CAST(p.ValidFrom AS DATE) AND CAST(p.ValidTo AS DATE)
                """, customerId, promoCode);

        if (claims.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired promo code.");
        }
        return claims.get(0);
    }

    private ProductUpsertPayload normalizeProductPayload(Map<String, Object> payload) {
        String name = requireText(payload.get("name"), "Product name is required.");
        String shortDescription = asNullableString(payload.get("shortDescription"));
        String description = asNullableString(payload.get("description"));
        String usageInstructions = asNullableString(payload.get("usageInstructions"));
        BigDecimal price = requirePositiveDecimal(payload.get("price"), "Price is required.");
        boolean active = requireBoolean(payload.getOrDefault("active", Boolean.TRUE));
        List<Integer> categoryIds = normalizeIntegerList(payload.get("categoryIds"));
        List<ProductImageInput> images = normalizeImageInputs(
                payload.get("images"),
                asNullableString(payload.get("thumbnailUrl")),
                asNullableString(payload.get("imageUrl")));

        String thumbnailUrl = images.isEmpty()
                ? firstNonBlank(asNullableString(payload.get("thumbnailUrl")), asNullableString(payload.get("imageUrl")))
                : images.stream().filter(ProductImageInput::isPrimary).findFirst().map(ProductImageInput::imageUrl)
                        .orElse(images.get(0).imageUrl());
        String primaryImageUrl = images.isEmpty()
                ? firstNonBlank(asNullableString(payload.get("imageUrl")), thumbnailUrl)
                : images.stream().filter(ProductImageInput::isPrimary).findFirst().map(ProductImageInput::imageUrl)
                        .orElse(images.get(0).imageUrl());

        return new ProductUpsertPayload(
                name,
                shortDescription,
                description,
                usageInstructions,
                price,
                active,
                categoryIds,
                thumbnailUrl,
                primaryImageUrl,
                images);
    }

    private void validateProductPayload(ProductUpsertPayload payload) {
        validateCategoryIds(payload.categoryIds());
        validateProductImages(payload.images());
    }

    private void validateCategoryIds(List<Integer> categoryIds) {
        if (categoryIds.isEmpty()) {
            return;
        }

        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.ProductCategories
                WHERE ProductCategoryID IN (%s)
                """.formatted(repeatPlaceholders(categoryIds.size())), Integer.class, categoryIds.toArray());
        if (count == null || count != categoryIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more product categories are invalid.");
        }
    }

    private void validateProductImages(List<ProductImageInput> images) {
        if (images.size() > 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A product can have at most 8 images.");
        }
        long primaryCount = images.stream().filter(ProductImageInput::isPrimary).count();
        if (primaryCount > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only one primary image is allowed per product.");
        }
        Set<String> seenUrls = new LinkedHashSet<>();
        Set<Integer> seenDisplayOrders = new LinkedHashSet<>();
        for (ProductImageInput image : images) {
            if (image.displayOrder() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Image display order must be greater than zero.");
            }
            String imageUrl = asNullableString(image.imageUrl());
            if (imageUrl == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image URL is required.");
            }
            if (!seenUrls.add(imageUrl)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duplicate product image URLs are not allowed.");
            }
            if (!seenDisplayOrders.add(image.displayOrder())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Duplicate product image display orders are not allowed.");
            }
        }
    }

    private void replaceProductCategories(int productId, List<Integer> categoryIds) {
        jdbcTemplate.update("DELETE FROM dbo.ProductCategoryMap WHERE ProductID = ?", productId);
        for (Integer categoryId : categoryIds) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.ProductCategoryMap (ProductID, ProductCategoryID)
                    VALUES (?, ?)
                    """, productId, categoryId);
        }
    }

    private void replaceProductImages(int productId, List<ProductImageInput> images) {
        List<String> previousManagedUrls = jdbcTemplate.query("""
                SELECT ImageUrl
                FROM dbo.ProductImages
                WHERE ProductID = ?
                """, (rs, rowNum) -> rs.getString("ImageUrl"), productId);
        jdbcTemplate.update("DELETE FROM dbo.ProductImages WHERE ProductID = ?", productId);
        for (ProductImageInput image : images) {
            jdbcTemplate.update("""
                    INSERT INTO dbo.ProductImages (ProductID, ImageUrl, AltText, DisplayOrder, IsPrimary, UpdatedAt)
                    VALUES (?, ?, ?, ?, ?, SYSDATETIME())
                    """, productId, image.imageUrl(), image.altText(), image.displayOrder(), image.isPrimary());
        }
        Set<String> retainedUrls = images.stream()
                .map(ProductImageInput::imageUrl)
                .filter(url -> url != null && !url.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        previousManagedUrls.stream()
                .filter(url -> url != null && !retainedUrls.contains(url))
                .forEach(this::tryDeleteManagedImageIfUnused);
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

    private Map<String, Object> loadCustomerReviewContext(int customerId, int productId) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("canReview", customerHasPaidOrderForProduct(customerId, productId));

        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT TOP (1) ProductReviewID, Rating, Comment, ReviewDate
                FROM dbo.ProductReviews
                WHERE ProductID = ? AND CustomerID = ?
                ORDER BY ProductReviewID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> review = new LinkedHashMap<>();
            review.put("reviewId", rs.getInt("ProductReviewID"));
            review.put("rating", rs.getInt("Rating"));
            review.put("comment", rs.getString("Comment"));
            review.put("reviewDate", rs.getTimestamp("ReviewDate"));
            return review;
        }, productId, customerId);

        context.put("myReview", rows.isEmpty() ? null : rows.get(0));
        return context;
    }

    private Integer resolvePaymentIdFromReturnPayload(Map<String, Object> payload) {
        Object rawPaymentId = firstNonNull(payload.get("paymentId"), payload.get("orderCode"));
        Integer parsed = payOsService.resolvePaymentIdFromPayOsOrderCode(rawPaymentId);
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

    private int insertOrder(int customerId, Integer claimId, BigDecimal subtotal, BigDecimal discount, BigDecimal total,
            OrderRecipient recipient, String paymentMethod) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("""
                    INSERT INTO dbo.Orders (
                        CustomerID, ClaimID, Subtotal, DiscountApplied, TotalAmount, Status,
                        ShippingFullName, ShippingPhone, ShippingEmail, ShippingAddress, PaymentMethod
                    )
                    VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)
                    """, new String[] { "OrderID" });
            ps.setInt(1, customerId);
            if (claimId == null) {
                ps.setNull(2, java.sql.Types.INTEGER);
            } else {
                ps.setInt(2, claimId);
            }
            ps.setBigDecimal(3, subtotal);
            ps.setBigDecimal(4, discount);
            ps.setBigDecimal(5, total);
            ps.setString(6, recipient.fullName());
            ps.setString(7, recipient.phone());
            ps.setString(8, recipient.email());
            ps.setString(9, recipient.address());
            ps.setString(10, paymentMethod);
            return ps;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create order.");
        }
        return key.intValue();
    }

    private int insertPaymentForOrder(int orderId, Integer claimId, BigDecimal originalAmount, BigDecimal discount,
            BigDecimal amount, String paymentMethod) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("""
                    INSERT INTO dbo.Payments (OriginalAmount, DiscountAmount, Amount, Status, OrderID, ClaimID, PaymentMethod)
                    VALUES (?, ?, ?, 'PENDING', ?, ?, ?)
                    """, new String[] { "PaymentID" });
            ps.setBigDecimal(1, originalAmount);
            ps.setBigDecimal(2, discount);
            ps.setBigDecimal(3, amount);
            ps.setInt(4, orderId);
            if (claimId == null) {
                ps.setNull(5, java.sql.Types.INTEGER);
            } else {
                ps.setInt(5, claimId);
            }
            ps.setString(6, paymentMethod);
            return ps;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create payment.");
        }
        return key.intValue();
    }

    private void markCheckoutCreationFailed(int orderId, int paymentId) {
        jdbcTemplate.update("""
                UPDATE dbo.Payments
                SET Status = 'FAILED',
                    PayOS_Status = COALESCE(PayOS_Status, 'FAILED')
                WHERE PaymentID = ? AND Status = 'PENDING'
                """, paymentId);
        jdbcTemplate.update("""
                UPDATE dbo.Orders
                SET Status = 'CANCELLED',
                    UpdatedAt = SYSDATETIME()
                WHERE OrderID = ? AND Status = 'PENDING'
                """, orderId);
    }

    private void notifyOrderPaymentSuccess(int paymentId) {
        jdbcTemplate.query("""
                SELECT TOP (1)
                    o.CustomerID,
                    o.OrderID,
                    p.Amount
                FROM dbo.Payments p
                JOIN dbo.Orders o ON o.OrderID = p.OrderID
                WHERE p.PaymentID = ?
                """, rs -> {
            int customerId = rs.getInt("CustomerID");
            int orderId = rs.getInt("OrderID");
            BigDecimal amount = rs.getBigDecimal("Amount");
            String message = "Your product order #" + orderId + " payment was confirmed"
                    + (amount == null ? "." : " for " + amount.stripTrailingZeros().toPlainString() + " VND.");
            notificationService.notifyUser(
                    customerId,
                    "ORDER_PAYMENT_SUCCESS",
                    "Order payment successful",
                    message,
                    "/customer/orders",
                    orderId,
                    "ORDER_PAYMENT_SUCCESS_" + paymentId);
        }, paymentId);
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
            if (value instanceof BigDecimal decimal) {
                return decimal;
            }
            if (value instanceof Number number) {
                return BigDecimal.valueOf(number.doubleValue());
            }
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private BigDecimal optionalDecimal(Object value, String message) {
        if (value == null) {
            return null;
        }
        return requireDecimal(value, message);
    }

    private String requireText(Object value, String message) {
        String text = asNullableString(value);
        if (text == null || text.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return text;
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

    private OrderRecipient resolveOrderRecipient(Map<String, Object> payload, CheckoutContact contact) {
        String fullName = asNullableString(payload.get("fullName"));
        String phone = asNullableString(payload.get("phone"));
        String email = asNullableString(payload.get("email"));

        return new OrderRecipient(
                fullName != null ? fullName : contact.buyerName(),
                phone != null ? phone : contact.buyerPhone(),
                email != null ? email : contact.buyerEmail(),
                null);
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

    private String requireReviewComment(Object value) {
        String comment = asNullableString(value);
        if (comment == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Review comment is required.");
        }
        return comment;
    }

    private List<Integer> normalizeIntegerList(Object raw) {
        if (!(raw instanceof Collection<?> collection)) {
            return List.of();
        }
        List<Integer> ids = new ArrayList<>();
        for (Object value : collection) {
            ids.add(requirePositiveInt(value, "Category IDs must be positive integers."));
        }
        return ids.stream().distinct().toList();
    }

    private List<ProductImageInput> normalizeImageInputs(Object raw, String fallbackThumbnailUrl, String fallbackImageUrl) {
        List<ProductImageInput> images = new ArrayList<>();
        if (raw instanceof Collection<?> collection) {
            int fallbackOrder = 1;
            for (Object value : collection) {
                if (!(value instanceof Map<?, ?> rawMap)) {
                    continue;
                }
                Map<String, Object> map = new LinkedHashMap<>();
                rawMap.forEach((key, itemValue) -> map.put(String.valueOf(key), itemValue));
                String imageUrl = asNullableString(map.get("imageUrl"));
                if (imageUrl == null) {
                    continue;
                }
                String altText = asNullableString(map.get("altText"));
                int displayOrder = map.get("displayOrder") == null
                        ? fallbackOrder
                        : requirePositiveInt(map.get("displayOrder"), "Image display order must be positive.");
                boolean isPrimary = requireBoolean(map.getOrDefault("isPrimary", Boolean.FALSE));
                images.add(new ProductImageInput(imageUrl, altText, displayOrder, isPrimary));
                fallbackOrder++;
            }
        }

        if (images.isEmpty()) {
            String fallback = firstNonBlank(fallbackThumbnailUrl, fallbackImageUrl);
            if (fallback != null) {
                images = List.of(new ProductImageInput(fallback, null, 1, true));
            }
        } else if (images.stream().noneMatch(ProductImageInput::isPrimary)) {
            ProductImageInput first = images.get(0);
            List<ProductImageInput> normalized = new ArrayList<>();
            normalized.add(new ProductImageInput(first.imageUrl(), first.altText(), first.displayOrder(), true));
            normalized.addAll(images.subList(1, images.size()));
            images = normalized;
        }

        return images;
    }

    private String detectImageExtension(byte[] bytes) {
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47
                && bytes[4] == 0x0D
                && bytes[5] == 0x0A
                && bytes[6] == 0x1A
                && bytes[7] == 0x0A) {
            return "png";
        }
        if (bytes.length >= 12
                && bytes[0] == 0x52
                && bytes[1] == 0x49
                && bytes[2] == 0x46
                && bytes[3] == 0x46
                && bytes[8] == 0x57
                && bytes[9] == 0x45
                && bytes[10] == 0x42
                && bytes[11] == 0x50) {
            return "webp";
        }
        return null;
    }

    private boolean tryDeleteManagedImageIfUnused(String imageUrl) {
        Path storedPath = resolveManagedProductImagePath(imageUrl);
        if (storedPath == null) {
            return false;
        }

        Integer usageCount = jdbcTemplate.queryForObject("""
                SELECT
                    COALESCE((
                        SELECT COUNT(1)
                        FROM dbo.ProductImages
                        WHERE ImageUrl = ?
                    ), 0)
                    +
                    COALESCE((
                        SELECT COUNT(1)
                        FROM dbo.Products
                        WHERE ImageUrl = ? OR ThumbnailUrl = ?
                    ), 0)
                """, Integer.class, imageUrl, imageUrl, imageUrl);
        if (usageCount != null && usageCount > 0) {
            return false;
        }

        try {
            return Files.deleteIfExists(storedPath);
        } catch (Exception ignored) {
            return false;
        }
    }

    private Path resolveManagedProductImagePath(String imageUrl) {
        String normalizedUrl = asNullableString(imageUrl);
        if (normalizedUrl == null || !normalizedUrl.startsWith("/uploads/products/")) {
            return null;
        }

        String relative = normalizedUrl.substring("/uploads/products/".length());
        Path configuredRoot = Paths.get(productImageDir).toAbsolutePath().normalize();
        Path resolved = configuredRoot.resolve(relative.replace("/", java.io.File.separator)).normalize();
        if (!resolved.startsWith(configuredRoot)) {
            return null;
        }
        return resolved;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String repeatPlaceholders(int count) {
        return String.join(", ", Collections.nCopies(count, "?"));
    }

    private record CartLine(int productId, String name, BigDecimal price, int quantity, String thumbnailUrl) {
    }

    private record CheckoutContact(String buyerName, String buyerPhone, String buyerEmail) {
    }

    private record OrderRecipient(String fullName, String phone, String email, String address) {
    }

    private record ProductUpsertPayload(
            String name,
            String shortDescription,
            String description,
            String usageInstructions,
            BigDecimal price,
            boolean active,
            List<Integer> categoryIds,
            String thumbnailUrl,
            String primaryImageUrl,
            List<ProductImageInput> images) {
    }

    private record ProductImageInput(String imageUrl, String altText, int displayOrder, boolean isPrimary) {
    }
}
