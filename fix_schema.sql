USE GymCore;
GO

PRINT 'Applying Section 1: Orders/Payments PaymentMethod';
IF COL_LENGTH('dbo.Orders', 'PaymentMethod') IS NULL
BEGIN
    ALTER TABLE dbo.Orders ADD PaymentMethod NVARCHAR(50) NULL;
    PRINT 'Added PaymentMethod to dbo.Orders';
END;

IF COL_LENGTH('dbo.Payments', 'PaymentMethod') IS NULL
BEGIN
    ALTER TABLE dbo.Payments ADD PaymentMethod NVARCHAR(50) NULL;
    PRINT 'Added PaymentMethod to dbo.Payments';
END;
GO

PRINT 'Applying Section 2: Promotions ApplyTarget and BonusDurationMonths';
IF COL_LENGTH('dbo.Promotions', 'ApplyTarget') IS NULL
BEGIN
    ALTER TABLE dbo.Promotions
    ADD ApplyTarget NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Promotions_ApplyTarget DEFAULT N'ORDER'
        WITH VALUES;
    PRINT 'Added ApplyTarget to dbo.Promotions';
END;

IF COL_LENGTH('dbo.Promotions', 'BonusDurationMonths') IS NULL
BEGIN
    ALTER TABLE dbo.Promotions
    ADD BonusDurationMonths INT NOT NULL
        CONSTRAINT DF_Promotions_BonusDurationMonths DEFAULT 0
        WITH VALUES;
    PRINT 'Added BonusDurationMonths to dbo.Promotions';
END;
GO

PRINT 'Applying Section 3: CoachAvailability and PT Requests';
IF COL_LENGTH('dbo.CoachWeeklyAvailability', 'IsAvailable') IS NULL
BEGIN
    ALTER TABLE dbo.CoachWeeklyAvailability
    ADD IsAvailable BIT NOT NULL
        CONSTRAINT DF_CoachWeeklyAvailability_IsAvailable DEFAULT 1;
    PRINT 'Added IsAvailable to dbo.CoachWeeklyAvailability';
END;

IF COL_LENGTH('dbo.PTRecurringRequests', 'DenyReason') IS NULL
BEGIN
    ALTER TABLE dbo.PTRecurringRequests
    ADD DenyReason NVARCHAR(500) NULL;
    PRINT 'Added DenyReason to dbo.PTRecurringRequests';
END;
GO
