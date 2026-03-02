package com.gymcore.backend.modules.coach.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.coach.service.CoachBookingService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CoachBookingController {

    private final CoachBookingService coachBookingService;

    public CoachBookingController(CoachBookingService coachBookingService) {
        this.coachBookingService = coachBookingService;
    }

    private static Map<String, Object> withAuth(String authorizationHeader, Map<String, Object> payload) {
        Map<String, Object> request = new LinkedHashMap<>(payload != null ? payload : Map.of());
        request.put("authorizationHeader", authorizationHeader);
        return request;
    }

    @GetMapping("/time-slots")
    public ApiResponse<Map<String, Object>> getTimeSlots() {
        return ApiResponse.ok("Time slots loaded successfully", coachBookingService.execute("get-time-slots", Map.of()));
    }

    @GetMapping("/coaches")
    public ApiResponse<Map<String, Object>> getCoaches(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Coach list loaded successfully", coachBookingService.execute("customer-get-coaches",
                withAuth(authorizationHeader, null)));
    }

    @GetMapping("/coaches/{coachId}")
    public ApiResponse<Map<String, Object>> getCoachDetail(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer coachId) {
        return ApiResponse.ok("Coach profile loaded successfully",
                coachBookingService.execute("customer-get-coach-detail",
                        withAuth(authorizationHeader, Map.of("coachId", coachId))));
    }

    @GetMapping("/coaches/{coachId}/schedule")
    public ApiResponse<Map<String, Object>> getCoachSchedule(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer coachId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {
        Map<String, Object> params = new LinkedHashMap<>(Map.of("coachId", coachId));
        if (fromDate != null) {
            params.put("fromDate", fromDate);
        }
        if (toDate != null) {
            params.put("toDate", toDate);
        }
        return ApiResponse.ok("Coach schedule loaded successfully",
                coachBookingService.execute("customer-get-coach-schedule",
                        withAuth(authorizationHeader, params)));
    }

    @PostMapping("/coach-booking/match")
    public ApiResponse<Map<String, Object>> matchCoaches(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach matches generated successfully",
                coachBookingService.execute("customer-match-coaches",
                        withAuth(authorizationHeader, payload)));
    }

    @PostMapping("/coach-booking/requests")
    public ApiResponse<Map<String, Object>> createBookingRequest(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("PT booking request created successfully",
                coachBookingService.execute("customer-create-booking-request",
                        withAuth(authorizationHeader, payload)));
    }

    @GetMapping("/coach-booking/my-schedule")
    public ApiResponse<Map<String, Object>> getMySchedule(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Customer PT schedule loaded successfully",
                coachBookingService.execute("customer-get-my-schedule",
                        withAuth(authorizationHeader, null)));
    }

    @DeleteMapping("/coach-booking/my-schedule/sessions/{sessionId}")
    public ApiResponse<Map<String, Object>> deleteMySession(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer sessionId) {
        return ApiResponse.ok("Cancelled PT session deleted successfully",
                coachBookingService.execute("customer-delete-session", withAuth(authorizationHeader,
                        Map.of("sessionId", sessionId))));
    }

    @PatchMapping("/coach-booking/sessions/{sessionId}/cancel")
    public ApiResponse<Map<String, Object>> cancelSession(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer sessionId,
            @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok("PT session cancelled successfully",
                coachBookingService.execute("customer-cancel-session",
                        withAuth(authorizationHeader, Map.of("sessionId", sessionId, "body",
                                payload != null ? payload : Map.of()))));
    }

    @PatchMapping("/coach-booking/sessions/{sessionId}/reschedule")
    public ApiResponse<Map<String, Object>> rescheduleSession(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer sessionId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("PT reschedule request submitted successfully",
                coachBookingService.execute("customer-reschedule-session", withAuth(authorizationHeader,
                        Map.of("sessionId", sessionId, "body", payload))));
    }

    @PostMapping("/coach-booking/feedback")
    public ApiResponse<Map<String, Object>> submitFeedback(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach feedback submitted successfully",
                coachBookingService.execute("customer-submit-feedback",
                        withAuth(authorizationHeader, payload)));
    }

    @PutMapping("/coach/availability")
    public ApiResponse<Map<String, Object>> updateAvailability(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach availability updated successfully",
                coachBookingService.execute("coach-update-availability",
                        withAuth(authorizationHeader, payload)));
    }

    @GetMapping("/coach/availability")
    public ApiResponse<Map<String, Object>> getMyAvailability(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Coach availability loaded successfully",
                coachBookingService.execute("coach-get-availability",
                        withAuth(authorizationHeader, Map.of())));
    }

    @GetMapping("/coach/schedule")
    public ApiResponse<Map<String, Object>> getCoachMySchedule(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {
        Map<String, Object> params = new LinkedHashMap<>();
        if (fromDate != null) {
            params.put("fromDate", fromDate);
        }
        if (toDate != null) {
            params.put("toDate", toDate);
        }
        return ApiResponse.ok("Coach PT schedule loaded successfully", coachBookingService.execute("coach-get-schedule",
                withAuth(authorizationHeader, params)));
    }

    @GetMapping("/coach/pt-sessions")
    public ApiResponse<Map<String, Object>> getCoachSessions(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {
        Map<String, Object> params = new LinkedHashMap<>();
        if (fromDate != null) {
            params.put("fromDate", fromDate);
        }
        if (toDate != null) {
            params.put("toDate", toDate);
        }
        return ApiResponse.ok("Coach PT sessions loaded successfully",
                coachBookingService.execute("coach-get-pt-sessions",
                        withAuth(authorizationHeader, params)));
    }

    @PostMapping("/coach/pt-sessions/{sessionId}/notes")
    public ApiResponse<Map<String, Object>> createSessionNotes(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer sessionId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Session note created successfully",
                coachBookingService.execute("coach-create-session-notes", withAuth(authorizationHeader,
                        Map.of("sessionId", sessionId, "body", payload))));
    }

    @DeleteMapping("/coach/pt-sessions/{sessionId}")
    public ApiResponse<Map<String, Object>> deleteSession(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer sessionId) {
        return ApiResponse.ok("Cancelled session deleted successfully",
                coachBookingService.execute("coach-delete-session", withAuth(authorizationHeader,
                        Map.of("sessionId", sessionId))));
    }

    @PostMapping("/coach/pt-sessions/{sessionId}/complete")
    public ApiResponse<Map<String, Object>> completeSession(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer sessionId) {
        return ApiResponse.ok("PT session marked as completed successfully",
                coachBookingService.execute("coach-complete-session", withAuth(authorizationHeader,
                        Map.of("sessionId", sessionId))));
    }

    @PutMapping("/coach/pt-sessions/notes/{noteId}")
    public ApiResponse<Map<String, Object>> updateSessionNote(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer noteId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Session note updated successfully",
                coachBookingService.execute("coach-update-session-note", withAuth(authorizationHeader,
                        Map.of("noteId", noteId, "body", payload))));
    }

    @GetMapping("/coach/customers")
    public ApiResponse<Map<String, Object>> getCoachCustomers(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Coach customer list loaded successfully",
                coachBookingService.execute("coach-get-customers",
                        withAuth(authorizationHeader, null)));
    }

    @GetMapping("/coach/pt-requests")
    public ApiResponse<Map<String, Object>> getCoachPtRequests(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Pending PT booking requests loaded successfully",
                coachBookingService.execute("coach-get-pt-requests",
                        withAuth(authorizationHeader, null)));
    }

    @GetMapping("/coach/reschedule-requests")
    public ApiResponse<Map<String, Object>> getCoachRescheduleRequests(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Coach reschedule requests loaded successfully",
                coachBookingService.execute("coach-get-reschedule-requests",
                        withAuth(authorizationHeader, null)));
    }

    @PostMapping("/coach/pt-sessions/{sessionId}/reschedule-approve")
    public ApiResponse<Map<String, Object>> approveRescheduleRequest(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer sessionId) {
        return ApiResponse.ok("Reschedule request approved successfully",
                coachBookingService.execute("coach-approve-reschedule-request",
                        withAuth(authorizationHeader, Map.of("sessionId", sessionId))));
    }

    @PostMapping("/coach/pt-sessions/{sessionId}/reschedule-deny")
    public ApiResponse<Map<String, Object>> denyRescheduleRequest(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer sessionId,
            @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok("Reschedule request denied successfully",
                coachBookingService.execute("coach-deny-reschedule-request",
                        withAuth(authorizationHeader, Map.of("sessionId", sessionId, "body",
                                payload != null ? payload : Map.of()))));
    }

    @PostMapping("/coach/pt-requests/{requestId}/approve")
    public ApiResponse<Map<String, Object>> approvePtRequest(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer requestId) {
        return ApiResponse.ok("PT booking request approved successfully",
                coachBookingService.execute("coach-approve-pt-request",
                        withAuth(authorizationHeader, Map.of("requestId", requestId))));
    }

    @PostMapping("/coach/pt-requests/{requestId}/deny")
    public ApiResponse<Map<String, Object>> denyPtRequest(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer requestId,
            @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok("PT booking request denied successfully",
                coachBookingService.execute("coach-deny-pt-request",
                        withAuth(authorizationHeader, Map.of(
                                "requestId", requestId,
                                "body", payload != null ? payload : Map.of()))));
    }

    @GetMapping("/coach/customers/{customerId}")
    public ApiResponse<Map<String, Object>> getCoachCustomerDetail(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer customerId) {
        return ApiResponse.ok("Customer detail loaded successfully",
                coachBookingService.execute("coach-get-customer-detail",
                        withAuth(authorizationHeader, Map.of("customerId", customerId))));
    }

    @GetMapping("/coach/customers/{customerId}/history")
    public ApiResponse<Map<String, Object>> getCoachCustomerHistory(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer customerId) {
        return ApiResponse.ok("Customer training history loaded successfully",
                coachBookingService.execute("coach-get-customer-history",
                        withAuth(authorizationHeader, Map.of("customerId", customerId))));
    }

    @PutMapping("/coach/customers/{customerId}/progress")
    public ApiResponse<Map<String, Object>> updateProgress(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer customerId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Customer progress updated successfully",
                coachBookingService.execute("coach-update-customer-progress",
                        withAuth(authorizationHeader,
                                Map.of("customerId", customerId, "body", payload))));
    }

    @GetMapping("/coach/feedback")
    public ApiResponse<Map<String, Object>> getCoachFeedback(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Coach feedback loaded successfully",
                coachBookingService.execute("coach-get-feedback", withAuth(authorizationHeader, null)));
    }

    @GetMapping("/coach/feedback/average")
    public ApiResponse<Map<String, Object>> getCoachAverageFeedback(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Average coach rating loaded successfully",
                coachBookingService.execute("coach-get-feedback-average",
                        withAuth(authorizationHeader, null)));
    }

    @GetMapping("/admin/coaches")
    public ApiResponse<Map<String, Object>> adminGetCoaches(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        return ApiResponse.ok("Admin coach list loaded successfully",
                coachBookingService.execute("admin-get-coaches", withAuth(authorizationHeader, null)));
    }

    @GetMapping("/admin/coaches/{coachId}")
    public ApiResponse<Map<String, Object>> adminGetCoachDetail(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer coachId) {
        return ApiResponse.ok("Admin coach profile loaded successfully",
                coachBookingService.execute("admin-get-coach-detail",
                        withAuth(authorizationHeader, Map.of("coachId", coachId))));
    }

    @PutMapping("/admin/coaches/{coachId}")
    public ApiResponse<Map<String, Object>> adminUpdateCoachProfile(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer coachId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Coach profile updated successfully",
                coachBookingService.execute("admin-update-coach-profile", withAuth(authorizationHeader,
                        Map.of("coachId", coachId, "body", payload))));
    }

    @GetMapping("/admin/coaches/{coachId}/performance")
    public ApiResponse<Map<String, Object>> adminGetCoachPerformance(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer coachId) {
        return ApiResponse.ok("Coach performance loaded successfully",
                coachBookingService.execute("admin-get-coach-performance",
                        withAuth(authorizationHeader, Map.of("coachId", coachId))));
    }

    @GetMapping("/admin/coaches/{coachId}/students")
    public ApiResponse<Map<String, Object>> adminGetCoachStudents(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @PathVariable Integer coachId) {
        return ApiResponse.ok("Coach student list loaded successfully",
                coachBookingService.execute("admin-get-coach-students",
                        withAuth(authorizationHeader, Map.of("coachId", coachId))));
    }
}
