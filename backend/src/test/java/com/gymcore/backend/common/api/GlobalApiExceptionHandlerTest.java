package com.gymcore.backend.common.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import jakarta.validation.ConstraintViolationException;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

class GlobalApiExceptionHandlerTest {

    private GlobalApiExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalApiExceptionHandler();
    }

    @Test
    void handleResponseStatusException_shouldPreserveStatusAndReason() {
        ResponseEntity<ApiResponse<Map<String, Object>>> response = handler.handleResponseStatusException(
                new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid coupon payload."));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(false, response.getBody().success());
        assertEquals("Invalid coupon payload.", response.getBody().message());
    }

    @Test
    void handleMethodArgumentNotValid_shouldReturnFirstFieldMessage() {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "payload");
        bindingResult.addError(new FieldError("payload", "promoCode", "Coupon code is required."));
        MethodArgumentNotValidException exception = new MethodArgumentNotValidException(
                Mockito.mock(MethodParameter.class),
                bindingResult);

        ResponseEntity<ApiResponse<Map<String, Object>>> response = handler.handleMethodArgumentNotValid(exception);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Coupon code is required.", response.getBody().message());
    }

    @Test
    void handleConstraintViolation_shouldReturnValidationMessage() {
        ResponseEntity<ApiResponse<Map<String, Object>>> response = handler.handleConstraintViolation(
                new ConstraintViolationException("bad request", java.util.Set.of()));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Request validation failed.", response.getBody().message());
    }

    @Test
    void handleMaxUploadSizeExceeded_shouldReturnPayloadTooLarge() {
        ResponseEntity<ApiResponse<Map<String, Object>>> response = handler.handleMaxUploadSizeExceeded(
                new MaxUploadSizeExceededException(6L * 1024 * 1024));

        assertEquals(413, response.getStatusCode().value());
        assertEquals("Uploaded file is too large.", response.getBody().message());
    }

    @Test
    void handleUnexpectedException_shouldReturnInternalServerError() {
        ResponseEntity<ApiResponse<Map<String, Object>>> response = handler.handleUnexpectedException(
                new IllegalStateException("boom"));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("Unexpected server error.", response.getBody().message());
    }
}
