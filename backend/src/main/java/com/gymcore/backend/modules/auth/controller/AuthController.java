package com.gymcore.backend.modules.auth.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(@Valid @RequestBody RegisterStartRequest payload) {
        return ApiResponse.ok(
                "Verification OTP has been sent.",
                authService.startRegistration(
                        payload.fullName(),
                        payload.email(),
                        payload.phone(),
                        payload.password(),
                        payload.confirmPassword()
                )
        );
    }

    @PostMapping("/register/resend-otp")
    public ApiResponse<Map<String, Object>> resendRegisterOtp(@Valid @RequestBody EmailOnlyRequest payload) {
        return ApiResponse.ok("Verification OTP has been resent.", authService.resendRegisterOtp(payload.email()));
    }

    @PostMapping("/register/verify-otp")
    public ApiResponse<Map<String, Object>> verifyRegisterOtp(@Valid @RequestBody EmailOtpRequest payload) {
        return ApiResponse.ok("Email verified successfully.", authService.verifyRegisterOtp(payload.email(), payload.otp()));
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(
            @Valid @RequestBody LoginRequest payload,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return ApiResponse.ok("Login successful",
                authService.loginWithPassword(payload.email(), payload.password(), request, response));
    }

    @PostMapping("/login/google")
    public ApiResponse<Map<String, Object>> loginWithGoogle(
            @Valid @RequestBody GoogleLoginRequest payload,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return ApiResponse.ok("Google login successful",
                authService.loginWithGoogle(payload.idToken(), request, response));
    }

    @PostMapping("/refresh")
    public ApiResponse<Map<String, Object>> refresh(HttpServletRequest request, HttpServletResponse response) {
        return ApiResponse.ok("Access token refreshed", authService.refreshSession(request, response));
    }

    @PostMapping("/forgot-password")
    public ApiResponse<Map<String, Object>> forgotPassword(@Valid @RequestBody EmailOnlyRequest payload) {
        return ApiResponse.ok("Password reset OTP has been sent.", authService.startForgotPassword(payload.email()));
    }

    @PostMapping("/forgot-password/resend-otp")
    public ApiResponse<Map<String, Object>> resendForgotPasswordOtp(@Valid @RequestBody EmailOnlyRequest payload) {
        return ApiResponse.ok("Password reset OTP has been resent.", authService.resendForgotPasswordOtp(payload.email()));
    }

    @PostMapping("/forgot-password/verify-otp")
    public ApiResponse<Map<String, Object>> verifyForgotPasswordOtp(@Valid @RequestBody EmailOtpRequest payload) {
        return ApiResponse.ok("OTP verified.", authService.verifyForgotPasswordOtp(payload.email(), payload.otp()));
    }

    @PostMapping("/forgot-password/reset")
    public ApiResponse<Map<String, Object>> resetPassword(@Valid @RequestBody ForgotPasswordResetRequest payload) {
        return ApiResponse.ok(
                "Password reset successful.",
                authService.resetPasswordWithOtp(payload.email(), payload.otp(), payload.newPassword(), payload.confirmPassword())
        );
    }

    @PatchMapping("/change-password")
    public ApiResponse<Map<String, Object>> changePassword(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @Valid @RequestBody ChangePasswordRequest payload
    ) {
        return ApiResponse.ok(
                "Password changed successfully.",
                authService.changePassword(authorizationHeader, payload.oldPassword(), payload.newPassword(), payload.confirmPassword())
        );
    }

    @PostMapping("/logout")
    public ApiResponse<Map<String, Object>> logout(HttpServletRequest request, HttpServletResponse response) {
        return ApiResponse.ok("Logged out", authService.logout(request, response));
    }

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> getProfile(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader
    ) {
        return ApiResponse.ok("Profile loaded", authService.getProfile(authorizationHeader));
    }

    @GetMapping("/me/qr-token")
    public ApiResponse<Map<String, Object>> getMyQrToken(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader
    ) {
        return ApiResponse.ok("QR token loaded", authService.getMyQrToken(authorizationHeader));
    }

    @PutMapping("/me")
    public ApiResponse<Map<String, Object>> updateProfile(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @Valid @RequestBody UpdateProfileRequest payload
    ) {
        return ApiResponse.ok(
                "Profile updated successfully.",
                authService.updateProfile(
                        authorizationHeader,
                        payload.fullName(),
                        payload.phone(),
                        payload.dateOfBirth(),
                        payload.gender()
                )
        );
    }

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Map<String, Object>> uploadAvatar(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestPart("file") MultipartFile file
    ) {
        return ApiResponse.ok("Avatar uploaded successfully.", authService.uploadAvatar(authorizationHeader, file));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleResponseStatusException(ResponseStatusException exception) {
        String message = exception.getReason() == null ? "Request failed." : exception.getReason();
        return ResponseEntity.status(exception.getStatusCode()).body(ApiResponse.error(message, Map.of()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleMethodArgumentNotValid(MethodArgumentNotValidException exception) {
        FieldError fieldError = exception.getBindingResult().getFieldError();
        String message = fieldError == null ? "Request validation failed." : fieldError.getDefaultMessage();
        return ResponseEntity.badRequest().body(ApiResponse.error(message, Map.of()));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleConstraintViolation(ConstraintViolationException exception) {
        return ResponseEntity.badRequest().body(ApiResponse.error("Request validation failed.", Map.of()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleUnexpectedException(Exception exception) {
        return ResponseEntity.internalServerError().body(ApiResponse.error("Unexpected server error.", Map.of()));
    }

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {
    }

    public record GoogleLoginRequest(@NotBlank String idToken) {
    }

    public record RegisterStartRequest(
            @NotBlank(message = "Full name is required.") String fullName,
            @NotBlank(message = "Email is required.") @Email(message = "Email is invalid.") String email,
            String phone,
            @NotBlank(message = "Password is required.") @Size(min = 8, message = "Password must be at least 8 characters.") String password,
            @NotBlank(message = "Confirm password is required.") String confirmPassword
    ) {
    }

    public record EmailOnlyRequest(
            @NotBlank(message = "Email is required.") @Email(message = "Email is invalid.") String email
    ) {
    }

    public record EmailOtpRequest(
            @NotBlank(message = "Email is required.") @Email(message = "Email is invalid.") String email,
            @NotBlank(message = "OTP is required.") String otp
    ) {
    }

    public record ForgotPasswordResetRequest(
            @NotBlank(message = "Email is required.") @Email(message = "Email is invalid.") String email,
            @NotBlank(message = "OTP is required.") String otp,
            @NotBlank(message = "New password is required.") @Size(min = 8, message = "Password must be at least 8 characters.") String newPassword,
            @NotBlank(message = "Confirm password is required.") String confirmPassword
    ) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Current password is required.") String oldPassword,
            @NotBlank(message = "New password is required.") @Size(min = 8, message = "Password must be at least 8 characters.") String newPassword,
            @NotBlank(message = "Confirm password is required.") String confirmPassword
    ) {
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "Full name is required.") String fullName,
            String phone,
            String dateOfBirth,
            @Size(max = 10, message = "Gender must be at most 10 characters.") String gender
    ) {
    }
}
