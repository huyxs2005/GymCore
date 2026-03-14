package com.gymcore.backend.modules.content.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.common.api.ApiResponse;
import com.gymcore.backend.modules.content.service.GoalAdminService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class GoalAdminControllerTest {

    private GoalAdminService goalAdminService;
    private GoalAdminController controller;

    @BeforeEach
    void setUp() {
        goalAdminService = Mockito.mock(GoalAdminService.class);
        controller = new GoalAdminController(goalAdminService);
    }

    @Test
    void getGoals_shouldDelegateToService() {
        when(goalAdminService.getGoals("Bearer admin")).thenReturn(Map.of("items", java.util.List.of()));

        ApiResponse<Map<String, Object>> response = controller.getGoals("Bearer admin");

        assertEquals(true, response.success());
        verify(goalAdminService).getGoals("Bearer admin");
    }

    @Test
    void createGoal_shouldPassPayload() {
        Map<String, Object> payload = Map.of("goalCode", "GAIN_MUSCLE", "name", "Gain muscle");
        when(goalAdminService.createGoal("Bearer admin", payload)).thenReturn(Map.of("goalId", 11));

        ApiResponse<Map<String, Object>> response = controller.createGoal("Bearer admin", payload);

        assertEquals(11, response.data().get("goalId"));
        verify(goalAdminService).createGoal("Bearer admin", payload);
    }
}
