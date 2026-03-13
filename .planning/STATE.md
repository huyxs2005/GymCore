# Project State

## Project Reference
- See: [.planning/PROJECT.md](D:\project\GymCore-beta-test-0.2\.planning\PROJECT.md) (updated 2026-03-12)
- Core value: Make GymCore operationally safe, low-friction, and worth returning to weekly through clearer lifecycle logic, stronger PT continuity, safer commerce handoff, better support visibility, and useful AI guidance.
- Current focus: Phase 7 (Customer Progress Hub) is in progress. Plan 07-03 is the next dependency-safe execution target after the PT-context and latest-signal backend enrichment in 07-02.

## Current Position
- Phase: 7 of 8 (Customer Progress Hub)
- Plan Execution: 2 of 4 in current phase
- Status: Phase 1 through Phase 6 executed; Phase 7 is in progress
- Last activity: 2026-03-13 - executed Plan 07-02 (PT context and coaching-signal backend enrichment) with a reusable customer PT progress-context read model, explicit latest note/progress signals, and targeted backend coverage across `CheckinHealthService` and `CoachBookingService`
- Progress: [########--] 81.3%

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
- Phase 7 keeps legacy customer health and coach-note endpoints live while the new progress hub contract rolls out incrementally.
- Phase 7 progress-hub aggregates use additive aliases like `currentSnapshot` and `recentCoachNotes` instead of breaking legacy response keys during migration.
- Customer progress-hub follow-up remains explicitly read-only; coach-owned progress and note writes stay authoritative.
- Phase 7 PT context should be sourced from the existing coach booking read model instead of duplicating booking logic inside the progress hub.
- Phase 7 latest coaching semantics should be consumed through explicit `latestNoteSignal`, `latestProgressSignal`, and `latestSignals.mostRecent` fields instead of frontend timestamp guessing.

### Source Documents
- [docs/PRODUCT_DIRECTION_SUMMARY.md](D:\project\GymCore-beta-test-0.2\docs\PRODUCT_DIRECTION_SUMMARY.md)
- [docs/PT_EXPANSION_SPEC.md](D:\project\GymCore-beta-test-0.2\docs\PT_EXPANSION_SPEC.md)
- [docs/EXPANSION_PHASE_PLAN.md](D:\project\GymCore-beta-test-0.2\docs\EXPANSION_PHASE_PLAN.md)

### Blockers and Concerns
- No phase-specific CONTEXT.md exists yet; all phases were planned from roadmap, requirements, and research.
- A dedicated multi-context Playwright follow-up for coach replacement acceptance/decline is currently skipped locally because it is flaky on the local dev-server/browser-context combination.
- `backend\\mvnw.cmd` still fails in this shell environment; targeted backend verification currently depends on the local Maven installation plus `.codex-maven-settings.xml`.
- Later execution order should continue to respect roadmap dependencies; Plan 07-03 is the next safe execution target for customer progress-hub UI integration.

## Session Continuity
- Last completed session: Phase 7 PT context and coaching-signal backend enrichment
- Stopped at: Plan 07-02 execution, summary creation, roadmap/state updates, and targeted `CheckinHealthServiceTest` plus `CoachBookingServiceTest` verification for unified PT-progress semantics
- Resume action: run `$gsd-execute-phase 7`
- Continue file: [.planning/phases/07-customer-progress-hub/07-03-PLAN.md](D:\project\GymCore-beta-test-0.2\.planning\phases\07-customer-progress-hub\07-03-PLAN.md)
