# Retrospective

## Milestone: v1.0 - Expansion

**Shipped:** 2026-03-13  
**Phases:** 8 | **Plans:** 31 | **Tasks:** 38

### What Was Built
- Commerce handoff, reorder, and coupon wallet clarity.
- Membership lifecycle normalization for purchase, renew, and upgrade behavior.
- PT booking, recurring scheduling, self-service change flows, and coach exception handling.
- Support-first admin and reception workflows with safer governance.
- Reminder-center and notification discipline.
- Customer progress visibility plus AI weekly planning and action routing.

### What Worked
- Phase-by-phase execution with summaries kept implementation traceable.
- Backend-owned read models reduced frontend guesswork in progress and AI surfaces.
- Cross-role Playwright coverage caught real product wiring issues before closeout.

### What Was Inefficient
- Phase verification was inconsistent; phases 1 through 5 completed without `VERIFICATION.md` artifacts.
- Repo-wide backend verification drifted because older tests were not updated after constructor changes.
- Some Playwright flows remained sensitive to worker parallelism and local environment startup.

### Patterns Established
- Additive contracts are safer than replacing live response shapes during multi-phase rollouts.
- Customer-facing AI and progress UX should bridge into real product actions rather than become disconnected assistant surfaces.
- Shared SQL fixtures need isolated identities or serialized workers when multi-role flows overlap.

### Key Lessons
- Milestone closure should not wait until the end to discover missing phase verification artifacts.
- Constructor and test fixture changes need repo-wide follow-through, not only target-suite updates.
- End-to-end proof for exception flows needs dedicated ownership; stubs are not enough for final sign-off.

### Cost Observations
- Model mix: mostly executor-style subagents plus local orchestration.
- Sessions: 1 milestone closeout session after phased execution.
- Notable: archival is cheap only when verification artifacts are complete before the milestone audit.

## Cross-Milestone Trends

| Milestone | Verification Quality | Main Debt |
|---|---|---|
| v1.0 | Partial | Missing early phase verification artifacts and stale backend tests |
