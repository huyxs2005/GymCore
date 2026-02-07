package com.gymcore.backend.modules.checkin.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.checkin.service.CheckinHealthService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    public ApiResponse<Map<String, Object>> getQrToken() {
        return ApiResponse.ok("Check-in QR endpoint ready for implementation", checkinHealthService.execute("customer-get-qr", null));
    }

    @GetMapping("/checkin/history")
    public ApiResponse<Map<String, Object>> getCheckinHistory() {
        return ApiResponse.ok("Check-in history endpoint ready for implementation",
                checkinHealthService.execute("customer-get-checkin-history", null));
    }

    @GetMapping("/health/current")
    public ApiResponse<Map<String, Object>> getCurrentHealth() {
        return ApiResponse.ok("Current health endpoint ready for implementation",
                checkinHealthService.execute("customer-get-health-current", null));
    }

    @GetMapping("/health/history")
    public ApiResponse<Map<String, Object>> getHealthHistory() {
        return ApiResponse.ok("Health history endpoint ready for implementation",
                checkinHealthService.execute("customer-get-health-history", null));
    }

    @GetMapping("/health/coach-notes")
    public ApiResponse<Map<String, Object>> getCoachNotes() {
        return ApiResponse.ok("Coach notes endpoint ready for implementation",
                checkinHealthService.execute("customer-get-coach-notes", null));
    }

    @PostMapping("/health/records")
    public ApiResponse<Map<String, Object>> createHealthRecord(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Create health record endpoint ready for implementation",
                checkinHealthService.execute("customer-create-health-record", payload));
    }

    @PostMapping("/reception/checkin/scan")
    public ApiResponse<Map<String, Object>> scanCheckin(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Reception scan check-in endpoint ready for implementation",
                checkinHealthService.execute("reception-scan-checkin", payload));
    }

    @GetMapping("/reception/checkin/{customerId}/validity")
    public ApiResponse<Map<String, Object>> validateMembership(@PathVariable Integer customerId) {
        return ApiResponse.ok("Reception membership validity endpoint ready for implementation",
                checkinHealthService.execute("reception-validate-membership", Map.of("customerId", customerId)));
    }

    @GetMapping("/reception/checkin/history")
    public ApiResponse<Map<String, Object>> getReceptionHistory() {
        return ApiResponse.ok("Reception check-in history endpoint ready for implementation",
                checkinHealthService.execute("reception-get-checkin-history", null));
    }
}
