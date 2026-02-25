-- Thêm cột IsAvailable vào bảng CoachWeeklyAvailability (nếu chưa có).
-- Chạy script này nếu gặp lỗi: "The column name IsAvailable is not valid."

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.CoachWeeklyAvailability')
      AND name = 'IsAvailable'
)
BEGIN
    ALTER TABLE dbo.CoachWeeklyAvailability
    ADD IsAvailable BIT NOT NULL
    CONSTRAINT DF_CoachWeeklyAvailability_IsAvailable DEFAULT 1;
END
GO
