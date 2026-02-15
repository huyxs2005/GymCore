package com.gymcore.backend.modules.auth.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.auth.controller.AuthController.ChangePasswordRequest;
import com.gymcore.backend.modules.auth.controller.AuthController.EmailOnlyRequest;
import com.gymcore.backend.modules.auth.controller.AuthController.EmailOtpRequest;
import com.gymcore.backend.modules.auth.controller.AuthController.ForgotPasswordResetRequest;
import com.gymcore.backend.modules.auth.controller.AuthController.GoogleLoginRequest;
import com.gymcore.backend.modules.auth.controller.AuthController.LoginRequest;
import com.gymcore.backend.modules.auth.controller.AuthController.RegisterStartRequest;
import com.gymcore.backend.modules.auth.controller.AuthController.UpdateProfileRequest;
import com.gymcore.backend.modules.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    private AuthController controller;

    @BeforeEach
    void setUp() {
        controller = new AuthController(authService);
    }

    @Test
    void registerShouldCallServiceAndReturnSuccess() {
        when(authService.startRegistration(anyString(), anyString(), any(), anyString(), anyString()))
                .thenReturn(Map.of("email", "new@gymcore.local"));

        ApiResponse<Map<String, Object>> result = controller.register(
                new RegisterStartRequest("New User", "new@gymcore.local", "0900111222", "secret123", "secret123"));

        assertTrue(result.success());
        assertEquals("Verification OTP has been sent.", result.message());
        verify(authService).startRegistration(anyString(), anyString(), any(), anyString(), anyString());
    }

    @Test
    void loginShouldReturnAccessToken() {
        when(authService.loginWithPassword(anyString(), anyString(), any(), any()))
                .thenReturn(Map.of("accessToken", "token"));

        ApiResponse<Map<String, Object>> result =
                controller.login(new LoginRequest("customer@gymcore.local", "secret123"), request, response);

        assertTrue(result.success());
        assertEquals("token", result.data().get("accessToken"));
    }

    @Test
    void googleLoginShouldCallService() {
        when(authService.loginWithGoogle(anyString(), any(), any()))
                .thenReturn(Map.of("accessToken", "token"));

        ApiResponse<Map<String, Object>> result =
                controller.loginWithGoogle(new GoogleLoginRequest("google-id-token"), request, response);

        assertTrue(result.success());
        verify(authService).loginWithGoogle(anyString(), any(), any());
    }

    @Test
    void forgotResetShouldCallService() {
        when(authService.resetPasswordWithOtp(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(Map.of("reset", true));

        ApiResponse<Map<String, Object>> result = controller.resetPassword(
                new ForgotPasswordResetRequest("customer@gymcore.local", "123456", "newpass123", "newpass123"));

        assertTrue(result.success());
        assertEquals(true, result.data().get("reset"));
    }

    @Test
    void changePasswordShouldPassAuthorizationHeader() {
        when(authService.changePassword(any(), anyString(), anyString(), anyString()))
                .thenReturn(Map.of("changed", true));

        ApiResponse<Map<String, Object>> result = controller.changePassword(
                "Bearer token",
                new ChangePasswordRequest("oldpass123", "newpass123", "newpass123"));

        assertTrue(result.success());
        assertEquals(true, result.data().get("changed"));
    }

    @Test
    void profileEndpointsShouldCallService() {
        when(authService.getProfile(anyString())).thenReturn(Map.of("user", Map.of("email", "customer@gymcore.local")));
        when(authService.getMyQrToken(anyString())).thenReturn(Map.of("qrCodeToken", "token"));
        when(authService.updateProfile(
                anyString(),
                anyString(),
                org.mockito.ArgumentMatchers.<String>any(),
                org.mockito.ArgumentMatchers.<String>any(),
                org.mockito.ArgumentMatchers.<String>any()
        )).thenReturn(Map.of("user", Map.of("fullName", "Updated")));
        when(authService.uploadAvatar(anyString(), any())).thenReturn(Map.of("user", Map.of("avatarSource", "CUSTOM")));

        ApiResponse<Map<String, Object>> profile = controller.getProfile("Bearer token");
        ApiResponse<Map<String, Object>> qrToken = controller.getMyQrToken("Bearer token");
        ApiResponse<Map<String, Object>> updated = controller.updateProfile(
                "Bearer token",
                new UpdateProfileRequest("Updated", "0900", null, null));
        ApiResponse<Map<String, Object>> avatar = controller.uploadAvatar(
                "Bearer token",
                new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3}));

        assertTrue(profile.success());
        assertTrue(qrToken.success());
        assertTrue(updated.success());
        assertTrue(avatar.success());
    }

    @Test
    void otpEndpointsShouldCallService() {
        when(authService.resendRegisterOtp(anyString())).thenReturn(Map.of("ok", true));
        when(authService.verifyRegisterOtp(anyString(), anyString())).thenReturn(Map.of("verified", true));
        when(authService.startForgotPassword(anyString())).thenReturn(Map.of("ok", true));
        when(authService.resendForgotPasswordOtp(anyString())).thenReturn(Map.of("ok", true));
        when(authService.verifyForgotPasswordOtp(anyString(), anyString())).thenReturn(Map.of("verified", true));

        ApiResponse<Map<String, Object>> resendRegister = controller.resendRegisterOtp(new EmailOnlyRequest("a@gymcore.local"));
        ApiResponse<Map<String, Object>> verifyRegister = controller.verifyRegisterOtp(new EmailOtpRequest("a@gymcore.local", "123456"));
        ApiResponse<Map<String, Object>> forgot = controller.forgotPassword(new EmailOnlyRequest("a@gymcore.local"));
        ApiResponse<Map<String, Object>> resendForgot = controller.resendForgotPasswordOtp(new EmailOnlyRequest("a@gymcore.local"));
        ApiResponse<Map<String, Object>> verifyForgot = controller.verifyForgotPasswordOtp(new EmailOtpRequest("a@gymcore.local", "123456"));

        assertTrue(resendRegister.success());
        assertTrue(verifyRegister.success());
        assertTrue(forgot.success());
        assertTrue(resendForgot.success());
        assertTrue(verifyForgot.success());
    }

    @Test
    void responseStatusExceptionHandlerShouldReturnErrorBody() {
        ResponseEntity<ApiResponse<Map<String, Object>>> responseEntity =
                controller.handleResponseStatusException(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Access token is invalid."));

        assertEquals(401, responseEntity.getStatusCode().value());
        assertFalse(responseEntity.getBody().success());
        assertEquals("Access token is invalid.", responseEntity.getBody().message());
    }
}
