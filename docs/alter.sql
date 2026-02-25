USE GymCore;
GO

-- 1. Chuyển cột sang cho phép NULL (bỏ qua IF EXISTS để đảm bảo nó chạy hoặc báo lỗi rõ ràng)
PRINT 'Đang cập nhật table PTRecurringRequests...';
ALTER TABLE dbo.PTRecurringRequests 
ALTER COLUMN CustomerMembershipID INT NULL;
GO

-- 2. Kiểm tra lại thuộc tính cột sau khi alter
SELECT 
    name AS Column_Name, 
    is_nullable AS Allows_Null
FROM sys.columns 
WHERE object_id = OBJECT_ID('dbo.PTRecurringRequests')
  AND name = 'CustomerMembershipID';
GO
