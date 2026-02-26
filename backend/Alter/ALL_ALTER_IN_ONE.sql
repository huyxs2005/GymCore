USE GymCore;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'ShippingFullName')
BEGIN
    ALTER TABLE dbo.Orders ADD ShippingFullName NVARCHAR(255) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'ShippingPhone')
BEGIN
    ALTER TABLE dbo.Orders ADD ShippingPhone NVARCHAR(50) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'ShippingAddress')
BEGIN
    ALTER TABLE dbo.Orders ADD ShippingAddress NVARCHAR(MAX) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'PaymentMethod')
BEGIN
    ALTER TABLE dbo.Orders ADD PaymentMethod NVARCHAR(50) NULL;
END
GO

USE GymCore;
GO

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRAN;

    DECLARE @RoleCustomer INT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'Customer');
    DECLARE @NewUserID INT;
    DECLARE @Product1ID INT;
    DECLARE @Product2ID INT;
    DECLARE @OrderID INT;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'testcustomer@gymcore.local')
    BEGIN
        INSERT INTO dbo.Users (RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt)
        VALUES (
            @RoleCustomer, 
            N'Test Customer', 
            N'testcustomer@gymcore.local', 
            N'0999999999', 
            N'$2a$10$EiimMLC5OYOJCTSB.tc0uuOpVpi4IpeFwPqfytKuyd6HohAoerL1m',
            1, 
            SYSDATETIME()
        );

        SET @NewUserID = SCOPE_IDENTITY();
        PRINT 'âœ… Created User: testcustomer@gymcore.local / Customer123456!';
    END
    ELSE
    BEGIN
        SELECT @NewUserID = UserID FROM dbo.Users WHERE Email = N'testcustomer@gymcore.local';
        PRINT 'â„¹ï¸ User testcustomer@gymcore.local already exists (ID: ' + CAST(@NewUserID AS NVARCHAR(20)) + ')';
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @NewUserID)
    BEGIN
        INSERT INTO dbo.Customers (CustomerID, DateOfBirth, Gender)
        VALUES (@NewUserID, '2000-01-01', N'Male');
        PRINT 'âœ… Created Customer Profile';
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Carts WHERE CustomerID = @NewUserID)
    BEGIN
        INSERT INTO dbo.Carts (CustomerID) VALUES (@NewUserID);
        PRINT 'âœ… Created Shopping Cart';
    END;

    SELECT TOP 1 @Product1ID = ProductID FROM dbo.Products WHERE ProductName LIKE '%Whey Protein%' AND IsActive = 1;

    SELECT TOP 1 @Product2ID = ProductID FROM dbo.Products WHERE ProductName LIKE '%Creatine%' AND IsActive = 1;

    IF @Product1ID IS NULL OR @Product2ID IS NULL
    BEGIN
        THROW 50001, 'Could not find sample products (Whey/Creatine). Run Insert_Sample_Products.sql first!', 1;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.Orders o 
        JOIN dbo.OrderItems oi ON o.OrderID = oi.OrderID 
        WHERE o.CustomerID = @NewUserID 
          AND o.Status = 'PAID' 
          AND oi.ProductID IN (@Product1ID, @Product2ID)
    )
    BEGIN
        INSERT INTO dbo.Orders (CustomerID, Subtotal, DiscountApplied, TotalAmount, Status, OrderDate)
        VALUES (@NewUserID, 2000000, 0, 2000000, 'PAID', DATEADD(day, -1, SYSDATETIME()));

        SET @OrderID = SCOPE_IDENTITY();

        INSERT INTO dbo.OrderItems (OrderID, ProductID, Quantity, UnitPrice)
        VALUES 
            (@OrderID, @Product1ID, 1, 1000000),
            (@OrderID, @Product2ID, 1, 1000000);

        PRINT 'âœ… Created PAID Order #' + CAST(@OrderID AS NVARCHAR(20)) + ' with 2 items';
        PRINT '   -> You can now Review Product IDs: ' + CAST(@Product1ID AS NVARCHAR(20)) + ' and ' + CAST(@Product2ID AS NVARCHAR(20));
    END
    ELSE
    BEGIN
        PRINT 'â„¹ï¸ User already has a PAID order for these products.';
    END;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT 'âŒ Error: ' + @ErrorMessage;
