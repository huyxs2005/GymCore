package com.gymcore.backend.modules.product.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.product.service.ProductSalesService;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
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
        public ApiResponse<Map<String, Object>> getProducts(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
                return ApiResponse.ok("Product list retrieved",
                                productSalesService.execute("customer-get-products", authorization, null));
        }

        @GetMapping("/products/{productId}")
        public ApiResponse<Map<String, Object>> getProductDetail(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                        @PathVariable Integer productId) {
                return ApiResponse.ok("Product detail retrieved",
                                productSalesService.execute("customer-get-product-detail", authorization,
                                                Map.of("productId", productId)));
        }

        @PostMapping("/products/{productId}/reviews")
        public ApiResponse<Map<String, Object>> createReview(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                        @PathVariable Integer productId,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Product review created",
                                productSalesService.execute("customer-create-review", authorization,
                                                Map.of("productId", productId, "body", payload)));
        }

        @GetMapping("/cart")
        public ApiResponse<Map<String, Object>> getCart(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
                return ApiResponse.ok("Cart retrieved",
                                productSalesService.execute("customer-get-cart", authorization, null));
        }

        @PostMapping("/cart/items")
        public ApiResponse<Map<String, Object>> addCartItem(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Cart item added",
                                productSalesService.execute("customer-add-cart-item", authorization, payload));
        }

        @PatchMapping("/cart/items/{productId}")
        public ApiResponse<Map<String, Object>> updateCartItem(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                        @PathVariable Integer productId,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Cart item updated",
                                productSalesService.execute("customer-update-cart-item", authorization,
                                                Map.of("productId", productId, "body", payload)));
        }

        @DeleteMapping("/cart/items/{productId}")
        public ApiResponse<Map<String, Object>> deleteCartItem(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                        @PathVariable Integer productId) {
                return ApiResponse.ok("Cart item deleted",
                                productSalesService.execute("customer-delete-cart-item", authorization,
                                                Map.of("productId", productId)));
        }

        @PostMapping("/orders/checkout")
        public ApiResponse<Map<String, Object>> checkout(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                        @RequestBody(required = false) Map<String, Object> payload) {
                return ApiResponse.ok("Checkout created",
                                productSalesService.execute("customer-checkout", authorization, payload));
        }

        @GetMapping("/orders/my-orders")
        public ApiResponse<Map<String, Object>> getMyOrders(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
                return ApiResponse.ok("My orders retrieved",
                                productSalesService.execute("customer-get-my-orders", authorization, null));
        }

        @GetMapping("/admin/products")
        public ApiResponse<Map<String, Object>> getAdminProducts(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
                return ApiResponse.ok("Admin products retrieved",
                                productSalesService.execute("admin-get-products", authorization, null));
        }

        @PostMapping("/admin/products")
        public ApiResponse<Map<String, Object>> createProduct(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Admin product created",
                                productSalesService.execute("admin-create-product", authorization, payload));
        }

        @PutMapping("/admin/products/{productId}")
        public ApiResponse<Map<String, Object>> updateProduct(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                        @PathVariable Integer productId,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Admin product updated",
                                productSalesService.execute("admin-update-product", authorization,
                                                Map.of("productId", productId, "body", payload)));
        }

        @GetMapping("/admin/products/reviews")
        public ApiResponse<Map<String, Object>> getReviews(
                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
                return ApiResponse.ok("Admin product reviews retrieved",
                                productSalesService.execute("admin-get-product-reviews", authorization, null));
        }
}
