package com.gymcore.backend.modules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import com.gymcore.backend.modules.admin.service.AdminService;
import com.gymcore.backend.modules.auth.service.AuthService;
import com.gymcore.backend.modules.checkin.service.CheckinHealthService;
import com.gymcore.backend.modules.coach.service.CoachBookingService;
import com.gymcore.backend.modules.content.service.ContentService;
import com.gymcore.backend.modules.users.service.UserManagementService;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class UnsupportedActionDispatchTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final AuthService authService = mock(AuthService.class);

    @Test
    void userManagementService_shouldRejectUnsupportedAction() {
        UserManagementService service = new UserManagementService(jdbcTemplate, authService);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.execute("unknown-action", Map.of()));

        assertEquals(HttpStatus.NOT_IMPLEMENTED, exception.getStatusCode());
        assertEquals("Unsupported users action: unknown-action", exception.getReason());
    }

    @Test
    void checkinHealthService_shouldRejectUnsupportedAction() {
        CheckinHealthService service = new CheckinHealthService(jdbcTemplate, authService);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.execute("unknown-action", Map.of()));

        assertEquals(HttpStatus.NOT_IMPLEMENTED, exception.getStatusCode());
        assertEquals("Unsupported checkin-health action: unknown-action", exception.getReason());
    }

    @Test
    void contentService_shouldRejectUnsupportedAction() {
        ContentService service = new ContentService();

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.execute("unknown-action", Map.of()));

        assertEquals(HttpStatus.NOT_IMPLEMENTED, exception.getStatusCode());
        assertEquals("Unsupported content action: unknown-action", exception.getReason());
    }

    @Test
    void coachBookingService_shouldRejectUnsupportedAction() {
        CoachBookingService service = new CoachBookingService(jdbcTemplate, authService);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.execute("unknown-action", Map.of()));

        assertEquals(HttpStatus.NOT_IMPLEMENTED, exception.getStatusCode());
        assertEquals("Unsupported coach-booking action: unknown-action", exception.getReason());
    }

    @Test
    void adminService_shouldRejectUnsupportedAction() {
        AdminService service = new AdminService(jdbcTemplate);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.execute("unknown-action", Map.of()));

        assertEquals(HttpStatus.NOT_IMPLEMENTED, exception.getStatusCode());
        assertEquals("Unsupported admin action: unknown-action", exception.getReason());
    }
}
