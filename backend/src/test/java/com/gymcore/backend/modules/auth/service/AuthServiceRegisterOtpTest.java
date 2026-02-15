package com.gymcore.backend.modules.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.AuthService.EmailVerificationTokenRecord;
import com.gymcore.backend.modules.auth.service.AuthService.UserRecord;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

class AuthServiceRegisterOtpTest {

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
    void startRegistration_shouldRejectShortPassword() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.startRegistration("Nguyễn Văn A", "a@gymcore.local", "0900123456", "123", "123"));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void startRegistration_shouldRejectPasswordMismatch() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.startRegistration("Nguyễn Văn A", "a@gymcore.local", "0900123456", "secret123", "secret124"));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void startRegistration_shouldRejectWhenEmailAlreadyVerified() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerUserVerified());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.startRegistration("Nguyễn Văn A", "customer@gymcore.local", "0900123456", "secret123", "secret123"));
        assertEquals(HttpStatus.CONFLICT.value(), ex.getStatusCode().value());
    }

    @Test
    void startRegistration_shouldRejectWhenEmailBelongsToStaff() {
        UserRecord coach = new UserRecord(
                2, 2, "Coach", "COACH",
                "Coach", "coach@gymcore.local", "0900123456", "$2a$hash",
                false, true, false,
                null, null
        );
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(coach);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.startRegistration("Nguyễn Văn A", "coach@gymcore.local", "0900123456", "secret123", "secret123"));
        assertEquals(HttpStatus.CONFLICT.value(), ex.getStatusCode().value());
    }

    @Test
    void startRegistration_shouldInsertUserProfileAndSendOtp_forNewUser() {
        // No existing user.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenThrow(new EmptyResultDataAccessException(1));

        when(jdbcTemplate.queryForObject(contains("FROM dbo.Roles"), eq(Integer.class), any()))
                .thenReturn(1);

        when(passwordEncoder.encode(anyString())).thenReturn("$hash");

        // Insert user returns new user id.
        when(jdbcTemplate.update(any(), any(KeyHolder.class))).thenAnswer(invocation -> {
            KeyHolder keyHolder = invocation.getArgument(1);
            keyHolder.getKeyList().add(Map.of("UserID", 100));
            return 1;
        });

        // Customer profile does not exist.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Customers"), eq(Integer.class), eq(100)))
                .thenReturn(0);

        Map<String, Object> result = authService.startRegistration(
                "Nguyễn Văn A",
                "  NEW@GymCore.Local ",
                "0900123456",
                "secret123",
                "secret123"
        );

        assertEquals("new@gymcore.local", result.get("email"));
        assertEquals(120L, result.get("expiresInSeconds"));
        assertEquals(5L, result.get("resendCooldownSeconds"));

        verify(authMailService).sendRegisterOtp(eq("new@gymcore.local"), eq("Nguyễn Văn A"), anyString(), eq(120L));
    }

    @Test
    void resendRegisterOtp_shouldEnforceCooldown() {
        UserRecord pending = customerUserUnverified();
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(pending);

        EmailVerificationTokenRecord token = new EmailVerificationTokenRecord(
                1, "$otpHash", Instant.now().plusSeconds(60), Instant.now().plusSeconds(3));
        when(jdbcTemplate.queryForObject(contains("FROM dbo.EmailVerificationTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(token);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.resendRegisterOtp("customer@gymcore.local"));
        assertEquals(429, ex.getStatusCode().value());
    }

    @Test
    void resendRegisterOtp_shouldInvalidateOldAndSendNewOtp() {
        UserRecord pending = customerUserUnverified();
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(pending);

        EmailVerificationTokenRecord token = new EmailVerificationTokenRecord(
                1, "$otpHash", Instant.now().plusSeconds(60), Instant.now().minusSeconds(1));
        when(jdbcTemplate.queryForObject(contains("FROM dbo.EmailVerificationTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(token);

        when(passwordEncoder.encode(anyString())).thenReturn("$otpHash");

        Map<String, Object> result = authService.resendRegisterOtp("customer@gymcore.local");
        assertEquals("customer@gymcore.local", result.get("email"));

        verify(authMailService).sendRegisterOtp(eq("customer@gymcore.local"), anyString(), anyString(), eq(120L));
    }

    @Test
    void verifyRegisterOtp_shouldRejectWhenNoOtpExists() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerUserUnverified());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.EmailVerificationTokens"), any(RowMapper.class), eq(1)))
                .thenThrow(new EmptyResultDataAccessException(1));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.verifyRegisterOtp("customer@gymcore.local", "123456"));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void verifyRegisterOtp_shouldRejectExpiredOtp() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerUserUnverified());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.EmailVerificationTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(new EmailVerificationTokenRecord(1, "$otpHash", Instant.now().minusSeconds(1), Instant.now()));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.verifyRegisterOtp("customer@gymcore.local", "123456"));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void verifyRegisterOtp_shouldRejectWrongOtp() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerUserUnverified());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.EmailVerificationTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(new EmailVerificationTokenRecord(1, "$otpHash", Instant.now().plusSeconds(60), Instant.now()));
        when(passwordEncoder.matches(eq("123456"), anyString())).thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.verifyRegisterOtp("customer@gymcore.local", " 123456 "));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void verifyRegisterOtp_shouldMarkVerifiedAndSendWelcome() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerUserUnverified());
        when(jdbcTemplate.queryForObject(contains("FROM dbo.EmailVerificationTokens"), any(RowMapper.class), eq(1)))
                .thenReturn(new EmailVerificationTokenRecord(1, "$otpHash", Instant.now().plusSeconds(60), Instant.now()));
        when(passwordEncoder.matches(eq("123456"), anyString())).thenReturn(true);

        Map<String, Object> result = authService.verifyRegisterOtp("customer@gymcore.local", "123456");
        assertEquals(true, result.get("verified"));

        verify(authMailService).sendWelcomeEmail(eq("customer@gymcore.local"), anyString());
    }

    @Test
    void verifyRegisterOtp_shouldReturnVerifiedWhenAlreadyVerified() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(customerUserVerified());

        Map<String, Object> result = authService.verifyRegisterOtp("customer@gymcore.local", "123456");
        assertEquals(true, result.get("verified"));

        verify(jdbcTemplate, never()).queryForObject(contains("FROM dbo.EmailVerificationTokens"), any(RowMapper.class), any());
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private UserRecord customerUserUnverified() {
        return new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyễn Văn Minh", "customer@gymcore.local", "0900123456", "$2a$hash",
                false, true, false,
                null, null
        );
    }

    private UserRecord customerUserVerified() {
        return new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyễn Văn Minh", "customer@gymcore.local", "0900123456", "$2a$hash",
                false, true, true,
                null, null
        );
    }
}
