package com.gymcore.backend.modules.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.AuthService.PasswordResetTokenRecord;
import com.gymcore.backend.modules.auth.service.AuthService.UserRecord;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

class AuthServiceForgotPasswordOtpTest {

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
    void startForgotPassword_shouldRejectUnknownEmail() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenThrow(new EmptyResultDataAccessException(1));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.startForgotPassword("nope@gymcore.local"));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void startForgotPassword_shouldEnforceCooldownWhenTokenWasJustIssued() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActive());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.PasswordResetTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(new PasswordResetTokenRecord(1, "$hash", Instant.now().plusSeconds(60), Instant.now()));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.startForgotPassword("customer@gymcore.local"));
        assertEquals(429, ex.getStatusCode().value());
    }

    @Test
    void startForgotPassword_shouldSendOtpAndPersistToken() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActive());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.PasswordResetTokens"), any(RowMapper.class), eq(1)))
                .thenThrow(new EmptyResultDataAccessException(1));

        when(passwordEncoder.encode(anyString())).thenReturn("$otpHash");

        Map<String, Object> result = authService.startForgotPassword("customer@gymcore.local");
        assertEquals("customer@gymcore.local", result.get("email"));

        verify(authMailService).sendPasswordResetOtp(eq("customer@gymcore.local"), anyString(), anyString(), eq(120L));
    }

    @Test
    void verifyForgotPasswordOtp_shouldRejectExpiredOtp() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActive());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.PasswordResetTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(new PasswordResetTokenRecord(1, "$hash", Instant.now().minusSeconds(1), Instant.now().minusSeconds(60)));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.verifyForgotPasswordOtp("customer@gymcore.local", "123456"));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void verifyForgotPasswordOtp_shouldRejectWrongOtp() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActive());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.PasswordResetTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(new PasswordResetTokenRecord(1, "$hash", Instant.now().plusSeconds(60), Instant.now().minusSeconds(10)));
        when(passwordEncoder.matches(eq("123456"), anyString())).thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.verifyForgotPasswordOtp("customer@gymcore.local", " 123456 "));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void verifyForgotPasswordOtp_shouldSucceed() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActive());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.PasswordResetTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(new PasswordResetTokenRecord(1, "$hash", Instant.now().plusSeconds(60), Instant.now().minusSeconds(10)));
        when(passwordEncoder.matches(eq("123456"), anyString())).thenReturn(true);

        Map<String, Object> result = authService.verifyForgotPasswordOtp("customer@gymcore.local", "123456");
        assertEquals(true, result.get("verified"));
    }

    @Test
    void resetPasswordWithOtp_shouldRejectMismatchPassword() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.resetPasswordWithOtp("customer@gymcore.local", "123456", "secret123", "secret124"));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void resetPasswordWithOtp_shouldRejectExpiredOtp() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActive());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.PasswordResetTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(new PasswordResetTokenRecord(1, "$hash", Instant.now().minusSeconds(1), Instant.now().minusSeconds(60)));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.resetPasswordWithOtp("customer@gymcore.local", "123456", "secret123", "secret123"));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void resetPasswordWithOtp_shouldResetPasswordAndRevokeRefreshTokens() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActive());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.PasswordResetTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(new PasswordResetTokenRecord(1, "$hash", Instant.now().plusSeconds(60), Instant.now().minusSeconds(60)));
        when(passwordEncoder.matches(eq("123456"), anyString())).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("$newHash");

        Map<String, Object> result = authService.resetPasswordWithOtp("customer@gymcore.local", "123456", "mậtkhẩuđẹp123", "mậtkhẩuđẹp123");
        assertEquals(true, result.get("reset"));

        verify(jdbcTemplate).update(contains("UPDATE dbo.Users SET PasswordHash"), eq("$newHash"), eq(1));
        verify(jdbcTemplate).update(contains("UPDATE dbo.UserRefreshTokens"), eq(1));
    }

    @Test
    void changePassword_shouldRejectWrongCurrentPassword() throws Exception {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActiveWithPassword("$2a$hash"));
        when(passwordEncoder.matches(eq("oldpass"), anyString())).thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.changePassword("Bearer " + token, "oldpass", "newpass123", "newpass123"));
        assertEquals(401, ex.getStatusCode().value());
    }

    @Test
    void changePassword_shouldUpdateAndRevokeRefreshTokens() throws Exception {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActiveWithPassword("$2a$hash"));
        when(passwordEncoder.matches(eq("oldpass"), anyString())).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("$newHash");

        Map<String, Object> result = authService.changePassword("Bearer " + token, "oldpass", "newpass123", "newpass123");
        assertEquals(true, result.get("changed"));

        verify(jdbcTemplate).update(contains("UPDATE dbo.Users SET PasswordHash"), eq("$newHash"), eq(1));
        verify(jdbcTemplate).update(contains("UPDATE dbo.UserRefreshTokens"), eq(1));
    }

    @Test
    void updateProfile_shouldRequireValidBearerToken() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.updateProfile(null, "Nguyễn Văn A", "0900123456", null, null));
        assertEquals(401, ex.getStatusCode().value());
    }

    @Test
    void updateProfile_shouldUpdateAndReturnUser() throws Exception {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActive());

        // After update, service re-queries user by id again.
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), eq(1)))
                .thenReturn(new UserRecord(
                        1, 1, "Customer", "CUSTOMER",
                        "Nguyễn Văn A", "customer@gymcore.local", "0900123456", "$2a$hash",
                        false, true, true,
                        null, null
                ));

        Map<String, Object> result = authService.updateProfile("Bearer " + token, "Nguyễn Văn A", "0900123456", null, null);
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) result.get("user");
        assertEquals("Nguyễn Văn A", user.get("fullName"));
    }

    @Test
    void getProfile_shouldReturnUserMap() throws Exception {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(customerVerifiedActive());

        Map<String, Object> result = authService.getProfile("Bearer " + token);
        assertNotNull(result.get("user"));
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private UserRecord customerVerifiedActive() {
        return new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyễn Văn Minh", "customer@gymcore.local", "0900123456", "$2a$hash",
                false, true, true,
                null, null
        );
    }

    private UserRecord customerVerifiedActiveWithPassword(String passwordHash) {
        return new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyễn Văn Minh", "customer@gymcore.local", "0900123456", passwordHash,
                false, true, true,
                null, null
        );
    }
}
