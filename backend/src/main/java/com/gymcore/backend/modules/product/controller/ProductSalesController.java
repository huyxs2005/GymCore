package com.gymcore.backend.modules.product.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.product.service.ProductSalesService;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class ProductSalesController {

    private final ProductSalesService productSalesService;

    public ProductSalesController(ProductSalesService productSalesService) {
        this.productSalesService = productSalesService;
    }

    @GetMapping("/products")
    public ApiResponse<Map<String, Object>> getProducts() {
        return ApiResponse.ok("Product list endpoint ready for implementation", productSalesService.execute("customer-get-products", null));
    }

    @GetMapping("/products/{productId}")
    public ApiResponse<Map<String, Object>> getProductDetail(@PathVariable Integer productId) {
        return ApiResponse.ok("Product detail endpoint ready for implementation",
                productSalesService.execute("customer-get-product-detail", Map.of("productId", productId)));
    }

    @PostMapping("/products/{productId}/reviews")
    public ApiResponse<Map<String, Object>> createReview(@PathVariable Integer productId, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Product review endpoint ready for implementation",
                productSalesService.execute("customer-create-review", Map.of("productId", productId, "body", payload)));
    }

    @GetMapping("/cart")
    public ApiResponse<Map<String, Object>> getCart() {
        return ApiResponse.ok("Cart endpoint ready for implementation", productSalesService.execute("customer-get-cart", null));
    }

    @PostMapping("/cart/items")
    public ApiResponse<Map<String, Object>> addCartItem(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Add cart item endpoint ready for implementation",
                productSalesService.execute("customer-add-cart-item", payload));
    }

    @PatchMapping("/cart/items/{productId}")
    public ApiResponse<Map<String, Object>> updateCartItem(@PathVariable Integer productId, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Update cart item endpoint ready for implementation",
                productSalesService.execute("customer-update-cart-item", Map.of("productId", productId, "body", payload)));
    }

    @DeleteMapping("/cart/items/{productId}")
    public ApiResponse<Map<String, Object>> deleteCartItem(@PathVariable Integer productId) {
        return ApiResponse.ok("Delete cart item endpoint ready for implementation",
                productSalesService.execute("customer-delete-cart-item", Map.of("productId", productId)));
    }

    @PostMapping("/orders/checkout")
    public ApiResponse<Map<String, Object>> checkout(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Checkout endpoint ready for implementation", productSalesService.execute("customer-checkout", payload));
    }

    @GetMapping("/orders/my-orders")
    public ApiResponse<Map<String, Object>> getMyOrders() {
        return ApiResponse.ok("My orders endpoint ready for implementation",
                productSalesService.execute("customer-get-my-orders", null));
    }

    @GetMapping("/admin/products")
    public ApiResponse<Map<String, Object>> getAdminProducts() {
        return ApiResponse.ok("Admin products endpoint ready for implementation", productSalesService.execute("admin-get-products", null));
    }

    @PostMapping("/admin/products")
    public ApiResponse<Map<String, Object>> createProduct(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin create product endpoint ready for implementation",
                productSalesService.execute("admin-create-product", payload));
    }

    @PutMapping("/admin/products/{productId}")
    public ApiResponse<Map<String, Object>> updateProduct(@PathVariable Integer productId, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin update product endpoint ready for implementation",
                productSalesService.execute("admin-update-product", Map.of("productId", productId, "body", payload)));
    }

    @GetMapping("/admin/products/reviews")
    public ApiResponse<Map<String, Object>> getReviews() {
        return ApiResponse.ok("Admin product reviews endpoint ready for implementation",
                productSalesService.execute("admin-get-product-reviews", null));
    }
}
