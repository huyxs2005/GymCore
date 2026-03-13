# Project State

## Project Reference
- See: [.planning/PROJECT.md](D:\project\GymCore-beta-test-0.2\.planning\PROJECT.md) (updated 2026-03-12)
- Core value: Make GymCore operationally safe, low-friction, and worth returning to weekly through clearer lifecycle logic, stronger PT continuity, safer commerce handoff, better support visibility, and useful AI guidance.
- Current focus: Phase 6 (Reminder and Notification Discipline) is complete. Phase 7 (Customer Progress Hub) is now the next dependency-safe execution target.

## Current Position
- Phase: 6 of 8 (Reminder and Notification Discipline)
- Plan Execution: 4 of 4 in current phase
- Status: Phase 1 through Phase 6 executed; Phase 7 is next
- Last activity: 2026-03-13 - executed Plan 06-04 (reminder center UX and Phase 6 verification) with action-first notification surfaces, de-emphasized read history, reminder-center frontend coverage, and Playwright verification for important-only promotion notification visibility
- Progress: [########--] 75.0%

## Performance Metrics
- Total phases in roadmap: 8
- Planned phases complete: 8
- Executed phases complete: 6
- Pending todos captured: 0
- Active debug sessions: 0

## Accumulated Context
### Locked Product Decisions
- PT booking is instant when slots are available, tied to one primary coach, recurring from week one, and self-service only before the 12-hour cutoff.
- Membership renew always continues after expiry. Upgrade applies immediately, uses day-based prorated credit, allows membership coupons, resets full duration, and cancels scheduled old-context plans.
- Commerce allows recipient-change requests for paid but unpicked orders, review only after pickup, reorder from history, and wallet-first coupon usage.
- Reception can only search, explain, and check in against valid rules. No membership override powers.
- Promotion notifications broadcast only for posts marked important. Expiry reminders follow 7/3/1-day cadence, and paid-but-unpicked orders follow a 1/3/7-day pickup reminder cadence.
- Reminder center surfaces direct next actions first while preserving read notifications as quieter visible history across the dropdown and full page.
- Sensitive admin actions require reason notes, and customer-facing sensitive account actions must send explanation emails.
- AI must use goals, health, and progress, and can produce mini weekly plans while routing users back to real flows.

### Source Documents
- [docs/PRODUCT_DIRECTION_SUMMARY.md](D:\project\GymCore-beta-test-0.2\docs\PRODUCT_DIRECTION_SUMMARY.md)
- [docs/PT_EXPANSION_SPEC.md](D:\project\GymCore-beta-test-0.2\docs\PT_EXPANSION_SPEC.md)
- [docs/EXPANSION_PHASE_PLAN.md](D:\project\GymCore-beta-test-0.2\docs\EXPANSION_PHASE_PLAN.md)

### Blockers and Concerns
- No phase-specific CONTEXT.md exists yet; all phases were planned from roadmap, requirements, and research.
- A dedicated multi-context Playwright follow-up for coach replacement acceptance/decline is currently skipped locally because it is flaky on the local dev-server/browser-context combination.
- Later execution order should continue to respect roadmap dependencies; Phase 7 is the next safe execution target before AI and weekly-planning work.

## Session Continuity
- Last completed session: Phase 6 verification closeout
- Stopped at: Phase 6 execution, summaries, roadmap updates, frontend notification tests, Playwright reminder/promotion coverage, and the targeted backend Maven suite all passed after fixing the stale `UnsupportedActionDispatchTest` constructor
- Resume action: run `$gsd-execute-phase 7`
- Continue file: [.planning/phases/07-customer-progress-hub/07-01-PLAN.md](D:\project\GymCore-beta-test-0.2\.planning\phases\07-customer-progress-hub\07-01-PLAN.md)
