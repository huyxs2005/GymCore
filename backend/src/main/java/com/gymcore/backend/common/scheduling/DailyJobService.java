package com.gymcore.backend.common.scheduling;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class DailyJobService {

    static final String LEGACY_DAILY_MEMBERSHIP_JOB_SQL = "EXEC dbo.sp_RunDailyMembershipJobs";
    static final String MEMBERSHIP_EXPIRY_REMINDER_SQL = """
            DECLARE @today DATE = CAST(GETDATE() AS DATE);

            ;WITH ActiveM AS (
                SELECT m.CustomerMembershipID, m.CustomerID, m.EndDate,
                       DATEDIFF(DAY, @today, m.EndDate) AS DaysLeft
                FROM dbo.CustomerMemberships m
                WHERE m.Status = 'ACTIVE'
            )
            INSERT INTO dbo.Notifications (UserID, NotificationType, Title, Message, LinkUrl, RefId, ExtraKey)
            SELECT
                a.CustomerID,
                'MEMBERSHIP_EXPIRES_COUNTDOWN',
                N'Membership expiring soon',
                CONCAT(N'Your membership expires in ', a.DaysLeft, N' day(s). If you do not renew, all PT schedules will be cancelled.'),
                N'/membership',
                a.CustomerMembershipID,
                CONCAT('DAYSLEFT_', a.DaysLeft)
            FROM ActiveM a
            WHERE a.DaysLeft IN (7, 3, 1)
              AND NOT EXISTS (
                    SELECT 1 FROM dbo.Notifications n
                    WHERE n.UserID = a.CustomerID
                      AND n.NotificationType = 'MEMBERSHIP_EXPIRES_COUNTDOWN'
                      AND n.RefId = a.CustomerMembershipID
                      AND n.ExtraKey = CONCAT('DAYSLEFT_', a.DaysLeft)
              );
            """;
    static final String PICKUP_WAITING_REMINDER_SQL = """
            DECLARE @today DATE = CAST(GETDATE() AS DATE);

            ;WITH AwaitingPickup AS (
                SELECT
                    o.OrderID,
                    o.CustomerID,
                    DATEDIFF(DAY, CAST(i.PaidAt AS DATE), @today) AS DaysWaiting
                FROM dbo.Orders o
                JOIN dbo.OrderInvoices i ON i.OrderID = o.OrderID
                WHERE o.Status = 'PAID'
                  AND i.PickedUpAt IS NULL
                  AND i.PaidAt IS NOT NULL
            )
            INSERT INTO dbo.Notifications (UserID, NotificationType, Title, Message, LinkUrl, RefId, ExtraKey)
            SELECT
                p.CustomerID,
                'ORDER_PICKUP_REMINDER',
                N'Order waiting for pickup',
                CONCAT(N'Your paid order #', p.OrderID, N' is still waiting for pickup. Please visit reception to collect it.'),
                N'/customer/orders',
                p.OrderID,
                CONCAT('WAITING_DAY_', p.DaysWaiting)
            FROM AwaitingPickup p
            WHERE p.DaysWaiting IN (1, 3, 7)
              AND NOT EXISTS (
                    SELECT 1 FROM dbo.Notifications n
                    WHERE n.UserID = p.CustomerID
                      AND n.NotificationType = 'ORDER_PICKUP_REMINDER'
                      AND n.RefId = p.OrderID
                      AND n.ExtraKey = CONCAT('WAITING_DAY_', p.DaysWaiting)
              );
            """;

    private final JdbcTemplate jdbcTemplate;

    public DailyJobService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Run daily membership jobs at midnight (00:00:00).
     * - Countdown notifications (7..1 days left)
     * - Expire memberships
     * - Cancel PT sessions if membership expires
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void runMembershipJobs() {
        System.out.println("Running daily membership jobs...");
        try {
            jdbcTemplate.execute(LEGACY_DAILY_MEMBERSHIP_JOB_SQL);
            System.out.println("Daily membership jobs completed successfully.");
        } catch (Exception e) {
            System.err.println("Error running daily membership jobs: " + e.getMessage());
        }
    }
}
