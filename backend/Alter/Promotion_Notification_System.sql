/* =========================================================
   GymCore Alter Script - Promotion & Notification System
   Ensures all tables, views, and SPs for promotions and 
   notifications are present.
   ========================================================= */

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Promotions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Promotions (
        PromotionID INT IDENTITY(1,1) PRIMARY KEY,
        PromoCode NVARCHAR(30) NOT NULL UNIQUE,
        Description NVARCHAR(200) NULL,
        DiscountPercent DECIMAL(5,2) NULL,
        DiscountAmount DECIMAL(12,2) NULL,
        ValidFrom DATETIME2 NOT NULL,
        ValidTo DATETIME2 NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Promotions_IsActive DEFAULT 1,

        CONSTRAINT CK_Promotions_Date CHECK (ValidTo > ValidFrom),
        CONSTRAINT CK_Promotions_DiscountType CHECK (
            NOT (DiscountPercent IS NOT NULL AND DiscountAmount IS NOT NULL)
        ),
        CONSTRAINT CK_Promotions_Percent CHECK (DiscountPercent IS NULL OR (DiscountPercent >= 0 AND DiscountPercent <= 100)),
        CONSTRAINT CK_Promotions_Amount CHECK (DiscountAmount IS NULL OR DiscountAmount >= 0)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PromotionPosts' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.PromotionPosts (
        PromotionPostID INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(150) NOT NULL,
        Content NVARCHAR(2000) NOT NULL,
        BannerUrl NVARCHAR(500) NULL,

        PromotionID INT NOT NULL,
        StartAt DATETIME2 NOT NULL,
        EndAt DATETIME2 NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_PromotionPosts_IsActive DEFAULT 1,

        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PromotionPosts_CreatedAt DEFAULT SYSDATETIME(),
        CreatedBy INT NULL,

        CONSTRAINT FK_PromotionPosts_Promotions FOREIGN KEY (PromotionID) REFERENCES dbo.Promotions(PromotionID),
        CONSTRAINT FK_PromotionPosts_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserID),
        CONSTRAINT CK_PromotionPosts_Time CHECK (EndAt > StartAt)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserPromotionClaims' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.UserPromotionClaims (
        ClaimID INT IDENTITY(1,1) PRIMARY KEY,
        UserID INT NOT NULL,
        PromotionID INT NOT NULL,
        SourcePostID INT NOT NULL,
        ClaimedAt DATETIME2 NOT NULL CONSTRAINT DF_UserPromotionClaims_ClaimedAt DEFAULT SYSDATETIME(),

        UsedAt DATETIME2 NULL,
        UsedPaymentID INT NULL,
        UsedOnOrderID INT NULL,
        UsedOnMembershipID INT NULL,

        CONSTRAINT FK_UserPromotionClaims_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_UserPromotionClaims_Promotions FOREIGN KEY (PromotionID) REFERENCES dbo.Promotions(PromotionID),
        CONSTRAINT FK_UserPromotionClaims_SourcePost FOREIGN KEY (SourcePostID) REFERENCES dbo.PromotionPosts(PromotionPostID),

        CONSTRAINT UQ_UserPromotionClaims UNIQUE (UserID, PromotionID),

        CONSTRAINT CK_UserPromotionClaims_UsedTarget CHECK (
            (UsedAt IS NULL AND UsedPaymentID IS NULL AND UsedOnOrderID IS NULL AND UsedOnMembershipID IS NULL)
            OR
            (UsedAt IS NOT NULL AND UsedPaymentID IS NOT NULL AND (
                (UsedOnOrderID IS NOT NULL AND UsedOnMembershipID IS NULL)
                OR
                (UsedOnOrderID IS NULL AND UsedOnMembershipID IS NOT NULL)
            ))
        )
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notifications' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Notifications (
        NotificationID INT IDENTITY(1,1) PRIMARY KEY,
        UserID INT NOT NULL,

        NotificationType NVARCHAR(50) NOT NULL,
        Title NVARCHAR(150) NOT NULL,
        Message NVARCHAR(600) NOT NULL,
        LinkUrl NVARCHAR(300) NULL,

        IsRead BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSDATETIME(),

        RefId INT NULL,        -- membershipId, requestId, orderId, etc.
        ExtraKey NVARCHAR(50) NULL, -- e.g. 'DAYSLEFT_7'

        CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
    );

    CREATE INDEX IX_Notifications_User_Time ON dbo.Notifications(UserID, CreatedAt);
