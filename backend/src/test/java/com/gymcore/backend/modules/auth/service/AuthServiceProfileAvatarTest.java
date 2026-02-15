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

import com.gymcore.backend.modules.auth.service.AuthService.UserRecord;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Date;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

class AuthServiceProfileAvatarTest {

    private JdbcTemplate jdbcTemplate;
    private PasswordEncoder passwordEncoder;
    private AuthMailService authMailService;
    private RestTemplate restTemplate;
    private AuthService authService;

    @TempDir
    Path tempDir;

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
        setField(authService, "avatarDir", tempDir.resolve("avatars").toString());
        setField(authService, "avatarMaxBytes", 1024L);

        authService.initializeJwtKey();
    }

    @Test
    void updateProfile_shouldUpdateCustomerDemographics() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        UserRecord current = new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyễn Văn Minh", "customer@gymcore.local", "0900123456", "$2a$hash",
                false, true, true,
                null, null
        );

        // requireUserFromAccessToken + requireUserById
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(current);

        // ensureCustomerProfile (count=1, already exists)
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Customers"), eq(Integer.class), eq(1)))
                .thenReturn(1);

        // loadDemographics after update
        when(jdbcTemplate.queryForMap(contains("FROM dbo.Customers"), eq(1)))
                .thenReturn(Map.of("DateOfBirth", Date.valueOf("2000-01-02"), "Gender", "Male"));

        Map<String, Object> result = authService.updateProfile("Bearer " + token, "Nguyễn Văn Minh", "0900123456", "2000-01-02", "Male");
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) result.get("user");

        assertEquals("2000-01-02", user.get("dateOfBirth"));
        assertEquals("Male", user.get("gender"));

        verify(jdbcTemplate).update(contains("UPDATE dbo.Customers"), eq(Date.valueOf("2000-01-02")), eq("Male"), eq(1));
    }

    @Test
    void updateProfile_shouldRejectInvalidDateOfBirth() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        1, 1, "Customer", "CUSTOMER",
                        "Nguyễn Văn Minh", "customer@gymcore.local", "0900123456", "$2a$hash",
                        false, true, true,
                        null, null
                ));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.updateProfile("Bearer " + token, "Nguyễn Văn Minh", "0900123456", "02-01-2000", "Male"));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void updateProfile_shouldRejectInvalidPhone() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        1, 1, "Customer", "CUSTOMER",
                        "Nguyá»…n VÄƒn Minh", "customer@gymcore.local", "0900123456", "$2a$hash",
                        false, true, true,
                        null, null
                ));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.updateProfile("Bearer " + token, "Nguyá»…n VÄƒn Minh", "abc", null, null));
        assertEquals(400, ex.getStatusCode().value());

        verify(jdbcTemplate, never()).update(contains("UPDATE dbo.Users"), any(), any(), any());
    }

    @Test
    void updateProfile_shouldUpdateCoachDemographics() {
        String token = JwtTestUtil.accessTokenForUserId(2, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        UserRecord coach = new UserRecord(
                2, 2, "Coach", "COACH",
                "Trần Minh Huy", "coach@gymcore.local", "0900123456", null,
                false, true, true,
                null, null
        );

        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(coach);

        when(jdbcTemplate.queryForObject(contains("FROM dbo.Coaches"), eq(Integer.class), eq(2)))
                .thenReturn(1);

        when(jdbcTemplate.queryForMap(contains("FROM dbo.Coaches"), eq(2)))
                .thenReturn(Map.of("DateOfBirth", Date.valueOf("1998-01-01"), "Gender", "Male"));

        Map<String, Object> result = authService.updateProfile("Bearer " + token, "Trần Minh Huy", "0900123456", "1998-01-01", "Male");
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) result.get("user");

        assertEquals("1998-01-01", user.get("dateOfBirth"));
        assertEquals("Male", user.get("gender"));
        verify(jdbcTemplate).update(contains("UPDATE dbo.Coaches"), eq(Date.valueOf("1998-01-01")), eq("Male"), eq(2));
    }

    @Test
    void uploadAvatar_shouldStoreFileAndUpdateUser() throws Exception {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        UserRecord current = new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyễn Văn Minh", "customer@gymcore.local", "0900123456", "$2a$hash",
                false, true, true,
                null, null
        );

        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(current);

        // After avatar update, service reloads user by id again.
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), eq(1)))
                .thenReturn(new UserRecord(
                        1, 1, "Customer", "CUSTOMER",
                        "Nguyễn Văn Minh", "customer@gymcore.local", "0900123456", "$2a$hash",
                        false, true, true,
                        "/uploads/avatars/1/avatar.png", "CUSTOM"
                ));

        byte[] png = new byte[]{
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x00, 0x00
        };
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", png);

        Map<String, Object> result = authService.uploadAvatar("Bearer " + token, file);
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) result.get("user");
        assertEquals("CUSTOM", user.get("avatarSource"));
        assertTrue(String.valueOf(user.get("avatarUrl")).startsWith("/uploads/avatars/1/"));

        Path storedFolder = tempDir.resolve("avatars").resolve("1");
        assertTrue(Files.exists(storedFolder));
        try (var paths = Files.list(storedFolder)) {
            assertTrue(paths.anyMatch(p -> p.getFileName().toString().endsWith(".png")));
        }
    }

    @Test
    void uploadAvatar_shouldRejectNonImage() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        1, 1, "Customer", "CUSTOMER",
                        "Nguyễn Văn Minh", "customer@gymcore.local", "0900123456", "$2a$hash",
                        false, true, true,
                        null, null
                ));

        MockMultipartFile file = new MockMultipartFile("file", "x.txt", "text/plain", "not-an-image".getBytes());
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.uploadAvatar("Bearer " + token, file));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void uploadAvatar_shouldRejectTooLarge() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        1, 1, "Customer", "CUSTOMER",
                        "Nguyễn Văn Minh", "customer@gymcore.local", "0900123456", "$2a$hash",
                        false, true, true,
                        null, null
                ));

        byte[] big = new byte[2048];
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", big);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.uploadAvatar("Bearer " + token, file));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void loginWithGoogle_shouldApplyGoogleAvatarWhenNotCustom() {
        when(restTemplate.getForObject(contains("tokeninfo"), any(), anyString()))
                .thenReturn(Map.of(
                        "aud", "client",
                        "email", "coach@gymcore.local",
                        "sub", "sub123",
                        "email_verified", "true",
                        "name", "Coach Alex",
                        "picture", "https://example.com/p.png"
                ));

        when(jdbcTemplate.queryForObject(contains("FROM dbo.UserAuthProviders"), any(RowMapper.class), any(), any()))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));

        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        2, 2, "Coach", "COACH",
                        "Coach Alex", "coach@gymcore.local", "0900123456", null,
                        false, true, true,
                        null, null
                ));

        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), eq(2)))
                .thenReturn(new UserRecord(
                        2, 2, "Coach", "COACH",
                        "Coach Alex", "coach@gymcore.local", "0900123456", null,
                        false, true, true,
                        "https://example.com/p.png", "GOOGLE"
                ));

        when(jdbcTemplate.queryForObject(contains("SELECT COUNT(1)\n                FROM dbo.UserAuthProviders"), any(Class.class), any(), any()))
                .thenReturn(0);

        when(jdbcTemplate.update(any(), any(KeyHolder.class))).thenAnswer(invocation -> {
            KeyHolder keyHolder = invocation.getArgument(1);
            keyHolder.getKeyList().add(Map.of("RefreshTokenID", 200));
            return 1;
        });

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("User-Agent", "JUnit");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Map<String, Object> result = authService.loginWithGoogle("token", request, response);
        assertNotNull(result.get("accessToken"));

        verify(jdbcTemplate).update(contains("AvatarSource = 'GOOGLE'"), eq("https://example.com/p.png"), eq(2));
    }

    @Test
    void loginWithGoogle_shouldNotOverwriteCustomAvatar() {
        when(restTemplate.getForObject(contains("tokeninfo"), any(), anyString()))
                .thenReturn(Map.of(
                        "aud", "client",
                        "email", "coach@gymcore.local",
                        "sub", "sub123",
                        "email_verified", "true",
                        "name", "Coach Alex",
                        "picture", "https://example.com/p.png"
                ));

        // No existing provider link.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.UserAuthProviders"), any(RowMapper.class), any(), any()))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));

        // Find by email returns coach with CUSTOM avatar.
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Users"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        2, 2, "Coach", "COACH",
                        "Coach Alex", "coach@gymcore.local", "0900123456", null,
                        false, true, true,
                        "/uploads/avatars/2/x.png", "CUSTOM"
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
        request.addHeader("User-Agent", "JUnit");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Map<String, Object> result = authService.loginWithGoogle("token", request, response);
        assertNotNull(result.get("accessToken"));

        verify(jdbcTemplate, never()).update(contains("AvatarSource = 'GOOGLE'"), any(), any());
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
