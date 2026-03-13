---
phase: 06-reminder-and-notification-discipline
plan: 01
subsystem: api
tags: [notifications, reminder-center, spring-boot, backend]
requires:
  - phase: 01-commerce-quick-wins
    provides: promotion and notification endpoint surface used by the reminder center
  - phase: 02-membership-lifecycle-core
    provides: membership notification events and reminder sources
provides:
  - backend-owned reminder metadata on notification items
  - action-first notification views for actionable reminders versus quiet history
  - backend tests for reminder categorization and preserved history visibility
affects: [06-02, 06-03, 06-04, notification-ui]
tech-stack:
  added: []
  patterns: [backend-owned notification reminder metadata, action-first notification view filtering]
key-files:
  created: [backend/src/test/java/com/gymcore/backend/common/service/UserNotificationServiceTest.java]
  modified:
    - backend/src/main/java/com/gymcore/backend/common/service/UserNotificationService.java
    - backend/src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java
    - backend/src/main/java/com/gymcore/backend/modules/promotion/controller/PromotionController.java
    - backend/src/test/java/com/gymcore/backend/modules/promotion/controller/PromotionControllerTest.java
key-decisions:
  - "Reminder intent, bucket, category, and destination labels are derived in the backend from notification type and read state."
  - "Unread action-required items stay in the actionable bucket, while read items and informational items move to quiet history without deleting notification records."
patterns-established:
  - "Notification reminder projection: each notification carries a nested reminder object with intent, bucket, category, keepInHistory, and destination metadata."
  - "Notification query view: /notifications can project all, actionable, or history while still returning reminder-center counts."
requirements-completed: [NOTF-01, NOTF-04]
duration: 11 min
completed: 2026-03-13
---

# Phase 6 Plan 1: Reminder-center backend foundation Summary

**Reminder-center notification projection with backend-owned action/history buckets and endpoint-level action-first views**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-13T14:03:55+07:00
- **Completed:** 2026-03-13T14:14:44+07:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added backend-owned reminder metadata to each notification so the frontend does not infer reminder intent from raw notification types alone.
- Exposed action-first notification filtering with `all`, `actionable`, and `history` views while preserving the existing notification table and read semantics.
- Added backend tests for reminder categorization, read-history preservation, and controller forwarding of reminder view filters.

## Task Commits

Each task was committed atomically:

1. **Task 1: Introduce a backend-owned reminder-center notification contract** - `5d6ec63` (feat)
2. **Task 2: Normalize notification query behavior for action-first consumption** - `b25b147` (feat)
3. **Task 3: Lock reminder-center semantics with backend tests** - `4e87f43` (test)

## Files Created/Modified
- `backend/src/main/java/com/gymcore/backend/common/service/UserNotificationService.java` - Builds reminder metadata, action/history buckets, counts, and action-first views.
- `backend/src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java` - Forwards reminder view filters from the promotion-owned notification endpoint into the notification service.
- `backend/src/main/java/com/gymcore/backend/modules/promotion/controller/PromotionController.java` - Accepts `view` alongside `unreadOnly` on the notifications endpoint.
- `backend/src/test/java/com/gymcore/backend/common/service/UserNotificationServiceTest.java` - Covers reminder categorization, actionable/history projection, and read-history preservation.
- `backend/src/test/java/com/gymcore/backend/modules/promotion/controller/PromotionControllerTest.java` - Verifies controller forwarding of unread and reminder view filters.

## Decisions Made
- Reminder ownership stays in the backend service layer: the response now carries explicit reminder intent, bucket, category, and destination metadata.
- Read state influences presentation, not retention: action-required items fall back into history once read, keeping the full notification record accessible.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed (0 bug, 0 missing critical, 0 blocking)
**Impact on plan:** No scope drift in the implemented reminder-center behavior. Verification was limited by an unrelated existing test compilation failure.

## Issues Encountered
- `backend/.codex-maven-settings-local.xml` was added as a local-only sandbox helper so Maven could use a writable repository path during verification. It is not part of the plan output and is not committed.
- The required targeted Maven test command could not complete because `backend/src/test/java/com/gymcore/backend/modules/UnsupportedActionDispatchTest.java` has a pre-existing constructor mismatch against `UserManagementService`. Maven fails during `testCompile` before it reaches `PromotionControllerTest` or `UserNotificationServiceTest`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The backend now exposes reminder metadata and action/history grouping for the Phase 6 reminder-center UI work.
- Phase 06-02 and 06-03 can build on the reminder contract without changing notification storage or dedupe behavior.
- Targeted test execution is still blocked until the unrelated `UnsupportedActionDispatchTest` constructor mismatch is corrected.

## Self-Check: PASSED

- Verified required files exist on disk for the reminder service, controller wiring, tests, and deferred-items log.
- Verified task commits exist: `5d6ec63`, `b25b147`, `4e87f43`.

---
*Phase: 06-reminder-and-notification-discipline*
*Completed: 2026-03-13*
