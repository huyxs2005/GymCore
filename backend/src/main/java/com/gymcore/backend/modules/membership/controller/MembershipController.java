package com.gymcore.backend.modules.membership.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.membership.service.MembershipService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class MembershipController {

    private final MembershipService membershipService;

    public MembershipController(MembershipService membershipService) {
        this.membershipService = membershipService;
    }

    @GetMapping("/memberships/plans")
    public ApiResponse<Map<String, Object>> getPlans() {
        return ApiResponse.ok("Membership plans endpoint ready for implementation",
                membershipService.execute("customer-get-plans", null));
    }

    @GetMapping("/memberships/plans/{planId}")
    public ApiResponse<Map<String, Object>> getPlanDetail(@PathVariable Integer planId) {
        return ApiResponse.ok("Membership plan detail endpoint ready for implementation",
                membershipService.execute("customer-get-plan-detail", Map.of("planId", planId)));
    }

    @GetMapping("/memberships/current")
    public ApiResponse<Map<String, Object>> getCurrentMembership() {
        return ApiResponse.ok("Current membership endpoint ready for implementation",
                membershipService.execute("customer-get-current-membership", null));
    }

    @PostMapping("/memberships/purchase")
    public ApiResponse<Map<String, Object>> purchaseMembership(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Purchase membership endpoint ready for implementation",
                membershipService.execute("customer-purchase-membership", payload));
    }

    @PostMapping("/memberships/renew")
    public ApiResponse<Map<String, Object>> renewMembership(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Renew membership endpoint ready for implementation",
                membershipService.execute("customer-renew-membership", payload));
    }

    @PostMapping("/memberships/upgrade")
    public ApiResponse<Map<String, Object>> upgradeMembership(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Upgrade membership endpoint ready for implementation",
                membershipService.execute("customer-upgrade-membership", payload));
    }

    @PostMapping("/payments/webhook")
    public ApiResponse<Map<String, Object>> paymentWebhook(
            @RequestHeader HttpHeaders headers,
            @RequestBody Map<String, Object> payload) {
        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("headers", headers);
        wrapper.put("body", payload == null ? Map.of() : payload);
        return ApiResponse.ok("Payment webhook handled",
                membershipService.execute("payment-webhook", wrapper));
    }

    @GetMapping("/admin/membership-plans")
    public ApiResponse<Map<String, Object>> getAdminPlans() {
        return ApiResponse.ok("Admin membership plans endpoint ready for implementation",
                membershipService.execute("admin-get-plans", null));
    }

    @PostMapping("/admin/membership-plans")
    public ApiResponse<Map<String, Object>> createPlan(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Create membership plan endpoint ready for implementation",
                membershipService.execute("admin-create-plan", payload));
    }

    @PutMapping("/admin/membership-plans/{planId}")
    public ApiResponse<Map<String, Object>> updatePlan(@PathVariable Integer planId, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Update membership plan endpoint ready for implementation",
                membershipService.execute("admin-update-plan", Map.of("planId", planId, "body", payload)));
    }
}
