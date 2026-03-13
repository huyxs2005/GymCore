---
phase: 06-reminder-and-notification-discipline
plan: 02
subsystem: backend
tags: [notifications, scheduler, sql-server, spring-boot, reminders]
requires:
  - phase: 01-commerce-quick-wins
    provides: paid-order invoice and pickup tracking state used for commerce reminders
  - phase: 02-membership-lifecycle-core
    provides: membership status and expiry lifecycle state for reminder generation
provides:
  - explicit scheduler-owned SQL steps for 7/3/1 membership expiry reminders
  - low-noise pickup reminders for paid orders still awaiting reception pickup
  - scheduler test coverage for cadence, dedupe checkpoints, and pickup reminder discipline
affects: [06-03, 06-04, reminder-center, notification-ui]
tech-stack:
  added: []
  patterns: [transactional scheduler SQL batches, cadence-based reminder dedupe, commerce-state reminder generation]
key-files:
  created:
    - backend/src/test/java/com/gymcore/backend/common/scheduling/DailyJobServiceTest.java
  modified:
    - backend/src/main/java/com/gymcore/backend/common/scheduling/DailyJobService.java
    - docs/GymCore.txt
    - docs/alter.txt
key-decisions:
  - "Daily reminder cadence is enforced explicitly in DailyJobService instead of relying on the legacy stored procedure call path."
  - "Pickup reminders use paid order plus invoice pickup state and only fire on days 1, 3, and 7 to stay operationally useful without countdown spam."
patterns-established:
  - "Scheduler discipline: run each reminder SQL batch explicitly and transactionally so cadence and follow-up prompts stay testable in application code."
  - "Reminder dedupe: use order or membership ref IDs plus day-based extra keys so reruns do not emit duplicate reminder notifications."
requirements-completed: [NOTF-01, NOTF-02]
duration: 23 min
completed: 2026-03-13
---

# Phase 6 Plan 2: Reminder cadence and anti-spam scheduler discipline Summary

**Transactional scheduler-owned SQL for 7/3/1 membership expiry reminders plus low-noise paid-order pickup follow-up**

## Performance

- **Duration:** 23 min
- **Started:** 2026-03-13T14:18:00+07:00
- **Completed:** 2026-03-13T14:41:00+07:00
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Added a dedicated `DailyJobServiceTest` anchor that locks 7/3/1 cadence rules, checkpoint dedupe, and pickup reminder SQL expectations.
- Replaced the opaque legacy daily job call with explicit transactional scheduler steps so the application enforces the agreed 7/3/1 membership reminder cadence.
- Added low-noise pickup reminder generation for paid but uncollected orders and synchronized both SQL docs to the same reminder discipline.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scheduler test coverage for reminder cadence and rerun discipline** - `bb9d4d8` (test)
2. **Task 2: Change membership expiry reminder cadence to 7, 3, and 1 days** - `083d142` (fix)
3. **Task 3: Add low-noise pickup reminder generation to the daily reminder pipeline** - `815446e` (feat)

## Files Created/Modified
- `backend/src/main/java/com/gymcore/backend/common/scheduling/DailyJobService.java` - Executes explicit transactional daily reminder SQL steps for membership cadence, PT cleanup, and pickup reminders.
- `backend/src/test/java/com/gymcore/backend/common/scheduling/DailyJobServiceTest.java` - Covers scheduler step order plus cadence and dedupe SQL expectations.
- `docs/GymCore.txt` - Aligns the source-of-truth schema procedure with 7/3/1 membership reminders and 1/3/7 pickup reminders.
- `docs/alter.txt` - Adds an idempotent procedure override so existing local databases can pick up the new reminder discipline.

## Decisions Made
- Scheduler execution now owns reminder cadence explicitly in Java so the low-noise rules are visible and testable alongside the app code.
- Pickup reminders are driven from `Orders.Status = 'PAID'`, `OrderInvoices.PaidAt`, and `OrderInvoices.PickedUpAt` instead of separate reminder state, preserving commerce as the source of truth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added isolated scheduler-test verification outside Maven's blocked testCompile path**
- **Found during:** Task 1 and final verification
- **Issue:** The plan's exact Maven test command still fails before reaching `DailyJobServiceTest` because the unrelated `UnsupportedActionDispatchTest` constructor call is stale.
- **Fix:** Verified the scheduler work by compiling main sources with Maven, then compiling and launching `DailyJobServiceTest` in isolation with JUnit Platform.
- **Files modified:** None
- **Verification:** Isolated `DailyJobServiceTest` run passed with 3/3 tests successful after each scheduler change set.
- **Committed in:** None (verification-only workaround)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No product scope drift. The workaround only affected verification because the repository still has a pre-existing unrelated test-compile failure.

## Issues Encountered
- `backend\\mvnw` could not launch Maven correctly in this PowerShell environment, so verification used the direct Maven binary from the wrapper distribution.
- The required command `mvn -q -Dtest=DailyJobServiceTest test` still fails during `testCompile` because `backend/src/test/java/com/gymcore/backend/modules/UnsupportedActionDispatchTest.java` no longer matches the `UserManagementService` constructor signature. This blocker existed before Plan 06-02 and was not modified here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Reminder-center consumers in Phase 06 now receive materially quieter membership expiry reminders and actionable pickup follow-up sourced from real commerce state.
- Phase 06-03 can proceed without changing this scheduler contract.
- Anyone relying on the exact Maven targeted-test command still needs the unrelated `UnsupportedActionDispatchTest` constructor mismatch fixed before repository-wide test compilation is clean again.

## Self-Check: PASSED

- Verified required files exist on disk for the scheduler implementation, scheduler test anchor, and synced SQL docs.
- Verified task commits exist: `bb9d4d8`, `083d142`, `815446e`.

---
*Phase: 06-reminder-and-notification-discipline*
*Completed: 2026-03-13*
