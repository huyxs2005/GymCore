package com.gymcore.backend.common.scheduling;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

class DailyJobServiceTest {

    private JdbcTemplate jdbcTemplate;
    private DailyJobService dailyJobService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        dailyJobService = new DailyJobService(jdbcTemplate);
    }

    @Test
    void runMembershipJobs_shouldExecuteDailyMembershipProcedure() {
        dailyJobService.runMembershipJobs();

        verify(jdbcTemplate).execute(DailyJobService.LEGACY_DAILY_MEMBERSHIP_JOB_SQL);
    }

    @Test
    void membershipExpiryReminderSql_shouldUse731CadenceAndCheckpointDedupe() {
        String sql = DailyJobService.MEMBERSHIP_EXPIRY_REMINDER_SQL;

        assertTrue(sql.contains("a.DaysLeft IN (7, 3, 1)"));
        assertTrue(sql.contains("n.NotificationType = 'MEMBERSHIP_EXPIRES_COUNTDOWN'"));
        assertTrue(sql.contains("n.ExtraKey = CONCAT('DAYSLEFT_', a.DaysLeft)"));
        assertFalse(sql.contains("BETWEEN 1 AND 7"));
    }

    @Test
    void pickupWaitingReminderSql_shouldUsePaidUnpickedStateAndLowNoiseCadence() {
        String sql = DailyJobService.PICKUP_WAITING_REMINDER_SQL;

        assertTrue(sql.contains("o.Status = 'PAID'"));
        assertTrue(sql.contains("i.PickedUpAt IS NULL"));
        assertTrue(sql.contains("p.DaysWaiting IN (1, 3, 7)"));
        assertTrue(sql.contains("n.NotificationType = 'ORDER_PICKUP_REMINDER'"));
        assertTrue(sql.contains("n.ExtraKey = CONCAT('WAITING_DAY_', p.DaysWaiting)"));
    }
}
