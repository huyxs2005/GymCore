package com.gymcore.backend.modules.checkin.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.checkin.service.CheckinHealthService;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CheckinHealthController {

    private final CheckinHealthService checkinHealthService;

    public CheckinHealthController(CheckinHealthService checkinHealthService) {
        this.checkinHealthService = checkinHealthService;
    }

    @GetMapping("/checkin/qr")
    public ApiResponse<Map<String, Object>> getQrToken(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Lấy mã QR check-in thành công",
                checkinHealthService.execute("customer-get-qr", withAuth(authorizationHeader, null)));
    }

    @GetMapping("/checkin/history")
    public ApiResponse<Map<String, Object>> getCheckinHistory(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Lấy lịch sử check-in thành công",
                checkinHealthService.execute("customer-get-checkin-history", withAuth(authorizationHeader, null)));
    }

    @GetMapping("/health/current")
    public ApiResponse<Map<String, Object>> getCurrentHealth(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Lấy chỉ số sức khỏe hiện tại thành công",
                checkinHealthService.execute("customer-get-health-current", withAuth(authorizationHeader, null)));
    }

    @GetMapping("/health/history")
    public ApiResponse<Map<String, Object>> getHealthHistory(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Lấy lịch sử sức khỏe thành công",
                checkinHealthService.execute("customer-get-health-history", withAuth(authorizationHeader, null)));
    }

    @GetMapping("/health/coach-notes")
    public ApiResponse<Map<String, Object>> getCoachNotes(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Lấy ghi chú từ HLV thành công",
                checkinHealthService.execute("customer-get-coach-notes", withAuth(authorizationHeader, null)));
    }

    @PostMapping("/health/records")
    public ApiResponse<Map<String, Object>> createHealthRecord(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Cập nhật chỉ số sức khỏe thành công",
                checkinHealthService.execute("customer-create-health-record", withAuth(authorizationHeader, payload)));
    }

    @PostMapping("/reception/checkin/scan")
    public ApiResponse<Map<String, Object>> scanCheckin(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        Map<String, Object> request = new java.util.LinkedHashMap<>(payload);
        request.put("authorizationHeader", authorizationHeader);
        return ApiResponse.ok("Reception scan check-in endpoint ready for implementation",
                checkinHealthService.execute("reception-scan-checkin", request));
    }

    @GetMapping("/reception/checkin/{customerId}/validity")
    public ApiResponse<Map<String, Object>> validateMembership(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer customerId) {
        Map<String, Object> request = new java.util.LinkedHashMap<>();
        request.put("authorizationHeader", authorizationHeader);
        request.put("customerId", customerId);
        return ApiResponse.ok("Reception membership validity endpoint ready for implementation",
                checkinHealthService.execute("reception-validate-membership", request));
    }

    @GetMapping("/reception/checkin/history")
    public ApiResponse<Map<String, Object>> getReceptionHistory(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        Map<String, Object> request = new java.util.LinkedHashMap<>();
        request.put("authorizationHeader", authorizationHeader);
        return ApiResponse.ok("Reception check-in history endpoint ready for implementation",
                checkinHealthService.execute("reception-get-checkin-history", request));
    }

    private Map<String, Object> withAuth(String auth, Map<String, Object> payload) {
        Map<String, Object> map = new java.util.LinkedHashMap<>();
        if (payload != null)
            map.putAll(payload);
        map.put("authorizationHeader", auth);
        return map;
    }
}