END CATCH;
GO

USE GymCore;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ConfirmPaymentSuccess
    @PaymentID INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Payments
    SET Status = 'SUCCESS',
        PaidAt = COALESCE(PaidAt, SYSDATETIME()),
        PayOS_Status = COALESCE(PayOS_Status, 'SUCCESS')
    WHERE PaymentID = @PaymentID
      AND Status = 'PENDING';

    IF @@ROWCOUNT = 0
        RETURN;

    UPDATE dbo.Orders
    SET Status = 'PAID',
        UpdatedAt = SYSDATETIME()
    WHERE OrderID = (
        SELECT OrderID
        FROM dbo.Payments
        WHERE PaymentID = @PaymentID
    )
      AND Status = 'PENDING';

    UPDATE dbo.CustomerMemberships
    SET Status = 'ACTIVE',
        UpdatedAt = SYSDATETIME()
    WHERE CustomerMembershipID = (
        SELECT CustomerMembershipID
        FROM dbo.Payments
        WHERE PaymentID = @PaymentID
    )
      AND Status = 'PENDING';
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ConfirmPaymentSuccessByPayOSLinkId
    @PayOSPaymentLinkId NVARCHAR(80)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @PaymentID INT;
    SELECT TOP 1 @PaymentID = p.PaymentID
    FROM dbo.Payments p
    WHERE p.PayOS_PaymentLinkId = @PayOSPaymentLinkId
    ORDER BY p.PaymentID DESC;

    IF @PaymentID IS NULL
        RETURN;

    EXEC dbo.sp_ConfirmPaymentSuccess @PaymentID;
END;
GO

