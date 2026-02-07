package com.gymcore.backend.modules.auth.controller;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.auth.service.AuthService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Register endpoint ready for implementation", authService.execute("register", payload));
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Login endpoint ready for implementation", authService.execute("login", payload));
    }

    @PostMapping("/login/google")
    public ApiResponse<Map<String, Object>> loginWithGoogle(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Google login endpoint ready for implementation", authService.execute("login-google", payload));
    }

    @PostMapping("/forgot-password")
    public ApiResponse<Map<String, Object>> forgotPassword(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Forgot-password endpoint ready for implementation",
                authService.execute("forgot-password", payload));
    }

    @PatchMapping("/change-password")
    public ApiResponse<Map<String, Object>> changePassword(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Change-password endpoint ready for implementation",
                authService.execute("change-password", payload));
    }

    @PostMapping("/logout")
    public ApiResponse<Map<String, Object>> logout() {
        return ApiResponse.ok("Logout endpoint ready for implementation", authService.execute("logout", null));
    }

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> getProfile() {
        return ApiResponse.ok("Profile endpoint ready for implementation", authService.execute("get-profile", null));
    }

    @PutMapping("/me")
    public ApiResponse<Map<String, Object>> updateProfile(@RequestBody Map<String, Object> payload) {
        return ApiResponse.ok("Update profile endpoint ready for implementation",
                authService.execute("update-profile", payload));
    }
}
