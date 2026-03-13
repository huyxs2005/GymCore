# Project State

## Project Reference
- See: [.planning/PROJECT.md](D:\project\GymCore-beta-test-0.2\.planning\PROJECT.md) (updated 2026-03-12)
- Core value: Make GymCore operationally safe, low-friction, and worth returning to weekly through clearer lifecycle logic, stronger PT continuity, safer commerce handoff, better support visibility, and useful AI guidance.
- Current focus: Phase 6 (Reminder and Notification Discipline) is in progress. Plan 06-03 is the next dependency-safe execution target after the scheduler discipline work from Plan 06-02.

## Current Position
- Phase: 6 of 8 (Reminder and Notification Discipline)
- Plan Execution: 2 of 4 in current phase
- Status: Phase 1 through Phase 5 executed; Phase 6 in progress
- Last activity: 2026-03-13 - executed Plan 06-02 (reminder cadence and anti-spam scheduler discipline) with explicit 7/3/1 membership reminders, paid-order pickup reminders, and synced SQL docs
- Progress: [#######---] 67.7%

## Performance Metrics
- Total phases in roadmap: 8
- Planned phases complete: 8
- Executed phases complete: 5
- Pending todos captured: 0
- Active debug sessions: 0

## Accumulated Context
### Locked Product Decisions
- PT booking is instant when slots are available, tied to one primary coach, recurring from week one, and self-service only before the 12-hour cutoff.
- Membership renew always continues after expiry. Upgrade applies immediately, uses day-based prorated credit, allows membership coupons, resets full duration, and cancels scheduled old-context plans.
- Commerce allows recipient-change requests for paid but unpicked orders, review only after pickup, reorder from history, and wallet-first coupon usage.
- Reception can only search, explain, and check in against valid rules. No membership override powers.
- Promotion notifications broadcast only for posts marked important. Expiry reminders follow 7/3/1-day cadence, and paid-but-unpicked orders follow a 1/3/7-day pickup reminder cadence.
- Sensitive admin actions require reason notes, and customer-facing sensitive account actions must send explanation emails.
- AI must use goals, health, and progress, and can produce mini weekly plans while routing users back to real flows.

### Source Documents
- [docs/PRODUCT_DIRECTION_SUMMARY.md](D:\project\GymCore-beta-test-0.2\docs\PRODUCT_DIRECTION_SUMMARY.md)
- [docs/PT_EXPANSION_SPEC.md](D:\project\GymCore-beta-test-0.2\docs\PT_EXPANSION_SPEC.md)
- [docs/EXPANSION_PHASE_PLAN.md](D:\project\GymCore-beta-test-0.2\docs\EXPANSION_PHASE_PLAN.md)

### Blockers and Concerns
- No phase-specific CONTEXT.md exists yet; all phases were planned from roadmap, requirements, and research.
- A dedicated multi-context Playwright follow-up for coach replacement acceptance/decline is currently skipped locally because it is flaky on the local dev-server/browser-context combination.
- `backend/src/test/java/com/gymcore/backend/modules/UnsupportedActionDispatchTest.java` currently fails `testCompile` because its `UserManagementService` constructor call no longer matches the service signature. This is unrelated to Phase 6 reminder work but currently blocks targeted Maven test execution for Plans 06-01 and 06-02.
- Later execution order should continue to respect roadmap dependencies; Phase 6 is now the next safe execution target before later progress and AI work.

## Session Continuity
- Last completed session: Phase 6 Plan 06-02 execution
- Stopped at: reminder scheduler discipline implemented, summarized, and isolated scheduler tests verified; the exact Maven targeted-test command remains blocked by the unrelated `UnsupportedActionDispatchTest` constructor mismatch
- Resume action: run `$gsd-execute-phase 6`
- Continue file: [.planning/phases/06-reminder-and-notification-discipline/06-03-PLAN.md](D:\project\GymCore-beta-test-0.2\.planning\phases\06-reminder-and-notification-discipline\06-03-PLAN.md)
