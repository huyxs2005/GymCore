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
    public ApiResponse<Map<String, Object>> getPlans(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Membership plans retrieved",
                membershipService.execute("customer-get-plans", authorizationHeader, null));
    }

    @GetMapping("/memberships/plans/{planId}")
    public ApiResponse<Map<String, Object>> getPlanDetail(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer planId) {
        return ApiResponse.ok("Membership plan detail retrieved",
                membershipService.execute("customer-get-plan-detail", authorizationHeader, Map.of("planId", planId)));
    }

    @GetMapping("/memberships/current")
    public ApiResponse<Map<String, Object>> getCurrentMembership(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        return ApiResponse.ok("Current membership retrieved",
                membershipService.execute("customer-get-current-membership", authorizationHeader, null));
    }

    @PostMapping("/memberships/purchase")
    public ApiResponse<Map<String, Object>> purchaseMembership(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok("Membership checkout created",
                membershipService.execute("customer-purchase-membership", authorizationHeader, payload));
    }

    @PostMapping("/memberships/renew")
    public ApiResponse<Map<String, Object>> renewMembership(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok("Membership renewal checkout created",
                membershipService.execute("customer-renew-membership", authorizationHeader, payload));
    }

    @PostMapping("/memberships/upgrade")
    public ApiResponse<Map<String, Object>> upgradeMembership(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok("Membership upgrade checkout created",
                membershipService.execute("customer-upgrade-membership", authorizationHeader, payload));
    }

    @PostMapping("/memberships/payment-return")
    public ApiResponse<Map<String, Object>> confirmMembershipPaymentReturn(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok("Membership payment return processed",
                membershipService.execute("customer-confirm-payment-return", authorizationHeader, payload));
    }

    @PostMapping("/payments/webhook")
    public ApiResponse<Map<String, Object>> paymentWebhook(
            @RequestHeader HttpHeaders headers,
            @RequestBody Map<String, Object> payload) {
        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("headers", headers);
        wrapper.put("body", payload == null ? Map.of() : payload);
        return ApiResponse.ok("Payment webhook handled",
                membershipService.execute("payment-webhook", null, wrapper));
    }

    @GetMapping("/admin/membership-plans")
    public ApiResponse<Map<String, Object>> getAdminPlans(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        return ApiResponse.ok("Admin membership plans retrieved",
                membershipService.execute("admin-get-plans", authorizationHeader, null));
    }

    @PostMapping("/admin/membership-plans")
    public ApiResponse<Map<String, Object>> createPlan(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Membership plan created",
                membershipService.execute("admin-create-plan", authorizationHeader, payload));
    }

    @PutMapping("/admin/membership-plans/{planId}")
    public ApiResponse<Map<String, Object>> updatePlan(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable Integer planId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Membership plan updated",
                membershipService.execute("admin-update-plan", authorizationHeader, Map.of("planId", planId, "body", payload)));
    }
}
