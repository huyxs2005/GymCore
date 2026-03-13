const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

function loadApplicationProperties() {
  const propertiesPath = path.join(process.cwd(), 'backend', 'src', 'main', 'resources', 'application.properties')
  const raw = fs.readFileSync(propertiesPath, 'utf8')
  const entries = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    entries[key] = value
  }

  return entries
}

function resolveSpringPlaceholder(value) {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  const placeholderMatch = trimmed.match(/^\$\{([^:}]+):(.+)\}$/)
  if (!placeholderMatch) {
    return trimmed
  }

  const [, envName, fallback] = placeholderMatch
  const envValue = process.env[envName]
  if (envValue != null && String(envValue).trim() !== '') {
    return String(envValue).trim()
  }
  return fallback.trim()
}

function resolveSqlConnection() {
  const properties = loadApplicationProperties()
  const jdbcUrl = resolveSpringPlaceholder(properties['spring.datasource.url'] || '')
  const username = resolveSpringPlaceholder(properties['spring.datasource.username'] || '')
  const password = resolveSpringPlaceholder(properties['spring.datasource.password'] || '')
  const match = jdbcUrl.match(/^jdbc:sqlserver:\/\/([^;:]+)(?::(\d+))?;.*databaseName=([^;]+)/i)

  if (!match) {
    throw new Error(`Unsupported SQL Server JDBC URL: ${jdbcUrl}`)
  }

  return {
    server: match[2] ? `tcp:${match[1]},${match[2]}` : match[1],
    database: match[3],
    username,
    password,
  }
}

function runSqlScript(script, label = 'sql-script') {
  const connection = resolveSqlConnection()
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const tempFile = path.join(os.tmpdir(), `gymcore-${label}-${nonce}.sql`)

  fs.writeFileSync(tempFile, script, 'utf8')
  try {
    try {
      execFileSync(
        'sqlcmd',
        [
          '-S', connection.server,
          '-d', connection.database,
          '-U', connection.username,
          '-P', connection.password,
          '-b',
          '-C',
          '-i', tempFile,
        ],
        {
          stdio: 'pipe',
          encoding: 'utf8',
        },
      )
    } catch (error) {
      const stdout = String(error?.stdout || '').trim()
      const stderr = String(error?.stderr || '').trim()
      const details = [stderr, stdout].filter(Boolean).join('\n')
      if (details) {
        error.message = `${error.message}\n${details}`
      }
      throw error
    }
  } finally {
    try {
      fs.rmSync(tempFile, { force: true })
    } catch (error) {
      if (error && error.code !== 'EPERM') {
        throw error
      }
    }
  }
}

function querySqlScalar(query) {
  const connection = resolveSqlConnection()
  const output = execFileSync(
    'sqlcmd',
    [
      '-S', connection.server,
      '-d', connection.database,
      '-U', connection.username,
      '-P', connection.password,
      '-b',
      '-C',
      '-h', '-1',
      '-W',
      '-Q', query,
    ],
    {
      stdio: 'pipe',
      encoding: 'utf8',
    },
  )

  return String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0] || ''
}

function getLatestReplacementOfferStatus(customerEmail) {
  const escapedEmail = String(customerEmail).replace(/'/g, "''")
  return querySqlScalar(`
SET NOCOUNT ON;
SELECT TOP (1) o.Status
FROM dbo.PTSessionReplacementOffers o
JOIN dbo.PTSessions s ON s.PTSessionID = o.PTSessionID
JOIN dbo.Users u ON u.UserID = s.CustomerID
WHERE u.Email = N'${escapedEmail}'
ORDER BY o.CreatedAt DESC, o.OfferID DESC;
`)
}

function prepareCustomerPtBookingState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @LockResult INT;
EXEC @LockResult = sp_getapplock
    @Resource = N'gymcore-pt-exception-flow',
    @LockMode = N'Exclusive',
    @LockOwner = N'Session',
    @LockTimeout = 10000;
IF @LockResult < 0 THROW 51210, 'Could not acquire PT exception fixture lock.', 1;

DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'customer@gymcore.local');
DECLARE @CoachID INT = (
    SELECT TOP (1) c.CoachID
    FROM dbo.Coaches c
    JOIN dbo.Users u ON u.UserID = c.CoachID
    WHERE u.Email = N'coach@gymcore.local'
);
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @CoachPlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_PLUS_COACH'
      AND AllowsCoachBooking = 1
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @MembershipID INT = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY
        CASE Status WHEN N'ACTIVE' THEN 0 WHEN N'SCHEDULED' THEN 1 ELSE 2 END,
        EndDate DESC,
        CustomerMembershipID DESC
);

IF @CustomerID IS NULL THROW 51000, 'Seed customer account was not found.', 1;
IF @CoachID IS NULL THROW 51001, 'Seed coach account was not found.', 1;
IF @CoachPlanID IS NULL THROW 51002, 'A Gym + Coach membership plan was not found.', 1;

DELETE cf
FROM dbo.CoachFeedback cf
JOIN dbo.PTSessions s ON s.PTSessionID = cf.PTSessionID
WHERE s.CustomerID = @CustomerID;

DELETE n
FROM dbo.PTSessionNotes n
JOIN dbo.PTSessions s ON s.PTSessionID = n.PTSessionID
WHERE s.CustomerID = @CustomerID;

DELETE FROM dbo.PTSessions WHERE CustomerID = @CustomerID;

DELETE prs
FROM dbo.PTRequestSlots prs
JOIN dbo.PTRecurringRequests r ON r.PTRequestID = prs.PTRequestID
WHERE r.CustomerID = @CustomerID;

DELETE FROM dbo.PTRecurringRequests WHERE CustomerID = @CustomerID;

IF @MembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @CoachPlanID, N'ACTIVE', CAST(GETDATE() AS DATE), DATEADD(DAY, 180, CAST(GETDATE() AS DATE)), @AdminID
    );
    SET @MembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @MembershipID THEN N'ACTIVE'
        WHEN Status IN (N'ACTIVE', N'SCHEDULED') THEN N'EXPIRED'
        ELSE Status
    END,
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;

UPDATE dbo.CustomerMemberships
SET MembershipPlanID = @CoachPlanID,
    Status = N'ACTIVE',
    StartDate = CAST(GETDATE() AS DATE),
    EndDate = DATEADD(DAY, 180, CAST(GETDATE() AS DATE)),
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerMembershipID = @MembershipID;

IF NOT EXISTS (
    SELECT 1
    FROM dbo.CoachWeeklyAvailability
    WHERE CoachID = @CoachID
      AND DayOfWeek = 1
      AND TimeSlotID = (SELECT TOP (1) TimeSlotID FROM dbo.TimeSlots WHERE SlotIndex = 1)
)
BEGIN
    INSERT INTO dbo.CoachWeeklyAvailability (CoachID, DayOfWeek, TimeSlotID, IsAvailable)
    SELECT @CoachID, 1, ts.TimeSlotID, CAST(1 AS BIT)
    FROM dbo.TimeSlots ts
    WHERE ts.SlotIndex = 1;
END;
`, 'prepare-pt-booking')
}

function preparePtFlowCustomerState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CustomerRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'CUSTOMER');
DECLARE @SeedPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'customer@gymcore.local'
);
DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'pt.flow.customer@gymcore.local');
DECLARE @CoachID INT = (
    SELECT TOP (1) c.CoachID
    FROM dbo.Coaches c
    JOIN dbo.Users u ON u.UserID = c.CoachID
    WHERE u.Email = N'coach@gymcore.local'
);
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @CoachPlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_PLUS_COACH'
      AND AllowsCoachBooking = 1
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @MembershipID INT;

IF @CustomerRoleID IS NULL THROW 51020, 'CUSTOMER role was not found.', 1;
IF @SeedPasswordHash IS NULL THROW 51021, 'Seed customer password hash was not found.', 1;
IF @CoachID IS NULL THROW 51022, 'Seed coach account was not found.', 1;
IF @CoachPlanID IS NULL THROW 51023, 'A Gym + Coach membership plan was not found.', 1;

IF @CustomerID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CustomerRoleID, N'PT Flow Customer', N'pt.flow.customer@gymcore.local', N'0900000999', @SeedPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @CustomerID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CustomerRoleID,
        FullName = N'PT Flow Customer',
        Phone = N'0900000999',
        PasswordHash = @SeedPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CustomerID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @CustomerID)
BEGIN
    INSERT INTO dbo.Customers (CustomerID, Gender)
    VALUES (@CustomerID, N'OTHER');
END;

SET @MembershipID = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY
        CASE Status WHEN N'ACTIVE' THEN 0 WHEN N'SCHEDULED' THEN 1 ELSE 2 END,
        EndDate DESC,
        CustomerMembershipID DESC
);

DELETE cf
FROM dbo.CoachFeedback cf
JOIN dbo.PTSessions s ON s.PTSessionID = cf.PTSessionID
WHERE s.CustomerID = @CustomerID;

DELETE n
FROM dbo.PTSessionNotes n
JOIN dbo.PTSessions s ON s.PTSessionID = n.PTSessionID
WHERE s.CustomerID = @CustomerID;

DELETE FROM dbo.PTSessions WHERE CustomerID = @CustomerID;

DELETE prs
FROM dbo.PTRequestSlots prs
JOIN dbo.PTRecurringRequests r ON r.PTRequestID = prs.PTRequestID
WHERE r.CustomerID = @CustomerID;

DELETE FROM dbo.PTRecurringRequests WHERE CustomerID = @CustomerID;

IF @MembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @CoachPlanID, N'ACTIVE', CAST(GETDATE() AS DATE), DATEADD(DAY, 180, CAST(GETDATE() AS DATE)), @AdminID
    );
    SET @MembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @MembershipID THEN N'ACTIVE'
        WHEN Status IN (N'ACTIVE', N'SCHEDULED') THEN N'EXPIRED'
        ELSE Status
    END,
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;

UPDATE dbo.CustomerMemberships
SET MembershipPlanID = @CoachPlanID,
    Status = N'ACTIVE',
    StartDate = CAST(GETDATE() AS DATE),
    EndDate = DATEADD(DAY, 180, CAST(GETDATE() AS DATE)),
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerMembershipID = @MembershipID;
`, 'prepare-pt-flow-customer')
}

