package com.gymcore.backend.config;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Root endpoint (/). The backend is an API server and does not render a web UI.
 * Use Postman, curl, or the frontend app to call endpoints under /api/v1/.
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
                "docs", "See the project documentation in docs/ for API usage details."
        );
    }
}
