package com.gymcore.backend.modules.users.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.users.service.UserManagementService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class UserManagementControllerTest {

    private UserManagementService userManagementService;
    private UserManagementController controller;

    @BeforeEach
    void setUp() {
        userManagementService = Mockito.mock(UserManagementService.class);
        controller = new UserManagementController(userManagementService);
    }

    @Test
    void getUsers_shouldDelegateFiltersAndAuthorizationHeader() {
        Map<String, Object> expectedRequest = Map.of(
                "authorizationHeader", "Bearer admin",
                "query", "alex",
                "role", "COACH",
                "locked", "false",
                "active", "true");
        when(userManagementService.execute("admin-get-users", expectedRequest))
                .thenReturn(Map.of("summary", Map.of("filteredCount", 1)));

        ApiResponse<Map<String, Object>> response = controller.getUsers(
                "Bearer admin", "alex", "COACH", "false", "true");

        assertEquals(1, ((Map<?, ?>) response.data().get("summary")).get("filteredCount"));
        verify(userManagementService).execute("admin-get-users", expectedRequest);
    }

    @Test
    void createStaff_shouldDelegatePayloadAndAuthorizationHeader() {
        Map<String, Object> payload = Map.of(
                "fullName", "Reception New",
                "email", "new.reception@gymcore.local",
                "phone", "0900000099",
                "role", "RECEPTIONIST",
                "password", "Reception123!");

        when(userManagementService.execute(eq("admin-create-staff"), eq(Map.of(
                "authorizationHeader", "Bearer admin",
                "fullName", "Reception New",
                "email", "new.reception@gymcore.local",
                "phone", "0900000099",
                "role", "RECEPTIONIST",
                "password", "Reception123!"))))
                .thenReturn(Map.of("user", Map.of("userId", 9)));

        ApiResponse<Map<String, Object>> response = controller.createStaff("Bearer admin", payload);

        assertEquals(9, ((Map<?, ?>) response.data().get("user")).get("userId"));
        verify(userManagementService).execute("admin-create-staff", Map.of(
                "authorizationHeader", "Bearer admin",
                "fullName", "Reception New",
                "email", "new.reception@gymcore.local",
                "phone", "0900000099",
                "role", "RECEPTIONIST",
                "password", "Reception123!"));
    }

    @Test
    void updateLockAndUnlock_shouldWrapControllerPayloads() {
        when(userManagementService.execute(eq("admin-update-staff"), eq(Map.of(
                "authorizationHeader", "Bearer admin",
                "userId", 3,
                "body", Map.of("fullName", "Coach Alex", "active", true)))))
                .thenReturn(Map.of("user", Map.of("userId", 3)));
        when(userManagementService.execute(eq("admin-lock-user"), eq(Map.of(
                "authorizationHeader", "Bearer admin",
                "userId", 3,
                "body", Map.of("reason", "Policy violation")))))
                .thenReturn(Map.of("user", Map.of("userId", 3)));
        when(userManagementService.execute(eq("admin-unlock-user"), eq(Map.of(
                "authorizationHeader", "Bearer admin",
                "userId", 3))))
                .thenReturn(Map.of("user", Map.of("userId", 3)));

        controller.updateStaff("Bearer admin", 3, Map.of("fullName", "Coach Alex", "active", true));
        controller.lockUser("Bearer admin", 3, Map.of("reason", "Policy violation"));
        controller.unlockUser("Bearer admin", 3);

        verify(userManagementService).execute("admin-update-staff", Map.of(
                "authorizationHeader", "Bearer admin",
                "userId", 3,
                "body", Map.of("fullName", "Coach Alex", "active", true)));
        verify(userManagementService).execute("admin-lock-user", Map.of(
                "authorizationHeader", "Bearer admin",
                "userId", 3,
                "body", Map.of("reason", "Policy violation")));
        verify(userManagementService).execute("admin-unlock-user", Map.of(
                "authorizationHeader", "Bearer admin",
                "userId", 3));
    }
}