function prepareMembershipFlowCustomerState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CustomerRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'CUSTOMER');
DECLARE @SeedPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'customer@gymcore.local'
);
DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'membership.flow.customer@gymcore.local');
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @GymOnlyPlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_ONLY'
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @ActiveMembershipID INT;

IF @CustomerRoleID IS NULL THROW 51030, 'CUSTOMER role was not found.', 1;
IF @SeedPasswordHash IS NULL THROW 51031, 'Seed customer password hash was not found.', 1;
IF @GymOnlyPlanID IS NULL THROW 51032, 'An active Gym Only plan was not found.', 1;

IF @CustomerID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CustomerRoleID, N'Membership Flow Customer', N'membership.flow.customer@gymcore.local', N'0900000888', @SeedPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @CustomerID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CustomerRoleID,
        FullName = N'Membership Flow Customer',
        Phone = N'0900000888',
        PasswordHash = @SeedPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CustomerID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @CustomerID)
BEGIN
    INSERT INTO dbo.Customers (CustomerID, Gender)
    VALUES (@CustomerID, N'OTHER');
END;

SET @ActiveMembershipID = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY CustomerMembershipID DESC
);

IF @ActiveMembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @GymOnlyPlanID, N'ACTIVE', CAST(GETDATE() AS DATE), DATEADD(DAY, 30, CAST(GETDATE() AS DATE)), @AdminID
    );
    SET @ActiveMembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @ActiveMembershipID THEN N'ACTIVE'
        ELSE N'EXPIRED'
    END,
    MembershipPlanID = CASE
        WHEN CustomerMembershipID = @ActiveMembershipID THEN @GymOnlyPlanID
        ELSE MembershipPlanID
    END,
    StartDate = CASE
        WHEN CustomerMembershipID = @ActiveMembershipID THEN CAST(GETDATE() AS DATE)
        ELSE StartDate
    END,
    EndDate = CASE
        WHEN CustomerMembershipID = @ActiveMembershipID THEN DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
        ELSE EndDate
    END,
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;
`, 'prepare-membership-flow-customer')
}

function prepareCheckinFlowCustomerState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CustomerRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'CUSTOMER');
DECLARE @SeedPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'customer@gymcore.local'
);
DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'checkin.flow.customer@gymcore.local');
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @PlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_ONLY'
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @MembershipID INT;

IF @CustomerRoleID IS NULL THROW 51040, 'CUSTOMER role was not found.', 1;
IF @SeedPasswordHash IS NULL THROW 51041, 'Seed customer password hash was not found.', 1;
IF @PlanID IS NULL THROW 51042, 'An active Gym Only plan was not found.', 1;

IF @CustomerID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CustomerRoleID, N'Checkin Flow Customer', N'checkin.flow.customer@gymcore.local', N'0900000777', @SeedPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @CustomerID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CustomerRoleID,
        FullName = N'Checkin Flow Customer',
        Phone = N'0900000777',
        PasswordHash = @SeedPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CustomerID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @CustomerID)
BEGIN
    INSERT INTO dbo.Customers (CustomerID, Gender)
    VALUES (@CustomerID, N'OTHER');
END;

SET @MembershipID = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY CustomerMembershipID DESC
);

IF @MembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @PlanID, N'ACTIVE', CAST(GETDATE() AS DATE), DATEADD(DAY, 30, CAST(GETDATE() AS DATE)), @AdminID
    );
    SET @MembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @MembershipID THEN N'ACTIVE'
        ELSE N'EXPIRED'
    END,
    MembershipPlanID = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @PlanID
        ELSE MembershipPlanID
    END,
    StartDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN CAST(GETDATE() AS DATE)
        ELSE StartDate
    END,
    EndDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
        ELSE EndDate
    END,
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;

DELETE FROM dbo.CheckIns
WHERE CustomerID = @CustomerID
  AND CAST(CheckInTime AS DATE) = CAST(GETDATE() AS DATE);
`, 'prepare-checkin-flow-customer')
}

function prepareCoachManagementFlowState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CoachRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'COACH');
DECLARE @CustomerRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'CUSTOMER');
DECLARE @CoachPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'coach@gymcore.local'
);
DECLARE @CustomerPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'customer@gymcore.local'
);
DECLARE @CoachID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'coach.flow.coach@gymcore.local');
DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'coach.flow.customer@gymcore.local');
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @ReceptionID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'reception@gymcore.local');
DECLARE @CoachPlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_PLUS_COACH'
      AND AllowsCoachBooking = 1
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @MembershipID INT;
DECLARE @Slot1 INT = (SELECT TOP (1) TimeSlotID FROM dbo.TimeSlots WHERE SlotIndex = 1 ORDER BY TimeSlotID);
DECLARE @Slot2 INT = (
    SELECT TOP (1) TimeSlotID
    FROM dbo.TimeSlots
    WHERE SlotIndex = 2
    ORDER BY TimeSlotID
);
DECLARE @Today DATE = CAST(GETDATE() AS DATE);
DECLARE @ScheduledDate DATE = DATEADD(DAY, 1, @Today);
DECLARE @CancelledDate DATE = DATEADD(DAY, 2, @Today);
DECLARE @CompletedDate DATE = DATEADD(DAY, -3, @Today);
DECLARE @RequestID INT;
DECLARE @ScheduledSessionID INT;
DECLARE @CancelledSessionID INT;
DECLARE @CompletedSessionID INT;

IF @CoachRoleID IS NULL THROW 51050, 'COACH role was not found.', 1;
IF @CustomerRoleID IS NULL THROW 51051, 'CUSTOMER role was not found.', 1;
IF @CoachPasswordHash IS NULL THROW 51052, 'Seed coach password hash was not found.', 1;
IF @CustomerPasswordHash IS NULL THROW 51053, 'Seed customer password hash was not found.', 1;
IF @CoachPlanID IS NULL THROW 51054, 'A Gym + Coach membership plan was not found.', 1;
IF @Slot1 IS NULL THROW 51055, 'Time slot 1 was not found.', 1;
IF @Slot2 IS NULL SET @Slot2 = @Slot1;

IF @CoachID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CoachRoleID, N'Coach Flow Coach', N'coach.flow.coach@gymcore.local', N'0900000666', @CoachPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @CoachID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CoachRoleID,
        FullName = N'Coach Flow Coach',
        Phone = N'0900000666',
        PasswordHash = @CoachPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CoachID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Coaches WHERE CoachID = @CoachID)
BEGIN
    INSERT INTO dbo.Coaches (CoachID, DateOfBirth, Gender, ExperienceYears, Bio)
    VALUES (@CoachID, '1996-05-10', N'OTHER', 6, N'Dedicated coach fixture for end-to-end workflow coverage.');
END
ELSE
BEGIN
    UPDATE dbo.Coaches
    SET DateOfBirth = '1996-05-10',
        Gender = N'OTHER',
        ExperienceYears = 6,
        Bio = N'Dedicated coach fixture for end-to-end workflow coverage.'
    WHERE CoachID = @CoachID;
END;

IF @CustomerID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CustomerRoleID, N'Coach Flow Customer', N'coach.flow.customer@gymcore.local', N'0900000555', @CustomerPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @CustomerID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CustomerRoleID,
        FullName = N'Coach Flow Customer',
        Phone = N'0900000555',
        PasswordHash = @CustomerPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CustomerID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @CustomerID)
BEGIN
    INSERT INTO dbo.Customers (CustomerID, Gender)
    VALUES (@CustomerID, N'OTHER');
END;

SET @MembershipID = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY
        CASE Status WHEN N'ACTIVE' THEN 0 WHEN N'SCHEDULED' THEN 1 ELSE 2 END,
        EndDate DESC,
        CustomerMembershipID DESC
);

DELETE cf
FROM dbo.CoachFeedback cf
WHERE cf.CustomerID = @CustomerID OR cf.CoachID = @CoachID;

DELETE n
FROM dbo.PTSessionNotes n
JOIN dbo.PTSessions s ON s.PTSessionID = n.PTSessionID
WHERE s.CustomerID = @CustomerID OR s.CoachID = @CoachID;

DELETE FROM dbo.PTSessions WHERE CustomerID = @CustomerID OR CoachID = @CoachID;

DELETE prs
FROM dbo.PTRequestSlots prs
JOIN dbo.PTRecurringRequests r ON r.PTRequestID = prs.PTRequestID
WHERE r.CustomerID = @CustomerID OR r.CoachID = @CoachID;

DELETE FROM dbo.PTRecurringRequests WHERE CustomerID = @CustomerID OR CoachID = @CoachID;
DELETE FROM dbo.CustomerHealthCurrent WHERE CustomerID = @CustomerID;
DELETE FROM dbo.CustomerHealthHistory WHERE CustomerID = @CustomerID;

IF @MembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @CoachPlanID, N'ACTIVE', @Today, DATEADD(DAY, 180, @Today), COALESCE(@AdminID, @ReceptionID)
    );
    SET @MembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @MembershipID THEN N'ACTIVE'
        WHEN Status IN (N'ACTIVE', N'SCHEDULED') THEN N'EXPIRED'
        ELSE Status
    END,
    MembershipPlanID = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @CoachPlanID
        ELSE MembershipPlanID
    END,
    StartDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @Today
        ELSE StartDate
    END,
    EndDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN DATEADD(DAY, 180, @Today)
        ELSE EndDate
    END,
    UpdatedBy = COALESCE(@AdminID, @ReceptionID),
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;

