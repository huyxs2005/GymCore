/*
Run this script in GymCore database.
Purpose:
1) Ensure payment confirmation procedure updates product order status from PENDING to PAID.
2) Ensure product review is allowed only when customer already has a PAID order for that product.
3) Add helper procedure to confirm payment by PayOS payment link id.
*/

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

