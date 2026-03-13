package com.gymcore.backend.modules.promotion.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.promotion.service.PromotionService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

class PromotionControllerTest {

    private PromotionService promotionService;
    private PromotionController controller;

    @BeforeEach
    void setUp() {
        promotionService = Mockito.mock(PromotionService.class);
        controller = new PromotionController(promotionService);
    }

    @Test
    void uploadPromotionBanner_shouldDelegateToService() {
        MockMultipartFile file = new MockMultipartFile("file", "banner.png", "image/png", new byte[] { 1, 2, 3 });
        when(promotionService.uploadPromotionBanner("Bearer admin", file))
                .thenReturn(Map.of("imageUrl", "/uploads/promotions/banners/banner.png"));

        ApiResponse<Map<String, Object>> response = controller.uploadPromotionBanner("Bearer admin", file);

        assertEquals("Promotion banner uploaded", response.message());
        assertEquals("/uploads/promotions/banners/banner.png", response.data().get("imageUrl"));
        verify(promotionService).uploadPromotionBanner("Bearer admin", file);
    }

    @Test
    void deleteUploadedPromotionBanner_shouldDelegateToService() {
        when(promotionService.deleteUploadedPromotionBanner("Bearer admin", "/uploads/promotions/banners/banner.png"))
                .thenReturn(Map.of("deleted", true));

        ApiResponse<Map<String, Object>> response = controller.deleteUploadedPromotionBanner(
                "Bearer admin", "/uploads/promotions/banners/banner.png");

        assertEquals("Promotion banner deleted", response.message());
        assertEquals(Boolean.TRUE, response.data().get("deleted"));
        verify(promotionService).deleteUploadedPromotionBanner("Bearer admin", "/uploads/promotions/banners/banner.png");
    }

    @Test
    void createPost_shouldPassImportantFlagToService() {
        Map<String, Object> payload = Map.of(
                "title", "Important launch",
                "content", "Broadcast this campaign",
                "bannerUrl", "/banner.png",
                "promotionId", 3,
                "startAt", "2026-03-01",
                "endAt", "2026-03-31",
                "isActive", 1,
                "isImportant", 1);
        when(promotionService.execute("admin-create-promotion-post", "Bearer admin", payload))
                .thenReturn(Map.of("success", true));

        ApiResponse<Map<String, Object>> response = controller.createPost("Bearer admin", payload);

        assertEquals("Promotion post created", response.message());
        assertEquals(Boolean.TRUE, response.data().get("success"));
        verify(promotionService).execute("admin-create-promotion-post", "Bearer admin", payload);
    }

    @Test
    void updatePost_shouldPassImportantFlagToService() {
        Map<String, Object> payload = Map.of(
                "title", "Quiet follow-up",
                "content", "Page only",
                "bannerUrl", "/banner.png",
                "promotionId", 4,
                "startAt", "2026-03-01",
                "endAt", "2026-03-31",
                "isActive", 1,
                "isImportant", 0);
        when(promotionService.execute(
                "admin-update-promotion-post",
                "Bearer admin",
                Map.of("postId", 42, "body", payload)))
                .thenReturn(Map.of("success", true));

        ApiResponse<Map<String, Object>> response = controller.updatePost("Bearer admin", 42, payload);

        assertEquals("Promotion post updated", response.message());
        assertEquals(Boolean.TRUE, response.data().get("success"));
        verify(promotionService).execute(
                "admin-update-promotion-post",
                "Bearer admin",
                Map.of("postId", 42, "body", payload));
    }

    @Test
    void getNotifications_shouldDelegateReminderViewAndUnreadFilter() {
        when(promotionService.execute(
                "customer-get-notifications",
                "Bearer customer",
                Map.of("unreadOnly", true, "view", "actionable")))
                .thenReturn(Map.of("notifications", java.util.List.of(), "unreadCount", 0));

        ApiResponse<Map<String, Object>> response =
                controller.getNotifications("Bearer customer", true, "actionable");

        assertEquals("Notifications retrieved", response.message());
        assertEquals(0, response.data().get("unreadCount"));
        verify(promotionService).execute(
                "customer-get-notifications",
                "Bearer customer",
                Map.of("unreadOnly", true, "view", "actionable"));
    }

    @Test
    void handleResponseStatusException_shouldReturnApiErrorBody() {
        ResponseStatusException exception = new ResponseStatusException(HttpStatus.BAD_REQUEST, "Promotion banner file is required.");

        ResponseEntity<ApiResponse<Map<String, Object>>> response = controller.handleResponseStatusException(exception);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(false, response.getBody().success());
        assertEquals("Promotion banner file is required.", response.getBody().message());
    }

    @Test
    void handleMaxUploadSizeExceeded_shouldReturnFriendly413Message() {
        when(promotionService.promotionBannerTooLargeMessage())
                .thenReturn("Promotion banner file is too large. Maximum size is 5 MB.");

        ResponseEntity<ApiResponse<Map<String, Object>>> response =
                controller.handleMaxUploadSizeExceeded(new MaxUploadSizeExceededException(6L * 1024 * 1024));

        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, response.getStatusCode());
        assertEquals(false, response.getBody().success());
        assertEquals("Promotion banner file is too large. Maximum size is 5 MB.", response.getBody().message());
    }
}