MERGE dbo.CoachWeeklyAvailability AS target
USING (
    SELECT @CoachID AS CoachID, CAST(1 AS TINYINT) AS DayOfWeek, @Slot1 AS TimeSlotID
    UNION ALL
    SELECT @CoachID, CAST(2 AS TINYINT), @Slot2
) AS source
ON target.CoachID = source.CoachID
AND target.DayOfWeek = source.DayOfWeek
AND target.TimeSlotID = source.TimeSlotID
WHEN MATCHED THEN
    UPDATE SET IsAvailable = 1
WHEN NOT MATCHED THEN
    INSERT (CoachID, DayOfWeek, TimeSlotID, IsAvailable)
    VALUES (source.CoachID, source.DayOfWeek, source.TimeSlotID, 1);

INSERT INTO dbo.PTRecurringRequests (
    CustomerID, CoachID, CustomerMembershipID, StartDate, EndDate, Status
)
VALUES (
    @CustomerID, @CoachID, @MembershipID, @Today, DATEADD(DAY, 28, @Today), N'APPROVED'
);

SET @RequestID = SCOPE_IDENTITY();

INSERT INTO dbo.PTRequestSlots (PTRequestID, DayOfWeek, TimeSlotID)
VALUES
    (@RequestID, 1, @Slot1),
    (@RequestID, 2, @Slot2);

INSERT INTO dbo.PTSessions (PTRequestID, CustomerID, CoachID, SessionDate, DayOfWeek, TimeSlotID, Status)
VALUES
    (@RequestID, @CustomerID, @CoachID, @ScheduledDate, 1, @Slot1, N'SCHEDULED'),
    (@RequestID, @CustomerID, @CoachID, @CancelledDate, 2, @Slot2, N'CANCELLED'),
    (@RequestID, @CustomerID, @CoachID, @CompletedDate, 1, @Slot1, N'COMPLETED');

SELECT @ScheduledSessionID = MIN(CASE WHEN Status = N'SCHEDULED' THEN PTSessionID END),
       @CancelledSessionID = MIN(CASE WHEN Status = N'CANCELLED' THEN PTSessionID END),
       @CompletedSessionID = MIN(CASE WHEN Status = N'COMPLETED' THEN PTSessionID END)
FROM dbo.PTSessions
WHERE PTRequestID = @RequestID;

UPDATE dbo.PTSessions
SET CancelReason = N'Customer requested to skip this slot.'
WHERE PTSessionID = @CancelledSessionID;

INSERT INTO dbo.CustomerHealthHistory (CustomerID, HeightCm, WeightKg, RecordedAt)
VALUES (@CustomerID, 172, 68, DATEADD(DAY, -1, SYSDATETIME()));

INSERT INTO dbo.PTSessionNotes (PTSessionID, NoteContent)
VALUES (@CompletedSessionID, N'Initial mobility assessment completed.');

INSERT INTO dbo.CoachFeedback (PTSessionID, CustomerID, CoachID, Rating, Comment)
VALUES (@CompletedSessionID, @CustomerID, @CoachID, 5, N'Very supportive coach.');
`, 'prepare-coach-management-flow')
}

function prepareCoachCustomersFlowState(options = {}) {
  const scope = String(options.scope || 'coach.customers')
  const normalizedScope = scope.replace(/[^a-z0-9]+/gi, '.').replace(/^\.+|\.+$/g, '') || 'coach.customers'
  const coachEmail = escapeSqlString(options.coachEmail || `${normalizedScope}.coach@gymcore.local`)
  const customerEmail = escapeSqlString(options.customerEmail || `${normalizedScope}.customer@gymcore.local`)
  const coachName = escapeSqlString(options.coachName || 'Coach Customers Coach')
  const customerName = escapeSqlString(options.customerName || 'Coach Customers Customer')
  const coachPhone = escapeSqlString(options.coachPhone || '0900000333')
  const customerPhone = escapeSqlString(options.customerPhone || '0900000222')
  const coachBio = escapeSqlString(options.coachBio || 'Dedicated coach-customer management fixture for end-to-end workflow coverage.')
  const lockResource = escapeSqlString(`gymcore-${normalizedScope}-flow`)

  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @LockResult INT;
EXEC @LockResult = sp_getapplock
    @Resource = N'${lockResource}',
    @LockMode = N'Exclusive',
    @LockOwner = N'Session',
    @LockTimeout = 10000;
IF @LockResult < 0 THROW 51069, 'Could not acquire coach customer fixture lock.', 1;

DECLARE @CoachRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'COACH');
DECLARE @CustomerRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'CUSTOMER');
DECLARE @CoachPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'coach@gymcore.local'
);
DECLARE @CustomerPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'customer@gymcore.local'
);
DECLARE @CoachID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'${coachEmail}');
DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'${customerEmail}');
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @ReceptionID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'reception@gymcore.local');
DECLARE @CoachPlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_PLUS_COACH'
      AND AllowsCoachBooking = 1
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @MembershipID INT;
DECLARE @Slot1 INT = (SELECT TOP (1) TimeSlotID FROM dbo.TimeSlots WHERE SlotIndex = 1 ORDER BY TimeSlotID);
DECLARE @Slot2 INT = (
    SELECT TOP (1) TimeSlotID
    FROM dbo.TimeSlots
    WHERE SlotIndex = 2
    ORDER BY TimeSlotID
);
DECLARE @Today DATE = CAST(GETDATE() AS DATE);
DECLARE @ScheduledDate DATE = DATEADD(DAY, 1, @Today);
DECLARE @CompletedDate DATE = DATEADD(DAY, 3, @Today);
DECLARE @RequestID INT;
DECLARE @CompletedSessionID INT;

IF @CoachRoleID IS NULL THROW 51070, 'COACH role was not found.', 1;
IF @CustomerRoleID IS NULL THROW 51071, 'CUSTOMER role was not found.', 1;
IF @CoachPasswordHash IS NULL THROW 51072, 'Seed coach password hash was not found.', 1;
IF @CustomerPasswordHash IS NULL THROW 51073, 'Seed customer password hash was not found.', 1;
IF @CoachPlanID IS NULL THROW 51074, 'A Gym + Coach membership plan was not found.', 1;
IF @Slot1 IS NULL THROW 51075, 'Time slot 1 was not found.', 1;
IF @Slot2 IS NULL SET @Slot2 = @Slot1;

IF @CoachID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CoachRoleID, N'${coachName}', N'${coachEmail}', N'${coachPhone}', @CoachPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @CoachID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CoachRoleID,
        FullName = N'${coachName}',
        Phone = N'${coachPhone}',
        PasswordHash = @CoachPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CoachID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Coaches WHERE CoachID = @CoachID)
BEGIN
    INSERT INTO dbo.Coaches (CoachID, DateOfBirth, Gender, ExperienceYears, Bio)
    VALUES (@CoachID, '1995-08-20', N'OTHER', 7, N'${coachBio}');
END
ELSE
BEGIN
    UPDATE dbo.Coaches
    SET DateOfBirth = '1995-08-20',
        Gender = N'OTHER',
        ExperienceYears = 7,
        Bio = N'${coachBio}'
    WHERE CoachID = @CoachID;
END;

IF @CustomerID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CustomerRoleID, N'${customerName}', N'${customerEmail}', N'${customerPhone}', @CustomerPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @CustomerID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CustomerRoleID,
        FullName = N'${customerName}',
        Phone = N'${customerPhone}',
        PasswordHash = @CustomerPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CustomerID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @CustomerID)
BEGIN
    INSERT INTO dbo.Customers (CustomerID, Gender)
    VALUES (@CustomerID, N'OTHER');
END;

SET @MembershipID = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY
        CASE Status WHEN N'ACTIVE' THEN 0 WHEN N'SCHEDULED' THEN 1 ELSE 2 END,
        EndDate DESC,
        CustomerMembershipID DESC
);

DELETE cf
FROM dbo.CoachFeedback cf
WHERE cf.CustomerID = @CustomerID OR cf.CoachID = @CoachID;

DELETE n
FROM dbo.PTSessionNotes n
JOIN dbo.PTSessions s ON s.PTSessionID = n.PTSessionID
WHERE s.CustomerID = @CustomerID OR s.CoachID = @CoachID;

DELETE FROM dbo.PTSessions WHERE CustomerID = @CustomerID OR CoachID = @CoachID;

DELETE prs
FROM dbo.PTRequestSlots prs
JOIN dbo.PTRecurringRequests r ON r.PTRequestID = prs.PTRequestID
WHERE r.CustomerID = @CustomerID OR r.CoachID = @CoachID;

DELETE FROM dbo.PTRecurringRequests WHERE CustomerID = @CustomerID OR CoachID = @CoachID;
DELETE FROM dbo.CustomerHealthCurrent WHERE CustomerID = @CustomerID;
DELETE FROM dbo.CustomerHealthHistory WHERE CustomerID = @CustomerID;

IF @MembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @CoachPlanID, N'ACTIVE', @Today, DATEADD(DAY, 180, @Today), COALESCE(@AdminID, @ReceptionID)
    );
    SET @MembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @MembershipID THEN N'ACTIVE'
        WHEN Status IN (N'ACTIVE', N'SCHEDULED') THEN N'EXPIRED'
        ELSE Status
    END,
    MembershipPlanID = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @CoachPlanID
        ELSE MembershipPlanID
    END,
    StartDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @Today
        ELSE StartDate
    END,
    EndDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN DATEADD(DAY, 180, @Today)
        ELSE EndDate
    END,
    UpdatedBy = COALESCE(@AdminID, @ReceptionID),
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;

MERGE dbo.CoachWeeklyAvailability AS target
USING (
    SELECT @CoachID AS CoachID, CAST(1 AS TINYINT) AS DayOfWeek, @Slot1 AS TimeSlotID
    UNION ALL
    SELECT @CoachID, CAST(2 AS TINYINT), @Slot2
) AS source
ON target.CoachID = source.CoachID
AND target.DayOfWeek = source.DayOfWeek
AND target.TimeSlotID = source.TimeSlotID
WHEN MATCHED THEN
    UPDATE SET IsAvailable = 1
WHEN NOT MATCHED THEN
    INSERT (CoachID, DayOfWeek, TimeSlotID, IsAvailable)
    VALUES (source.CoachID, source.DayOfWeek, source.TimeSlotID, 1);

INSERT INTO dbo.PTRecurringRequests (
    CustomerID, CoachID, CustomerMembershipID, StartDate, EndDate, Status
)
VALUES (
    @CustomerID, @CoachID, @MembershipID, @Today, DATEADD(DAY, 28, @Today), N'APPROVED'
);

SET @RequestID = SCOPE_IDENTITY();

INSERT INTO dbo.PTRequestSlots (PTRequestID, DayOfWeek, TimeSlotID)
VALUES
    (@RequestID, 1, @Slot1),
    (@RequestID, 2, @Slot2);

INSERT INTO dbo.PTSessions (PTRequestID, CustomerID, CoachID, SessionDate, DayOfWeek, TimeSlotID, Status)
VALUES
    (@RequestID, @CustomerID, @CoachID, @ScheduledDate, 1, @Slot1, N'SCHEDULED'),
    (@RequestID, @CustomerID, @CoachID, @CompletedDate, 1, @Slot1, N'COMPLETED');

SELECT @CompletedSessionID = MIN(CASE WHEN Status = N'COMPLETED' THEN PTSessionID END)
FROM dbo.PTSessions
WHERE PTRequestID = @RequestID;

INSERT INTO dbo.CustomerHealthHistory (CustomerID, HeightCm, WeightKg, RecordedAt)
VALUES (@CustomerID, 171, 67, DATEADD(DAY, -1, SYSDATETIME()));

INSERT INTO dbo.PTSessionNotes (PTSessionID, NoteContent)
VALUES (@CompletedSessionID, N'Initial mobility assessment completed.');

INSERT INTO dbo.CoachFeedback (PTSessionID, CustomerID, CoachID, Rating, Comment)
VALUES (@CompletedSessionID, @CustomerID, @CoachID, 5, N'Very supportive coach.');
`, 'prepare-coach-customers-flow')
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''")
}

