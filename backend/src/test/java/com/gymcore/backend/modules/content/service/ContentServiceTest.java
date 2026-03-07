package com.gymcore.backend.modules.content.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class ContentServiceTest {

    private final ContentService contentService = new ContentService();

    @Test
    void execute_shouldReturnNotImplementedForUnsupportedAction() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> contentService.execute("get-workouts", null));

        assertEquals(HttpStatus.NOT_IMPLEMENTED, exception.getStatusCode());
        assertEquals("Unsupported content action: get-workouts", exception.getReason());
    }
}
