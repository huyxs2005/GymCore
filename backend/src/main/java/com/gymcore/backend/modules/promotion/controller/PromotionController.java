package com.gymcore.backend.modules.promotion.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.promotion.service.PromotionService;
import java.util.Map;
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
public class PromotionController {

        private final PromotionService promotionService;

        public PromotionController(PromotionService promotionService) {
                this.promotionService = promotionService;
        }

<<<<<<< Updated upstream
    @GetMapping("/promotions/posts")
    public ApiResponse<Map<String, Object>> getPosts() {
        return ApiResponse.ok("Promotion posts endpoint ready for implementation",
                promotionService.execute("customer-get-promotion-posts", null));
    }

    @PostMapping("/promotions/claims")
    public ApiResponse<Map<String, Object>> claimCoupon(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Claim coupon endpoint ready for implementation",
                promotionService.execute("customer-claim-coupon", payload));
    }

    @GetMapping("/promotions/my-claims")
    public ApiResponse<Map<String, Object>> getMyClaims() {
        return ApiResponse.ok("My claims endpoint ready for implementation",
                promotionService.execute("customer-get-my-claims", null));
    }

    @PostMapping("/promotions/apply")
    public ApiResponse<Map<String, Object>> applyCoupon(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Apply coupon endpoint ready for implementation",
                promotionService.execute("customer-apply-coupon", payload));
    }

    @GetMapping("/notifications")
    public ApiResponse<Map<String, Object>> getNotifications() {
        return ApiResponse.ok("Notifications endpoint ready for implementation",
                promotionService.execute("customer-get-notifications", null));
    }

    @PatchMapping("/notifications/{notificationId}/read")
    public ApiResponse<Map<String, Object>> markAsRead(@PathVariable Integer notificationId) {
        return ApiResponse.ok("Mark notification as read endpoint ready for implementation",
                promotionService.execute("customer-mark-notification-read", Map.of("notificationId", notificationId)));
    }

    @GetMapping("/admin/promotions/coupons")
    public ApiResponse<Map<String, Object>> getCoupons() {
        return ApiResponse.ok("Admin coupons endpoint ready for implementation",
                promotionService.execute("admin-get-coupons", null));
    }

    @PostMapping("/admin/promotions/coupons")
    public ApiResponse<Map<String, Object>> createCoupon(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin create coupon endpoint ready for implementation",
                promotionService.execute("admin-create-coupon", payload));
    }

    @PutMapping("/admin/promotions/coupons/{promotionId}")
    public ApiResponse<Map<String, Object>> updateCoupon(@PathVariable Integer promotionId, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin update coupon endpoint ready for implementation",
                promotionService.execute("admin-update-coupon", Map.of("promotionId", promotionId, "body", payload)));
    }

    @PostMapping("/admin/promotions/posts")
    public ApiResponse<Map<String, Object>> createPost(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin create promotion post endpoint ready for implementation",
                promotionService.execute("admin-create-promotion-post", payload));
    }

    @PutMapping("/admin/promotions/posts/{postId}")
    public ApiResponse<Map<String, Object>> updatePost(@PathVariable Integer postId, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Admin update promotion post endpoint ready for implementation",
                promotionService.execute("admin-update-promotion-post", Map.of("postId", postId, "body", payload)));
    }
=======
        @GetMapping("/promotions/posts")
        public ApiResponse<Map<String, Object>> getPosts(
                        @RequestHeader(value = org.springframework.http.HttpHeaders.AUTHORIZATION, required = false) String authorization) {
                return ApiResponse.ok("Promotion posts retrieved",
                                promotionService.execute("customer-get-promotion-posts", authorization, null));
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

        @PostMapping("/admin/promotions/posts")
        public ApiResponse<Map<String, Object>> createPost(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Promotion post created",
                                promotionService.execute("admin-create-promotion-post", authorization, payload));
        }

        @PutMapping("/admin/promotions/posts/{postId}")
        public ApiResponse<Map<String, Object>> updatePost(
                        @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization,
                        @PathVariable Integer postId,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Promotion post updated",
                                promotionService.execute("admin-update-promotion-post", authorization,
                                                Map.of("postId", postId, "body", payload)));
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
                byte[] pdf = (byte[]) promotionService.execute("admin-export-revenue-pdf", authorization, null)
                                .get("pdf");

                org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                headers.setContentType(org.springframework.http.MediaType.APPLICATION_PDF);
                headers.setContentDispositionFormData("attachment", "GymCore_Revenue_Report.pdf");

                return new org.springframework.http.ResponseEntity<>(pdf, headers,
                                org.springframework.http.HttpStatus.OK);
        }
>>>>>>> Stashed changes
}
