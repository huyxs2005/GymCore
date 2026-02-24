USE GymCore;
GO

/* =========================================================
   Finalize Payment & Revenue Reporting Integration
   Ensures PayOS success flows into Admin Reports.
   ========================================================= */

/* 1. Ensure Payments table has PaidAt column if missing */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Payments') AND name = 'PaidAt')
BEGIN
    ALTER TABLE dbo.Payments ADD PaidAt DATETIME2 NULL;
END
GO

/* 2. Create the centralized procedure to confirm payment success */
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_ConfirmPaymentSuccess' AND type = 'P')
    DROP PROCEDURE dbo.sp_ConfirmPaymentSuccess;
GO

CREATE PROCEDURE dbo.sp_ConfirmPaymentSuccess
    @PaymentID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @OrderID INT, @MembershipID INT;
    
    -- Get related entities from the payment record
    SELECT @OrderID = OrderID, @MembershipID = CustomerMembershipID
    FROM dbo.Payments
    WHERE PaymentID = @PaymentID;
    
    -- 1) Flag the payment as successful
    UPDATE dbo.Payments
    SET Status = 'SUCCESS',
        PaidAt = SYSDATETIME(),
        PayOS_Status = 'PAID'  -- Sync PayOS status field as well
    WHERE PaymentID = @PaymentID;
    
    -- 2) Update Product Order state if applicable
    IF @OrderID IS NOT NULL
    BEGIN
        UPDATE dbo.Orders
        SET Status = 'PAID',
            UpdatedAt = SYSDATETIME()
        WHERE OrderID = @OrderID;
    END
    
    -- 3) Update Membership state if applicable
    IF @MembershipID IS NOT NULL
    BEGIN
        UPDATE dbo.CustomerMemberships
        SET Status = 'ACTIVE',
            UpdatedAt = SYSDATETIME()
        WHERE CustomerMembershipID = @MembershipID;
    END
END
GO

/* 3. Re-define Revenue Views to use the finalized PaidAt timestamp */

-- View for Product Revenue (Aggregated by day)
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_Revenue_ProductOrders' AND schema_id = SCHEMA_ID('dbo'))
    DROP VIEW dbo.vw_Revenue_ProductOrders;
GO

EXEC('CREATE VIEW dbo.vw_Revenue_ProductOrders
AS
SELECT
    CAST(pay.PaidAt AS DATE) AS RevenueDate,
    SUM(pay.Amount) AS RevenueAmount,
    COUNT(DISTINCT pay.OrderID) AS PaidOrders
FROM dbo.Payments pay
WHERE pay.Status = ''SUCCESS'' AND pay.OrderID IS NOT NULL AND pay.PaidAt IS NOT NULL
GROUP BY CAST(pay.PaidAt AS DATE);')
GO

-- View for Membership Revenue (Aggregated by day)
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_Revenue_Memberships' AND schema_id = SCHEMA_ID('dbo'))
    DROP VIEW dbo.vw_Revenue_Memberships;
GO

EXEC('CREATE VIEW dbo.vw_Revenue_Memberships
AS
SELECT
    CAST(pay.PaidAt AS DATE) AS RevenueDate,
    SUM(pay.Amount) AS RevenueAmount,
    COUNT(DISTINCT pay.CustomerMembershipID) AS PaidMemberships
FROM dbo.Payments pay
WHERE pay.Status = ''SUCCESS'' AND pay.CustomerMembershipID IS NOT NULL AND pay.PaidAt IS NOT NULL
GROUP BY CAST(pay.PaidAt AS DATE);')
GO
