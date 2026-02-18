/* ===================================================================
   Create Test Customer with PAID Order for GymCore
   - Creates user: testcustomer@gymcore.local / Customer123456!
   - Creates customer profile
   - Creates an empty cart
   - Creates a PAID order with 2 products (Whey + Creatine)
     -> This allows testing "Write Review" (requires purchased product)
   =================================================================== */

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

    -- 1. Create User (if not exists)
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'testcustomer@gymcore.local')
    BEGIN
        INSERT INTO dbo.Users (RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt)
        VALUES (
            @RoleCustomer, 
            N'Test Customer', 
            N'testcustomer@gymcore.local', 
            N'0999999999', 
            N'$2a$10$EiimMLC5OYOJCTSB.tc0uuOpVpi4IpeFwPqfytKuyd6HohAoerL1m', -- Hash for 'Customer123456!'
            1, 
            SYSDATETIME()
        );
        
        SET @NewUserID = SCOPE_IDENTITY();
        PRINT '✅ Created User: testcustomer@gymcore.local / Customer123456!';
    END
    ELSE
    BEGIN
        SELECT @NewUserID = UserID FROM dbo.Users WHERE Email = N'testcustomer@gymcore.local';
        PRINT 'ℹ️ User testcustomer@gymcore.local already exists (ID: ' + CAST(@NewUserID AS NVARCHAR(20)) + ')';
    END;

    -- 2. Create Customer Profile
    IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerID = @NewUserID)
    BEGIN
        INSERT INTO dbo.Customers (CustomerID, DateOfBirth, Gender)
        VALUES (@NewUserID, '2000-01-01', N'Male');
        PRINT '✅ Created Customer Profile';
    END;

    -- 3. Create Cart
    IF NOT EXISTS (SELECT 1 FROM dbo.Carts WHERE CustomerID = @NewUserID)
    BEGIN
        INSERT INTO dbo.Carts (CustomerID) VALUES (@NewUserID);
        PRINT '✅ Created Shopping Cart';
    END;

    -- 4. Get some Products for Order
    -- Get Whey Protein
    SELECT TOP 1 @Product1ID = ProductID FROM dbo.Products WHERE ProductName LIKE '%Whey Protein%' AND IsActive = 1;
    -- Get Creatine
    SELECT TOP 1 @Product2ID = ProductID FROM dbo.Products WHERE ProductName LIKE '%Creatine%' AND IsActive = 1;

    IF @Product1ID IS NULL OR @Product2ID IS NULL
    BEGIN
        THROW 50001, 'Could not find sample products (Whey/Creatine). Run Insert_Sample_Products.sql first!', 1;
    END;

    -- 5. Create PAID Order (to enable reviews)
    -- Check if this user already has a PAID order for these products to avoid duplicates if run multiple times
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
            
        -- Create Payment record for consistency (SKIPPED to avoid column issues, trigger only checks Orders.Status)
        -- INSERT INTO dbo.Payments (OrderID, Amount, Status, PayOS_Status, OriginalAmount)
        -- VALUES (@OrderID, 2000000, 'PAID', 'PAID', 2000000);

        PRINT '✅ Created PAID Order #' + CAST(@OrderID AS NVARCHAR(20)) + ' with 2 items';
        PRINT '   -> You can now Review Product IDs: ' + CAST(@Product1ID AS NVARCHAR(20)) + ' and ' + CAST(@Product2ID AS NVARCHAR(20));
    END
    ELSE
    BEGIN
        PRINT 'ℹ️ User already has a PAID order for these products.';
    END;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT '❌ Error: ' + @ErrorMessage;
END CATCH;
GO
