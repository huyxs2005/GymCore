---
phase: 08-ai-and-weekly-planning
plan: 04
subsystem: ai-verification
tags: [gemini, react, playwright, vitest, ai, weekly-plan]
requires:
  - phase: 08-03
    provides: shared knowledge-page action vocabulary and weekly-plan UI affordances
provides:
  - consultative Gemini chat prompts grounded in resolved customer context
  - bounded chat action vocabulary shared with weekly-plan and recommendation flows
  - dedicated customer AI business-flow verification for weekly planning and chat action bridges
affects: [phase-08 sign-off, customer knowledge ai flows, chat routing]
tech-stack:
  added: []
  patterns: [resolved-ai-context prompt shaping, widget-to-backend action handoff, deterministic AI fixture seeding]
key-files:
  created:
    - .planning/phases/08-ai-and-weekly-planning/08-04-SUMMARY.md
    - backend/src/test/java/com/gymcore/backend/modules/content/service/GeminiChatServiceTest.java
    - tests/customer.ai.business.spec.js
  modified:
    - backend/src/main/java/com/gymcore/backend/modules/content/service/GeminiChatService.java
    - frontend/src/components/common/AiChatWidget.jsx
    - frontend/src/components/common/AiChatWidget.test.jsx
    - tests/customer.business.spec.js
    - tests/helpers/sql.js
key-decisions:
  - "Chat now receives route-ready `availableActions` from the widget so Gemini can stay grounded in the same product actions exposed by weekly plans and recommendations."
  - "Resolved AI context is summarized into goals, health, progress, and current selections inside the Gemini system instruction instead of leaving those signals implicit."
  - "Phase 8 customer Playwright verification runs reliably with one worker because the shared commerce SQL fixtures are not parallel-safe."
patterns-established:
  - "AI chat prompts should only mention supported GymCore actions and must never imply that booking or operational actions happen inside chat."
  - "Customer AI Playwright coverage should seed explicit goals, health, and progress signals before asserting weekly-plan or recommendation behavior."
requirements-completed: [AI-01, AI-02, AI-03]
duration: 31min
completed: 2026-03-13
---

# Phase 8 Plan 04: Consultative Chat Context, Action Bridges, and Phase 8 Verification Summary

**Consultative GymCore chat now uses resolved customer signals plus shared action bridges, and Phase 8 is verified across frontend and customer business flows.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-03-13T20:18:00+07:00
- **Completed:** 2026-03-13T20:49:44+07:00
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Expanded Gemini prompt construction so chat is consultative, bounded to GymCore-supported actions, and aware of resolved goals, health, progress, selected workout/food context, and route-ready actions.
- Updated the floating AI widget to forward normalized `availableActions` with each chat request and protected that contract with Vitest coverage.
- Added a dedicated customer AI business-flow spec plus deterministic SQL fixture seeding to verify weekly-plan visibility, inline detail bridges, progress-hub routing, PT booking routing, and bounded chat payload actions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich consultative chat context and lock it with tests** - `4147b54` (feat)
2. **Task 2: Add customer-facing AI business-flow coverage** - `6ae127b` (test)
3. **Task 3: Run final Phase 8 verification and tidy action-bridge gaps** - `99faceb` (test)

## Files Created/Modified
- `backend/src/main/java/com/gymcore/backend/modules/content/service/GeminiChatService.java` - summarizes resolved AI context and allowed actions into the Gemini system prompt.
- `backend/src/test/java/com/gymcore/backend/modules/content/service/GeminiChatServiceTest.java` - verifies that prompt construction includes goals, health, progress, selections, actions, and food catalog grounding.
- `frontend/src/components/common/AiChatWidget.jsx` - sends normalized `availableActions` along with chat context.
- `frontend/src/components/common/AiChatWidget.test.jsx` - verifies the widget forwards route-ready actions in the chat payload.
- `tests/helpers/sql.js` - seeds deterministic customer AI planning state for saved goals, health history, and recent coaching signal.
- `tests/customer.ai.business.spec.js` - verifies weekly-plan visibility, real action bridges, and bounded chat payload actions.
- `tests/customer.business.spec.js` - aligns the saved-goal recommendation assertion with the Phase 8 recommendation UI.

## Decisions Made
- Kept PT booking as a receiving flow and enforced that boundary inside the Gemini prompt instructions.
- Reused the knowledge-page and weekly-plan action vocabulary inside chat instead of introducing a separate chat-only command system.
- Verified the broader customer Playwright suite with `--workers=1` because the shared commerce SQL fixture is not parallel-safe under multiple workers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Fixture] Fixed the AI planning SQL fixture to respect health-table behavior**
- **Found during:** Task 2 verification
- **Issue:** The new fixture attempted to write a computed `BMI` column and then double-populated `CustomerHealthCurrent` through the history upsert trigger.
- **Fix:** Removed the direct `BMI` write and reduced the seeded history insert to a single deterministic record that still provides progress context cleanly.
- **Files modified:** `tests/helpers/sql.js`

**2. [Rule 1 - Test Coverage] Updated outdated recommendation assertions to the current Phase 8 UI**
- **Found during:** Task 3 verification
- **Issue:** The existing customer business spec still expected pre-Phase-8 headings (`Workout recommendations` / `Food recommendations`).
- **Fix:** Updated the spec to assert the current `Recommendation brief`, `Workout focus`, and `Food emphasis` surfaces.
- **Files modified:** `tests/customer.business.spec.js`

## Issues Encountered
- Targeted backend Maven verification for `GeminiChatServiceTest` is still blocked by unrelated pre-existing test-compile failures in `UnsupportedActionDispatchTest` and `MembershipServiceCustomerFlowTest`, both of which instantiate `CheckinHealthService` with an outdated constructor. This blocker was already recorded in `STATE.md` and was left untouched because it is outside the scope of Phase 8 Plan `08-04`.
- Initial Vitest and Playwright runs required execution outside the sandbox because the local environment returned `spawn EPERM` for worker and browser startup.

## User Setup Required

None.

## Next Phase Readiness
- Phase 8 is fully implemented and customer-facing AI flows are verified across widget payloads, weekly plans, recommendations, and route bridges.
- The only remaining verification debt is the unrelated backend test-compile blocker outside this plan’s file ownership.

## Self-Check: PASSED

- Verified `.planning/phases/08-ai-and-weekly-planning/08-04-SUMMARY.md` exists.
- Verified task commits `4147b54`, `6ae127b`, and `99faceb` exist in git history.

---
*Phase: 08-ai-and-weekly-planning*
*Completed: 2026-03-13*