CREATE OR ALTER TRIGGER dbo.TRG_ProductReviews_RequirePurchase
ON dbo.ProductReviews
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted r
        WHERE NOT EXISTS (
            SELECT 1
            FROM dbo.Orders o
            JOIN dbo.OrderItems oi ON oi.OrderID = o.OrderID
            WHERE o.CustomerID = r.CustomerID
              AND oi.ProductID = r.ProductID
              AND o.Status = 'PAID'
        )
    )
    BEGIN
        RAISERROR('Review blocked: customer must have a PAID order for this product.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

USE GymCore;
GO

DECLARE @AdminID INT = (SELECT UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');

IF @AdminID IS NULL
BEGIN
    RAISERROR('Admin user not found. Please run InsertValues.txt first to create base users.', 16, 1);
    RETURN;
END;

INSERT INTO dbo.Products (ProductName, Description, Price, ImageUrl, IsActive, UpdatedBy)
SELECT v.ProductName, v.Description, v.Price, v.ImageUrl, CAST(1 AS BIT), @AdminID
FROM (VALUES

    (
        N'Whey Protein Isolate - Vanilla',
        N'100% pure whey protein isolate. 25g protein per serving. Perfect for muscle recovery and growth. Low carb, low fat. Imported from USA.',
        CAST(1200000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=500'
    ),
    (
        N'Whey Protein Concentrate - Chocolate',
        N'Premium whey protein concentrate. 24g protein per serving. Rich chocolate flavor. Great for post-workout. Contains BCAAs and essential amino acids.',
        CAST(900000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500'
    ),
    (
        N'Whey Protein Blend - Strawberry',
        N'Advanced whey protein blend (isolate + concentrate). 23g protein per serving. Delicious strawberry taste. Easy to mix, smooth texture.',
        CAST(950000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1622484211126-f3347e0c2d58?w=500'
    ),
    (
        N'Hydrolyzed Whey Protein - Unflavored',
        N'Fast-absorbing hydrolyzed whey protein. 26g protein per serving. Ideal for quick post-workout recovery. Pre-digested for better absorption.',
        CAST(1350000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=500'
    ),

    (
        N'Creatine Monohydrate - Micronized',
        N'Pure micronized creatine monohydrate. 5g per serving. Supports strength and power output. Clinically proven formula. 100 servings.',
        CAST(350000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=500'
    ),
    (
        N'Creatine HCL - Ultra Pure',
        N'Creatine Hydrochloride. Better absorption, no bloating. 3g per serving. Enhanced solubility and bioavailability. 120 servings.',
        CAST(450000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1534368420702-00fa0cd5a7dc?w=500'
    ),
    (
        N'Creatine Ethyl Ester',
        N'Advanced creatine ethyl ester formula. Enhanced cellular uptake. 4g per serving. Supports ATP production and muscle endurance.',
        CAST(420000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=500'
    ),
    (
        N'Buffered Creatine - Kre-Alkalyn',
        N'pH-buffered creatine for optimal stability. No loading phase required. 3g per serving. Reduced side effects, maximum results.',
        CAST(500000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1556817411-58c45dd94e8c?w=500'
    ),

    (
        N'Mass Gainer - Chocolate Supreme',
        N'High-calorie mass gainer. 1250 calories, 50g protein per serving. Perfect for hard gainers. Contains complex carbs and healthy fats.',
        CAST(950000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=500'
    ),
    (
        N'Lean Mass Gainer - Vanilla',
        N'Clean lean mass formula. 800 calories, 45g protein per serving. Low sugar. Premium ingredients for quality muscle gains.',
        CAST(880000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500'
    ),
    (
        N'Serious Mass - Banana',
        N'Serious mass building formula. 1300 calories, 52g protein. Enriched with vitamins and minerals. 6 lbs container.',
        CAST(1000000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=500'
    ),
    (
        N'Weight Gainer Pro - Cookies & Cream',
        N'Professional weight gainer. 900 calories, 48g protein per serving. Delicious cookies & cream flavor. Easy to digest.',
        CAST(850000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1622484211126-f3347e0c2d58?w=500'
    ),

    (
        N'Pre-Workout Extreme - Fruit Punch',
        N'High-stimulant pre-workout. 300mg caffeine, beta-alanine, citrulline malate. Explosive energy and pump. Enhanced focus and endurance.',
        CAST(650000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=500'
    ),
    (
        N'Pre-Workout Pump - Blue Raspberry',
        N'Stimulant-free pump formula. Maximize blood flow and muscle pumps. L-arginine, citrulline, beetroot extract. Great for evening workouts.',
        CAST(580000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=500'
    ),
    (
        N'Pre-Workout Focus - Green Apple',
        N'Balanced energy and focus. 250mg caffeine, nootropics, electrolytes. Smooth energy without crash. 30 servings.',
        CAST(600000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1556817411-58c45dd94e8c?w=500'
    ),

    (
        N'BCAA 2:1:1 - Watermelon',
        N'Branch Chain Amino Acids 2:1:1 ratio. 5g BCAAs per serving. Supports muscle recovery and reduces fatigue. Refreshing watermelon flavor.',
        CAST(450000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1534368420702-00fa0cd5a7dc?w=500'
    ),
    (
        N'BCAA + Electrolytes - Lemon Lime',
        N'BCAAs with added electrolytes. Perfect for intra-workout hydration. 7g BCAAs, essential minerals. Sugar-free formula.',
        CAST(520000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=500'
    ),
    (
        N'BCAA Energy - Mixed Berry',
        N'BCAAs with natural caffeine. 6g BCAAs, 100mg caffeine. Boost energy and recovery during training. Delicious mixed berry taste.',
        CAST(550000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500'
    ),

    (
        N'Multi-Vitamin for Men - Daily Pack',
        N'Complete multivitamin formula for active men. 24 essential vitamins and minerals. Supports immune system, energy, and muscle function. 30 packs.',
        CAST(380000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=500'
    ),
    (
        N'Multi-Vitamin for Athletes - Tablets',
        N'High-potency multivitamin for athletes. Enhanced B-complex, antioxidants, minerals. Supports recovery and performance. 90 tablets.',
        CAST(420000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1622484211126-f3347e0c2d58?w=500'
    )
) AS v(ProductName, Description, Price, ImageUrl)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Products p WHERE p.ProductName = v.ProductName
);

GO

SELECT 
    ProductID,
    ProductName,
    Price,
    IsActive,
    CreatedAt
FROM dbo.Products
ORDER BY CreatedAt DESC;

PRINT 'âœ… Successfully inserted 20 sample gym supplement products!';
PRINT 'âœ… All products have IsActive = 1 (visible to Admin and Customer)';
PRINT 'âœ… Products include: Whey (4), Creatine (4), Mass Gainer (4), Pre-Workout (3), BCAA (3), Multivitamin (2)';
GO

USE GymCore;
GO

BEGIN TRY
    BEGIN TRAN;

    DECLARE @RoleAdmin INT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'Admin');
    DECLARE @RoleCustomer INT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'Customer');

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'admin@gymcore.com')
    BEGIN
        INSERT INTO dbo.Users (RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked)
        VALUES (
            @RoleAdmin, 
            N'Admin GymCore', 
            N'admin@gymcore.com', 
            N'0900000010', 
            N'$2a$10$Ms9kKRlpN/13o7CqvZrpMup4lz2MXD1NbKEFZ54qigrtgXlUjzsKO',
            1, 
            SYSDATETIME(),
            1,
            0
        );
        PRINT 'âœ… Created Admin: admin@gymcore.com / Admin123456!';
    END
    ELSE
    BEGIN
        UPDATE dbo.Users 
        SET IsEmailVerified = 1, 
            EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
            IsActive = 1,
            IsLocked = 0,
            PasswordHash = N'$2a$10$Ms9kKRlpN/13o7CqvZrpMup4lz2MXD1NbKEFZ54qigrtgXlUjzsKO'
        WHERE Email = N'admin@gymcore.com';
        PRINT 'âœ… Updated Admin: admin@gymcore.com (Verified & Active)';
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'customer@gymcore.com')
    BEGIN
        INSERT INTO dbo.Users (RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked)
        VALUES (
            @RoleCustomer, 
            N'Standard Customer', 
            N'customer@gymcore.com', 
            N'0900000011', 
            N'$2a$10$EiimMLC5OYOJCTSB.tc0uuOpVpi4IpeFwPqfytKuyd6HohAoerL1m',
            1, 
            SYSDATETIME(),
            1,
            0
        );
        PRINT 'âœ… Created Customer: customer@gymcore.com / Customer123456!';
    END
    ELSE
    BEGIN
        UPDATE dbo.Users 
        SET IsEmailVerified = 1, 
            EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSDATETIME()),
            IsActive = 1,
            IsLocked = 0,
            PasswordHash = N'$2a$10$EiimMLC5OYOJCTSB.tc0uuOpVpi4IpeFwPqfytKuyd6HohAoerL1m'
        WHERE Email = N'customer@gymcore.com';
        PRINT 'âœ… Updated Customer: customer@gymcore.com (Verified & Active)';
    END;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT 'âŒ Error: ' + @ErrorMessage;
END CATCH;
GO

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

        RefId INT NULL,
        ExtraKey NVARCHAR(50) NULL,

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

        UPDATE dbo.CustomerMemberships SET Status = ''EXPIRED'', UpdatedAt = SYSDATETIME()
        WHERE Status = ''ACTIVE'' AND EndDate < @today;

        UPDATE s SET s.Status = ''CANCELLED'', s.CancelReason = ''Membership expired'', s.UpdatedAt = SYSDATETIME()
        FROM dbo.PTSessions s
        WHERE s.Status = ''SCHEDULED'' AND s.SessionDate >= @today
          AND NOT EXISTS (SELECT 1 FROM dbo.CustomerMemberships m WHERE m.CustomerID = s.CustomerID AND m.Status = ''ACTIVE'');
    END')
END
GO

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

