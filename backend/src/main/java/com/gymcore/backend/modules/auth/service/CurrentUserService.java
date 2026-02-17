package com.gymcore.backend.modules.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Locale;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.auth.jwt.secret}")
    private String jwtSecret;

    private SecretKey jwtSigningKey;

    public CurrentUserService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @jakarta.annotation.PostConstruct
    void initializeJwtKey() {
        byte[] keyMaterial = jwtSecret == null ? new byte[0] : jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (keyMaterial.length < 32) {
            keyMaterial = sha256(keyMaterial);
        }
        this.jwtSigningKey = Keys.hmacShaKeyFor(keyMaterial);
    }

    public UserInfo requireCustomer(String authorizationHeader) {
        UserInfo user = requireUser(authorizationHeader);
        if (!"CUSTOMER".equals(user.roleApiName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Customer role is required.");
        }
        return user;
    }

    public UserInfo requireAdmin(String authorizationHeader) {
        UserInfo user = requireUser(authorizationHeader);
        if (!"ADMIN".equals(user.roleApiName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role is required.");
        }
        return user;
    }

    public UserInfo requireUser(String authorizationHeader) {
        int userId = parseUserIdFromAccessToken(authorizationHeader);
        return loadUserInfo(userId);
    }

    private int parseUserIdFromAccessToken(String authorizationHeader) {
        String token = extractBearerToken(authorizationHeader);
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(jwtSigningKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            if (claims.getExpiration() != null && claims.getExpiration().toInstant().isBefore(Instant.now())) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Access token has expired.");
            }
            return Integer.parseInt(claims.getSubject());
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Access token is invalid.");
        }
    }

    private UserInfo loadUserInfo(int userId) {
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT TOP (1) u.UserID, r.RoleName
                    FROM dbo.Users u
                    JOIN dbo.Roles r ON r.RoleID = u.RoleID
                    WHERE u.UserID = ?
                    """, (rs, rowNum) -> {
                int id = rs.getInt("UserID");
                String dbRoleName = rs.getString("RoleName");
                String apiRole = normalizeRoleName(dbRoleName);
                return new UserInfo(id, dbRoleName, apiRole);
            }, userId);
        } catch (org.springframework.dao.EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found.");
        }
    }

    private String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization header is required.");
        }
        String normalized = authorizationHeader.trim();
        if (!normalized.regionMatches(true, 0, "Bearer ", 0, 7)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization header must use Bearer token.");
        }
        return normalized.substring(7).trim();
    }

    private String normalizeRoleName(String roleName) {
        if (roleName == null) {
            return "CUSTOMER";
        }
        return roleName.trim().replace(' ', '_').toUpperCase(Locale.ROOT);
    }

    private byte[] sha256(byte[] value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(value);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    public record UserInfo(int userId, String roleDbName, String roleApiName) {
    }
}

