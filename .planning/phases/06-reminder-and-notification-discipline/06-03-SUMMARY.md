---
phase: 06-reminder-and-notification-discipline
plan: 03
subsystem: promotion
tags: [notifications, promotions, react, spring, sql, testing]
requires:
  - phase: 06-reminder-and-notification-discipline
    provides: reminder-center notification categorization and shared customer notification dedupe
provides:
  - promotion post importance flag persisted in backend and schema docs
  - important-only promotion broadcast behavior for create and update flows
  - admin promotion UI that makes broadcast intent explicit
  - regression coverage for promotion broadcast discipline across service, controller, and page layers
affects: [phase-06-reminder-and-notification-discipline, promotions, reminder-center, admin-ui]
tech-stack:
  added: []
  patterns:
    - explicit notification intent flag for admin-authored promotion posts
    - create/update broadcast guard based on active and important state
key-files:
  created: []
  modified:
    - backend/src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java
    - backend/src/test/java/com/gymcore/backend/modules/promotion/service/PromotionServiceTest.java
    - backend/src/test/java/com/gymcore/backend/modules/promotion/controller/PromotionControllerTest.java
    - frontend/src/pages/admin/AdminPromotionsPage.jsx
    - frontend/src/pages/admin/AdminPromotionsPage.test.jsx
    - docs/GymCore.txt
    - docs/alter.txt
key-decisions:
  - "Promotion post importance is stored on dbo.PromotionPosts so the broadcast rule stays attached to the post, not the coupon."
  - "Only active posts marked important can trigger notifyAllCustomers, and update flows broadcast only when a post becomes newly eligible."
  - "Admin UX defaults to page-only publishing and requires an explicit toggle to broadcast to every customer."
patterns-established:
  - "Promotion publishing: treat customer-wide notifications as an explicit authoring choice, never as a default side effect."
  - "Notification discipline: rely on shared notification dedupe while still guarding create/update transitions at the feature service layer."
requirements-completed: [NOTF-03]
duration: 33 min
completed: 2026-03-13
---

# Phase 6 Plan 03: Important Promotion Broadcast Discipline Summary

**Important promotion posts now carry an explicit backend flag, only those posts broadcast to every customer, and the admin promotions UI makes the notification blast decision explicit.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-03-13T07:37:00Z
- **Completed:** 2026-03-13T08:10:13Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments
- Added `IsImportant` contract support for promotion posts in the promotion service and SQL schema docs.
- Restricted promotion broadcast notifications to active posts explicitly marked important, including update flows that newly qualify for broadcast.
- Added explicit admin UI controls and messaging for broadcast-vs-page-only publishing, with page tests covering both important and ordinary posts.

## Task Commits

Each task was committed atomically where the shared dirty worktree allowed it:

1. **Task 1: Add important-post persistence or contract support in the promotion backend** - `11cb96a` (feat)
2. **Task 2: Guard customer-wide promotion broadcasts behind the important flag** - `11cb96a` (feat)
3. **Task 3: Add admin UI controls for important promotion publishing** - `060eb47` (feat)
4. **Task 4: Lock important-only promotion broadcasting with backend and page tests** - `5316b32` (test)

**Plan metadata:** pending final docs commit at summary creation time

## Files Created/Modified
- `backend/src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java` - persists `IsImportant` and guards broadcast notifications to important active posts.
- `backend/src/test/java/com/gymcore/backend/modules/promotion/service/PromotionServiceTest.java` - covers important-only create/update broadcast behavior.
- `backend/src/test/java/com/gymcore/backend/modules/promotion/controller/PromotionControllerTest.java` - checks that controller payloads preserve the important flag.
- `frontend/src/pages/admin/AdminPromotionsPage.jsx` - adds explicit important-post toggle, low-noise messaging, and broadcast/page-only status badges.
- `frontend/src/pages/admin/AdminPromotionsPage.test.jsx` - verifies important posts submit `isImportant: 1` and ordinary posts default to `isImportant: 0`.
- `docs/GymCore.txt` - documents the `IsImportant` column on `dbo.PromotionPosts`.
- `docs/alter.txt` - backfills the `IsImportant` column for existing databases.

## Decisions Made
- Stored importance on the post record so the broadcast contract follows authored campaign content instead of coupon metadata.
- Guarded update-time broadcasts using prior post state so editing an already-important post does not resend a customer-wide blast.
- Kept ordinary posts fully usable from the Promotions page while making customer-wide broadcast an explicit admin choice.

## Deviations from Plan

### Execution Constraint

- `PromotionService.java` was already dirty with related in-progress promotion changes in the shared worktree. To avoid reverting collaborator work, the Task 1 commit also ended up carrying the Task 2 backend service changes that touched the same file.

---

**Total deviations:** 1 execution constraint
**Impact on plan:** The shipped behavior matches the plan, but Task 1 and Task 2 backend changes share one service-file commit because the file was already dirty.

## Issues Encountered
- `cmd /c npm run test:run -- src/pages/admin/AdminPromotionsPage.test.jsx` initially failed inside the sandbox because Vite/esbuild could not spawn helper processes. Running the same command outside the sandbox passed.
- `& \"$HOME\\.m2\\wrapper\\dists\\apache-maven-3.9.12\\59fe215c0ad6947fea90184bf7add084544567b927287592651fda3782e0e798\\bin\\mvn.cmd\" -q -s backend\\.codex-maven-settings.xml \"-Dtest=PromotionServiceTest,PromotionControllerTest\" test` still fails in `backend/src/test/java/com/gymcore/backend/modules/UnsupportedActionDispatchTest.java` because its `UserManagementService` constructor is stale. This blocker is pre-existing and unrelated to Plan 06-03.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Promotion notifications now follow the important-only discipline required before the Phase 6 reminder-center UX polish.
- Phase 06-04 can consume the lower-noise promotion notifications immediately.
- Backend Maven verification remains blocked until `UnsupportedActionDispatchTest.java` is updated to the current `UserManagementService` constructor.

## Self-Check: PASSED

- Verified summary and key implementation files exist on disk.
- Verified task commits `11cb96a`, `060eb47`, and `5316b32` exist in git history.

---
*Phase: 06-reminder-and-notification-discipline*
*Completed: 2026-03-13*
