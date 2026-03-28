package com.gymcore.backend.modules.users.service;

import com.gymcore.backend.modules.auth.service.AuthService;
import com.gymcore.backend.modules.auth.service.CurrentUserService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserManagementService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final String PASSWORD_POLICY_MESSAGE =
            "Password must be at least 8 characters and include at least one uppercase letter, one number, and one special character.";

    private final JdbcTemplate jdbcTemplate;
    private final AuthService authService;
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;

    public UserManagementService(
            JdbcTemplate jdbcTemplate,
            AuthService authService,
            CurrentUserService currentUserService,
            PasswordEncoder passwordEncoder) {
        this.jdbcTemplate = jdbcTemplate;
        this.authService = authService;
        this.currentUserService = currentUserService;
        this.passwordEncoder = passwordEncoder;
    }

    public Map<String, Object> execute(String action, Object payload) {
        return switch (action) {
            case "reception-search-customers" -> receptionSearchCustomers(asMap(payload));
            case "reception-customer-membership" -> receptionCustomerMembership(asMap(payload));
            case "admin-get-users" -> adminGetUsers(asMap(payload));
            case "admin-create-staff" -> adminCreateStaff(asMap(payload));
            case "admin-update-staff" -> adminUpdateStaff(asMap(payload));
            case "admin-lock-user" -> adminLockUser(asMap(payload));
            case "admin-unlock-user" -> adminUnlockUser(asMap(payload));
            default -> throw unsupportedAction(action);
        };
    }

    private Map<String, Object> receptionSearchCustomers(Map<String, Object> payload) {
        requireReceptionist(payload);
        String query = asText(payload.get("query"));
        if (query == null) {
            return Map.of("items", List.of());
        }

        String like = "%" + query + "%";
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT TOP (20)
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    latest.CustomerMembershipID,
                    latest.Status,
                    latest.StartDate,
                    latest.EndDate,
                    mp.PlanName,
                    mp.PlanType
                FROM dbo.Users u
                JOIN dbo.Customers c ON c.CustomerID = u.UserID
                OUTER APPLY (
                    SELECT TOP (1)
                        cm.CustomerMembershipID,
                        cm.MembershipPlanID,
                        cm.Status,
                        cm.StartDate,
                        cm.EndDate
                    FROM dbo.CustomerMemberships cm
                    WHERE cm.CustomerID = u.UserID
                    ORDER BY
                        CASE cm.Status
                            WHEN 'ACTIVE' THEN 1
                            WHEN 'SCHEDULED' THEN 2
                            WHEN 'PENDING' THEN 3
                            WHEN 'EXPIRED' THEN 4
                            WHEN 'CANCELLED' THEN 5
                            ELSE 6
                        END,
                        cm.EndDate DESC,
                        cm.CustomerMembershipID DESC
                ) latest
                LEFT JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = latest.MembershipPlanID
                WHERE
                    u.FullName LIKE ?
                    OR u.Email LIKE ?
                    OR u.Phone LIKE ?
                    OR u.PhoneNormalized LIKE ?
                ORDER BY u.FullName ASC, u.UserID ASC
                """, searchRowMapper(), like, like, like, like);
        return Map.of("items", items);
    }

    private Map<String, Object> receptionCustomerMembership(Map<String, Object> payload) {
        requireReceptionist(payload);
        Integer customerId = parseInteger(payload.get("customerId"));
        if (customerId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "customerId is required.");
        }

        CustomerLookup customer = jdbcTemplate.query("""
                SELECT
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone
                FROM dbo.Users u
                JOIN dbo.Customers c ON c.CustomerID = u.UserID
                WHERE u.UserID = ?
                """, customerLookupRowMapper(), customerId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found."));

        MembershipValidity validity = buildMembershipValidity(customer.customerId());

        Map<String, Object> customerMap = new LinkedHashMap<>();
        customerMap.put("customerId", customer.customerId());
        customerMap.put("fullName", customer.fullName());
        customerMap.put("email", customer.email());
        customerMap.put("phone", customer.phone());

        MembershipSnapshot active = findTopMembership(customer.customerId(), "ACTIVE");
        MembershipSnapshot scheduled = findTopMembership(customer.customerId(), "SCHEDULED");
        MembershipSnapshot expired = findTopMembership(customer.customerId(), "EXPIRED");

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("customer", customerMap);
        data.put("validForCheckin", validity.valid());
        data.put("reason", validity.reason());
        data.put("activeMembership", toMembershipMap(active));
        data.put("autoRenewMembership", toMembershipMap(scheduled));
        data.put("expiredMembership", toMembershipMap(expired));
        data.put("expiredMembershipHistory", findMembershipHistory(customer.customerId(), "EXPIRED", 12));
        data.put("checkinHistory", findCheckinHistory(customer.customerId(), 20));

        if (validity.customerMembershipId() == null) {
            data.put("membership", Map.of());
        } else {
            Map<String, Object> membership = new LinkedHashMap<>();
            membership.put("customerMembershipId", validity.customerMembershipId());
            membership.put("status", validity.status());
            membership.put("planName", validity.planName());
            membership.put("planType", validity.planType());
            membership.put("startDate", validity.startDate());
            membership.put("endDate", validity.endDate());
            if (validity.daysUntilActive() != null) {
                membership.put("daysUntilActive", validity.daysUntilActive());
            }
            data.put("membership", membership);
        }
        return data;
    }

    private Map<String, Object> adminGetUsers(Map<String, Object> payload) {
        requireAdmin(payload);

        String search = asText(payload.get("query"));
        String roleFilter = normalizeRoleInput(payload.get("role"), true);
        Boolean lockedFilter = parseBooleanFilter(payload.get("locked"), "locked");
        Boolean activeFilter = parseBooleanFilter(payload.get("active"), "active");

        StringBuilder sql = new StringBuilder("""
                SELECT
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    u.IsActive,
                    u.IsLocked,
                    u.LockedAt,
                    u.LockReason,
                    u.IsEmailVerified,
                    u.EmailVerifiedAt,
                    u.CreatedAt,
                    r.RoleName,
                    c.DateOfBirth,
                    c.Gender,
                    c.ExperienceYears,
                    c.Bio,
                    CASE
                        WHEN u.PasswordHash IS NOT NULL AND providers.GoogleProviderCount > 0 THEN 'PASSWORD_AND_GOOGLE'
                        WHEN u.PasswordHash IS NOT NULL THEN 'PASSWORD'
                        WHEN providers.GoogleProviderCount > 0 THEN 'GOOGLE_ONLY'
                        ELSE 'UNKNOWN'
                    END AS AuthMode
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                LEFT JOIN dbo.Coaches c ON c.CoachID = u.UserID
                OUTER APPLY (
                    SELECT COUNT(1) AS GoogleProviderCount
                    FROM dbo.UserAuthProviders provider
                    WHERE provider.UserID = u.UserID
                ) providers
                WHERE r.RoleName IN ('Admin', 'Coach', 'Receptionist')
                """);

        List<Object> params = new ArrayList<>();
        if (roleFilter != null) {
            if (!isStaffRole(roleFilter)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role filter is invalid.");
            }
            sql.append(" AND r.RoleName = ? ");
            params.add(toDbRoleName(roleFilter));
        }
        if (lockedFilter != null) {
            sql.append(" AND u.IsLocked = ? ");
            params.add(lockedFilter);
        }
        if (activeFilter != null) {
            sql.append(" AND u.IsActive = ? ");
            params.add(activeFilter);
        }
        if (search != null) {
            String like = "%" + search + "%";
            sql.append(" AND (u.FullName LIKE ? OR u.Email LIKE ? OR u.Phone LIKE ? OR u.PhoneNormalized LIKE ?) ");
            params.add(like);
            params.add(like);
            params.add(like);
            params.add(like);
        }
        sql.append(" ORDER BY CASE r.RoleName WHEN 'Admin' THEN 1 WHEN 'Coach' THEN 2 WHEN 'Receptionist' THEN 3 ELSE 4 END, ");
        sql.append("u.IsLocked ASC, u.FullName ASC, u.UserID ASC ");

        List<Map<String, Object>> items = jdbcTemplate.query(sql.toString(), staffRowMapper(), params.toArray());

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalStaff", queryInt("SELECT COUNT(1) FROM dbo.Users u JOIN dbo.Roles r ON r.RoleID = u.RoleID WHERE r.RoleName IN ('Admin', 'Coach', 'Receptionist')"));
        summary.put("adminCount", queryInt("SELECT COUNT(1) FROM dbo.Users u JOIN dbo.Roles r ON r.RoleID = u.RoleID WHERE r.RoleName = 'Admin'"));
        summary.put("coachCount", queryInt("SELECT COUNT(1) FROM dbo.Users u JOIN dbo.Roles r ON r.RoleID = u.RoleID WHERE r.RoleName = 'Coach'"));
        summary.put("receptionistCount", queryInt("SELECT COUNT(1) FROM dbo.Users u JOIN dbo.Roles r ON r.RoleID = u.RoleID WHERE r.RoleName = 'Receptionist'"));
        summary.put("lockedCount", queryInt("SELECT COUNT(1) FROM dbo.Users u JOIN dbo.Roles r ON r.RoleID = u.RoleID WHERE r.RoleName IN ('Admin', 'Coach', 'Receptionist') AND u.IsLocked = 1"));
        summary.put("filteredCount", items.size());

        return Map.of("items", items, "summary", summary);
    }

    private Map<String, Object> adminCreateStaff(Map<String, Object> payload) {
        CurrentUserService.UserInfo admin = requireAdmin(payload);
        String role = requireStaffRole(payload.get("role"));
        String fullName = requireText(asText(payload.get("fullName")), "Full name is required.");
        String email = normalizeEmail(requireText(asText(payload.get("email")), "Email is required."));
        String phone = requireStaffPhone(payload.get("phone"));
        String password = requireTemporaryPassword(payload);

        if (emailExists(email, null)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already in use.");
        }
        if (phoneExists(phone, null)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phone number is already in use.");
        }

        Integer roleId = jdbcTemplate.queryForObject("SELECT RoleID FROM dbo.Roles WHERE RoleName = ?", Integer.class, toDbRoleName(role));
        if (roleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Staff role is invalid.");
        }

        Integer userId = jdbcTemplate.queryForObject("""
                INSERT INTO dbo.Users (
                    RoleID, FullName, Email, Phone, PasswordHash,
                    IsActive, IsLocked, IsEmailVerified, EmailVerifiedAt, UpdatedAt
                )
                OUTPUT INSERTED.UserID
                VALUES (?, ?, ?, ?, ?, 1, 0, 1, SYSDATETIME(), SYSDATETIME())
                """, Integer.class, roleId, fullName, email, phone, passwordEncoder.encode(password));

        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create staff account.");
        }

        if ("COACH".equals(role)) {
            upsertCoachProfile(userId, payload);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("user", requireStaffItem(userId));
        response.put("createdByUserId", admin.userId());
        return response;
    }

    private Map<String, Object> adminUpdateStaff(Map<String, Object> payload) {
        CurrentUserService.UserInfo admin = requireAdmin(payload);
        int userId = requirePositiveInt(payload.get("userId"), "User ID is required.");
        Map<String, Object> body = asMap(payload.get("body"));
        ManagedUserRecord current = requireManagedUserRecord(userId);

        String requestedRole = normalizeRoleInput(body.get("role"), true);
        if (requestedRole != null && !requestedRole.equals(current.role())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Changing roles is not supported.");
        }

        String requestedEmail = normalizeNullableText(asText(body.get("email")));
        if (requestedEmail != null && !normalizeEmail(requestedEmail).equalsIgnoreCase(current.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email cannot be changed from this screen.");
        }

        String fullName = requireText(asText(firstNonNull(body.get("fullName"), current.fullName())), "Full name is required.");
        String phone = requireStaffPhone(firstNonNull(body.get("phone"), current.phone()));
        if (phoneExists(phone, userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phone number is already in use.");
        }

        boolean active = body.containsKey("active")
                ? parseBooleanRequired(body.get("active"), "active")
                : current.active();

        if ("ADMIN".equals(current.role())) {
            if (admin.userId() == userId && !active) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin cannot deactivate the current account.");
            }
            if (!active && !hasAnotherAvailableAdmin(userId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate the last active admin account.");
            }
        }

        jdbcTemplate.update("""
                UPDATE dbo.Users
                SET FullName = ?,
                    Phone = ?,
                    IsActive = ?,
                    UpdatedAt = SYSDATETIME()
                WHERE UserID = ?
                """, fullName, phone, active, userId);

        if ("COACH".equals(current.role())) {
            upsertCoachProfile(userId, body);
        }

        return Map.of("user", requireManagedUserItem(userId));
    }

    private Map<String, Object> adminLockUser(Map<String, Object> payload) {
        CurrentUserService.UserInfo admin = requireAdmin(payload);
        int userId = requirePositiveInt(payload.get("userId"), "User ID is required.");
        Map<String, Object> body = asMap(payload.get("body"));
        String reason = requireText(asText(body.get("reason")), "Lock reason is required.");
        ManagedUserRecord target = requireManagedUserRecord(userId);

        if (admin.userId() == userId) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin cannot lock the current account.");
        }
        if ("ADMIN".equals(target.role()) && !hasAnotherAvailableAdmin(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot lock the last active admin account.");
        }

        jdbcTemplate.update("""
                UPDATE dbo.Users
                SET IsLocked = 1,
                    LockedAt = SYSDATETIME(),
                    LockReason = ?,
                    UpdatedAt = SYSDATETIME()
                WHERE UserID = ?
                """, reason, userId);

        return Map.of("user", requireManagedUserItem(userId));
    }

    private Map<String, Object> adminUnlockUser(Map<String, Object> payload) {
        requireAdmin(payload);
        int userId = requirePositiveInt(payload.get("userId"), "User ID is required.");
        requireManagedUserRecord(userId);

        jdbcTemplate.update("""
                UPDATE dbo.Users
                SET IsLocked = 0,
                    LockedAt = NULL,
                    LockReason = NULL,
                    UpdatedAt = SYSDATETIME()
                WHERE UserID = ?
                """, userId);

        return Map.of("user", requireManagedUserItem(userId));
    }

    private AuthService.AuthContext requireReceptionist(Map<String, Object> payload) {
        String authorizationHeader = asText(payload.get("authorizationHeader"));
        AuthService.AuthContext context = authService.requireAuthContext(authorizationHeader);
        if (!"RECEPTIONIST".equalsIgnoreCase(context.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only receptionist can perform this action.");
        }
        return context;
    }

    private CurrentUserService.UserInfo requireAdmin(Map<String, Object> payload) {
        String authorizationHeader = asText(payload.get("authorizationHeader"));
        return currentUserService.requireAdmin(authorizationHeader);
    }

    private MembershipValidity buildMembershipValidity(int customerId) {
        MembershipSnapshot active = findTopMembership(customerId, "ACTIVE");
        if (active != null) {
            return new MembershipValidity(true, null, active.customerMembershipId(), active.status(), active.planName(), active.planType(), dateToString(active.startDate()), dateToString(active.endDate()), null);
        }

        MembershipSnapshot scheduled = findTopMembership(customerId, "SCHEDULED");
        if (scheduled != null) {
            int days = Math.max(0, (int) java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), scheduled.startDate()));
            return new MembershipValidity(false, scheduled.planName() + " is scheduled to start on " + dateToString(scheduled.startDate()) + ".", scheduled.customerMembershipId(), scheduled.status(), scheduled.planName(), scheduled.planType(), dateToString(scheduled.startDate()), dateToString(scheduled.endDate()), days);
        }

        MembershipSnapshot expired = findTopMembership(customerId, "EXPIRED");
        if (expired != null) {
            return new MembershipValidity(false, expired.planName() + " expired on " + dateToString(expired.endDate()) + ".", expired.customerMembershipId(), expired.status(), expired.planName(), expired.planType(), dateToString(expired.startDate()), dateToString(expired.endDate()), null);
        }

        MembershipSnapshot pending = findTopMembership(customerId, "PENDING");
        if (pending != null) {
            return new MembershipValidity(false, pending.planName() + " payment is pending and not active yet.", pending.customerMembershipId(), pending.status(), pending.planName(), pending.planType(), dateToString(pending.startDate()), dateToString(pending.endDate()), null);
        }

        return new MembershipValidity(false, "No active membership found for this customer.", null, null, null, null, null, null, null);
    }

    private MembershipSnapshot findTopMembership(int customerId, String status) {
        List<MembershipSnapshot> rows = jdbcTemplate.query("""
                SELECT TOP (1)
                    cm.CustomerMembershipID,
                    cm.Status,
                    cm.StartDate,
                    cm.EndDate,
                    mp.PlanName,
                    mp.PlanType
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ? AND cm.Status = ?
                ORDER BY cm.EndDate DESC, cm.CustomerMembershipID DESC
                """, membershipSnapshotRowMapper(), customerId, status);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Map<String, Object>> findMembershipHistory(int customerId, String status, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return jdbcTemplate.query("""
                SELECT TOP (50)
                    cm.CustomerMembershipID,
                    cm.Status,
                    cm.StartDate,
                    cm.EndDate,
                    mp.PlanName,
                    mp.PlanType
                FROM dbo.CustomerMemberships cm
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                WHERE cm.CustomerID = ? AND cm.Status = ?
                ORDER BY cm.EndDate DESC, cm.CustomerMembershipID DESC
                """, (rs, rowNum) -> toMembershipMap(membershipSnapshotRowMapper().mapRow(rs, rowNum)), customerId, status)
                .stream()
                .limit(safeLimit)
                .toList();
    }

    private List<Map<String, Object>> findCheckinHistory(int customerId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return jdbcTemplate.query("""
                SELECT TOP (50)
                    ci.CheckInID,
                    ci.CheckInTime,
                    mp.PlanName,
                    r.FullName AS CheckedByName
                FROM dbo.CheckIns ci
                JOIN dbo.CustomerMemberships cm ON cm.CustomerMembershipID = ci.CustomerMembershipID
                JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
                LEFT JOIN dbo.Users r ON r.UserID = ci.CheckedByUserID
                WHERE ci.CustomerID = ?
                ORDER BY ci.CheckInTime DESC, ci.CheckInID DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("checkInId", rs.getInt("CheckInID"));
            item.put("checkInTime", timestampToIso(rs.getTimestamp("CheckInTime")));
            item.put("planName", rs.getString("PlanName"));
            item.put("employeeName", rs.getString("CheckedByName"));
            return item;
        }, customerId).stream().limit(safeLimit).toList();
    }

    private Map<String, Object> toMembershipMap(MembershipSnapshot snapshot) {
        if (snapshot == null) {
            return Map.of();
        }
        Map<String, Object> membership = new LinkedHashMap<>();
        membership.put("customerMembershipId", snapshot.customerMembershipId());
        membership.put("status", snapshot.status());
        membership.put("planName", snapshot.planName());
        membership.put("planType", snapshot.planType());
        membership.put("startDate", dateToString(snapshot.startDate()));
        membership.put("endDate", dateToString(snapshot.endDate()));
        return membership;
    }

    private RowMapper<Map<String, Object>> searchRowMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("customerId", rs.getInt("UserID"));
            item.put("fullName", rs.getString("FullName"));
            item.put("email", rs.getString("Email"));
            item.put("phone", rs.getString("Phone"));

            Integer membershipId = parseInteger(rs.getObject("CustomerMembershipID"));
            if (membershipId != null) {
                Map<String, Object> membership = new LinkedHashMap<>();
                membership.put("customerMembershipId", membershipId);
                membership.put("status", rs.getString("Status"));
                membership.put("planName", rs.getString("PlanName"));
                membership.put("planType", rs.getString("PlanType"));
                membership.put("startDate", dateToString(toLocalDate(rs, "StartDate")));
                membership.put("endDate", dateToString(toLocalDate(rs, "EndDate")));
                item.put("membership", membership);
            } else {
                item.put("membership", Map.of());
            }
            return item;
        };
    }

    private RowMapper<CustomerLookup> customerLookupRowMapper() {
        return (rs, rowNum) -> new CustomerLookup(rs.getInt("UserID"), rs.getString("FullName"), rs.getString("Email"), rs.getString("Phone"));
    }

    private RowMapper<MembershipSnapshot> membershipSnapshotRowMapper() {
        return (rs, rowNum) -> new MembershipSnapshot(rs.getInt("CustomerMembershipID"), rs.getString("Status"), toLocalDate(rs, "StartDate"), toLocalDate(rs, "EndDate"), rs.getString("PlanName"), rs.getString("PlanType"));
    }

    private RowMapper<Map<String, Object>> staffRowMapper() {
        return (rs, rowNum) -> toStaffMap(rs);
    }

    private Map<String, Object> requireStaffItem(int userId) {
        return jdbcTemplate.query("""
                SELECT
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    u.IsActive,
                    u.IsLocked,
                    u.LockedAt,
                    u.LockReason,
                    u.IsEmailVerified,
                    u.EmailVerifiedAt,
                    u.CreatedAt,
                    r.RoleName,
                    c.DateOfBirth,
                    c.Gender,
                    c.ExperienceYears,
                    c.Bio,
                    CASE
                        WHEN u.PasswordHash IS NOT NULL AND providers.GoogleProviderCount > 0 THEN 'PASSWORD_AND_GOOGLE'
                        WHEN u.PasswordHash IS NOT NULL THEN 'PASSWORD'
                        WHEN providers.GoogleProviderCount > 0 THEN 'GOOGLE_ONLY'
                        ELSE 'UNKNOWN'
                    END AS AuthMode
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                LEFT JOIN dbo.Coaches c ON c.CoachID = u.UserID
                OUTER APPLY (
                    SELECT COUNT(1) AS GoogleProviderCount
                    FROM dbo.UserAuthProviders provider
                    WHERE provider.UserID = u.UserID
                ) providers
                WHERE u.UserID = ?
                """, staffRowMapper(), userId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff account not found."));
    }

    private Map<String, Object> requireManagedUserItem(int userId) {
        return jdbcTemplate.query("""
                SELECT
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    u.IsActive,
                    u.IsLocked,
                    u.LockedAt,
                    u.LockReason,
                    u.IsEmailVerified,
                    u.EmailVerifiedAt,
                    u.CreatedAt,
                    r.RoleName,
                    c.DateOfBirth,
                    c.Gender,
                    c.ExperienceYears,
                    c.Bio,
                    CASE
                        WHEN u.PasswordHash IS NOT NULL AND providers.GoogleProviderCount > 0 THEN 'PASSWORD_AND_GOOGLE'
                        WHEN u.PasswordHash IS NOT NULL THEN 'PASSWORD'
                        WHEN providers.GoogleProviderCount > 0 THEN 'GOOGLE_ONLY'
                        ELSE 'UNKNOWN'
                    END AS AuthMode
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                LEFT JOIN dbo.Coaches c ON c.CoachID = u.UserID
                OUTER APPLY (
                    SELECT COUNT(1) AS GoogleProviderCount
                    FROM dbo.UserAuthProviders provider
                    WHERE provider.UserID = u.UserID
                ) providers
                WHERE u.UserID = ?
                """, (rs, rowNum) -> toManagedUserMap(rs), userId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User account not found."));
    }

    private StaffRecord requireStaffRecord(int userId) {
        StaffRecord record = jdbcTemplate.query("""
                SELECT
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    u.IsActive,
                    u.IsLocked,
                    r.RoleName,
                    c.DateOfBirth,
                    c.Gender,
                    c.ExperienceYears,
                    c.Bio
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                LEFT JOIN dbo.Coaches c ON c.CoachID = u.UserID
                WHERE u.UserID = ?
                """, (rs, rowNum) -> new StaffRecord(rs.getInt("UserID"), rs.getString("FullName"), rs.getString("Email"), rs.getString("Phone"), normalizeRoleName(rs.getString("RoleName")), rs.getBoolean("IsActive"), rs.getBoolean("IsLocked"), toLocalDate(rs, "DateOfBirth"), rs.getString("Gender"), parseInteger(rs.getObject("ExperienceYears")), rs.getString("Bio")), userId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff account not found."));
        if (!isStaffRole(record.role())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only staff accounts are managed here.");
        }
        return record;
    }

    private ManagedUserRecord requireManagedUserRecord(int userId) {
        return jdbcTemplate.query("""
                SELECT
                    u.UserID,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    u.IsActive,
                    u.IsLocked,
                    r.RoleName,
                    c.DateOfBirth,
                    c.Gender,
                    c.ExperienceYears,
                    c.Bio
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                LEFT JOIN dbo.Coaches c ON c.CoachID = u.UserID
                WHERE u.UserID = ?
                """, (rs, rowNum) -> new ManagedUserRecord(
                rs.getInt("UserID"),
                rs.getString("FullName"),
                rs.getString("Email"),
                rs.getString("Phone"),
                normalizeRoleName(rs.getString("RoleName")),
                rs.getBoolean("IsActive"),
                rs.getBoolean("IsLocked"),
                toLocalDate(rs, "DateOfBirth"),
                rs.getString("Gender"),
                parseInteger(rs.getObject("ExperienceYears")),
                rs.getString("Bio")), userId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User account not found."));
    }

    private Map<String, Object> toStaffMap(ResultSet rs) throws SQLException {
        String normalizedRole = normalizeRoleName(rs.getString("RoleName"));
        if (!isStaffRole(normalizedRole)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only staff accounts are managed here.");
        }

        Map<String, Object> item = new LinkedHashMap<>();
        item.put("userId", rs.getInt("UserID"));
        item.put("fullName", rs.getString("FullName"));
        item.put("email", rs.getString("Email"));
        item.put("phone", rs.getString("Phone"));
        item.put("role", normalizedRole);
        item.put("roleLabel", rs.getString("RoleName"));
        item.put("active", rs.getBoolean("IsActive"));
        item.put("locked", rs.getBoolean("IsLocked"));
        item.put("lockReason", rs.getString("LockReason"));
        item.put("lockedAt", rs.getTimestamp("LockedAt"));
        item.put("emailVerified", rs.getBoolean("IsEmailVerified"));
        item.put("emailVerifiedAt", rs.getTimestamp("EmailVerifiedAt"));
        item.put("createdAt", rs.getTimestamp("CreatedAt"));
        item.put("lastLogin", null);
        item.put("authMode", rs.getString("AuthMode"));

        if ("COACH".equals(normalizedRole)) {
            Map<String, Object> coachProfile = new LinkedHashMap<>();
            coachProfile.put("dateOfBirth", dateToString(toLocalDate(rs, "DateOfBirth")));
            coachProfile.put("gender", rs.getString("Gender"));
            coachProfile.put("experienceYears", parseInteger(rs.getObject("ExperienceYears")));
            coachProfile.put("bio", rs.getString("Bio"));
            item.put("coachProfile", coachProfile);
        } else {
            item.put("coachProfile", Map.of());
        }

        return item;
    }

    private Map<String, Object> toManagedUserMap(ResultSet rs) throws SQLException {
        String normalizedRole = normalizeRoleName(rs.getString("RoleName"));
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("userId", rs.getInt("UserID"));
        item.put("fullName", rs.getString("FullName"));
        item.put("email", rs.getString("Email"));
        item.put("phone", rs.getString("Phone"));
        item.put("role", normalizedRole);
        item.put("roleLabel", rs.getString("RoleName"));
        item.put("active", rs.getBoolean("IsActive"));
        item.put("locked", rs.getBoolean("IsLocked"));
        item.put("lockReason", rs.getString("LockReason"));
        item.put("lockedAt", rs.getTimestamp("LockedAt"));
        item.put("emailVerified", rs.getBoolean("IsEmailVerified"));
        item.put("emailVerifiedAt", rs.getTimestamp("EmailVerifiedAt"));
        item.put("createdAt", rs.getTimestamp("CreatedAt"));
        item.put("lastLogin", null);
        item.put("authMode", rs.getString("AuthMode"));

        if ("COACH".equals(normalizedRole)) {
            Map<String, Object> coachProfile = new LinkedHashMap<>();
            coachProfile.put("dateOfBirth", dateToString(toLocalDate(rs, "DateOfBirth")));
            coachProfile.put("gender", rs.getString("Gender"));
            coachProfile.put("experienceYears", parseInteger(rs.getObject("ExperienceYears")));
            coachProfile.put("bio", rs.getString("Bio"));
            item.put("coachProfile", coachProfile);
        } else {
            item.put("coachProfile", Map.of());
        }

        return item;
    }

    private void upsertCoachProfile(int userId, Map<String, Object> payload) {
        LocalDate dateOfBirth = parseOptionalDate(payload, "dateOfBirth");
        String gender = normalizeNullableText(asText(payload.get("gender")));
        Integer experienceYears = parseInteger(payload.get("experienceYears"));
        if (experienceYears != null && experienceYears < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Experience years cannot be negative.");
        }
        String bio = normalizeNullableText(asText(payload.get("bio")));

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(1) FROM dbo.Coaches WHERE CoachID = ?", Integer.class, userId);
        if (count != null && count > 0) {
            jdbcTemplate.update("""
                    UPDATE dbo.Coaches
                    SET DateOfBirth = ?,
                        Gender = ?,
                        ExperienceYears = ?,
                        Bio = ?
                    WHERE CoachID = ?
                    """, dateOfBirth, gender, experienceYears, bio, userId);
            return;
        }

        jdbcTemplate.update("""
                INSERT INTO dbo.Coaches (CoachID, DateOfBirth, Gender, ExperienceYears, Bio)
                VALUES (?, ?, ?, ?, ?)
                """, userId, dateOfBirth, gender, experienceYears, bio);
    }

    private boolean emailExists(String email, Integer excludeUserId) {
        String sql = "SELECT COUNT(1) FROM dbo.Users WHERE LOWER(Email) = LOWER(?)" + (excludeUserId == null ? "" : " AND UserID <> ?");
        Integer count = excludeUserId == null
                ? jdbcTemplate.queryForObject(sql, Integer.class, email)
                : jdbcTemplate.queryForObject(sql, Integer.class, email, excludeUserId);
        return count != null && count > 0;
    }

    private boolean phoneExists(String phone, Integer excludeUserId) {
        String sql = "SELECT COUNT(1) FROM dbo.Users WHERE PhoneNormalized = ?" + (excludeUserId == null ? "" : " AND UserID <> ?");
        String normalizedPhone = normalizePhoneForLookup(phone);
        Integer count = excludeUserId == null
                ? jdbcTemplate.queryForObject(sql, Integer.class, normalizedPhone)
                : jdbcTemplate.queryForObject(sql, Integer.class, normalizedPhone, excludeUserId);
        return count != null && count > 0;
    }

    private boolean hasAnotherAvailableAdmin(int excludedUserId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM dbo.Users u
                JOIN dbo.Roles r ON r.RoleID = u.RoleID
                WHERE r.RoleName = 'Admin'
                  AND u.IsActive = 1
                  AND u.IsLocked = 0
                  AND u.UserID <> ?
                """, Integer.class, excludedUserId);
        return count != null && count > 0;
    }

    private boolean isStaffRole(String role) {
        return Objects.equals(role, "ADMIN") || Objects.equals(role, "COACH") || Objects.equals(role, "RECEPTIONIST");
    }

    private String requireStaffRole(Object value) {
        String role = normalizeRoleInput(value, false);
        if (role == null || !isStaffRole(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin can create only ADMIN, COACH, or RECEPTIONIST accounts.");
        }
        return role;
    }

    private String requireStaffPhone(Object value) {
        String normalized = normalizePhoneOrThrow(asText(value));
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number is required.");
        }
        return normalized;
    }

    private String requireTemporaryPassword(Map<String, Object> payload) {
        String password = asText(firstNonNull(payload.get("password"), payload.get("temporaryPassword")));
        String confirmPassword = asText(firstNonNull(payload.get("confirmPassword"), password));
        validatePasswordPair(password, confirmPassword);
        return password;
    }

    private String normalizeRoleInput(Object value, boolean allowNull) {
        String text = asText(value);
        if (text == null) {
            return allowNull ? null : null;
        }
        return text.trim().replace(' ', '_').toUpperCase(Locale.ROOT);
    }

    private String normalizeRoleName(String roleName) {
        if (roleName == null) {
            return null;
        }
        return roleName.trim().replace(' ', '_').toUpperCase(Locale.ROOT);
    }

    private String toDbRoleName(String normalizedRole) {
        return switch (normalizedRole) {
            case "ADMIN" -> "Admin";
            case "COACH" -> "Coach";
            case "RECEPTIONIST" -> "Receptionist";
            case "CUSTOMER" -> "Customer";
            default -> normalizedRole;
        };
    }

    private String normalizeEmail(String email) {
        return requireText(email, "Email is required.").trim().toLowerCase(Locale.ROOT);
    }

    private LocalDate toLocalDate(ResultSet rs, String column) throws SQLException {
        java.sql.Date date = rs.getDate(column);
        return date == null ? null : date.toLocalDate();
    }

    private String dateToString(LocalDate value) {
        return value == null ? null : value.format(DATE_FORMAT);
    }

    private String timestampToIso(Timestamp value) {
        return value == null ? null : value.toInstant().toString();
    }

    private ResponseStatusException unsupportedAction(String action) {
        return new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Unsupported users action: " + action);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return new LinkedHashMap<>();
    }

    private String asText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private Integer parseInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Integer integer) {
            return integer;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            String text = String.valueOf(value).trim();
            if (text.isEmpty()) {
                return null;
            }
            return Integer.parseInt(text);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private int requirePositiveInt(Object value, String message) {
        Integer parsed = parseInteger(value);
        if (parsed == null || parsed <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return parsed;
    }

    private Boolean parseBooleanFilter(Object value, String fieldName) {
        if (value == null) {
            return null;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        String text = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        if (text.isEmpty() || "all".equals(text)) {
            return null;
        }
        if ("true".equals(text)) {
            return true;
        }
        if ("false".equals(text)) {
            return false;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid " + fieldName + " filter.");
    }

    private boolean parseBooleanRequired(Object value, String fieldName) {
        Boolean parsed = parseBooleanFilter(value, fieldName);
        if (parsed == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid " + fieldName + " value.");
        }
        return parsed;
    }

    private int queryInt(String sql, Object... params) {
        Integer value = jdbcTemplate.queryForObject(sql, Integer.class, params);
        return value == null ? 0 : value;
    }

    private Object firstNonNull(Object first, Object second) {
        return first != null ? first : second;
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
            if (Character.isWhitespace(ch) || ch == '-' || ch == '(' || ch == ')' || ch == '.' || ch == '\u00A0'
                    || ch == '\u200B' || ch == '\u200C' || ch == '\u200D' || ch == '\uFEFF') {
                continue;
            }
            if (ch >= '0' && ch <= '9') {
                digits.append(ch);
                continue;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number is invalid.");
        }

        if (digits.length() == 0) {
            return null;
        }
        if (digits.length() < 8 || digits.length() > 15) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number is invalid.");
        }
        return hasPlus ? "+" + digits : digits.toString();
    }

    private String normalizePhoneForLookup(String phone) {
        String normalized = normalizePhoneOrThrow(phone);
        if (normalized == null) {
            return null;
        }
        String digits = normalized.startsWith("+") ? normalized.substring(1) : normalized;
        if (digits.startsWith("840")) {
            return "0" + digits.substring(3);
        }
        if (digits.startsWith("84")) {
            return "0" + digits.substring(2);
        }
        return digits;
    }

    private String requireText(String value, String message) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return normalized;
    }

    private void validatePasswordPair(String password, String confirmPassword) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH || !meetsPasswordComplexity(password)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, PASSWORD_POLICY_MESSAGE);
        }
        if (!Objects.equals(password, confirmPassword)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password confirmation does not match.");
        }
    }

    private boolean meetsPasswordComplexity(String password) {
        boolean hasUppercase = false;
        boolean hasNumber = false;
        boolean hasSpecial = false;
        for (int i = 0; i < password.length(); i++) {
            char ch = password.charAt(i);
            if (Character.isUpperCase(ch)) {
                hasUppercase = true;
            } else if (Character.isDigit(ch)) {
                hasNumber = true;
            } else if (!Character.isLetter(ch) && !Character.isWhitespace(ch)) {
                hasSpecial = true;
            }
        }
        return hasUppercase && hasNumber && hasSpecial;
    }

    private LocalDate parseOptionalDate(Map<String, Object> payload, String key) {
        if (!payload.containsKey(key)) {
            return null;
        }
        Object value = payload.get(key);
        String text = asText(value);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text, DATE_FORMAT);
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " must use yyyy-MM-dd format.");
        }
    }

    private record CustomerLookup(int customerId, String fullName, String email, String phone) {
    }

    private record MembershipSnapshot(int customerMembershipId, String status, LocalDate startDate, LocalDate endDate, String planName, String planType) {
    }

    private record MembershipValidity(boolean valid, String reason, Integer customerMembershipId, String status, String planName, String planType, String startDate, String endDate, Integer daysUntilActive) {
    }

    private record StaffRecord(int userId, String fullName, String email, String phone, String role, boolean active, boolean locked, LocalDate coachDateOfBirth, String coachGender, Integer coachExperienceYears, String coachBio) {
    }

    private record ManagedUserRecord(int userId, String fullName, String email, String phone, String role, boolean active, boolean locked, LocalDate coachDateOfBirth, String coachGender, Integer coachExperienceYears, String coachBio) {
    }
}