function prepareInvoiceFlowState(options = {}) {
  const scope = String(options.scope || 'invoice').toLowerCase()
  const suffix = String(options.codeSuffix || scope).replace(/[^a-z0-9]/gi, '').toUpperCase()
  const email = escapeSqlString(options.email || `${scope}.flow.customer@gymcore.local`)
  const fullName = escapeSqlString(options.fullName || `${scope.charAt(0).toUpperCase()}${scope.slice(1)} Flow Customer`)
  const phone = escapeSqlString(options.phone || '0900000444')
  const awaitingCode = escapeSqlString(options.awaitingCode || `${suffix}-E2E-AWAITING`)
  const pickedCode = escapeSqlString(options.pickedCode || `${suffix}-E2E-PICKED`)

  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CustomerRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'CUSTOMER');
DECLARE @CustomerPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'customer@gymcore.local'
);
DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'${email}');
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @ReceptionID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'reception@gymcore.local');
DECLARE @ProductID INT = (SELECT TOP (1) ProductID FROM dbo.Products WHERE IsActive = 1 ORDER BY ProductID);
DECLARE @ProductName NVARCHAR(255) = (SELECT TOP (1) ProductName FROM dbo.Products WHERE ProductID = @ProductID);
DECLARE @UnitPrice DECIMAL(18, 2) = CAST((SELECT TOP (1) Price FROM dbo.Products WHERE ProductID = @ProductID) AS DECIMAL(18, 2));
DECLARE @AwaitingOrderID INT;
DECLARE @PickedOrderID INT;
DECLARE @AwaitingPaymentID INT;
DECLARE @PickedPaymentID INT;
DECLARE @AwaitingInvoiceID INT;
DECLARE @PickedInvoiceID INT;
DECLARE @AwaitingCode NVARCHAR(50) = N'${awaitingCode}';
DECLARE @PickedCode NVARCHAR(50) = N'${pickedCode}';
DECLARE @Now DATETIME2 = SYSDATETIME();

IF @CustomerRoleID IS NULL THROW 51060, 'CUSTOMER role was not found.', 1;
IF @CustomerPasswordHash IS NULL THROW 51061, 'Seed customer password hash was not found.', 1;
IF @ProductID IS NULL THROW 51062, 'No active product was found.', 1;

IF @CustomerID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CustomerRoleID, N'${fullName}', N'${email}', N'${phone}', @CustomerPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @CustomerID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CustomerRoleID,
        FullName = N'${fullName}',
        Phone = N'${phone}',
        PasswordHash = @CustomerPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CustomerID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @CustomerID)
BEGIN
    INSERT INTO dbo.Customers (CustomerID, Gender)
    VALUES (@CustomerID, N'OTHER');
END;

DELETE FROM dbo.OrderRecipientChangeRequests
WHERE CustomerID = @CustomerID
   OR OrderID IN (SELECT OrderID FROM dbo.Orders WHERE CustomerID = @CustomerID);

DELETE FROM dbo.OrderInvoiceItems
WHERE InvoiceID IN (
    SELECT InvoiceID
    FROM dbo.OrderInvoices
    WHERE CustomerID = @CustomerID
       OR InvoiceCode IN (@AwaitingCode, @PickedCode)
);

DELETE FROM dbo.OrderInvoices
WHERE CustomerID = @CustomerID
   OR InvoiceCode IN (@AwaitingCode, @PickedCode);

DELETE FROM dbo.Payments WHERE OrderID IN (SELECT OrderID FROM dbo.Orders WHERE CustomerID = @CustomerID);
DELETE FROM dbo.Orders WHERE CustomerID = @CustomerID;

INSERT INTO dbo.Orders (
    CustomerID, OrderDate, ClaimID, Subtotal, DiscountApplied, TotalAmount, Status,
    ShippingFullName, ShippingPhone, ShippingEmail, ShippingAddress, UpdatedBy, PaymentMethod
)
VALUES (
    @CustomerID, DATEADD(HOUR, -6, @Now), NULL, @UnitPrice * 2, 0, @UnitPrice * 2, N'PAID',
    N'${fullName}', N'${phone}', N'${email}', N'123 Gym Street', COALESCE(@AdminID, @ReceptionID), N'CASH'
),
(
    @CustomerID, DATEADD(HOUR, -12, @Now), NULL, @UnitPrice, 0, @UnitPrice, N'PAID',
    N'${fullName}', N'${phone}', N'${email}', N'123 Gym Street', COALESCE(@AdminID, @ReceptionID), N'CASH'
);

SELECT @AwaitingOrderID = MIN(OrderID), @PickedOrderID = MAX(OrderID)
FROM dbo.Orders
WHERE CustomerID = @CustomerID;

INSERT INTO dbo.Payments (
    OriginalAmount, DiscountAmount, Amount, Currency, Status, ClaimID,
    PayOS_PaymentLinkId, PayOS_CheckoutUrl, PayOS_Status, PayOS_ExpiredAt,
    CreatedAt, PaidAt, WebhookVerifiedAt, OrderID, CustomerMembershipID, PaymentMethod
)
VALUES
(
    @UnitPrice * 2, 0, @UnitPrice * 2, N'VND', N'SUCCESS', NULL,
    NULL, NULL, N'SUCCESS', NULL,
    DATEADD(HOUR, -6, @Now), DATEADD(HOUR, -5, @Now), DATEADD(HOUR, -5, @Now), @AwaitingOrderID, NULL, N'CASH'
),
(
    @UnitPrice, 0, @UnitPrice, N'VND', N'SUCCESS', NULL,
    NULL, NULL, N'SUCCESS', NULL,
    DATEADD(HOUR, -12, @Now), DATEADD(HOUR, -11, @Now), DATEADD(HOUR, -11, @Now), @PickedOrderID, NULL, N'CASH'
);

SELECT @AwaitingPaymentID = MIN(PaymentID), @PickedPaymentID = MAX(PaymentID)
FROM dbo.Payments
WHERE OrderID IN (@AwaitingOrderID, @PickedOrderID);

INSERT INTO dbo.OrderInvoices (
    InvoiceCode, OrderID, PaymentID, CustomerID, RecipientEmail, RecipientName,
    ShippingPhone, ShippingAddress, PaymentMethod, Currency, Subtotal, DiscountAmount,
    TotalAmount, PaidAt, PickedUpAt, PickedUpByUserID, EmailSentAt, EmailSendError
)
VALUES
(
    @AwaitingCode, @AwaitingOrderID, @AwaitingPaymentID, @CustomerID, N'${email}', N'${fullName}',
    N'${phone}', N'123 Gym Street', N'CASH', N'VND', @UnitPrice * 2, 0,
    @UnitPrice * 2, DATEADD(HOUR, -5, @Now), NULL, NULL, NULL, NULL
),
(
    @PickedCode, @PickedOrderID, @PickedPaymentID, @CustomerID, N'${email}', N'${fullName}',
    N'${phone}', N'123 Gym Street', N'CASH', N'VND', @UnitPrice, 0,
    @UnitPrice, DATEADD(HOUR, -11, @Now), DATEADD(HOUR, -10, @Now), COALESCE(@ReceptionID, @AdminID), DATEADD(HOUR, -10, @Now), NULL
);

SELECT @AwaitingInvoiceID = MIN(InvoiceID), @PickedInvoiceID = MAX(InvoiceID)
FROM dbo.OrderInvoices
WHERE OrderID IN (@AwaitingOrderID, @PickedOrderID);

INSERT INTO dbo.OrderInvoiceItems (InvoiceID, ProductID, ProductName, Quantity, UnitPrice, LineTotal)
VALUES
    (@AwaitingInvoiceID, @ProductID, @ProductName, 2, @UnitPrice, @UnitPrice * 2),
    (@PickedInvoiceID, @ProductID, @ProductName, 1, @UnitPrice, @UnitPrice);

