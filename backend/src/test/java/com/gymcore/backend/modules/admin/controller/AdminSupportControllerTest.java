package com.gymcore.backend.modules.admin.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.admin.service.AdminSupportService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class AdminSupportControllerTest {

    private AdminSupportService adminSupportService;
    private AdminSupportController controller;

    @BeforeEach
    void setUp() {
        adminSupportService = Mockito.mock(AdminSupportService.class);
        controller = new AdminSupportController(adminSupportService);
    }

    @Test
    void searchCustomers_shouldDelegateToService() {
        when(adminSupportService.searchCustomers("Bearer admin", "minh")).thenReturn(Map.of("items", java.util.List.of()));

        ApiResponse<Map<String, Object>> response = controller.searchCustomers("Bearer admin", "minh");

        assertEquals(true, response.success());
        verify(adminSupportService).searchCustomers("Bearer admin", "minh");
    }
}
