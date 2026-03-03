package com.gymcore.backend.modules.auth.service;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.AuthService.UserRecord;
import java.lang.reflect.Field;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
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

class AuthServiceGoogleAutoCreateTest {

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
        setField(authService, "googleClientId", "client");
        setField(authService, "otpExpirySeconds", 120L);
        setField(authService, "otpResendCooldownSeconds", 5L);

        authService.initializeJwtKey();
    }

    @Test
    void loginWithGoogle_unknownEmail_shouldAutoCreateCustomer() {
        when(restTemplate.getForObject(contains("tokeninfo"), any(), anyString()))
                .thenReturn(Map.of(
                        "aud", "client",
                        "email", "newuser@gmail.com",
                        "sub", "sub-new-123",
                        "email_verified", "true",
                        "name", "Alex Carter"
                ));

        // No existing provider link.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.UserAuthProviders"), any(RowMapper.class), any(), any()))
                .thenThrow(new EmptyResultDataAccessException(1));

        // No user by email.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), eq("newuser@gmail.com")))
                .thenThrow(new EmptyResultDataAccessException(1));

        // Get role id for Customer.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Roles"), eq(Integer.class), any()))
                .thenReturn(1);

        // Insert User + insert RefreshToken (both use KeyHolder). Return keys in order.
        AtomicInteger keyInsertCounter = new AtomicInteger(0);
        when(jdbcTemplate.update(any(), any(KeyHolder.class))).thenAnswer(invocation -> {
            KeyHolder keyHolder = invocation.getArgument(1);
            int step = keyInsertCounter.getAndIncrement();
            if (step == 0) {
                keyHolder.getKeyList().add(Map.of("UserID", 101));
            } else {
                keyHolder.getKeyList().add(Map.of("RefreshTokenID", 201));
            }
            return 1;
        });

        // Customer profile missing -> insert.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Customers"), eq(Integer.class), eq(101)))
                .thenReturn(0);

        // After creation, service loads user by id.
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), eq(101)))
                .thenReturn(new UserRecord(
                        101, 1, "Customer", "CUSTOMER",
                        "Alex Carter", "newuser@gmail.com", null, null,
                        false, true, true,
                        null, null
                ));

        // Provider upsert count=0 -> insert.
        when(jdbcTemplate.queryForObject(contains("SELECT COUNT(1)\n                FROM dbo.UserAuthProviders"), any(Class.class), any(), any()))
                .thenReturn(0);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.USER_AGENT, "JUnit");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Map<String, Object> result = authService.loginWithGoogle("id-token", request, response);
        assertNotNull(result.get("accessToken"));
        assertTrue(String.valueOf(response.getHeader(HttpHeaders.SET_COOKIE)).contains("gymcore_refresh_token="));

        // Ensure it attempted to create the customer profile.
        verify(jdbcTemplate).update(contains("INSERT INTO dbo.Customers"), eq(101));
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
