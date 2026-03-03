package com.gymcore.backend.modules.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

class AuthServiceGoogleTokenValidationTest {

    private JdbcTemplate jdbcTemplate;
    private PasswordEncoder passwordEncoder;
    private AuthMailService authMailService;
    private RestTemplate restTemplate;
    private AuthService authService;

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        passwordEncoder = Mockito.mock(PasswordEncoder.class);
        authMailService = Mockito.mock(AuthMailService.class);
        restTemplate = Mockito.mock(RestTemplate.class);

        authService = new AuthService(jdbcTemplate, passwordEncoder, authMailService, restTemplate);
        setField(authService, "jwtSecret", "this-is-a-test-jwt-secret-at-least-32-chars!!");
        setField(authService, "accessTokenMinutes", 15L);
        setField(authService, "refreshTokenDays", 14L);
        setField(authService, "refreshCookieSecure", false);
        setField(authService, "googleClientId", "expected-client-id");
        setField(authService, "otpExpirySeconds", 120L);
        setField(authService, "otpResendCooldownSeconds", 5L);
        authService.initializeJwtKey();
    }

    @Test
    void googleLogin_shouldRejectTokeninfoNetworkError() {
        when(restTemplate.getForObject(contains("tokeninfo"), any(), anyString()))
                .thenThrow(new RestClientException("boom"));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithGoogle("idtoken", new org.springframework.mock.web.MockHttpServletRequest(),
                        new org.springframework.mock.web.MockHttpServletResponse()));
        assertEquals(HttpStatus.UNAUTHORIZED.value(), ex.getStatusCode().value());
    }

    @Test
    void googleLogin_shouldRejectAudienceMismatch() {
        when(restTemplate.getForObject(contains("tokeninfo"), any(), anyString()))
                .thenReturn(Map.of(
                        "aud", "wrong-client",
                        "email", "a@gymcore.local",
                        "sub", "sub",
                        "email_verified", "true"
                ));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithGoogle("idtoken", new org.springframework.mock.web.MockHttpServletRequest(),
                        new org.springframework.mock.web.MockHttpServletResponse()));
        assertEquals(HttpStatus.UNAUTHORIZED.value(), ex.getStatusCode().value());
    }

    @Test
    void googleLogin_shouldRejectWhenEmailNotVerified() {
        when(restTemplate.getForObject(contains("tokeninfo"), any(), anyString()))
                .thenReturn(Map.of(
                        "aud", "expected-client-id",
                        "email", "a@gymcore.local",
                        "sub", "sub",
                        "email_verified", "false"
                ));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithGoogle("idtoken", new org.springframework.mock.web.MockHttpServletRequest(),
                        new org.springframework.mock.web.MockHttpServletResponse()));
        assertEquals(HttpStatus.UNAUTHORIZED.value(), ex.getStatusCode().value());
    }

    @Test
    void googleLogin_shouldRejectMissingEmailOrSub() {
        when(restTemplate.getForObject(contains("tokeninfo"), any(), anyString()))
                .thenReturn(Map.of(
                        "aud", "expected-client-id",
                        "email_verified", "true"
                ));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithGoogle("idtoken", new org.springframework.mock.web.MockHttpServletRequest(),
                        new org.springframework.mock.web.MockHttpServletResponse()));
        assertEquals(HttpStatus.UNAUTHORIZED.value(), ex.getStatusCode().value());
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