INSERT INTO dbo.OrderRecipientChangeRequests (
    OrderID, CustomerID, RequestedFullName, RequestedPhone, RequestedEmail, Status
)
VALUES (
    @AwaitingOrderID, @CustomerID, N'Updated Pickup Recipient', N'0900000555', N'pickup.alt@gymcore.local', N'PENDING'
);
`, `prepare-invoice-flow-${scope}`)
}

function prepareCustomerCommerceState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'customer@gymcore.local');
DECLARE @CustomerRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'CUSTOMER');
DECLARE @SeedPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'customer@gymcore.local'
);
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @ReceptionID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'reception@gymcore.local');
DECLARE @ProductID INT = (SELECT TOP (1) ProductID FROM dbo.Products WHERE IsActive = 1 ORDER BY ProductID);
DECLARE @ProductName NVARCHAR(255) = (SELECT TOP (1) ProductName FROM dbo.Products WHERE ProductID = @ProductID);
DECLARE @UnitPrice DECIMAL(18, 2) = CAST((SELECT TOP (1) Price FROM dbo.Products WHERE ProductID = @ProductID) AS DECIMAL(18, 2));
DECLARE @CartID INT;
DECLARE @AwaitingOrderID INT;
DECLARE @PickedOrderID INT;
DECLARE @AwaitingPaymentID INT;
DECLARE @PickedPaymentID INT;
DECLARE @AwaitingInvoiceID INT;
DECLARE @PickedInvoiceID INT;
DECLARE @AwaitingCode NVARCHAR(50) = N'ORD-COMMERCE-AWAITING';
DECLARE @PickedCode NVARCHAR(50) = N'ORD-COMMERCE-PICKED';
DECLARE @Now DATETIME2 = SYSDATETIME();
DECLARE @WelcomePromoID INT = (SELECT TOP (1) PromotionID FROM dbo.Promotions WHERE PromoCode = N'WELCOME10');

IF @CustomerID IS NULL THROW 51080, 'Seed customer account was not found.', 1;
IF @CustomerRoleID IS NULL THROW 51081, 'CUSTOMER role was not found.', 1;
IF @SeedPasswordHash IS NULL THROW 51082, 'Seed customer password hash was not found.', 1;
IF @ProductID IS NULL THROW 51083, 'No active product was found.', 1;

UPDATE dbo.Users
SET RoleID = @CustomerRoleID,
    FullName = N'Customer Minh',
    Phone = N'0900000111',
    PasswordHash = @SeedPasswordHash,
    IsEmailVerified = 1,
    EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
    IsActive = 1,
    IsLocked = 0,
    UpdatedAt = SYSDATETIME()
WHERE UserID = @CustomerID;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @CustomerID)
BEGIN
    INSERT INTO dbo.Customers (CustomerID, Gender)
    VALUES (@CustomerID, N'OTHER');
END;

SELECT @CartID = CartID
FROM dbo.Carts
WHERE CustomerID = @CustomerID;

IF @CartID IS NULL
BEGIN
    INSERT INTO dbo.Carts (CustomerID, UpdatedAt)
    VALUES (@CustomerID, SYSDATETIME());
    SET @CartID = SCOPE_IDENTITY();
END;

DELETE FROM dbo.CartItems WHERE CartID = @CartID;

DELETE FROM dbo.OrderRecipientChangeRequests
WHERE CustomerID = @CustomerID
   OR OrderID IN (SELECT OrderID FROM dbo.Orders WHERE CustomerID = @CustomerID);

DELETE FROM dbo.ProductReviews
WHERE CustomerID = @CustomerID
  AND ProductID = @ProductID;

DELETE FROM dbo.OrderInvoiceItems
WHERE InvoiceID IN (
    SELECT InvoiceID
    FROM dbo.OrderInvoices
    WHERE CustomerID = @CustomerID
       OR InvoiceCode IN (@AwaitingCode, @PickedCode)
);

DELETE FROM dbo.OrderInvoices
WHERE CustomerID = @CustomerID
   OR InvoiceCode IN (@AwaitingCode, @PickedCode);

DELETE FROM dbo.Payments
WHERE OrderID IN (SELECT OrderID FROM dbo.Orders WHERE CustomerID = @CustomerID);

DELETE FROM dbo.OrderItems
WHERE OrderID IN (SELECT OrderID FROM dbo.Orders WHERE CustomerID = @CustomerID);

DELETE FROM dbo.Orders
WHERE CustomerID = @CustomerID;

DELETE FROM dbo.UserPromotionClaims
WHERE UserID = @CustomerID;

INSERT INTO dbo.Orders (
    CustomerID, OrderDate, ClaimID, Subtotal, DiscountApplied, TotalAmount, Status,
    ShippingFullName, ShippingPhone, ShippingEmail, ShippingAddress, UpdatedBy, PaymentMethod
)
VALUES (
    @CustomerID, DATEADD(HOUR, -4, @Now), NULL, @UnitPrice * 2, 0, @UnitPrice * 2, N'PAID',
    N'Customer Minh', N'0900000111', N'customer@gymcore.local', N'123 Gym Street', COALESCE(@AdminID, @ReceptionID), N'CASH'
),
(
    @CustomerID, DATEADD(HOUR, -8, @Now), NULL, @UnitPrice, 0, @UnitPrice, N'PAID',
    N'Customer Minh', N'0900000111', N'customer@gymcore.local', N'123 Gym Street', COALESCE(@AdminID, @ReceptionID), N'CASH'
);

SELECT @AwaitingOrderID = MIN(OrderID), @PickedOrderID = MAX(OrderID)
FROM dbo.Orders
WHERE CustomerID = @CustomerID;

INSERT INTO dbo.OrderItems (OrderID, ProductID, Quantity, UnitPrice)
VALUES
    (@AwaitingOrderID, @ProductID, 2, @UnitPrice),
    (@PickedOrderID, @ProductID, 1, @UnitPrice);

INSERT INTO dbo.Payments (
    OriginalAmount, DiscountAmount, Amount, Currency, Status, ClaimID,
    PayOS_PaymentLinkId, PayOS_CheckoutUrl, PayOS_Status, PayOS_ExpiredAt,
    CreatedAt, PaidAt, WebhookVerifiedAt, OrderID, CustomerMembershipID, PaymentMethod
)
VALUES
(
    @UnitPrice * 2, 0, @UnitPrice * 2, N'VND', N'SUCCESS', NULL,
    NULL, NULL, N'SUCCESS', NULL,
    DATEADD(HOUR, -4, @Now), DATEADD(HOUR, -3, @Now), DATEADD(HOUR, -3, @Now), @AwaitingOrderID, NULL, N'CASH'
),
(
    @UnitPrice, 0, @UnitPrice, N'VND', N'SUCCESS', NULL,
    NULL, NULL, N'SUCCESS', NULL,
    DATEADD(HOUR, -8, @Now), DATEADD(HOUR, -7, @Now), DATEADD(HOUR, -7, @Now), @PickedOrderID, NULL, N'CASH'
);

SELECT @AwaitingPaymentID = MIN(PaymentID), @PickedPaymentID = MAX(PaymentID)
FROM dbo.Payments
WHERE OrderID IN (@AwaitingOrderID, @PickedOrderID);

INSERT INTO dbo.OrderInvoices (
    InvoiceCode, OrderID, PaymentID, CustomerID, RecipientEmail, RecipientName,
    ShippingPhone, ShippingAddress, PaymentMethod, Currency, Subtotal, DiscountAmount,
    TotalAmount, PaidAt, PickedUpAt, PickedUpByUserID, EmailSentAt, EmailSendError
)
VALUES
(
    @AwaitingCode, @AwaitingOrderID, @AwaitingPaymentID, @CustomerID, N'customer@gymcore.local', N'Customer Minh',
    N'0900000111', N'123 Gym Street', N'CASH', N'VND', @UnitPrice * 2, 0,
    @UnitPrice * 2, DATEADD(HOUR, -3, @Now), NULL, NULL, DATEADD(HOUR, -3, @Now), NULL
),
(
    @PickedCode, @PickedOrderID, @PickedPaymentID, @CustomerID, N'customer@gymcore.local', N'Customer Minh',
    N'0900000111', N'123 Gym Street', N'CASH', N'VND', @UnitPrice, 0,
    @UnitPrice, DATEADD(HOUR, -7, @Now), DATEADD(HOUR, -6, @Now), COALESCE(@ReceptionID, @AdminID), DATEADD(HOUR, -7, @Now), NULL
);

SELECT @AwaitingInvoiceID = MIN(InvoiceID), @PickedInvoiceID = MAX(InvoiceID)
FROM dbo.OrderInvoices
WHERE OrderID IN (@AwaitingOrderID, @PickedOrderID);

INSERT INTO dbo.OrderInvoiceItems (InvoiceID, ProductID, ProductName, Quantity, UnitPrice, LineTotal)
VALUES
    (@AwaitingInvoiceID, @ProductID, @ProductName, 2, @UnitPrice, @UnitPrice * 2),
    (@PickedInvoiceID, @ProductID, @ProductName, 1, @UnitPrice, @UnitPrice);

IF @WelcomePromoID IS NOT NULL
BEGIN
    DELETE FROM dbo.UserPromotionClaims
    WHERE UserID = @CustomerID
      AND PromotionID = @WelcomePromoID;
END;
`, 'prepare-customer-commerce')
}

function restoreSeedPtBookingState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'customer@gymcore.local');
DECLARE @CoachID INT = (
    SELECT TOP (1) c.CoachID
    FROM dbo.Coaches c
    JOIN dbo.Users u ON u.UserID = c.CoachID
    WHERE u.Email = N'coach@gymcore.local'
);
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @CoachPlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_PLUS_COACH'
      AND AllowsCoachBooking = 1
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @MembershipID INT = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY
        CASE Status WHEN N'ACTIVE' THEN 0 WHEN N'SCHEDULED' THEN 1 ELSE 2 END,
        EndDate DESC,
        CustomerMembershipID DESC
);
DECLARE @Slot1 INT = (SELECT TOP (1) TimeSlotID FROM dbo.TimeSlots WHERE SlotIndex = 1);
DECLARE @Start DATE = CAST(GETDATE() AS DATE);
DECLARE @PTRequestID INT;

