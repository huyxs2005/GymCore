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
}
