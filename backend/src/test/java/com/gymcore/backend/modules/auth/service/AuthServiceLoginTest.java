package com.gymcore.backend.modules.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.AuthService.RefreshTokenRecord;
import com.gymcore.backend.modules.auth.service.AuthService.UserRecord;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

class AuthServiceLoginTest {

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

        // Call @PostConstruct manually for unit tests.
        authService.initializeJwtKey();
    }

    @Test
    void loginWithPassword_shouldRejectMissingUser() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any(Object[].class)))
                .thenThrow(new EmptyResultDataAccessException(1));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithPassword("nope@gymcore.local", "x", request, response));
        assertEquals(401, ex.getStatusCode().value());
    }

    @Test
    void loginWithPassword_shouldRejectUnverifiedEmail() {
        stubUserLookup(customerUser(false, true, false, "$2a$hash"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithPassword("customer@gymcore.local", "secret123", request, response));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void loginWithPassword_shouldRejectLockedAccount() {
        stubUserLookup(customerUser(true, true, true, "$2a$hash"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithPassword("customer@gymcore.local", "secret123", request, response));
        assertEquals(423, ex.getStatusCode().value());
    }

    @Test
    void loginWithPassword_shouldRejectInactiveAccount() {
        stubUserLookup(customerUser(true, false, false, "$2a$hash"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithPassword("customer@gymcore.local", "secret123", request, response));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void loginWithPassword_shouldRejectGoogleOnlyAccountWithoutPasswordHash() {
        stubUserLookup(customerUser(true, true, false, null));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithPassword("customer@gymcore.local", "secret123", request, response));
        assertEquals(401, ex.getStatusCode().value());
    }

    @Test
    void loginWithPassword_shouldRejectWrongPassword() {
        stubUserLookup(customerUser(true, true, false, "$2a$hash"));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithPassword("customer@gymcore.local", "wrong", request, response));
        assertEquals(401, ex.getStatusCode().value());
    }

    @Test
    void loginWithPassword_shouldTrimAndLowercaseEmail_withWhitespaceAndMixedCaseEmail() {
        // IME/typing on some input methods often leaves accidental whitespace.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), eq("customer@gymcore.local")))
                .thenReturn(customerUser(true, true, false, "$2a$hash"));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
        when(jdbcTemplate.update(any(), any(KeyHolder.class))).thenAnswer(invocation -> {
            KeyHolder keyHolder = invocation.getArgument(1);
            keyHolder.getKeyList().add(Map.of("RefreshTokenID", 123));
            return 1;
        });

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.USER_AGENT, "JUnit");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Map<String, Object> result = authService.loginWithPassword("  CUSTOMER@GYMCORE.LOCAL  ", "secret123", request, response);
        assertNotNull(result.get("accessToken"));

        verify(jdbcTemplate).queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), eq("customer@gymcore.local"));
    }

    @Test
    void loginWithPassword_shouldAcceptUnicodePassword_withUnicodeCharacters() {
        stubUserLookup(customerUser(true, true, false, "$2a$hash"));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
        when(jdbcTemplate.update(any(), any(KeyHolder.class))).thenAnswer(invocation -> {
            KeyHolder keyHolder = invocation.getArgument(1);
            keyHolder.getKeyList().add(Map.of("RefreshTokenID", 123));
            return 1;
        });

        String unicodePassword = "Password１２３!";
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.USER_AGENT, "JUnit");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Map<String, Object> result = authService.loginWithPassword("customer@gymcore.local", unicodePassword, request, response);
        assertNotNull(result.get("accessToken"));

        verify(passwordEncoder).matches(eq(unicodePassword), anyString());
    }

    @Test
    void loginWithPassword_shouldSetRefreshCookieAndReturnAccessToken() {
        stubUserLookup(customerUser(true, true, false, "$2a$hash"));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        // Simulate DB returning generated RefreshTokenID.
        when(jdbcTemplate.update(any(), any(KeyHolder.class))).thenAnswer(invocation -> {
            KeyHolder keyHolder = invocation.getArgument(1);
            // Make getKey() work by adding a generated key map.
            keyHolder.getKeyList().add(Map.of("RefreshTokenID", 123));
            return 1;
        });

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.USER_AGENT, "JUnit");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Map<String, Object> result = authService.loginWithPassword("customer@gymcore.local", "secret123", request, response);

        assertNotNull(result.get("accessToken"));
        String setCookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertNotNull(setCookie);
        assertTrue(setCookie.contains("gymcore_refresh_token="));
        assertTrue(setCookie.toLowerCase().contains("httponly"));
    }

    @Test
    void refreshSession_shouldRejectMissingCookie() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.refreshSession(request, response));
        assertEquals(401, ex.getStatusCode().value());
    }

    @Test
    void refreshSession_shouldRejectInvalidToken() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.UserRefreshTokens"), any(RowMapper.class), any()))
                .thenThrow(new EmptyResultDataAccessException(1));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("gymcore_refresh_token", "invalid"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.refreshSession(request, response));
        assertEquals(401, ex.getStatusCode().value());
    }

    @Test
    void refreshSession_shouldRejectExpiredOrRevokedToken() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.UserRefreshTokens"), any(RowMapper.class), any()))
                .thenReturn(new RefreshTokenRecord(10, 1, Instant.now().minusSeconds(10), null));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("gymcore_refresh_token", "expired"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.refreshSession(request, response));
        assertEquals(401, ex.getStatusCode().value());
    }

    @Test
    void refreshSession_shouldRejectRevokedToken() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.UserRefreshTokens"), any(RowMapper.class), any()))
                .thenReturn(new RefreshTokenRecord(10, 1, Instant.now().plusSeconds(3600), Instant.now()));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("gymcore_refresh_token", "revoked"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.refreshSession(request, response));
        assertEquals(401, ex.getStatusCode().value());
    }

    @Test
    void refreshSession_shouldRejectWhenUserLocked() {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.UserRefreshTokens"), any(RowMapper.class), any()))
                .thenReturn(new RefreshTokenRecord(10, 1, Instant.now().plusSeconds(3600), null));
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(customerUser(true, true, true, "$2a$hash"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("gymcore_refresh_token", "ok"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.refreshSession(request, response));
        assertEquals(423, ex.getStatusCode().value());
    }

    @Test
    void refreshSession_shouldRotateTokenAndSetCookie() {
        String rawRefresh = "refresh-token-raw";

        // Current refresh token exists + not revoked + not expired.
        RefreshTokenRecord current = new RefreshTokenRecord(10, 1, Instant.now().plusSeconds(3600), null);
        UserRecord user = customerUser(true, true, false, "$2a$hash");

        // JdbcTemplate has overloads; keep matchers broad to avoid varargs casting issues.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.UserRefreshTokens"), any(RowMapper.class), any()))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(user);

        // Insert new refresh token key.
        when(jdbcTemplate.update(any(), any(KeyHolder.class))).thenAnswer(invocation -> {
            KeyHolder keyHolder = invocation.getArgument(1);
            keyHolder.getKeyList().add(Map.of("RefreshTokenID", 11));
            return 1;
        });

        // Revoke old refresh token.
        when(jdbcTemplate.update(contains("UPDATE dbo.UserRefreshTokens"), any(), any())).thenReturn(1);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("gymcore_refresh_token", rawRefresh));
        request.addHeader(HttpHeaders.USER_AGENT, "JUnit");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Map<String, Object> result = authService.refreshSession(request, response);
        assertNotNull(result.get("accessToken"));

        String setCookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertNotNull(setCookie);
        assertTrue(setCookie.contains("gymcore_refresh_token="));
    }

    @Test
    void logout_shouldAlwaysClearRefreshCookie() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        Map<String, Object> result = authService.logout(request, response);
        assertEquals(true, result.get("loggedOut"));

        String setCookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertNotNull(setCookie);
        assertTrue(setCookie.contains("gymcore_refresh_token="));
        assertTrue(setCookie.toLowerCase().contains("max-age=0"));
    }

    @Test
    void loginWithGoogle_shouldRejectWhenNotConfigured() {
        setQuietField(authService, "googleClientId", "");
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithGoogle("token", request, response));
        assertEquals(503, ex.getStatusCode().value());
    }

    @Test
    void loginWithGoogle_existingAdminAccount_shouldReject() {
        setQuietField(authService, "googleClientId", "client");
        when(restTemplate.getForObject(contains("tokeninfo"), any(), anyString()))
                .thenReturn(Map.of(
                        "aud", "client",
                        "email", "admin@gymcore.local",
                        "sub", "sub123",
                        "email_verified", "true",
                        "name", "Admin"
                ));
        when(jdbcTemplate.queryForObject(contains("FROM dbo.UserAuthProviders"), any(RowMapper.class), any(), any()))
                .thenThrow(new EmptyResultDataAccessException(1));
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        99, 4, "Admin", "ADMIN",
                        "Admin", "admin@gymcore.local", null, null,
                        false, true, true,
                        null, null
                ));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.loginWithGoogle("token", request, response));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void loginWithGoogle_existingCoachAccount_shouldSucceedAndSetCookie() {
        setQuietField(authService, "googleClientId", "client");
        when(restTemplate.getForObject(contains("tokeninfo"), any(), anyString()))
                .thenReturn(Map.of(
                        "aud", "client",
                        "email", "coach@gymcore.local",
                        "sub", "sub123",
                        "email_verified", "true",
                        "name", "Coach Alex"
                ));

        // No existing provider link.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.UserAuthProviders"), any(RowMapper.class), any(), any()))
                .thenThrow(new EmptyResultDataAccessException(1));

        // Find by email returns coach user (not verified yet).
        UserRecord coach = new UserRecord(
                2, 2, "Coach", "COACH",
                "Coach Alex", "coach@gymcore.local", "0900123456", null,
                false, true, false,
                null, null
        );
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(coach);

        // After marking verified, service reloads by user id.
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        2, 2, "Coach", "COACH",
                        "Coach Alex", "coach@gymcore.local", "0900123456", null,
                        false, true, true,
                        null, null
                ));

        // Upsert provider: count=0 -> insert.
        when(jdbcTemplate.queryForObject(contains("SELECT COUNT(1)\n                FROM dbo.UserAuthProviders"), any(Class.class), any(), any()))
                .thenReturn(0);

        // Refresh token insert.
        when(jdbcTemplate.update(any(), any(KeyHolder.class))).thenAnswer(invocation -> {
            KeyHolder keyHolder = invocation.getArgument(1);
            keyHolder.getKeyList().add(Map.of("RefreshTokenID", 200));
            return 1;
        });

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.USER_AGENT, "JUnit");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Map<String, Object> result = authService.loginWithGoogle("token", request, response);
        assertNotNull(result.get("accessToken"));

        String setCookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertNotNull(setCookie);
        assertTrue(setCookie.contains("gymcore_refresh_token="));
    }

    private void stubUserLookup(UserRecord user) {
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any(Object[].class)))
                .thenReturn(user);
    }

    private UserRecord customerUser(boolean emailVerified, boolean active, boolean locked, String passwordHash) {
        return new UserRecord(
                1,
                1,
                "Customer",
                "CUSTOMER",
                "Jordan Miles",
                "customer@gymcore.local",
                "0900123456",
                passwordHash,
                locked,
                active,
                emailVerified,
                null, null
        );
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static void setQuietField(Object target, String fieldName, Object value) {
        try {
            setField(target, fieldName, value);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String hashOpaque(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
