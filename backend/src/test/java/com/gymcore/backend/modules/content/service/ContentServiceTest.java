package com.gymcore.backend.modules.content.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class ContentServiceTest {

    @Test
    void execute_shouldReturnNotImplementedForUnsupportedAction() {
        ContentService contentService = new ContentService(org.mockito.Mockito.mock(JdbcTemplate.class));
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> contentService.execute("unsupported-action", null));

        assertEquals(HttpStatus.NOT_IMPLEMENTED, exception.getStatusCode());
        assertEquals("Unsupported content action: unsupported-action", exception.getReason());
    }
}
