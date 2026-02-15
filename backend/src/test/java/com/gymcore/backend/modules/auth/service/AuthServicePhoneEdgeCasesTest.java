package com.gymcore.backend.modules.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gymcore.backend.modules.auth.service.AuthService.UserRecord;
import java.lang.reflect.Field;
import java.sql.Date;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.client.RestTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class AuthServicePhoneEdgeCasesTest {

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
    void updateProfile_shouldAcceptFormattedPhoneAndStoreDigits() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        UserRecord current = new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyễn Văn Minh", "customer@gymcore.local", null, "$2a$hash",
                false, true, true,
                null, null
        );

        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), org.mockito.ArgumentMatchers.eq(1)))
                .thenReturn(current);

        when(jdbcTemplate.queryForObject(contains("FROM dbo.Customers"), org.mockito.ArgumentMatchers.eq(Integer.class), org.mockito.ArgumentMatchers.eq(1)))
                .thenReturn(1);
        when(jdbcTemplate.queryForMap(contains("FROM dbo.Customers"), org.mockito.ArgumentMatchers.eq(1)))
                .thenReturn(Map.of("DateOfBirth", Date.valueOf("2000-01-02"), "Gender", "Male"));

        authService.updateProfile("Bearer " + token, "Nguyễn Văn Minh", "(090) 567-5437", "2000-01-02", "Male");

        verify(jdbcTemplate).update(
                contains("UPDATE dbo.Users"),
                org.mockito.ArgumentMatchers.eq("Nguyễn Văn Minh"),
                org.mockito.ArgumentMatchers.eq("0905675437"),
                org.mockito.ArgumentMatchers.eq(1)
        );
    }

    @Test
    void updateProfile_shouldAcceptPlusPrefixedPhone() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        UserRecord current = new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyễn Văn Minh", "customer@gymcore.local", null, "$2a$hash",
                false, true, true,
                null, null
        );
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), org.mockito.ArgumentMatchers.eq(1)))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Customers"), org.mockito.ArgumentMatchers.eq(Integer.class), org.mockito.ArgumentMatchers.eq(1)))
                .thenReturn(1);
        when(jdbcTemplate.queryForMap(contains("FROM dbo.Customers"), org.mockito.ArgumentMatchers.eq(1)))
                .thenReturn(Map.of());

        authService.updateProfile("Bearer " + token, "Nguyễn Văn Minh", "+84905675437", null, null);

        verify(jdbcTemplate).update(
                contains("UPDATE dbo.Users"),
                org.mockito.ArgumentMatchers.eq("Nguyễn Văn Minh"),
                org.mockito.ArgumentMatchers.eq("+84905675437"),
                org.mockito.ArgumentMatchers.eq(1)
        );
    }

    @Test
    void updateProfile_shouldTreatWhitespacePhoneAsNull() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        UserRecord current = new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyá»…n VÄƒn Minh", "customer@gymcore.local", null, "$2a$hash",
                false, true, true,
                null, null
        );

        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), eq(1)))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Customers"), eq(Integer.class), eq(1)))
                .thenReturn(1);
        when(jdbcTemplate.queryForMap(contains("FROM dbo.Customers"), eq(1)))
                .thenReturn(Map.of());

        authService.updateProfile("Bearer " + token, "Nguyá»…n VÄƒn Minh", "    ", null, null);

        verify(jdbcTemplate).update(
                contains("UPDATE dbo.Users"),
                eq("Nguyá»…n VÄƒn Minh"),
                eq(null),
                eq(1)
        );
    }

    @Test
    void updateProfile_shouldAcceptBoundaryPhoneLengths_8_and_15_digits() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        UserRecord current = new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyá»…n VÄƒn Minh", "customer@gymcore.local", null, "$2a$hash",
                false, true, true,
                null, null
        );

        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), eq(1)))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Customers"), eq(Integer.class), eq(1)))
                .thenReturn(1);
        when(jdbcTemplate.queryForMap(contains("FROM dbo.Customers"), eq(1)))
                .thenReturn(Map.of());

        authService.updateProfile("Bearer " + token, "Nguyá»…n VÄƒn Minh", "12345678", null, null);
        authService.updateProfile("Bearer " + token, "Nguyá»…n VÄƒn Minh", "123456789012345", null, null);

        verify(jdbcTemplate).update(
                contains("UPDATE dbo.Users"),
                eq("Nguyá»…n VÄƒn Minh"),
                eq("12345678"),
                eq(1)
        );
        verify(jdbcTemplate).update(
                contains("UPDATE dbo.Users"),
                eq("Nguyá»…n VÄƒn Minh"),
                eq("123456789012345"),
                eq(1)
        );
    }

    @Test
    void updateProfile_shouldAcceptPlusPhoneWithSpacesAndDashes() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        UserRecord current = new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyá»…n VÄƒn Minh", "customer@gymcore.local", null, "$2a$hash",
                false, true, true,
                null, null
        );

        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), eq(1)))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Customers"), eq(Integer.class), eq(1)))
                .thenReturn(1);
        when(jdbcTemplate.queryForMap(contains("FROM dbo.Customers"), eq(1)))
                .thenReturn(Map.of());

        authService.updateProfile("Bearer " + token, "Nguyá»…n VÄƒn Minh", "  +84 (905) 675-437  ", null, null);

        verify(jdbcTemplate).update(
                contains("UPDATE dbo.Users"),
                eq("Nguyá»…n VÄƒn Minh"),
                eq("+84905675437"),
                eq(1)
        );
    }

    @Test
    void updateProfile_shouldAcceptFullwidthDigitsAndStoreAscii() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        UserRecord current = new UserRecord(
                1, 1, "Customer", "CUSTOMER",
                "Nguyá»…n VÄƒn Minh", "customer@gymcore.local", null, "$2a$hash",
                false, true, true,
                null, null
        );

        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), eq(1)))
                .thenReturn(current);
        when(jdbcTemplate.queryForObject(contains("FROM dbo.Customers"), eq(Integer.class), eq(1)))
                .thenReturn(1);
        when(jdbcTemplate.queryForMap(contains("FROM dbo.Customers"), eq(1)))
                .thenReturn(Map.of());

        authService.updateProfile("Bearer " + token, "Nguyá»…n VÄƒn Minh", "０９０５６７５４３７", null, null);

        verify(jdbcTemplate).update(
                contains("UPDATE dbo.Users"),
                eq("Nguyá»…n VÄƒn Minh"),
                eq("0905675437"),
                eq(1)
        );
    }

    @Test
    void updateProfile_shouldRejectEmojiInPhone() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        1, 1, "Customer", "CUSTOMER",
                        "Nguyá»…n VÄƒn Minh", "customer@gymcore.local", null, "$2a$hash",
                        false, true, true,
                        null, null
                ));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.updateProfile("Bearer " + token, "Nguyá»…n VÄƒn Minh", "090😊5675437", null, null));
        assertEquals(400, ex.getStatusCode().value());

        verify(jdbcTemplate, never()).update(contains("UPDATE dbo.Users"), any(), any(), any());
    }

    @Test
    void updateProfile_shouldRejectTooLongPhone() {
        String token = JwtTestUtil.accessTokenForUserId(1, "this-is-a-test-jwt-secret-at-least-32-chars!!");
        when(jdbcTemplate.queryForObject(contains("WHERE u.UserID"), any(RowMapper.class), any()))
                .thenReturn(new UserRecord(
                        1, 1, "Customer", "CUSTOMER",
                        "Nguyễn Văn Minh", "customer@gymcore.local", null, "$2a$hash",
                        false, true, true,
                        null, null
                ));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.updateProfile("Bearer " + token, "Nguyễn Văn Minh", "+1234567890123456", null, null));
        assertEquals(400, ex.getStatusCode().value());

        verify(jdbcTemplate, never()).update(contains("UPDATE dbo.Users"), any(), any(), any());
    }

    @Test
    void getMyQrToken_shouldRejectMissingAuthorizationHeader() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                authService.getMyQrToken(null));
        assertEquals(401, ex.getStatusCode().value());
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
