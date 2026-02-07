package com.gymcore.backend.modules.coach.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.coach.service.CoachBookingService;
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
public class CoachBookingController {

    private final CoachBookingService coachBookingService;

    public CoachBookingController(CoachBookingService coachBookingService) {
        this.coachBookingService = coachBookingService;
    }

    @GetMapping("/coaches")
    public ApiResponse<Map<String, Object>> getCoaches() {
        return ApiResponse.ok("Coach list endpoint ready for implementation", coachBookingService.execute("customer-get-coaches", null));
    }

    @GetMapping("/coaches/{coachId}")
    public ApiResponse<Map<String, Object>> getCoachDetail(@PathVariable Integer coachId) {
        return ApiResponse.ok("Coach detail endpoint ready for implementation",
                coachBookingService.execute("customer-get-coach-detail", Map.of("coachId", coachId)));
    }

    @GetMapping("/coaches/{coachId}/schedule")
    public ApiResponse<Map<String, Object>> getCoachSchedule(@PathVariable Integer coachId) {
        return ApiResponse.ok("Coach schedule endpoint ready for implementation",
                coachBookingService.execute("customer-get-coach-schedule", Map.of("coachId", coachId)));
    }

    @PostMapping("/coach-booking/match")
    public ApiResponse<Map<String, Object>> matchCoaches(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach matching endpoint ready for implementation",
                coachBookingService.execute("customer-match-coaches", payload));
    }

    @PostMapping("/coach-booking/requests")
    public ApiResponse<Map<String, Object>> createBookingRequest(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach booking request endpoint ready for implementation",
                coachBookingService.execute("customer-create-booking-request", payload));
    }

    @GetMapping("/coach-booking/my-schedule")
    public ApiResponse<Map<String, Object>> getMySchedule() {
        return ApiResponse.ok("Customer PT schedule endpoint ready for implementation",
                coachBookingService.execute("customer-get-my-schedule", null));
    }

    @PatchMapping("/coach-booking/sessions/{sessionId}/cancel")
    public ApiResponse<Map<String, Object>> cancelSession(@PathVariable Integer sessionId, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Cancel PT session endpoint ready for implementation",
                coachBookingService.execute("customer-cancel-session", Map.of("sessionId", sessionId, "body", payload)));
    }

    @PatchMapping("/coach-booking/sessions/{sessionId}/reschedule")
    public ApiResponse<Map<String, Object>> rescheduleSession(@PathVariable Integer sessionId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Reschedule PT session endpoint ready for implementation",
                coachBookingService.execute("customer-reschedule-session", Map.of("sessionId", sessionId, "body", payload)));
    }

    @PostMapping("/coach-booking/feedback")
    public ApiResponse<Map<String, Object>> submitFeedback(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach feedback endpoint ready for implementation",
                coachBookingService.execute("customer-submit-feedback", payload));
    }

    @GetMapping("/coach/schedule")
    public ApiResponse<Map<String, Object>> getCoachMySchedule() {
        return ApiResponse.ok("Coach schedule endpoint ready for implementation", coachBookingService.execute("coach-get-schedule", null));
    }

    @PutMapping("/coach/availability")
    public ApiResponse<Map<String, Object>> updateAvailability(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach availability endpoint ready for implementation",
                coachBookingService.execute("coach-update-availability", payload));
    }

    @GetMapping("/coach/pt-sessions")
    public ApiResponse<Map<String, Object>> getCoachSessions() {
        return ApiResponse.ok("Coach PT sessions endpoint ready for implementation",
                coachBookingService.execute("coach-get-pt-sessions", null));
    }

    @PostMapping("/coach/pt-sessions/{sessionId}/notes")
    public ApiResponse<Map<String, Object>> createSessionNotes(@PathVariable Integer sessionId, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach session notes endpoint ready for implementation",
                coachBookingService.execute("coach-create-session-notes", Map.of("sessionId", sessionId, "body", payload)));
    }

    @GetMapping("/coach/customers")
    public ApiResponse<Map<String, Object>> getCoachCustomers() {
        return ApiResponse.ok("Coach customer list endpoint ready for implementation",
                coachBookingService.execute("coach-get-customers", null));
    }

    @GetMapping("/coach/customers/{customerId}")
    public ApiResponse<Map<String, Object>> getCoachCustomerDetail(@PathVariable Integer customerId) {
        return ApiResponse.ok("Coach customer detail endpoint ready for implementation",
                coachBookingService.execute("coach-get-customer-detail", Map.of("customerId", customerId)));
    }

    @GetMapping("/coach/customers/{customerId}/history")
    public ApiResponse<Map<String, Object>> getCoachCustomerHistory(@PathVariable Integer customerId) {
        return ApiResponse.ok("Coach customer history endpoint ready for implementation",
                coachBookingService.execute("coach-get-customer-history", Map.of("customerId", customerId)));
    }

    @PutMapping("/coach/customers/{customerId}/progress")
    public ApiResponse<Map<String, Object>> updateProgress(@PathVariable Integer customerId, @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach customer progress endpoint ready for implementation",
                coachBookingService.execute("coach-update-customer-progress", Map.of("customerId", customerId, "body", payload)));
    }

    @GetMapping("/coach/feedback")
    public ApiResponse<Map<String, Object>> getCoachFeedback() {
        return ApiResponse.ok("Coach feedback summary endpoint ready for implementation",
                coachBookingService.execute("coach-get-feedback", null));
    }

    @GetMapping("/coach/feedback/average")
    public ApiResponse<Map<String, Object>> getCoachAverageFeedback() {
        return ApiResponse.ok("Coach average feedback endpoint ready for implementation",
                coachBookingService.execute("coach-get-feedback-average", null));
    }
}
