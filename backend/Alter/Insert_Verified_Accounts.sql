/* ===================================================================
   Insert/Update Verified Accounts for GymCore
   - Ensures admin@gymcore.com exists and is verified
   - Ensures customer@gymcore.com exists and is verified
   =================================================================== */

USE GymCore;
GO

BEGIN TRY
    BEGIN TRAN;

    DECLARE @RoleAdmin INT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'Admin');
    DECLARE @RoleCustomer INT = (SELECT RoleID FROM dbo.Roles WHERE RoleName = 'Customer');

    -- 1. Admin Account: admin@gymcore.com
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'admin@gymcore.com')
    BEGIN
        INSERT INTO dbo.Users (RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked)
        VALUES (
            @RoleAdmin, 
            N'Admin GymCore', 
            N'admin@gymcore.com', 
            N'0900000010', 
            N'$2a$10$Ms9kKRlpN/13o7CqvZrpMup4lz2MXD1NbKEFZ54qigrtgXlUjzsKO', -- Hash for 'Admin123456!'
            1, 
            SYSDATETIME(),
            1,
            0
        );
        PRINT '✅ Created Admin: admin@gymcore.com / Admin123456!';
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
        PRINT '✅ Updated Admin: admin@gymcore.com (Verified & Active)';
    END;

    -- 2. Customer Account: customer@gymcore.com
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'customer@gymcore.com')
    BEGIN
        INSERT INTO dbo.Users (RoleID, FullName, Email, Phone, PasswordHash, IsEmailVerified, EmailVerifiedAt, IsActive, IsLocked)
        VALUES (
            @RoleCustomer, 
            N'Standard Customer', 
            N'customer@gymcore.com', 
            N'0900000011', 
            N'$2a$10$EiimMLC5OYOJCTSB.tc0uuOpVpi4IpeFwPqfytKuyd6HohAoerL1m', -- Hash for 'Customer123456!'
            1, 
            SYSDATETIME(),
            1,
            0
        );
        PRINT '✅ Created Customer: customer@gymcore.com / Customer123456!';
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
        PRINT '✅ Updated Customer: customer@gymcore.com (Verified & Active)';
    END;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT '❌ Error: ' + @ErrorMessage;
END CATCH;
GO
