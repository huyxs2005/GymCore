package com.gymcore.backend.modules.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.AuthService.UserRecord;
import java.lang.reflect.Field;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

class AuthServiceQrTokenTest {

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
        setField(authService, "googleClientId", "");
        setField(authService, "otpExpirySeconds", 120L);
        setField(authService, "otpResendCooldownSeconds", 5L);

        authService.initializeJwtKey();
    }

    @Test
    void getMyQrToken_shouldReturnQrCodeToken() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        1, 1, "Customer", "CUSTOMER",
                        "Trần Minh Huy", "customer@gymcore.local", null, "$2a$hash",
                        false, true, true,
                        null, null
                ));
        when(jdbcTemplate.queryForObject(contains("SELECT QrCodeToken"), eq(String.class), eq(1)))
                .thenReturn("QR_TOKEN_123");

        Map<String, Object> result = authService.getMyQrToken("Bearer " + token);
        assertEquals("QR_TOKEN_123", result.get("qrCodeToken"));
    }

    @Test
    void getMyQrToken_shouldRejectMissingToken() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        1, 1, "Customer", "CUSTOMER",
                        "Trần Minh Huy", "customer@gymcore.local", null, "$2a$hash",
                        false, true, true,
                        null, null
                ));
        when(jdbcTemplate.queryForObject(contains("SELECT QrCodeToken"), eq(String.class), eq(1)))
                .thenReturn(" ");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.getMyQrToken("Bearer " + token));
        assertEquals(500, ex.getStatusCode().value());
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