IF @CustomerID IS NULL THROW 51010, 'Seed customer account was not found.', 1;
IF @CoachID IS NULL THROW 51011, 'Seed coach account was not found.', 1;
IF @CoachPlanID IS NULL THROW 51012, 'A Gym + Coach membership plan was not found.', 1;
IF @Slot1 IS NULL THROW 51013, 'Seed slot 1 was not found.', 1;

DELETE cf
FROM dbo.CoachFeedback cf
JOIN dbo.PTSessions s ON s.PTSessionID = cf.PTSessionID
WHERE s.CustomerID = @CustomerID;

DELETE n
FROM dbo.PTSessionNotes n
JOIN dbo.PTSessions s ON s.PTSessionID = n.PTSessionID
WHERE s.CustomerID = @CustomerID;

DELETE FROM dbo.PTSessions WHERE CustomerID = @CustomerID;

DELETE prs
FROM dbo.PTRequestSlots prs
JOIN dbo.PTRecurringRequests r ON r.PTRequestID = prs.PTRequestID
WHERE r.CustomerID = @CustomerID;

DELETE FROM dbo.PTRecurringRequests WHERE CustomerID = @CustomerID;

IF @MembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @CoachPlanID, N'ACTIVE', @Start, DATEADD(DAY, 180, @Start), @AdminID
    );
    SET @MembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @MembershipID THEN N'ACTIVE'
        WHEN Status IN (N'ACTIVE', N'SCHEDULED') THEN N'EXPIRED'
        ELSE Status
    END,
    MembershipPlanID = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @CoachPlanID
        ELSE MembershipPlanID
    END,
    StartDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @Start
        ELSE StartDate
    END,
    EndDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN DATEADD(DAY, 180, @Start)
        ELSE EndDate
    END,
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;

INSERT INTO dbo.PTRecurringRequests (
    CustomerID, CoachID, CustomerMembershipID, StartDate, EndDate, Status
)
VALUES (
    @CustomerID, @CoachID, @MembershipID, @Start, DATEADD(DAY, 28, @Start), N'APPROVED'
);

SET @PTRequestID = SCOPE_IDENTITY();

INSERT INTO dbo.PTRequestSlots (PTRequestID, DayOfWeek, TimeSlotID)
VALUES
    (@PTRequestID, 1, @Slot1),
    (@PTRequestID, 3, @Slot1),
    (@PTRequestID, 5, @Slot1);

INSERT INTO dbo.PTSessions (PTRequestID, CustomerID, CoachID, SessionDate, DayOfWeek, TimeSlotID, Status)
VALUES
    (@PTRequestID, @CustomerID, @CoachID, DATEADD(DAY, 1, @Start), 1, @Slot1, N'SCHEDULED'),
    (@PTRequestID, @CustomerID, @CoachID, DATEADD(DAY, 3, @Start), 3, @Slot1, N'SCHEDULED'),
    (@PTRequestID, @CustomerID, @CoachID, DATEADD(DAY, 5, @Start), 5, @Slot1, N'SCHEDULED');
`, 'restore-pt-booking')
}

function prepareSupportConsoleCustomerState(options = {}) {
  const {
    email = 'admin.support.customer@gymcore.local',
    fullName = 'Admin Support Customer',
    phone = '0900000777',
  } = options

  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @Email NVARCHAR(255) = N'${email.replace(/'/g, "''")}';
DECLARE @FullName NVARCHAR(255) = N'${fullName.replace(/'/g, "''")}';
DECLARE @Phone NVARCHAR(20) = N'${phone.replace(/'/g, "''")}';
DECLARE @CustomerRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'CUSTOMER');
DECLARE @SeedPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'customer@gymcore.local'
);
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @GymOnlyPlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_ONLY'
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @CustomerID INT = (
    SELECT TOP (1) UserID
    FROM dbo.Users
    WHERE Email = @Email OR Phone = @Phone OR PhoneNormalized = @Phone
    ORDER BY CASE WHEN Email = @Email THEN 0 ELSE 1 END, UserID DESC
);
DECLARE @MembershipID INT;

IF @CustomerRoleID IS NULL THROW 51110, 'CUSTOMER role was not found.', 1;
IF @SeedPasswordHash IS NULL THROW 51111, 'Seed customer password hash was not found.', 1;
IF @GymOnlyPlanID IS NULL THROW 51112, 'An active Gym Only plan was not found.', 1;

IF @CustomerID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked, LockReason
    )
    VALUES (
        @CustomerRoleID, @FullName, @Email, @Phone, @SeedPasswordHash, 1, SYSDATETIME(), 1, 0, NULL
    );
    SET @CustomerID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CustomerRoleID,
        FullName = @FullName,
        Email = @Email,
        Phone = @Phone,
        PasswordHash = @SeedPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        LockReason = NULL,
        LockedAt = NULL,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CustomerID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @CustomerID)
BEGIN
    INSERT INTO dbo.Customers (CustomerID, Gender)
    VALUES (@CustomerID, N'OTHER');
END;

DELETE FROM dbo.PTSessions WHERE CustomerID = @CustomerID;
DELETE prs
FROM dbo.PTRequestSlots prs
JOIN dbo.PTRecurringRequests r ON r.PTRequestID = prs.PTRequestID
WHERE r.CustomerID = @CustomerID;
DELETE FROM dbo.PTRecurringRequests WHERE CustomerID = @CustomerID;

SET @MembershipID = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY
        CASE Status WHEN N'ACTIVE' THEN 0 WHEN N'SCHEDULED' THEN 1 ELSE 2 END,
        EndDate DESC,
        CustomerMembershipID DESC
);

IF @MembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @GymOnlyPlanID, N'ACTIVE', CAST(GETDATE() AS DATE), DATEADD(DAY, 90, CAST(GETDATE() AS DATE)), @AdminID
    );
    SET @MembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @MembershipID THEN N'ACTIVE'
        WHEN Status IN (N'ACTIVE', N'SCHEDULED', N'PENDING') THEN N'EXPIRED'
        ELSE Status
    END,
    MembershipPlanID = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @GymOnlyPlanID
        ELSE MembershipPlanID
    END,
    StartDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN CAST(GETDATE() AS DATE)
        ELSE StartDate
    END,
    EndDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN DATEADD(DAY, 90, CAST(GETDATE() AS DATE))
        ELSE EndDate
    END,
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;
`, 'prepare-support-console-customer')
}

function preparePtExceptionFlowState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CoachRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'COACH');
DECLARE @CustomerRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'CUSTOMER');
DECLARE @CoachPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'coach@gymcore.local'
);
DECLARE @CustomerPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'customer@gymcore.local'
);
DECLARE @PrimaryCoachID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'pt.exception.coach@gymcore.local');
DECLARE @BackupCoachID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'pt.exception.backup@gymcore.local');
DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'pt.exception.customer@gymcore.local');
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @CoachPlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_PLUS_COACH'
      AND AllowsCoachBooking = 1
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @Slot1 INT = (SELECT TOP (1) TimeSlotID FROM dbo.TimeSlots WHERE SlotIndex = 1 ORDER BY TimeSlotID);
DECLARE @Slot2 INT = (SELECT TOP (1) TimeSlotID FROM dbo.TimeSlots WHERE SlotIndex = 2 ORDER BY TimeSlotID);
DECLARE @Start DATE = CAST(GETDATE() AS DATE);
DECLARE @FirstSessionDate DATE = DATEADD(DAY, 3, @Start);
DECLARE @SecondSessionDate DATE = DATEADD(DAY, 4, @Start);
DECLARE @FirstDayOfWeek INT = ((DATEDIFF(DAY, '19000101', @FirstSessionDate) % 7) + 1);
DECLARE @SecondDayOfWeek INT = ((DATEDIFF(DAY, '19000101', @SecondSessionDate) % 7) + 1);
DECLARE @MembershipID INT;
DECLARE @PTRequestID INT;
DECLARE @FirstSessionID INT;

IF @CoachRoleID IS NULL THROW 51200, 'COACH role was not found.', 1;
IF @CustomerRoleID IS NULL THROW 51201, 'CUSTOMER role was not found.', 1;
IF @CoachPasswordHash IS NULL THROW 51202, 'Seed coach password hash was not found.', 1;
IF @CustomerPasswordHash IS NULL THROW 51203, 'Seed customer password hash was not found.', 1;
IF @CoachPlanID IS NULL THROW 51204, 'A Gym + Coach membership plan was not found.', 1;
IF @Slot1 IS NULL THROW 51205, 'Time slot 1 was not found.', 1;
IF @Slot2 IS NULL SET @Slot2 = @Slot1;

IF @PrimaryCoachID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CoachRoleID, N'PT Exception Coach', N'pt.exception.coach@gymcore.local', N'0999111444', @CoachPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @PrimaryCoachID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CoachRoleID,
        FullName = N'PT Exception Coach',
        Phone = N'0999111444',
        PasswordHash = @CoachPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @PrimaryCoachID;
END;

IF @BackupCoachID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CoachRoleID, N'PT Backup Coach', N'pt.exception.backup@gymcore.local', N'0999111333', @CoachPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @BackupCoachID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CoachRoleID,
        FullName = N'PT Backup Coach',
        Phone = N'0999111333',
        PasswordHash = @CoachPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @BackupCoachID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Coaches WHERE CoachID = @PrimaryCoachID)
BEGIN
    INSERT INTO dbo.Coaches (CoachID, ExperienceYears, Bio)
    VALUES (@PrimaryCoachID, 4, N'PT exception primary coach');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Coaches WHERE CoachID = @BackupCoachID)
