USE GymCore;
GO

/* Add shipping information columns to Orders table */
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
    ALTER TABLE dbo.Orders ADD PaymentMethod NVARCHAR(50) NULL; -- e.g., 'PayOS', 'COD'
END
GO
