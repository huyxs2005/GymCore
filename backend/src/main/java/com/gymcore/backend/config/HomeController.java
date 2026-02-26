package com.gymcore.backend.config;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Trang gốc (/) - Backend là API server, không có giao diện web.
 * Dùng Postman/curl hoặc frontend để gọi API tại /api/v1/...
 */
@RestController
public class HomeController {

    @GetMapping("/")
    public Map<String, Object> home() {
        return Map.of(
                "message", "GymCore Backend API",
                "status", "running",
                "apiBase", "/api/v1",
                "auth", "/api/v1/auth/login",
                "docs", "Xem docs/HUONG-DAN-CHAY-VA-GOI-API.md để gọi API"
        );
    }
}