BEGIN
    INSERT INTO dbo.Coaches (CoachID, ExperienceYears, Bio)
    VALUES (@BackupCoachID, 3, N'PT exception backup coach');
END;

IF @CustomerID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CustomerRoleID, N'PT Exception Customer', N'pt.exception.customer@gymcore.local', N'0999111222', @CustomerPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @CustomerID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CustomerRoleID,
        FullName = N'PT Exception Customer',
        Phone = N'0999111222',
        PasswordHash = @CustomerPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CustomerID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @CustomerID)
BEGIN
    INSERT INTO dbo.Customers (CustomerID, Gender)
    VALUES (@CustomerID, N'OTHER');
END;

DELETE FROM dbo.PTSessionReplacementOffers
WHERE PTSessionID IN (SELECT PTSessionID FROM dbo.PTSessions WHERE CustomerID = @CustomerID);
DELETE FROM dbo.CoachUnavailableBlocks WHERE CoachID IN (@PrimaryCoachID, @BackupCoachID);
DELETE FROM dbo.PTSessionNotes WHERE PTSessionID IN (SELECT PTSessionID FROM dbo.PTSessions WHERE CustomerID = @CustomerID);
DELETE FROM dbo.PTSessions WHERE CustomerID = @CustomerID;
DELETE prs
FROM dbo.PTRequestSlots prs
JOIN dbo.PTRecurringRequests r ON r.PTRequestID = prs.PTRequestID
WHERE r.CustomerID = @CustomerID;
DELETE FROM dbo.PTRecurringRequests WHERE CustomerID = @CustomerID;

SET @MembershipID = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY
        CASE Status WHEN N'ACTIVE' THEN 0 WHEN N'SCHEDULED' THEN 1 ELSE 2 END,
        EndDate DESC,
        CustomerMembershipID DESC
);

IF @MembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @CoachPlanID, N'ACTIVE', @Start, DATEADD(DAY, 120, @Start), @AdminID
    );
    SET @MembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @MembershipID THEN N'ACTIVE'
        WHEN Status IN (N'ACTIVE', N'SCHEDULED', N'PENDING') THEN N'EXPIRED'
        ELSE Status
    END,
    MembershipPlanID = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @CoachPlanID
        ELSE MembershipPlanID
    END,
    StartDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @Start
        ELSE StartDate
    END,
    EndDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN DATEADD(DAY, 120, @Start)
        ELSE EndDate
    END,
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;

DELETE FROM dbo.CoachWeeklyAvailability WHERE CoachID IN (@PrimaryCoachID, @BackupCoachID);
INSERT INTO dbo.CoachWeeklyAvailability (CoachID, DayOfWeek, TimeSlotID, IsAvailable)
VALUES
    (@PrimaryCoachID, @FirstDayOfWeek, @Slot1, 1),
    (@PrimaryCoachID, @SecondDayOfWeek, @Slot1, 1),
    (@PrimaryCoachID, @SecondDayOfWeek, @Slot2, 1),
    (@BackupCoachID, @FirstDayOfWeek, @Slot1, 1),
    (@BackupCoachID, @SecondDayOfWeek, @Slot1, 1),
    (@BackupCoachID, @SecondDayOfWeek, @Slot2, 1);

INSERT INTO dbo.PTRecurringRequests (
    CustomerID, CoachID, CustomerMembershipID, StartDate, EndDate, Status, BookingMode
)
VALUES (
    @CustomerID, @PrimaryCoachID, @MembershipID, @Start, DATEADD(DAY, 35, @Start), N'APPROVED', N'INSTANT'
);

SET @PTRequestID = SCOPE_IDENTITY();

INSERT INTO dbo.PTRequestSlots (PTRequestID, DayOfWeek, TimeSlotID)
VALUES
    (@PTRequestID, @FirstDayOfWeek, @Slot1),
    (@PTRequestID, @SecondDayOfWeek, @Slot1);

INSERT INTO dbo.PTSessions (PTRequestID, CustomerID, CoachID, SessionDate, DayOfWeek, TimeSlotID, Status)
VALUES
    (@PTRequestID, @CustomerID, @PrimaryCoachID, @FirstSessionDate, @FirstDayOfWeek, @Slot1, N'SCHEDULED'),
    (@PTRequestID, @CustomerID, @PrimaryCoachID, @SecondSessionDate, @SecondDayOfWeek, @Slot1, N'SCHEDULED');

`, 'prepare-pt-exception-flow')
}

function preparePtExceptionScheduleState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CoachRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'COACH');
DECLARE @CustomerRoleID INT = (SELECT TOP (1) RoleID FROM dbo.Roles WHERE RoleName = N'CUSTOMER');
DECLARE @CoachPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'coach@gymcore.local'
);
DECLARE @CustomerPasswordHash NVARCHAR(255) = (
    SELECT TOP (1) PasswordHash
    FROM dbo.Users
    WHERE Email = N'customer@gymcore.local'
);
DECLARE @PrimaryCoachID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'pt.exception.schedule.coach@gymcore.local');
DECLARE @BackupCoachID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'pt.exception.schedule.backup@gymcore.local');
DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'pt.exception.schedule.customer@gymcore.local');
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @CoachPlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_PLUS_COACH'
      AND AllowsCoachBooking = 1
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @Slot1 INT = (SELECT TOP (1) TimeSlotID FROM dbo.TimeSlots WHERE SlotIndex = 1 ORDER BY TimeSlotID);
DECLARE @Slot2 INT = (SELECT TOP (1) TimeSlotID FROM dbo.TimeSlots WHERE SlotIndex = 2 ORDER BY TimeSlotID);
DECLARE @Start DATE = CAST(GETDATE() AS DATE);
DECLARE @FirstSessionDate DATE = DATEADD(DAY, 3, @Start);
DECLARE @SecondSessionDate DATE = DATEADD(DAY, 4, @Start);
DECLARE @FirstDayOfWeek INT = ((DATEDIFF(DAY, '19000101', @FirstSessionDate) % 7) + 1);
DECLARE @SecondDayOfWeek INT = ((DATEDIFF(DAY, '19000101', @SecondSessionDate) % 7) + 1);
DECLARE @MembershipID INT;
DECLARE @PTRequestID INT;

IF @CoachRoleID IS NULL THROW 51220, 'COACH role was not found.', 1;
IF @CustomerRoleID IS NULL THROW 51221, 'CUSTOMER role was not found.', 1;
IF @CoachPasswordHash IS NULL THROW 51222, 'Seed coach password hash was not found.', 1;
IF @CustomerPasswordHash IS NULL THROW 51223, 'Seed customer password hash was not found.', 1;
IF @CoachPlanID IS NULL THROW 51224, 'A Gym + Coach membership plan was not found.', 1;
IF @Slot1 IS NULL THROW 51225, 'Time slot 1 was not found.', 1;
IF @Slot2 IS NULL SET @Slot2 = @Slot1;

IF @PrimaryCoachID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CoachRoleID, N'PT Exception Schedule Coach', N'pt.exception.schedule.coach@gymcore.local', N'0999112444', @CoachPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @PrimaryCoachID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CoachRoleID,
        FullName = N'PT Exception Schedule Coach',
        Phone = N'0999112444',
        PasswordHash = @CoachPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @PrimaryCoachID;
END;

IF @BackupCoachID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CoachRoleID, N'PT Schedule Backup Coach', N'pt.exception.schedule.backup@gymcore.local', N'0999112333', @CoachPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @BackupCoachID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CoachRoleID,
        FullName = N'PT Schedule Backup Coach',
        Phone = N'0999112333',
        PasswordHash = @CoachPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @BackupCoachID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Coaches WHERE CoachID = @PrimaryCoachID)
BEGIN
    INSERT INTO dbo.Coaches (CoachID, ExperienceYears, Bio)
    VALUES (@PrimaryCoachID, 4, N'PT exception schedule primary coach');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Coaches WHERE CoachID = @BackupCoachID)
BEGIN
    INSERT INTO dbo.Coaches (CoachID, ExperienceYears, Bio)
    VALUES (@BackupCoachID, 3, N'PT exception schedule backup coach');
END;

IF @CustomerID IS NULL
BEGIN
    INSERT INTO dbo.Users (
        RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked
    )
    VALUES (
        @CustomerRoleID, N'PT Exception Schedule Customer', N'pt.exception.schedule.customer@gymcore.local', N'0999112222', @CustomerPasswordHash, 1, SYSDATETIME(), 1, 0
    );
    SET @CustomerID = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.Users
    SET RoleID = @CustomerRoleID,
        FullName = N'PT Exception Schedule Customer',
        Phone = N'0999112222',
        PasswordHash = @CustomerPasswordHash,
        IsEmailVerified = 1,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
        IsActive = 1,
        IsLocked = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserID = @CustomerID;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @CustomerID)
BEGIN
    INSERT INTO dbo.Customers (CustomerID, Gender)
    VALUES (@CustomerID, N'OTHER');
END;

DELETE FROM dbo.PTSessionReplacementOffers
WHERE PTSessionID IN (SELECT PTSessionID FROM dbo.PTSessions WHERE CustomerID = @CustomerID);
DELETE FROM dbo.CoachUnavailableBlocks WHERE CoachID IN (@PrimaryCoachID, @BackupCoachID);
DELETE FROM dbo.PTSessionNotes WHERE PTSessionID IN (SELECT PTSessionID FROM dbo.PTSessions WHERE CustomerID = @CustomerID);
DELETE FROM dbo.PTSessions WHERE CustomerID = @CustomerID;
DELETE prs
FROM dbo.PTRequestSlots prs
JOIN dbo.PTRecurringRequests r ON r.PTRequestID = prs.PTRequestID
WHERE r.CustomerID = @CustomerID;
DELETE FROM dbo.PTRecurringRequests WHERE CustomerID = @CustomerID;

SET @MembershipID = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY
        CASE Status WHEN N'ACTIVE' THEN 0 WHEN N'SCHEDULED' THEN 1 ELSE 2 END,
        EndDate DESC,
        CustomerMembershipID DESC
);

IF @MembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @CoachPlanID, N'ACTIVE', @Start, DATEADD(DAY, 120, @Start), @AdminID
    );
    SET @MembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @MembershipID THEN N'ACTIVE'
        WHEN Status IN (N'ACTIVE', N'SCHEDULED', N'PENDING') THEN N'EXPIRED'
        ELSE Status
    END,
    MembershipPlanID = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @CoachPlanID
        ELSE MembershipPlanID
    END,
    StartDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @Start
        ELSE StartDate
    END,
    EndDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN DATEADD(DAY, 120, @Start)
        ELSE EndDate
    END,
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;

DELETE FROM dbo.CoachWeeklyAvailability WHERE CoachID IN (@PrimaryCoachID, @BackupCoachID);
INSERT INTO dbo.CoachWeeklyAvailability (CoachID, DayOfWeek, TimeSlotID, IsAvailable)
VALUES
    (@PrimaryCoachID, @FirstDayOfWeek, @Slot1, 1),
    (@PrimaryCoachID, @SecondDayOfWeek, @Slot1, 1),
    (@PrimaryCoachID, @SecondDayOfWeek, @Slot2, 1),
    (@BackupCoachID, @FirstDayOfWeek, @Slot1, 1),
    (@BackupCoachID, @SecondDayOfWeek, @Slot1, 1),
    (@BackupCoachID, @SecondDayOfWeek, @Slot2, 1);

INSERT INTO dbo.PTRecurringRequests (
    CustomerID, CoachID, CustomerMembershipID, StartDate, EndDate, Status, BookingMode
)
VALUES (
    @CustomerID, @PrimaryCoachID, @MembershipID, @Start, DATEADD(DAY, 35, @Start), N'APPROVED', N'INSTANT'
);

SET @PTRequestID = SCOPE_IDENTITY();

INSERT INTO dbo.PTRequestSlots (PTRequestID, DayOfWeek, TimeSlotID)
VALUES
    (@PTRequestID, @FirstDayOfWeek, @Slot1),
    (@PTRequestID, @SecondDayOfWeek, @Slot1);

INSERT INTO dbo.PTSessions (PTRequestID, CustomerID, CoachID, SessionDate, DayOfWeek, TimeSlotID, Status)
VALUES
    (@PTRequestID, @CustomerID, @PrimaryCoachID, @FirstSessionDate, @FirstDayOfWeek, @Slot1, N'SCHEDULED'),
    (@PTRequestID, @CustomerID, @PrimaryCoachID, @SecondSessionDate, @SecondDayOfWeek, @Slot1, N'SCHEDULED');

`, 'prepare-pt-exception-schedule')
}

