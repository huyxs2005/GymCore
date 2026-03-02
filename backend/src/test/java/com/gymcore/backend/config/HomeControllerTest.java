package com.gymcore.backend.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

class HomeControllerTest {

    @Test
    void home_shouldReturnEnglishApiMetadata() {
        HomeController controller = new HomeController();

        Map<String, Object> payload = controller.home();

        assertEquals("GymCore Backend API", payload.get("message"));
        assertEquals("running", payload.get("status"));
        assertEquals("/api/v1", payload.get("apiBase"));
        assertEquals("/api/v1/auth/login", payload.get("auth"));
        assertEquals("See the project documentation in docs/ for API usage details.", payload.get("docs"));
    }
}
