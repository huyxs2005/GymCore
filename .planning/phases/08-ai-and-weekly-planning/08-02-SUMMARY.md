---
phase: 08-ai-and-weekly-planning
plan: 02
subsystem: api
tags: [spring-boot, ai, recommendations, weekly-plan, testing]
requires:
  - phase: 08-01
    provides: ai-context.v1 context assembly and explainable context metadata
provides:
  - richer AI recommendation contract with summaries, sections, reasons, and action bridges
  - structured weekly-plan backend contract with guidance guardrails and next actions
  - backend tests covering recommendation and weekly-plan response semantics
affects: [08-03 weekly planner UX, 08-04 AI action bridges, customer knowledge rendering]
tech-stack:
  added: []
  patterns: [backend-owned structured AI contracts, explainable recommendation sections, guidance-only weekly-plan payloads]
key-files:
  created: [.planning/phases/08-ai-and-weekly-planning/08-02-SUMMARY.md]
  modified:
    - backend/src/main/java/com/gymcore/backend/modules/content/service/ContentService.java
    - backend/src/main/java/com/gymcore/backend/modules/content/controller/ContentController.java
    - backend/src/test/java/com/gymcore/backend/modules/content/service/ContentServiceTest.java
    - backend/src/test/java/com/gymcore/backend/modules/content/controller/ContentControllerTest.java
key-decisions:
  - "Kept `workouts` and `foods` top-level in recommendations while adding `summary`, `sections`, and `nextActions` for frontend compatibility."
  - "Made weekly-plan output deterministic and guidance-only rather than free-form prose so later UI can render stable sections and safety messaging."
patterns-established:
  - "Structured AI response pattern: contractVersion plus summary, sections, nextActions, and ai-context metadata."
  - "Action bridge pattern: recommendation items and weekly plans expose route-ready objects instead of only descriptive text."
requirements-completed: [AI-01, AI-02]
duration: 4min
completed: 2026-03-13
---

# Phase 8 Plan 02: Recommendation and Weekly Plan Contracts Summary

**Context-aware recommendation payloads and a guidance-bounded weekly-plan contract on top of `ai-context.v1` for frontend rendering and action routing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T19:40:12+07:00
- **Completed:** 2026-03-13T19:44:07+07:00
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Expanded AI recommendations so the backend now returns summaries, highlights, renderable sections, item reasons, and route-ready next actions.
- Added a new `/api/v1/ai/weekly-plan` backend contract with workout, food, and recovery sections plus explicit scope guardrails.
- Added backend contract tests for recommendation semantics and weekly-plan response shape, then wired controller coverage for the new endpoint.

## Task Commits

Each task was committed atomically:

1. **Task 1: Refine recommendation contracts around richer AI context** - `caa70ce` (feat)
2. **Task 2: Add a structured mini weekly-plan contract** - `b7f00b9` (feat)
3. **Task 3: Protect recommendation and weekly-plan contracts with backend tests** - `a7c5a53` (test)

## Files Created/Modified
- `backend/src/main/java/com/gymcore/backend/modules/content/service/ContentService.java` - added recommendation summaries/actions and the weekly-plan contract builder.
- `backend/src/main/java/com/gymcore/backend/modules/content/controller/ContentController.java` - exposed the weekly-plan endpoint.
- `backend/src/test/java/com/gymcore/backend/modules/content/service/ContentServiceTest.java` - locked structured recommendation and weekly-plan payload expectations.
- `backend/src/test/java/com/gymcore/backend/modules/content/controller/ContentControllerTest.java` - verified weekly-plan controller delegation.

## Decisions Made
- Preserved existing recommendation arrays for compatibility while adding richer structured fields for the upcoming knowledge-page UX.
- Kept the weekly plan deterministic, sectioned, and explicitly limited to guidance-level suggestions with disclaimers and product-scoped next actions.

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered
- The plan’s target Maven test commands could not complete because unrelated pre-existing test files (`UnsupportedActionDispatchTest` and `MembershipServiceCustomerFlowTest`) still construct `CheckinHealthService` with an outdated constructor. Main-source verification used `-DskipTests compile`, and the blocker was recorded for follow-up.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `08-03` can now render recommendation summaries, sections, action bridges, and the new weekly-plan contract directly from backend-owned payloads.
- The pre-existing unrelated test-compile blocker still needs cleanup before targeted Maven content-test verification can run end to end.

## Self-Check: PASSED

- Verified `.planning/phases/08-ai-and-weekly-planning/08-02-SUMMARY.md` exists.
- Verified task commits `caa70ce`, `b7f00b9`, and `a7c5a53` exist in git history.

---
*Phase: 08-ai-and-weekly-planning*
*Completed: 2026-03-13*