function prepareCustomerAiPlanningState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'customer@gymcore.local');
DECLARE @CoachID INT = (
    SELECT TOP (1) c.CoachID
    FROM dbo.Coaches c
    JOIN dbo.Users u ON u.UserID = c.CoachID
    WHERE u.Email = N'coach@gymcore.local'
);
DECLARE @AdminID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');
DECLARE @CoachPlanID INT = (
    SELECT TOP (1) MembershipPlanID
    FROM dbo.MembershipPlans
    WHERE PlanType = N'GYM_PLUS_COACH'
      AND AllowsCoachBooking = 1
      AND IsActive = 1
    ORDER BY DurationDays DESC, MembershipPlanID DESC
);
DECLARE @MembershipID INT;
DECLARE @RequestID INT;
DECLARE @CompletedSessionID INT;
DECLARE @Today DATE = CAST(GETDATE() AS DATE);
DECLARE @CompletedDate DATE = DATEADD(DAY, -2, @Today);
DECLARE @Slot1 INT = (SELECT TOP (1) TimeSlotID FROM dbo.TimeSlots WHERE SlotIndex = 1 ORDER BY TimeSlotID);
DECLARE @GoalGainMuscleID INT = (
    SELECT TOP (1) GoalID
    FROM dbo.FitnessGoals
    WHERE GoalCode = N'GAIN_MUSCLE'
      AND IsActive = 1
);
DECLARE @GoalLoseFatID INT = (
    SELECT TOP (1) GoalID
    FROM dbo.FitnessGoals
    WHERE GoalCode = N'LOSE_FAT'
      AND IsActive = 1
);

IF @CustomerID IS NULL THROW 51400, 'Seed customer account was not found.', 1;
IF @CoachPlanID IS NULL THROW 51401, 'A Gym + Coach membership plan was not found.', 1;
IF @Slot1 IS NULL THROW 51402, 'Time slot 1 was not found.', 1;

SET @MembershipID = (
    SELECT TOP (1) CustomerMembershipID
    FROM dbo.CustomerMemberships
    WHERE CustomerID = @CustomerID
    ORDER BY
        CASE Status WHEN N'ACTIVE' THEN 0 WHEN N'SCHEDULED' THEN 1 ELSE 2 END,
        EndDate DESC,
        CustomerMembershipID DESC
);

IF @MembershipID IS NULL
BEGIN
    INSERT INTO dbo.CustomerMemberships (
        CustomerID, MembershipPlanID, Status, StartDate, EndDate, UpdatedBy
    )
    VALUES (
        @CustomerID, @CoachPlanID, N'ACTIVE', @Today, DATEADD(DAY, 90, @Today), @AdminID
    );
    SET @MembershipID = SCOPE_IDENTITY();
END;

UPDATE dbo.CustomerMemberships
SET Status = CASE
        WHEN CustomerMembershipID = @MembershipID THEN N'ACTIVE'
        WHEN Status IN (N'ACTIVE', N'SCHEDULED', N'PENDING') THEN N'EXPIRED'
        ELSE Status
    END,
    MembershipPlanID = CASE
        WHEN CustomerMembershipID = @MembershipID THEN @CoachPlanID
        ELSE MembershipPlanID
    END,
    StartDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN DATEADD(DAY, -14, @Today)
        ELSE StartDate
    END,
    EndDate = CASE
        WHEN CustomerMembershipID = @MembershipID THEN DATEADD(DAY, 90, @Today)
        ELSE EndDate
    END,
    UpdatedBy = @AdminID,
    UpdatedAt = SYSDATETIME()
WHERE CustomerID = @CustomerID;

DELETE FROM dbo.CustomerGoals WHERE CustomerID = @CustomerID;
IF @GoalGainMuscleID IS NOT NULL
BEGIN
    INSERT INTO dbo.CustomerGoals (CustomerID, GoalID, IsActive)
    VALUES (@CustomerID, @GoalGainMuscleID, 1);
END;
IF @GoalLoseFatID IS NOT NULL
BEGIN
    INSERT INTO dbo.CustomerGoals (CustomerID, GoalID, IsActive)
    VALUES (@CustomerID, @GoalLoseFatID, 1);
END;

DELETE FROM dbo.CustomerHealthCurrent WHERE CustomerID = @CustomerID;
DELETE FROM dbo.CustomerHealthHistory WHERE CustomerID = @CustomerID;

INSERT INTO dbo.CustomerHealthHistory (CustomerID, HeightCm, WeightKg, RecordedAt)
VALUES (@CustomerID, 172, 69, DATEADD(DAY, -1, SYSDATETIME()));

DELETE FROM dbo.PTSessionNotes
WHERE PTSessionID IN (SELECT PTSessionID FROM dbo.PTSessions WHERE CustomerID = @CustomerID);
DELETE FROM dbo.PTSessions WHERE CustomerID = @CustomerID;
DELETE prs
FROM dbo.PTRequestSlots prs
JOIN dbo.PTRecurringRequests r ON r.PTRequestID = prs.PTRequestID
WHERE r.CustomerID = @CustomerID;
DELETE FROM dbo.PTRecurringRequests WHERE CustomerID = @CustomerID;

IF @CoachID IS NOT NULL
BEGIN
    INSERT INTO dbo.PTRecurringRequests (
        CustomerID, CoachID, CustomerMembershipID, StartDate, EndDate, Status, BookingMode
    )
    VALUES (
        @CustomerID, @CoachID, @MembershipID, DATEADD(DAY, -14, @Today), DATEADD(DAY, 14, @Today), N'APPROVED', N'INSTANT'
    );

    SET @RequestID = SCOPE_IDENTITY();

    INSERT INTO dbo.PTRequestSlots (PTRequestID, DayOfWeek, TimeSlotID)
    VALUES (@RequestID, 1, @Slot1);

    INSERT INTO dbo.PTSessions (PTRequestID, CustomerID, CoachID, SessionDate, DayOfWeek, TimeSlotID, Status)
    VALUES (@RequestID, @CustomerID, @CoachID, @CompletedDate, 1, @Slot1, N'COMPLETED');

    SET @CompletedSessionID = SCOPE_IDENTITY();

    INSERT INTO dbo.PTSessionNotes (PTSessionID, NoteContent, CreatedAt)
    VALUES (@CompletedSessionID, N'Coach note: keep the strength work progressive and protect recovery quality this week.', DATEADD(DAY, -1, SYSDATETIME()));
END;
`, 'prepare-customer-ai-planning')
}

module.exports = {
  prepareCustomerAiPlanningState,
  prepareCheckinFlowCustomerState,
  prepareCoachCustomersFlowState,
  prepareCoachManagementFlowState,
  prepareCustomerCommerceState,
  prepareCustomerPtBookingState,
  prepareInvoiceFlowState,
  prepareMembershipFlowCustomerState,
  preparePtExceptionFlowState,
  preparePtExceptionScheduleState,
  preparePtFlowCustomerState,
  prepareSupportConsoleCustomerState,
  restoreSeedPtBookingState,
  getLatestReplacementOfferStatus,
  querySqlScalar,
  runSqlScript,
}
