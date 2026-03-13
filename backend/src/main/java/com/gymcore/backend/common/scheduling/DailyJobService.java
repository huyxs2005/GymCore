package com.gymcore.backend.common.scheduling;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DailyJobService {

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
    static final String EXPIRE_MEMBERSHIPS_SQL = """
            DECLARE @today DATE = CAST(GETDATE() AS DATE);

            UPDATE dbo.CustomerMemberships
            SET Status = 'EXPIRED', UpdatedAt = SYSDATETIME()
            WHERE Status = 'ACTIVE' AND EndDate < @today;
            """;
    static final String ACTIVATE_DUE_SCHEDULED_MEMBERSHIPS_SQL = """
            DECLARE @today DATE = CAST(GETDATE() AS DATE);

            ;WITH DueScheduled AS (
                SELECT m.CustomerMembershipID
                FROM dbo.CustomerMemberships m
                WHERE m.Status = 'SCHEDULED'
                  AND m.StartDate <= @today
                  AND NOT EXISTS (
                      SELECT 1
                      FROM dbo.CustomerMemberships a
                      WHERE a.CustomerID = m.CustomerID
                        AND a.Status = 'ACTIVE'
                  )
            )
            UPDATE m
            SET m.Status = 'ACTIVE',
                m.UpdatedAt = SYSDATETIME()
            FROM dbo.CustomerMemberships m
            JOIN DueScheduled d ON d.CustomerMembershipID = m.CustomerMembershipID;
            """;
    static final String CANCEL_PT_SESSIONS_FOR_EXPIRED_MEMBERSHIPS_SQL = """
            DECLARE @today DATE = CAST(GETDATE() AS DATE);

            ;WITH NoActive AS (
                SELECT DISTINCT c.CustomerID
                FROM dbo.Customers c
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.CustomerMemberships m
                    WHERE m.CustomerID = c.CustomerID AND m.Status = 'ACTIVE'
                )
            )
            UPDATE s
            SET s.Status = 'CANCELLED',
                s.CancelReason = 'Membership expired',
                s.UpdatedAt = SYSDATETIME()
            FROM dbo.PTSessions s
            JOIN NoActive na ON na.CustomerID = s.CustomerID
            WHERE s.Status = 'SCHEDULED'
              AND s.SessionDate >= @today;
            """;
    static final String PT_CANCELLATION_NOTIFICATION_SQL = """
            INSERT INTO dbo.Notifications (UserID, NotificationType, Title, Message, LinkUrl, RefId, ExtraKey)
            SELECT DISTINCT
                s.CustomerID,
                'PT_CANCELLED_MEMBERSHIP_EXPIRED',
                N'PT schedule cancelled',
                N'Your membership expired, so all PT schedules were cancelled. Renew to book again.',
                N'/schedule',
                NULL,
                NULL
            FROM dbo.PTSessions s
            WHERE s.Status = 'CANCELLED'
              AND s.CancelReason = 'Membership expired'
              AND s.UpdatedAt >= DATEADD(MINUTE, -5, SYSDATETIME());
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
     * - Countdown notifications (7/3/1 days left)
     * - Expire memberships
     * - Cancel PT sessions if membership expires
     */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void runMembershipJobs() {
        System.out.println("Running daily membership jobs...");
        try {
            runStep("membership-expiry-reminders", MEMBERSHIP_EXPIRY_REMINDER_SQL);
            runStep("expire-memberships", EXPIRE_MEMBERSHIPS_SQL);
            runStep("activate-scheduled-memberships", ACTIVATE_DUE_SCHEDULED_MEMBERSHIPS_SQL);
            runStep("cancel-pt-sessions", CANCEL_PT_SESSIONS_FOR_EXPIRED_MEMBERSHIPS_SQL);
            runStep("notify-cancelled-pt-sessions", PT_CANCELLATION_NOTIFICATION_SQL);
            System.out.println("Daily membership jobs completed successfully.");
        } catch (Exception e) {
            System.err.println("Error running daily membership jobs: " + e.getMessage());
            throw e;
        }
    }

    private void runStep(String stepName, String sql) {
        System.out.println("Running daily step: " + stepName);
        jdbcTemplate.execute(sql);
    }
}
