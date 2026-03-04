package com.gymcore.backend.modules.promotion.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.promotion.service.PromotionService;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class PromotionController {

        private final PromotionService promotionService;

        public PromotionController(PromotionService promotionService) {
                this.promotionService = promotionService;
        }

        @GetMapping("/promotions/coupons")
        public ApiResponse<Map<String, Object>> getCustomerCoupons(
                        @RequestHeader(value = org.springframework.http.HttpHeaders.AUTHORIZATION, required = false) String authorization) {
                return ApiResponse.ok("Coupons retrieved",
                                promotionService.execute("customer-get-coupons", authorization, null));
        }

        @PostMapping("/promotions/claims")
        public ApiResponse<Map<String, Object>> claimCoupon(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Coupon claimed",
                                promotionService.execute("customer-claim-coupon", authorization, payload));
        }

        @GetMapping("/promotions/my-claims")
        public ApiResponse<Map<String, Object>> getMyClaims(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization) {
                return ApiResponse.ok("My claimed coupons retrieved",
                                promotionService.execute("customer-get-my-claims", authorization, null));
        }

        @PostMapping("/promotions/apply")
        public ApiResponse<Map<String, Object>> applyCoupon(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Coupon apply check successful",
                                promotionService.execute("customer-apply-coupon", authorization, payload));
        }

        @GetMapping("/notifications")
        public ApiResponse<Map<String, Object>> getNotifications(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization) {
                return ApiResponse.ok("Notifications retrieved",
                                promotionService.execute("customer-get-notifications", authorization, null));
        }

        @PatchMapping("/notifications/{notificationId}/read")
        public ApiResponse<Map<String, Object>> markAsRead(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization,
                        @PathVariable Integer notificationId) {
                return ApiResponse.ok("Notification marked as read",
                                promotionService.execute("customer-mark-notification-read", authorization,
                                                Map.of("notificationId", notificationId)));
        }

        @GetMapping("/admin/promotions/coupons")
        public ApiResponse<Map<String, Object>> getCoupons(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization) {
                return ApiResponse.ok("Coupons retrieved",
                                promotionService.execute("admin-get-coupons", authorization, null));
        }

        @PostMapping("/admin/promotions/coupons")
        public ApiResponse<Map<String, Object>> createCoupon(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Coupon created",
                                promotionService.execute("admin-create-coupon", authorization, payload));
        }

        @PutMapping("/admin/promotions/coupons/{promotionId}")
        public ApiResponse<Map<String, Object>> updateCoupon(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization,
                        @PathVariable Integer promotionId,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Coupon updated",
                                promotionService.execute("admin-update-coupon", authorization,
                                                Map.of("promotionId", promotionId, "body", payload)));
        }

        @DeleteMapping("/admin/promotions/coupons/{promotionId}")
        public ApiResponse<Map<String, Object>> deleteCoupon(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization,
                        @PathVariable Integer promotionId) {
                return ApiResponse.ok("Coupon deactivated",
                                promotionService.execute("admin-delete-coupon", authorization,
                                                Map.of("promotionId", promotionId)));
        }

        @GetMapping("/admin/promotions/revenue-report")
        public ApiResponse<Map<String, Object>> getRevenueReport(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization) {
                return ApiResponse.ok("Revenue report retrieved",
                                promotionService.execute("admin-get-revenue-report", authorization, null));
        }

        @GetMapping("/admin/promotions/revenue-report/pdf")
        public org.springframework.http.ResponseEntity<byte[]> exportRevenuePdf(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization) {
                return promotionService.exportRevenuePdf(authorization);
        }
}
