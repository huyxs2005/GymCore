package com.gymcore.backend.modules.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.text.Normalizer;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String REFRESH_COOKIE_NAME = "gymcore_refresh_token";
    private static final String GOOGLE_PROVIDER = "GOOGLE";
    private static final int OTP_LENGTH = 6;
    private static final int MIN_PASSWORD_LENGTH = 8;

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final AuthMailService authMailService;
    private final RestTemplate restTemplate;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.auth.jwt.secret}")
    private String jwtSecret;

    @Value("${app.auth.access-token-minutes:15}")
    private long accessTokenMinutes;

    @Value("${app.auth.refresh-token-days:14}")
    private long refreshTokenDays;

    @Value("${app.auth.refresh-cookie-secure:false}")
    private boolean refreshCookieSecure;

    @Value("${app.auth.google-client-id:}")
    private String googleClientId;

    @Value("${app.auth.otp.expiry-seconds:120}")
    private long otpExpirySeconds;

    @Value("${app.auth.otp.resend-cooldown-seconds:5}")
    private long otpResendCooldownSeconds;

    @Value("${app.profile.avatar-dir:uploads/avatars}")
    private String avatarDir;

    @Value("${app.profile.avatar-max-bytes:5242880}")
    private long avatarMaxBytes;

    private SecretKey jwtSigningKey;

    private final RowMapper<UserRecord> userRowMapper = (rs, rowNum) -> toUserRecord(rs);
    private final RowMapper<RefreshTokenRecord> refreshTokenRowMapper = (rs, rowNum) -> toRefreshTokenRecord(rs);
    private final RowMapper<EmailVerificationTokenRecord> emailVerificationTokenRowMapper = (rs,
            rowNum) -> toEmailVerificationTokenRecord(rs);
    private final RowMapper<PasswordResetTokenRecord> passwordResetTokenRowMapper = (rs,
            rowNum) -> toPasswordResetTokenRecord(rs);

    public AuthService(
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder,
            AuthMailService authMailService,
            RestTemplate restTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.authMailService = authMailService;
        this.restTemplate = restTemplate;
    }

    @PostConstruct
    void initializeJwtKey() {
        byte[] keyMaterial = jwtSecret == null ? new byte[0] : jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (keyMaterial.length < 32) {
            keyMaterial = sha256(keyMaterial);
        }
        this.jwtSigningKey = Keys.hmacShaKeyFor(keyMaterial);
    }

    @Transactional
    public Map<String, Object> loginWithPassword(String email, String password, HttpServletRequest request,
            HttpServletResponse response) {
        log.info("Attempting password login for email: {}", email);
        UserRecord user;
        try {
            user = requireUserByEmail(email);
        } catch (ResponseStatusException e) {
            log.warn("Login failed: User not found for email: {}", email);
            throw e;
        }

        try {
            ensureLoginAllowed(user, true);
        } catch (ResponseStatusException e) {
            log.warn("Login failed: Access denied for email: {}. Reason: {}", email, e.getReason());
            throw e;
        }

        if (user.passwordHash == null || user.passwordHash.isBlank()) {
            log.warn("Login failed: Password login not available for account: {}", email);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Password login is not available for this account.");
        }
        if (!passwordEncoder.matches(password, user.passwordHash)) {
            log.warn("Login failed: Invalid password for email: {}", email);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
        }

        log.info("Login successful for email: {}", email);
        return issueSession(user, request, response);
    }

    @Transactional
    public Map<String, Object> loginWithGoogle(String idToken, HttpServletRequest request,
            HttpServletResponse response) {
        GoogleTokenInfo tokenInfo = verifyGoogleIdToken(idToken);

        UserRecord user = findUserByGoogleSub(tokenInfo.sub).orElse(null);
        if (user == null) {
            user = findUserByEmail(tokenInfo.email).orElse(null);
            if (user == null) {
                int customerRoleId = getRoleIdByName("Customer");
                int userId = insertUser(customerRoleId, tokenInfo.displayName(), tokenInfo.email, null, null, true,
                        Instant.now());
                ensureCustomerProfile(userId);
                user = requireUserById(userId);
            } else {
                if ("ADMIN".equals(user.roleApiName)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin accounts cannot use Google login.");
                }
                if (!isGoogleAllowedRole(user.roleApiName)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Google login is not allowed for this role.");
                }
                if (!user.emailVerified) {
                    jdbcTemplate.update(
                            """
                                    UPDATE dbo.Users
                                    SET IsEmailVerified = 1, EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()), UpdatedAt = SYSDATETIME()
                                    WHERE UserID = ?
                                    """,
                            user.userId);
                    user = requireUserById(user.userId);
                }
            }
            upsertGoogleProvider(user.userId, tokenInfo.sub, tokenInfo.email);
        } else {
            if ("ADMIN".equals(user.roleApiName)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin accounts cannot use Google login.");
            }
            if (!isGoogleAllowedRole(user.roleApiName)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Google login is not allowed for this role.");
            }
            if (!normalizeEmail(user.email).equals(tokenInfo.email)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Google account does not match the linked email.");
            }
        }

        // Update avatar from Google unless the user explicitly uploaded a custom
        // avatar.
        if (maybeApplyGoogleAvatar(user, tokenInfo.pictureUrl)) {
            user = requireUserById(user.userId);
        }

        ensureLoginAllowed(user, false);
        return issueSession(user, request, response);
    }

    @Transactional
    public Map<String, Object> refreshSession(HttpServletRequest request, HttpServletResponse response) {
        String rawRefreshToken = extractRefreshCookie(request)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token is missing."));

        RefreshTokenRecord currentToken = findRefreshTokenByHash(hashOpaqueToken(rawRefreshToken))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token is invalid."));
        if (currentToken.revokedAt != null || Instant.now().isAfter(currentToken.expiresAt)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired or revoked.");
        }

        UserRecord user = requireUserById(currentToken.userId);
        ensureLoginAllowed(user, false);

        RefreshIssue nextRefresh = createRefreshToken(user.userId, request);
        jdbcTemplate.update("""
                UPDATE dbo.UserRefreshTokens
                SET RevokedAt = SYSDATETIME(), ReplacedByRefreshTokenID = ?
                WHERE RefreshTokenID = ? AND RevokedAt IS NULL
                """, nextRefresh.refreshTokenId, currentToken.refreshTokenId);

        setRefreshCookie(response, nextRefresh.rawToken, nextRefresh.expiresAt);
        return authPayload(user, createAccessToken(user));
    }

    @Transactional
    public Map<String, Object> logout(HttpServletRequest request, HttpServletResponse response) {
        extractRefreshCookie(request)
                .flatMap(raw -> findRefreshTokenByHash(hashOpaqueToken(raw)))
                .ifPresent(token -> jdbcTemplate.update("""
                        UPDATE dbo.UserRefreshTokens
                        SET RevokedAt = COALESCE(RevokedAt, SYSDATETIME())
                        WHERE RefreshTokenID = ?
                        """, token.refreshTokenId));

        clearRefreshCookie(response);
        return Map.of("loggedOut", true);
    }

    public Map<String, Object> getProfile(String authorizationHeader) {
        UserRecord user = requireUserFromAccessToken(authorizationHeader);
        java.util.Map<String, Object> profile = new java.util.LinkedHashMap<>(userToMap(user));
        profile.putAll(loadDemographics(user));
        return Map.of("user", profile);
    }

    public Map<String, Object> getMyQrToken(String authorizationHeader) {
        UserRecord user = requireUserFromAccessToken(authorizationHeader);
        String token = jdbcTemplate.queryForObject(
                "SELECT QrCodeToken FROM dbo.Users WHERE UserID = ?",
                String.class,
                user.userId);
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "QR token is missing for this user.");
        }
        return Map.of("qrCodeToken", token);
    }

    public AuthContext requireAuthContext(String authorizationHeader) {
        UserRecord user = requireUserFromAccessToken(authorizationHeader);
        ensureLoginAllowed(user, false);
        return new AuthContext(user.userId, user.roleApiName, user.fullName, user.email);
    }

    @Transactional
    public Map<String, Object> updateProfile(
            String authorizationHeader,
            String fullName,
            String phone,
            String dateOfBirth,
            String gender) {
        UserRecord currentUser = requireUserFromAccessToken(authorizationHeader);
        String normalizedName = requireText(fullName, "Full name is required.");
        String normalizedPhone = normalizePhoneOrThrow(phone);
        jdbcTemplate.update("""
                UPDATE dbo.Users
                SET FullName = ?, Phone = ?, UpdatedAt = SYSDATETIME()
                WHERE UserID = ?
                """, normalizedName, normalizedPhone, currentUser.userId);

        UserRecord updated = requireUserById(currentUser.userId);
        updateDemographics(updated, dateOfBirth, gender);
        java.util.Map<String, Object> profile = new java.util.LinkedHashMap<>(userToMap(updated));
        profile.putAll(loadDemographics(updated));
        return Map.of("user", profile);
    }

    @Transactional
    public Map<String, Object> uploadAvatar(String authorizationHeader, MultipartFile file) {
        UserRecord user = requireUserFromAccessToken(authorizationHeader);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Avatar file is required.");
        }
        if (file.getSize() > avatarMaxBytes) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Avatar file is too large.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to read avatar file.");
        }
        if (bytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Avatar file is required.");
        }
        if (bytes.length > avatarMaxBytes) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Avatar file is too large.");
        }

        String extension = detectImageExtension(bytes);
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only JPG, PNG, or WEBP images are allowed.");
        }

        Path baseDir = Paths.get(avatarDir).toAbsolutePath().normalize();
        Path userDir = baseDir.resolve(String.valueOf(user.userId)).normalize();
        if (!userDir.startsWith(baseDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid avatar storage location.");
        }

        try {
            Files.createDirectories(userDir);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to create avatar storage folder.");
        }

        String filename = UUID.randomUUID().toString().replace("-", "") + "." + extension;
        Path storedPath = userDir.resolve(filename).normalize();
        if (!storedPath.startsWith(userDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid avatar file path.");
        }

        try {
            Files.write(storedPath, bytes);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store avatar file.");
        }

        String publicUrl = "/uploads/avatars/" + user.userId + "/" + filename;
        jdbcTemplate.update("""
                UPDATE dbo.Users
                SET AvatarUrl = ?, AvatarSource = 'CUSTOM', UpdatedAt = SYSDATETIME()
                WHERE UserID = ?
                """, publicUrl, user.userId);

        UserRecord updated = requireUserById(user.userId);
        java.util.Map<String, Object> profile = new java.util.LinkedHashMap<>(userToMap(updated));
        profile.putAll(loadDemographics(updated));
        return Map.of("user", profile);
    }

    @Transactional
    public Map<String, Object> changePassword(String authorizationHeader, String oldPassword, String newPassword,
            String confirmPassword) {
        validatePasswordPair(newPassword, confirmPassword);
        UserRecord user = requireUserFromAccessToken(authorizationHeader);
        if (user.passwordHash == null || user.passwordHash.isBlank()
                || !passwordEncoder.matches(oldPassword, user.passwordHash)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is incorrect.");
        }

        jdbcTemplate.update("UPDATE dbo.Users SET PasswordHash = ?, UpdatedAt = SYSDATETIME() WHERE UserID = ?",
                passwordEncoder.encode(newPassword), user.userId);
        revokeAllRefreshTokens(user.userId);
        return Map.of("changed", true);
    }

    private Map<String, Object> issueSession(UserRecord user, HttpServletRequest request,
            HttpServletResponse response) {
        RefreshIssue refreshIssue = createRefreshToken(user.userId, request);
        setRefreshCookie(response, refreshIssue.rawToken, refreshIssue.expiresAt);
        return authPayload(user, createAccessToken(user));
    }

    private Map<String, Object> authPayload(UserRecord user, String accessToken) {
        return Map.of(
                "accessToken", accessToken,
                "tokenType", "Bearer",
                "expiresInSeconds", accessTokenMinutes * 60,
                "landingPath", landingPath(user.roleApiName),
                "user", userToMap(user));
    }

    @Transactional
    public Map<String, Object> startRegistration(String fullName, String email, String phone, String password,
            String confirmPassword) {
        validatePasswordPair(password, confirmPassword);

        String normalizedEmail = normalizeEmail(email);
        String normalizedName = requireText(fullName, "Full name is required.");
        String normalizedPhone = normalizePhoneOrThrow(phone);

        UserRecord existing = findUserByEmail(normalizedEmail).orElse(null);
        if (existing != null && existing.emailVerified) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered.");
        }
        if (existing != null && !"CUSTOMER".equals(existing.roleApiName)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This email belongs to a staff account.");
        }

        int userId;
        if (existing == null) {
            int roleId = getRoleIdByName("Customer");
            userId = insertUser(roleId, normalizedName, normalizedEmail, normalizedPhone,
                    passwordEncoder.encode(password), false, null);
        } else {
            userId = existing.userId;
            jdbcTemplate.update("""
                    UPDATE dbo.Users
                    SET FullName = ?, Phone = ?, PasswordHash = ?, IsActive = 1, IsLocked = 0,
                        LockedAt = NULL, LockReason = NULL, UpdatedAt = SYSDATETIME()
                    WHERE UserID = ?
                    """, normalizedName, normalizedPhone, passwordEncoder.encode(password), userId);
        }

        ensureCustomerProfile(userId);
        invalidatePendingEmailVerificationTokens(userId);

        String otp = generateOtp();
        Instant now = Instant.now();
        insertEmailVerificationToken(
                userId,
                passwordEncoder.encode(otp),
                now.plusSeconds(otpExpirySeconds),
                now.plusSeconds(otpResendCooldownSeconds));
        authMailService.sendRegisterOtp(normalizedEmail, normalizedName, otp, otpExpirySeconds);

        return Map.of(
                "email", normalizedEmail,
                "expiresInSeconds", otpExpirySeconds,
                "resendCooldownSeconds", otpResendCooldownSeconds);
    }

    @Transactional
    public Map<String, Object> resendRegisterOtp(String email) {
        String normalizedEmail = normalizeEmail(email);
        UserRecord user = findUserByEmail(normalizedEmail).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No pending registration was found."));

        if (!"CUSTOMER".equals(user.roleApiName) || user.emailVerified) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No pending registration was found.");
        }

        EmailVerificationTokenRecord pending = findLatestActiveEmailVerificationToken(user.userId).orElse(null);
        if (pending != null && Instant.now().isBefore(pending.resendAvailableAt)) {
            long waitSeconds = Math.max(1, Duration.between(Instant.now(), pending.resendAvailableAt).toSeconds());
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Please wait " + waitSeconds + " second(s) before resending OTP.");
        }

        invalidatePendingEmailVerificationTokens(user.userId);
        String otp = generateOtp();
        Instant now = Instant.now();
        insertEmailVerificationToken(
                user.userId,
                passwordEncoder.encode(otp),
                now.plusSeconds(otpExpirySeconds),
                now.plusSeconds(otpResendCooldownSeconds));
        authMailService.sendRegisterOtp(normalizedEmail, user.fullName, otp, otpExpirySeconds);

        return Map.of(
                "email", normalizedEmail,
                "expiresInSeconds", otpExpirySeconds,
                "resendCooldownSeconds", otpResendCooldownSeconds);
    }

    @Transactional
    public Map<String, Object> verifyRegisterOtp(String email, String otp) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedOtp = requireOtp(otp);

        UserRecord user = findUserByEmail(normalizedEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP or email."));

        if (user.emailVerified) {
            return Map.of("verified", true, "email", normalizedEmail);
        }

        EmailVerificationTokenRecord token = findLatestActiveEmailVerificationToken(user.userId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "OTP not found. Please request a new OTP."));

        if (Instant.now().isAfter(token.expiresAt)) {
            invalidateEmailVerificationToken(token.emailVerificationTokenId);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OTP expired. Please request a new OTP.");
        }
        if (!passwordEncoder.matches(normalizedOtp, token.otpHash)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP.");
        }

        markEmailVerificationTokenUsed(token.emailVerificationTokenId);
        jdbcTemplate.update("""
                UPDATE dbo.Users
                SET IsEmailVerified = 1, EmailVerifiedAt = SYSDATETIME(), UpdatedAt = SYSDATETIME()
                WHERE UserID = ?
                """, user.userId);
        invalidatePendingEmailVerificationTokens(user.userId);
        authMailService.sendWelcomeEmail(normalizedEmail, user.fullName);

        return Map.of("verified", true, "email", normalizedEmail);
    }

    @Transactional
    public Map<String, Object> startForgotPassword(String email) {
        return issueForgotPasswordOtp(email, false);
    }

    @Transactional
    public Map<String, Object> resendForgotPasswordOtp(String email) {
        return issueForgotPasswordOtp(email, true);
    }

    public Map<String, Object> verifyForgotPasswordOtp(String email, String otp) {
        UserRecord user = requireUserByEmail(email);
        PasswordResetTokenRecord token = requireLatestActivePasswordResetToken(user.userId);

        if (Instant.now().isAfter(token.expiresAt)) {
            markPasswordResetTokenUsed(token.passwordResetTokenId);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OTP expired. Please request a new OTP.");
        }
        if (!passwordEncoder.matches(requireOtp(otp), token.tokenHash)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP.");
        }

        return Map.of("verified", true, "email", normalizeEmail(email));
    }

    @Transactional
    public Map<String, Object> resetPasswordWithOtp(String email, String otp, String newPassword,
            String confirmPassword) {
        validatePasswordPair(newPassword, confirmPassword);
        UserRecord user = requireUserByEmail(email);
        PasswordResetTokenRecord token = requireLatestActivePasswordResetToken(user.userId);

        if (Instant.now().isAfter(token.expiresAt)) {
            markPasswordResetTokenUsed(token.passwordResetTokenId);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OTP expired. Please request a new OTP.");
        }
        if (!passwordEncoder.matches(requireOtp(otp), token.tokenHash)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP.");
        }

        jdbcTemplate.update("UPDATE dbo.Users SET PasswordHash = ?, UpdatedAt = SYSDATETIME() WHERE UserID = ?",
                passwordEncoder.encode(newPassword), user.userId);
        markPasswordResetTokenUsed(token.passwordResetTokenId);
        invalidateOtherPasswordResetTokens(user.userId, token.passwordResetTokenId);
        revokeAllRefreshTokens(user.userId);

        return Map.of("reset", true);
    }

    private Map<String, Object> issueForgotPasswordOtp(String email, boolean resend) {
        String normalizedEmail = normalizeEmail(email);
        UserRecord user = findUserByEmail(normalizedEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email not found."));
        ensureLoginAllowed(user, false);

        PasswordResetTokenRecord existing = findLatestActivePasswordResetToken(user.userId).orElse(null);
        if (existing != null) {
            Instant canResendAt = existing.createdAt.plusSeconds(otpResendCooldownSeconds);
            if (Instant.now().isBefore(canResendAt)) {
                long waitSeconds = Math.max(1, Duration.between(Instant.now(), canResendAt).toSeconds());
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Please wait " + waitSeconds + " second(s) before requesting another OTP.");
            }
        }

        invalidateAllActivePasswordResetTokens(user.userId);
        String otp = generateOtp();
        insertPasswordResetToken(user.userId, passwordEncoder.encode(otp), Instant.now().plusSeconds(otpExpirySeconds));
        authMailService.sendPasswordResetOtp(normalizedEmail, user.fullName, otp, otpExpirySeconds);

        return Map.of(
                "email", normalizedEmail,
                "resend", resend,
                "expiresInSeconds", otpExpirySeconds,
                "resendCooldownSeconds", otpResendCooldownSeconds);
    }

    private void ensureLoginAllowed(UserRecord user, boolean requireVerifiedEmail) {
        if (!user.active) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is inactive.");
        }
        if (user.locked) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Account is locked.");
        }
        if (requireVerifiedEmail && !user.emailVerified) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Please verify your email before login.");
        }
    }

    private UserRecord requireUserFromAccessToken(String authorizationHeader) {
        return requireUserById(parseUserIdFromAccessToken(authorizationHeader));
    }

    private int parseUserIdFromAccessToken(String authorizationHeader) {
        String token = extractBearerToken(authorizationHeader);
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(jwtSigningKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Integer.parseInt(claims.getSubject());
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Access token is invalid.");
        }
    }

    private String createAccessToken(UserRecord user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(Duration.ofMinutes(accessTokenMinutes));
        return Jwts.builder()
                .subject(String.valueOf(user.userId))
                .claim("email", user.email)
                .claim("role", user.roleApiName)
                .issuedAt(java.util.Date.from(now))
                .expiration(java.util.Date.from(expiresAt))
                .signWith(jwtSigningKey)
                .compact();
    }

    private RefreshIssue createRefreshToken(int userId, HttpServletRequest request) {
        String rawToken = generateOpaqueToken();
        String tokenHash = hashOpaqueToken(rawToken);
        Instant expiresAt = Instant.now().plus(Duration.ofDays(refreshTokenDays));
        int refreshTokenId = insertRefreshToken(userId, tokenHash, expiresAt, requestClientIp(request),
                requestUserAgent(request));
        return new RefreshIssue(refreshTokenId, rawToken, expiresAt);
    }

    private void setRefreshCookie(HttpServletResponse response, String refreshToken, Instant expiresAt) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, refreshToken)
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Strict")
                .path("/api/v1/auth")
                .maxAge(Duration.between(Instant.now(), expiresAt))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Strict")
                .path("/api/v1/auth")
                .maxAge(Duration.ZERO)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private Optional<String> extractRefreshCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        for (Cookie cookie : cookies) {
            if (REFRESH_COOKIE_NAME.equals(cookie.getName()) && cookie.getValue() != null
                    && !cookie.getValue().isBlank()) {
                return Optional.of(cookie.getValue());
            }
        }
        return Optional.empty();
    }

    private String requestClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String requestUserAgent(HttpServletRequest request) {
        return normalizeNullableText(request.getHeader(HttpHeaders.USER_AGENT));
    }

    private void revokeAllRefreshTokens(int userId) {
        jdbcTemplate.update("""
                UPDATE dbo.UserRefreshTokens
                SET RevokedAt = COALESCE(RevokedAt, SYSDATETIME())
                WHERE UserID = ? AND RevokedAt IS NULL
                """, userId);
    }

    private GoogleTokenInfo verifyGoogleIdToken(String idToken) {
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google login is not configured.");
        }
        if (idToken == null || idToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Google token is required.");
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = restTemplate.getForObject(
                    "https://oauth2.googleapis.com/tokeninfo?id_token={idToken}",
                    Map.class,
                    idToken);
            if (payload == null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google token is invalid.");
            }

            String aud = asString(payload.get("aud"));
            String email = normalizeEmail(asString(payload.get("email")));
            String sub = asString(payload.get("sub"));
            boolean emailVerified = Boolean.parseBoolean(asString(payload.get("email_verified")));
            String name = asString(payload.get("name"));
            String picture = asString(payload.get("picture"));

            if (!googleClientId.equals(aud) || email.isBlank() || sub.isBlank() || !emailVerified) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google token is invalid.");
            }

            return new GoogleTokenInfo(sub, email, name, picture);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google token is invalid.");
        }
    }

    private Optional<UserRecord> findUserByGoogleSub(String providerUserId) {
        try {
            UserRecord user = jdbcTemplate.queryForObject("""
                    SELECT TOP (1) u.UserID, u.RoleID, r.RoleName, u.FullName, u.Email, u.Phone, u.PasswordHash,
                           u.IsLocked, u.IsActive, u.IsEmailVerified, u.AvatarUrl, u.AvatarSource
                    FROM dbo.UserAuthProviders ap
                    JOIN dbo.Users u ON u.UserID = ap.UserID
                    JOIN dbo.Roles r ON r.RoleID = u.RoleID
                    WHERE ap.Provider = ? AND ap.ProviderUserId = ?
                    """, userRowMapper, GOOGLE_PROVIDER, providerUserId);
            return Optional.ofNullable(user);
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private Optional<UserRecord> findUserByEmail(String email) {
        try {
            UserRecord user = jdbcTemplate.queryForObject("""
                    SELECT TOP (1) u.UserID, u.RoleID, r.RoleName, u.FullName, u.Email, u.Phone, u.PasswordHash,
                           u.IsLocked, u.IsActive, u.IsEmailVerified, u.AvatarUrl, u.AvatarSource
                    FROM dbo.Users u
                    JOIN dbo.Roles r ON r.RoleID = u.RoleID
                    WHERE LOWER(u.Email) = LOWER(?)
                    """, userRowMapper, normalizeEmail(email));
            return Optional.ofNullable(user);
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private UserRecord requireUserByEmail(String email) {
        return findUserByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password."));
    }

    private UserRecord requireUserById(int userId) {
        try {
            UserRecord user = jdbcTemplate.queryForObject("""
                    SELECT TOP (1) u.UserID, u.RoleID, r.RoleName, u.FullName, u.Email, u.Phone, u.PasswordHash,
                           u.IsLocked, u.IsActive, u.IsEmailVerified, u.AvatarUrl, u.AvatarSource
                    FROM dbo.Users u
                    JOIN dbo.Roles r ON r.RoleID = u.RoleID
                    WHERE u.UserID = ?
                    """, userRowMapper, userId);
            if (user == null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found.");
            }
            return user;
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found.");
        }
    }

    private Optional<RefreshTokenRecord> findRefreshTokenByHash(String tokenHash) {
        try {
            RefreshTokenRecord token = jdbcTemplate.queryForObject("""
                    SELECT TOP (1) RefreshTokenID, UserID, ExpiresAt, RevokedAt
                    FROM dbo.UserRefreshTokens
                    WHERE TokenHash = ?
                    """, refreshTokenRowMapper, tokenHash);
            return Optional.ofNullable(token);
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private Optional<EmailVerificationTokenRecord> findLatestActiveEmailVerificationToken(int userId) {
        try {
            EmailVerificationTokenRecord token = jdbcTemplate.queryForObject("""
                    SELECT TOP (1) EmailVerificationTokenID, OtpHash, ExpiresAt, ResendAvailableAt
                    FROM dbo.EmailVerificationTokens
                    WHERE UserID = ? AND UsedAt IS NULL AND InvalidatedAt IS NULL
                    ORDER BY CreatedAt DESC
                    """, emailVerificationTokenRowMapper, userId);
            return Optional.ofNullable(token);
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private Optional<PasswordResetTokenRecord> findLatestActivePasswordResetToken(int userId) {
        try {
            PasswordResetTokenRecord token = jdbcTemplate.queryForObject("""
                    SELECT TOP (1) PasswordResetTokenID, TokenHash, ExpiresAt, CreatedAt
                    FROM dbo.PasswordResetTokens
                    WHERE UserID = ? AND UsedAt IS NULL
                    ORDER BY CreatedAt DESC
                    """, passwordResetTokenRowMapper, userId);
            return Optional.ofNullable(token);
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private PasswordResetTokenRecord requireLatestActivePasswordResetToken(int userId) {
        return findLatestActivePasswordResetToken(userId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "OTP not found. Please request a new OTP."));
    }

    private int getRoleIdByName(String roleName) {
        Integer roleId = jdbcTemplate.queryForObject(
                "SELECT TOP (1) RoleID FROM dbo.Roles WHERE LOWER(RoleName) = LOWER(?)",
                Integer.class,
                roleName);
        if (roleId == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Required role not found: " + roleName);
        }
        return roleId;
    }

    private int insertUser(int roleId, String fullName, String email, String phone, String passwordHash,
            boolean emailVerified, Instant emailVerifiedAt) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO dbo.Users (
                        RoleID, FullName, Email, Phone, PasswordHash, IsLocked, IsActive,
                        IsEmailVerified, EmailVerifiedAt
                    )
                    VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
                    """, new String[] { "UserID" });
            statement.setInt(1, roleId);
            statement.setString(2, fullName);
            statement.setString(3, email);
            statement.setString(4, phone);
            statement.setString(5, passwordHash);
            statement.setBoolean(6, emailVerified);
            statement.setTimestamp(7, emailVerifiedAt == null ? null : Timestamp.from(emailVerifiedAt));
            return statement;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create user.");
        }
        return key.intValue();
    }

    private void ensureCustomerProfile(int userId) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(1) FROM dbo.Customers WHERE CustomerID = ?",
                Integer.class, userId);
        if (count != null && count == 0) {
            jdbcTemplate.update("INSERT INTO dbo.Customers (CustomerID) VALUES (?)", userId);
        }
    }

    private void ensureCoachProfile(int userId) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(1) FROM dbo.Coaches WHERE CoachID = ?", Integer.class,
                userId);
        if (count != null && count == 0) {
            jdbcTemplate.update("INSERT INTO dbo.Coaches (CoachID) VALUES (?)", userId);
        }
    }

    private Map<String, Object> loadDemographics(UserRecord user) {
        String role = user.roleApiName;
        String dateOfBirth = "";
        String gender = "";

        try {
            if ("CUSTOMER".equals(role)) {
                @SuppressWarnings("unchecked")
                Map<String, Object> row = jdbcTemplate.queryForMap("""
                        SELECT DateOfBirth, Gender
                        FROM dbo.Customers
                        WHERE CustomerID = ?
                        """, user.userId);
                Object dob = row.get("DateOfBirth");
                dateOfBirth = dob == null ? "" : String.valueOf(dob);
                gender = asString(row.get("Gender"));
            } else if ("COACH".equals(role)) {
                @SuppressWarnings("unchecked")
                Map<String, Object> row = jdbcTemplate.queryForMap("""
                        SELECT DateOfBirth, Gender
                        FROM dbo.Coaches
                        WHERE CoachID = ?
                        """, user.userId);
                Object dob = row.get("DateOfBirth");
                dateOfBirth = dob == null ? "" : String.valueOf(dob);
                gender = asString(row.get("Gender"));
            }
        } catch (Exception ignored) {
            // Return empty demographics if the profile row doesn't exist yet.
        }

        return Map.of(
                "dateOfBirth", dateOfBirth == null ? "" : dateOfBirth,
                "gender", gender == null ? "" : gender);
    }

    private void updateDemographics(UserRecord user, String dateOfBirth, String gender) {
        String role = user.roleApiName;
        String normalizedGender = normalizeNullableText(gender);
        if (normalizedGender != null && normalizedGender.length() > 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Gender must be at most 10 characters.");
        }

        String normalizedDob = normalizeNullableText(dateOfBirth);
        LocalDate parsedDob = null;
        if (normalizedDob != null) {
            try {
                parsedDob = LocalDate.parse(normalizedDob);
            } catch (Exception exception) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Date of birth must be in YYYY-MM-DD format.");
            }
        }

        java.sql.Date dobParam = parsedDob == null ? null : java.sql.Date.valueOf(parsedDob);

        if ("CUSTOMER".equals(role)) {
            ensureCustomerProfile(user.userId);
            jdbcTemplate.update("""
                    UPDATE dbo.Customers
                    SET DateOfBirth = ?, Gender = ?
                    WHERE CustomerID = ?
                    """, dobParam, normalizedGender, user.userId);
        } else if ("COACH".equals(role)) {
            ensureCoachProfile(user.userId);
            jdbcTemplate.update("""
                    UPDATE dbo.Coaches
                    SET DateOfBirth = ?, Gender = ?
                    WHERE CoachID = ?
                    """, dobParam, normalizedGender, user.userId);
        }
    }

    private boolean maybeApplyGoogleAvatar(UserRecord user, String pictureUrl) {
        String normalized = normalizeNullableText(pictureUrl);
        if (normalized == null) {
            return false;
        }
        if ("CUSTOM".equalsIgnoreCase(asString(user.avatarSource))) {
            return false;
        }
        jdbcTemplate.update("""
                UPDATE dbo.Users
                SET AvatarUrl = ?, AvatarSource = 'GOOGLE', UpdatedAt = SYSDATETIME()
                WHERE UserID = ?
                """, normalized, user.userId);
        return true;
    }

    private String detectImageExtension(byte[] bytes) {
        if (bytes == null || bytes.length < 12) {
            return null;
        }

        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        if ((bytes[0] & 0xFF) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47
                && bytes[4] == 0x0D
                && bytes[5] == 0x0A
                && bytes[6] == 0x1A
                && bytes[7] == 0x0A) {
            return "png";
        }

        // JPEG signature: FF D8 FF
        if ((bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return "jpg";
        }

        // WEBP: "RIFF" .... "WEBP"
        if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return "webp";
        }

        return null;
    }

    private void upsertGoogleProvider(int userId, String providerUserId, String providerEmail) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.UserAuthProviders
                WHERE UserID = ? AND Provider = ?
                """, Integer.class, userId, GOOGLE_PROVIDER);
        if (count != null && count > 0) {
            jdbcTemplate.update("""
                    UPDATE dbo.UserAuthProviders
                    SET ProviderUserId = ?, ProviderEmail = ?
                    WHERE UserID = ? AND Provider = ?
                    """, providerUserId, providerEmail, userId, GOOGLE_PROVIDER);
        } else {
            jdbcTemplate.update("""
                    INSERT INTO dbo.UserAuthProviders (UserID, Provider, ProviderUserId, ProviderEmail)
                    VALUES (?, ?, ?, ?)
                    """, userId, GOOGLE_PROVIDER, providerUserId, providerEmail);
        }
    }

    private void invalidatePendingEmailVerificationTokens(int userId) {
        jdbcTemplate.update("""
                UPDATE dbo.EmailVerificationTokens
                SET InvalidatedAt = SYSDATETIME()
                WHERE UserID = ? AND UsedAt IS NULL AND InvalidatedAt IS NULL
                """, userId);
    }

    private void insertEmailVerificationToken(int userId, String otpHash, Instant expiresAt,
            Instant resendAvailableAt) {
        jdbcTemplate.update("""
                INSERT INTO dbo.EmailVerificationTokens (UserID, OtpHash, ExpiresAt, ResendAvailableAt)
                VALUES (?, ?, ?, ?)
                """, userId, otpHash, Timestamp.from(expiresAt), Timestamp.from(resendAvailableAt));
    }

    private void markEmailVerificationTokenUsed(int tokenId) {
        jdbcTemplate.update("""
                UPDATE dbo.EmailVerificationTokens
                SET UsedAt = SYSDATETIME()
                WHERE EmailVerificationTokenID = ? AND UsedAt IS NULL
                """, tokenId);
    }

    private void invalidateEmailVerificationToken(int tokenId) {
        jdbcTemplate.update("""
                UPDATE dbo.EmailVerificationTokens
                SET InvalidatedAt = SYSDATETIME()
                WHERE EmailVerificationTokenID = ? AND UsedAt IS NULL AND InvalidatedAt IS NULL
                """, tokenId);
    }

    private void insertPasswordResetToken(int userId, String tokenHash, Instant expiresAt) {
        jdbcTemplate.update("""
                INSERT INTO dbo.PasswordResetTokens (UserID, TokenHash, ExpiresAt)
                VALUES (?, ?, ?)
                """, userId, tokenHash, Timestamp.from(expiresAt));
    }

    private void invalidateAllActivePasswordResetTokens(int userId) {
        jdbcTemplate.update("""
                UPDATE dbo.PasswordResetTokens
                SET UsedAt = SYSDATETIME()
                WHERE UserID = ? AND UsedAt IS NULL
                """, userId);
    }

    private void markPasswordResetTokenUsed(int tokenId) {
        jdbcTemplate.update("""
                UPDATE dbo.PasswordResetTokens
                SET UsedAt = SYSDATETIME()
                WHERE PasswordResetTokenID = ? AND UsedAt IS NULL
                """, tokenId);
    }

    private void invalidateOtherPasswordResetTokens(int userId, int exceptTokenId) {
        jdbcTemplate.update("""
                UPDATE dbo.PasswordResetTokens
                SET UsedAt = SYSDATETIME()
                WHERE UserID = ? AND UsedAt IS NULL AND PasswordResetTokenID <> ?
                """, userId, exceptTokenId);
    }

    private int insertRefreshToken(int userId, String tokenHash, Instant expiresAt, String ipAddress,
            String userAgent) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO dbo.UserRefreshTokens (UserID, TokenHash, ExpiresAt, UserAgent, IpAddress)
                    VALUES (?, ?, ?, ?, ?)
                    """, new String[] { "RefreshTokenID" });
            statement.setInt(1, userId);
            statement.setString(2, tokenHash);
            statement.setTimestamp(3, Timestamp.from(expiresAt));
            statement.setString(4, userAgent);
            statement.setString(5, ipAddress);
            return statement;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to issue refresh token.");
        }
        return key.intValue();
    }

    private UserRecord toUserRecord(ResultSet rs) throws SQLException {
        String dbRoleName = rs.getString("RoleName");
        return new UserRecord(
                rs.getInt("UserID"),
                rs.getInt("RoleID"),
                dbRoleName,
                normalizeRoleName(dbRoleName),
                rs.getString("FullName"),
                rs.getString("Email"),
                rs.getString("Phone"),
                rs.getString("PasswordHash"),
                rs.getBoolean("IsLocked"),
                rs.getBoolean("IsActive"),
                rs.getBoolean("IsEmailVerified"),
                rs.getString("AvatarUrl"),
                rs.getString("AvatarSource"));
    }

    private RefreshTokenRecord toRefreshTokenRecord(ResultSet rs) throws SQLException {
        return new RefreshTokenRecord(
                rs.getInt("RefreshTokenID"),
                rs.getInt("UserID"),
                toInstant(rs.getTimestamp("ExpiresAt")),
                toInstant(rs.getTimestamp("RevokedAt")));
    }

    private EmailVerificationTokenRecord toEmailVerificationTokenRecord(ResultSet rs) throws SQLException {
        return new EmailVerificationTokenRecord(
                rs.getInt("EmailVerificationTokenID"),
                rs.getString("OtpHash"),
                toInstant(rs.getTimestamp("ExpiresAt")),
                toInstant(rs.getTimestamp("ResendAvailableAt")));
    }

    private PasswordResetTokenRecord toPasswordResetTokenRecord(ResultSet rs) throws SQLException {
        return new PasswordResetTokenRecord(
                rs.getInt("PasswordResetTokenID"),
                rs.getString("TokenHash"),
                toInstant(rs.getTimestamp("ExpiresAt")),
                toInstant(rs.getTimestamp("CreatedAt")));
    }

    private Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private Map<String, Object> userToMap(UserRecord user) {
        return Map.of(
                "userId", user.userId,
                "fullName", user.fullName,
                "email", user.email,
                "phone", user.phone == null ? "" : user.phone,
                "role", user.roleApiName,
                "avatarUrl", user.avatarUrl == null ? "" : user.avatarUrl,
                "avatarSource", user.avatarSource == null ? "" : user.avatarSource);
    }

    private String normalizeRoleName(String roleName) {
        if (roleName == null) {
            return "CUSTOMER";
        }
        return roleName.trim().replace(' ', '_').toUpperCase(Locale.ROOT);
    }

    private boolean isGoogleAllowedRole(String role) {
        return "CUSTOMER".equals(role) || "COACH".equals(role) || "RECEPTIONIST".equals(role);
    }

    private String landingPath(String role) {
        return switch (role) {
            case "COACH" -> "/coach/schedule";
            case "RECEPTIONIST" -> "/reception/checkin";
            case "ADMIN" -> "/admin/dashboard";
            default -> "/customer/membership";
        };
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizePhoneOrThrow(String phone) {
        String normalized = normalizeNullableText(phone);
        if (normalized == null) {
            return null;
        }

        // Normalize keyboard/IME variants (e.g., fullwidth digits) into ASCII where
        // possible.
        String nfkc = Normalizer.normalize(normalized, Normalizer.Form.NFKC);
        if (nfkc == null) {
            return null;
        }

        String trimmed = nfkc.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        boolean hasPlus = false;
        StringBuilder digits = new StringBuilder();

        for (int i = 0; i < trimmed.length(); i++) {
            char ch = trimmed.charAt(i);
            if (i == 0 && ch == '+') {
                hasPlus = true;
                continue;
            }

            // Allowed separators commonly used in phone input.
            if (Character.isWhitespace(ch) || ch == '-' || ch == '(' || ch == ')' || ch == '.' || ch == '\u00A0'
                    || ch == '\u200B' || ch == '\u200C' || ch == '\u200D' || ch == '\uFEFF') {
                continue;
            }

            if (ch >= '0' && ch <= '9') {
                digits.append(ch);
                continue;
            }

            // Any other character (letters, emoji, etc.) is rejected.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number is invalid.");
        }

        if (digits.length() == 0) {
            return null;
        }

        // E.164 maximum is 15 digits (excluding '+'). Keep minimum loose for local VN
        // numbers.
        if (digits.length() < 8 || digits.length() > 15) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number is invalid.");
        }

        return hasPlus ? "+" + digits : digits.toString();
    }

    private String requireText(String value, String message) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return normalized;
    }

    private void validatePasswordPair(String password, String confirmPassword) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Password must be at least " + MIN_PASSWORD_LENGTH + " characters.");
        }
        if (!Objects.equals(password, confirmPassword)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password confirmation does not match.");
        }
    }

    private String requireOtp(String otp) {
        String normalized = otp == null ? "" : otp.trim();
        if (normalized.length() != OTP_LENGTH || !normalized.chars().allMatch(Character::isDigit)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OTP must be a 6-digit code.");
        }
        return normalized;
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

    private String generateOtp() {
        int bound = (int) Math.pow(10, OTP_LENGTH);
        int value = secureRandom.nextInt(bound);
        return String.format("%0" + OTP_LENGTH + "d", value);
    }

    private String generateOpaqueToken() {
        byte[] bytes = new byte[48];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashOpaqueToken(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(sha256(value.getBytes(StandardCharsets.UTF_8)));
    }

    private byte[] sha256(byte[] value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(value);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    record UserRecord(
            int userId,
            int roleId,
            String roleDbName,
            String roleApiName,
            String fullName,
            String email,
            String phone,
            String passwordHash,
            boolean locked,
            boolean active,
            boolean emailVerified,
            String avatarUrl,
            String avatarSource) {
    }

    record RefreshTokenRecord(int refreshTokenId, int userId, Instant expiresAt, Instant revokedAt) {
    }

    record EmailVerificationTokenRecord(int emailVerificationTokenId, String otpHash, Instant expiresAt,
            Instant resendAvailableAt) {
    }

    record PasswordResetTokenRecord(int passwordResetTokenId, String tokenHash, Instant expiresAt,
            Instant createdAt) {
    }

    record RefreshIssue(int refreshTokenId, String rawToken, Instant expiresAt) {
    }

    record GoogleTokenInfo(String sub, String email, String name, String pictureUrl) {
        String displayName() {
            return (name == null || name.isBlank()) ? email : name;
        }
    }

    public record AuthContext(
            int userId,
            String role,
            String fullName,
            String email
    ) {
    }
}