END
GO

IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_Revenue_ProductOrders' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    EXEC('CREATE VIEW dbo.vw_Revenue_ProductOrders
    AS
    SELECT
        CAST(pay.PaidAt AS DATE) AS RevenueDate,
        SUM(pay.Amount) AS RevenueAmount,
        COUNT(DISTINCT pay.OrderID) AS PaidOrders
    FROM dbo.Payments pay
    WHERE pay.Status = ''SUCCESS'' AND pay.OrderID IS NOT NULL
    GROUP BY CAST(pay.PaidAt AS DATE);')
END
GO

IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_Revenue_Memberships' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    EXEC('CREATE VIEW dbo.vw_Revenue_Memberships
    AS
    SELECT
        CAST(pay.PaidAt AS DATE) AS RevenueDate,
        SUM(pay.Amount) AS RevenueAmount,
        COUNT(DISTINCT pay.CustomerMembershipID) AS PaidMemberships
    FROM dbo.Payments pay
    WHERE pay.Status = ''SUCCESS'' AND pay.CustomerMembershipID IS NOT NULL
    GROUP BY CAST(pay.PaidAt AS DATE);')
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_RunDailyMembershipJobs' AND type = 'P')
BEGIN
    EXEC('CREATE PROCEDURE dbo.sp_RunDailyMembershipJobs
    AS
    BEGIN
        SET NOCOUNT ON;
        DECLARE @today DATE = CAST(GETDATE() AS DATE);

        /* 1) Countdown notifications (7..1 days left) */
        ;WITH ActiveM AS (
            SELECT m.CustomerMembershipID, m.CustomerID, m.EndDate,
                   DATEDIFF(DAY, @today, m.EndDate) AS DaysLeft
            FROM dbo.CustomerMemberships m
            WHERE m.Status = ''ACTIVE''
        )
        INSERT INTO dbo.Notifications (UserID, NotificationType, Title, Message, LinkUrl, RefId, ExtraKey)
        SELECT a.CustomerID, ''MEMBERSHIP_EXPIRES_COUNTDOWN'', N''Membership expiring soon'',
               CONCAT(N''Your membership expires in '', a.DaysLeft, N'' day(s).''), N''/membership'',
               a.CustomerMembershipID, CONCAT(''DAYSLEFT_'', a.DaysLeft)
        FROM ActiveM a
        WHERE a.DaysLeft BETWEEN 1 AND 7
          AND NOT EXISTS (SELECT 1 FROM dbo.Notifications n WHERE n.UserID = a.CustomerID AND n.RefId = a.CustomerMembershipID AND n.ExtraKey = CONCAT(''DAYSLEFT_'', a.DaysLeft));

        /* 2) Expire memberships */
        UPDATE dbo.CustomerMemberships SET Status = ''EXPIRED'', UpdatedAt = SYSDATETIME()
        WHERE Status = ''ACTIVE'' AND EndDate < @today;

        /* 3) Cancel PT sessions */
        UPDATE s SET s.Status = ''CANCELLED'', s.CancelReason = ''Membership expired'', s.UpdatedAt = SYSDATETIME()
        FROM dbo.PTSessions s
        WHERE s.Status = ''SCHEDULED'' AND s.SessionDate >= @today
          AND NOT EXISTS (SELECT 1 FROM dbo.CustomerMemberships m WHERE m.CustomerID = s.CustomerID AND m.Status = ''ACTIVE'');
    END')
END
GO

/* =========================
   SEED SAMPLE DATA
   ========================= */
IF NOT EXISTS (SELECT 1 FROM dbo.Promotions WHERE PromoCode = 'WELCOME10')
BEGIN
    INSERT INTO dbo.Promotions (PromoCode, Description, DiscountPercent, ValidFrom, ValidTo)
    VALUES ('WELCOME10', '10% OFF for new members', 10.00, '2024-01-01', '2030-12-31');
END

DECLARE @PromoID INT = (SELECT PromotionID FROM dbo.Promotions WHERE PromoCode = 'WELCOME10');

IF NOT EXISTS (SELECT 1 FROM dbo.PromotionPosts WHERE PromotionID = @PromoID)
BEGIN
    INSERT INTO dbo.PromotionPosts (Title, Content, BannerUrl, PromotionID, StartAt, EndAt)
    VALUES (N'Welcome Offer!', N'Get 10% off your next order when you claim this coupon.', 
            'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800', 
            @PromoID, '2024-01-01', '2030-12-31');
END
GO
