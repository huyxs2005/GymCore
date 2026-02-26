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

        // ---------- Customer (Khách hàng) ----------

        @GetMapping("/time-slots")
        public ApiResponse<Map<String, Object>> getTimeSlots() {
                return ApiResponse.ok("Danh sách time slots", coachBookingService.execute("get-time-slots", Map.of()));
        }

        @GetMapping("/coaches")
        public ApiResponse<Map<String, Object>> getCoaches(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
                return ApiResponse.ok("Danh sách PT", coachBookingService.execute("customer-get-coaches",
                                withAuth(authorizationHeader, null)));
        }

        @GetMapping("/coaches/{coachId}")
        public ApiResponse<Map<String, Object>> getCoachDetail(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer coachId) {
                return ApiResponse.ok("Hồ sơ PT (kinh nghiệm, đánh giá, lịch trống)",
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
                if (fromDate != null)
                        params.put("fromDate", fromDate);
                if (toDate != null)
                        params.put("toDate", toDate);
                return ApiResponse.ok("Lịch trống của PT",
                                coachBookingService.execute("customer-get-coach-schedule",
                                                withAuth(authorizationHeader, params)));
        }

        @PostMapping("/coach-booking/match")
        public ApiResponse<Map<String, Object>> matchCoaches(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Gợi ý PT phù hợp",
                                coachBookingService.execute("customer-match-coaches",
                                                withAuth(authorizationHeader, payload)));
        }

        @PostMapping("/coach-booking/requests")
        public ApiResponse<Map<String, Object>> createBookingRequest(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Đặt lịch PT theo slot trống (1 PT – 1 khách / 1 slot)",
                                coachBookingService.execute("customer-create-booking-request",
                                                withAuth(authorizationHeader, payload)));
        }

        @GetMapping("/coach-booking/my-schedule")
        public ApiResponse<Map<String, Object>> getMySchedule(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
                return ApiResponse.ok("Lịch tập cá nhân",
                                coachBookingService.execute("customer-get-my-schedule",
                                                withAuth(authorizationHeader, null)));
        }

        @DeleteMapping("/coach-booking/my-schedule/sessions/{sessionId}")
        public ApiResponse<Map<String, Object>> deleteMySession(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer sessionId) {
                return ApiResponse.ok("Xóa buổi tập đã hủy",
                                coachBookingService.execute("customer-delete-session", withAuth(authorizationHeader,
                                                Map.of("sessionId", sessionId))));
        }

        @PatchMapping("/coach-booking/sessions/{sessionId}/cancel")
        public ApiResponse<Map<String, Object>> cancelSession(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer sessionId,
                        @RequestBody(required = false) Map<String, Object> payload) {
                return ApiResponse.ok("Hủy lịch PT (theo chính sách)",
                                coachBookingService.execute("customer-cancel-session",
                                                withAuth(authorizationHeader, Map.of("sessionId", sessionId, "body",
                                                                payload != null ? payload : Map.of()))));
        }

        @PatchMapping("/coach-booking/sessions/{sessionId}/reschedule")
        public ApiResponse<Map<String, Object>> rescheduleSession(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer sessionId,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Đổi lịch PT",
                                coachBookingService.execute("customer-reschedule-session", withAuth(authorizationHeader,
                                                Map.of("sessionId", sessionId, "body", payload))));
        }

        @PostMapping("/coach-booking/feedback")
        public ApiResponse<Map<String, Object>> submitFeedback(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Feedback và đánh giá PT sau buổi tập",
                                coachBookingService.execute("customer-submit-feedback",
                                                withAuth(authorizationHeader, payload)));
        }

        // ---------- Coach (PT) ----------

        @PutMapping("/coach/availability")
        public ApiResponse<Map<String, Object>> updateAvailability(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Cập nhật lịch trống",
                                coachBookingService.execute("coach-update-availability",
                                                withAuth(authorizationHeader, payload)));
        }

        @GetMapping("/coach/availability")
        public ApiResponse<Map<String, Object>> getMyAvailability(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
                return ApiResponse.ok("Lịch trống đã lưu",
                                coachBookingService.execute("coach-get-availability",
                                                withAuth(authorizationHeader, Map.of())));
        }

        @GetMapping("/coach/schedule")
        public ApiResponse<Map<String, Object>> getCoachMySchedule(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @RequestParam(required = false) String fromDate,
                        @RequestParam(required = false) String toDate) {
                Map<String, Object> params = new LinkedHashMap<>();
                if (fromDate != null)
                        params.put("fromDate", fromDate);
                if (toDate != null)
                        params.put("toDate", toDate);
                return ApiResponse.ok("Xem lịch PT", coachBookingService.execute("coach-get-schedule",
                                withAuth(authorizationHeader, params)));
        }

        @GetMapping("/coach/pt-sessions")
        public ApiResponse<Map<String, Object>> getCoachSessions(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @RequestParam(required = false) String fromDate,
                        @RequestParam(required = false) String toDate) {
                Map<String, Object> params = new LinkedHashMap<>();
                if (fromDate != null)
                        params.put("fromDate", fromDate);
                if (toDate != null)
                        params.put("toDate", toDate);
                return ApiResponse.ok("Xem lịch PT",
                                coachBookingService.execute("coach-get-pt-sessions",
                                                withAuth(authorizationHeader, params)));
        }

        @PostMapping("/coach/pt-sessions/{sessionId}/notes")
        public ApiResponse<Map<String, Object>> createSessionNotes(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer sessionId,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Ghi chú cho buổi tập (chế độ ăn, bài tập)",
                                coachBookingService.execute("coach-create-session-notes", withAuth(authorizationHeader,
                                                Map.of("sessionId", sessionId, "body", payload))));
        }

        @DeleteMapping("/coach/pt-sessions/{sessionId}")
        public ApiResponse<Map<String, Object>> deleteSession(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer sessionId) {
                return ApiResponse.ok("Xóa buổi tập đã hủy",
                                coachBookingService.execute("coach-delete-session", withAuth(authorizationHeader,
                                                Map.of("sessionId", sessionId))));
        }

        @PostMapping("/coach/pt-sessions/{sessionId}/complete")
        public ApiResponse<Map<String, Object>> completeSession(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer sessionId) {
                return ApiResponse.ok("Hoàn thành buổi tập",
                                coachBookingService.execute("coach-complete-session", withAuth(authorizationHeader,
                                                Map.of("sessionId", sessionId))));
        }

        @PutMapping("/coach/pt-sessions/notes/{noteId}")
        public ApiResponse<Map<String, Object>> updateSessionNote(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer noteId,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Chỉnh sửa / cập nhật ghi chú",
                                coachBookingService.execute("coach-update-session-note", withAuth(authorizationHeader,
                                                Map.of("noteId", noteId, "body", payload))));
        }

        @GetMapping("/coach/customers")
        public ApiResponse<Map<String, Object>> getCoachCustomers(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
                return ApiResponse.ok("Danh sách học viên của PT",
                                coachBookingService.execute("coach-get-customers",
                                                withAuth(authorizationHeader, null)));
        }

        @GetMapping("/coach/pt-requests")
        public ApiResponse<Map<String, Object>> getCoachPtRequests(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
                return ApiResponse.ok("Danh sách yêu cầu đặt lịch đang chờ",
                                coachBookingService.execute("coach-get-pt-requests",
                                                withAuth(authorizationHeader, null)));
        }

        @PostMapping("/coach/pt-requests/{requestId}/approve")
        public ApiResponse<Map<String, Object>> approvePtRequest(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer requestId) {
                return ApiResponse.ok("Chấp nhận yêu cầu đặt lịch",
                                coachBookingService.execute("coach-approve-pt-request",
                                                withAuth(authorizationHeader, Map.of("requestId", requestId))));
        }

        @PostMapping("/coach/pt-requests/{requestId}/deny")
        public ApiResponse<Map<String, Object>> denyPtRequest(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer requestId) {
                return ApiResponse.ok("Từ chối yêu cầu đặt lịch",
                                coachBookingService.execute("coach-deny-pt-request",
                                                withAuth(authorizationHeader, Map.of("requestId", requestId))));
        }

        @GetMapping("/coach/customers/{customerId}")
        public ApiResponse<Map<String, Object>> getCoachCustomerDetail(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer customerId) {
                return ApiResponse.ok("Thông tin chi tiết học viên (tiến trình: cân nặng, BMI, số buổi)",
                                coachBookingService.execute("coach-get-customer-detail",
                                                withAuth(authorizationHeader, Map.of("customerId", customerId))));
        }

        @GetMapping("/coach/customers/{customerId}/history")
        public ApiResponse<Map<String, Object>> getCoachCustomerHistory(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer customerId) {
                return ApiResponse.ok("Lịch sử tập luyện của học viên",
                                coachBookingService.execute("coach-get-customer-history",
                                                withAuth(authorizationHeader, Map.of("customerId", customerId))));
        }

        @PutMapping("/coach/customers/{customerId}/progress")
        public ApiResponse<Map<String, Object>> updateProgress(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer customerId,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Cập nhật tiến trình tập luyện cho học viên",
                                coachBookingService.execute("coach-update-customer-progress",
                                                withAuth(authorizationHeader,
                                                                Map.of("customerId", customerId, "body", payload))));
        }

        @GetMapping("/coach/feedback")
        public ApiResponse<Map<String, Object>> getCoachFeedback(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
                return ApiResponse.ok("Xem feedback và đánh giá từ học viên",
                                coachBookingService.execute("coach-get-feedback", withAuth(authorizationHeader, null)));
        }

        @GetMapping("/coach/feedback/average")
        public ApiResponse<Map<String, Object>> getCoachAverageFeedback(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
                return ApiResponse.ok("Xem điểm đánh giá trung bình",
                                coachBookingService.execute("coach-get-feedback-average",
                                                withAuth(authorizationHeader, null)));
        }

        // ---------- Admin ----------

        @GetMapping("/admin/coaches")
        public ApiResponse<Map<String, Object>> adminGetCoaches(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
                return ApiResponse.ok("Danh sách PT (Admin)",
                                coachBookingService.execute("admin-get-coaches", withAuth(authorizationHeader, null)));
        }

        @GetMapping("/admin/coaches/{coachId}")
        public ApiResponse<Map<String, Object>> adminGetCoachDetail(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer coachId) {
                return ApiResponse.ok("Chi tiết hồ sơ PT",
                                coachBookingService.execute("admin-get-coach-detail",
                                                withAuth(authorizationHeader, Map.of("coachId", coachId))));
        }

        @PutMapping("/admin/coaches/{coachId}")
        public ApiResponse<Map<String, Object>> adminUpdateCoachProfile(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer coachId,
                        @RequestBody Map<String, Object> payload) {
                return ApiResponse.ok("Quản lý hồ sơ PT",
                                coachBookingService.execute("admin-update-coach-profile", withAuth(authorizationHeader,
                                                Map.of("coachId", coachId, "body", payload))));
        }

        @GetMapping("/admin/coaches/{coachId}/performance")
        public ApiResponse<Map<String, Object>> adminGetCoachPerformance(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer coachId) {
                return ApiResponse.ok("Theo dõi hiệu suất PT (đánh giá của khách hàng)",
                                coachBookingService.execute("admin-get-coach-performance",
                                                withAuth(authorizationHeader, Map.of("coachId", coachId))));
        }

        @GetMapping("/admin/coaches/{coachId}/students")
        public ApiResponse<Map<String, Object>> adminGetCoachStudents(
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                        @PathVariable Integer coachId) {
                return ApiResponse.ok("Số lượng / lịch sử học viên của PT",
                                coachBookingService.execute("admin-get-coach-students",
                                                withAuth(authorizationHeader, Map.of("coachId", coachId))));
        }
}
