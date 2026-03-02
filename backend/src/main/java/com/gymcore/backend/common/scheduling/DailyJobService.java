package com.gymcore.backend.common.scheduling;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class DailyJobService {

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
            jdbcTemplate.execute("EXEC dbo.sp_RunDailyMembershipJobs");
            System.out.println("Daily membership jobs completed successfully.");
        } catch (Exception e) {
            System.err.println("Error running daily membership jobs: " + e.getMessage());
        }
    }
}
