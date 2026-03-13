# Project: GymCore

## What This Is
GymCore is a multi-role gym operations product for customers, coaches, receptionists, and admins. The shipped v1.0 product now covers memberships, PT booking and exception handling, check-in and health tracking, commerce handoff, operational support tooling, reminder discipline, customer progress visibility, and context-aware AI guidance.

## Core Value
Make GymCore operationally safe, low-friction, and worth returning to weekly through clearer lifecycle logic, stronger PT continuity, safer commerce handoff, better support visibility, and AI guidance that is useful instead of generic.

## Current State
Shipped milestone: `v1.0 Expansion` on `2026-03-13`.

Delivered in v1.0:
- Safer commerce handoff with recipient-change review, reorder, and coupon wallet clarity.
- Explicit membership purchase, renewal, upgrade, and entitlement behavior.
- Instant recurring PT booking, self-service schedule changes, and coach exception handling.
- Support-first admin and reception tooling with sensitive-action governance.
- Action-first reminder center behavior and important-only promotion broadcasts.
- Customer Progress Hub plus context-aware AI recommendations, weekly planning, and action bridges.

Archive references:
- Roadmap archive: [.planning/milestones/v1.0-ROADMAP.md](D:\project\GymCore-beta-test-0.2\.planning\milestones\v1.0-ROADMAP.md)
- Requirements archive: [.planning/milestones/v1.0-REQUIREMENTS.md](D:\project\GymCore-beta-test-0.2\.planning\milestones\v1.0-REQUIREMENTS.md)
- Milestone audit: [.planning/milestones/v1.0-MILESTONE-AUDIT.md](D:\project\GymCore-beta-test-0.2\.planning\milestones\v1.0-MILESTONE-AUDIT.md)

## Accepted Gaps
v1.0 was archived with explicit audit debt instead of a clean pass.

- Phases `01` through `05` have execution summaries but no phase-level `VERIFICATION.md` artifacts.
- Repo-wide backend verification is still blocked by stale `CheckinHealthService` constructor usage in older tests.
- The real multi-role `PT-08` replacement-coach acceptance flow is still skipped at E2E level.

## Next Milestone Goals
No next milestone is defined yet.

Use `$gsd-new-milestone` to establish the next set of requirements and roadmap phases.

Suggested starting points:
- Close the accepted v1.0 verification debt before adding more surface area.
- Decide whether the next milestone is hardening-focused or feature-focused.
- Refresh requirements from the shipped product instead of carrying v1.0 scope forward unchanged.

## Constraints
- Maintain the current multi-role architecture and seeded local environment.
- Keep business rules explicit and traceable to UI behavior.
- Prefer read-first support workflows over broad manual overrides.
- Avoid adding unrelated modules that dilute scope before current verification debt is understood.

## Key Decisions
- PT booking is instant when a slot is available; normal bookings do not require coach approval.
- Each active PT phase has one primary coach. Replacement coaches are allowed only as exceptions.
- Week-one PT slot selection becomes the recurring template for later weeks.
- PT self-service changes are allowed only before the 12-hour cutoff.
- Membership renew always starts after the current plan expires.
- Membership upgrade applies immediately, uses day-based prorated credit, allows membership coupons, resets full duration, and cancels any scheduled membership created under the old context.
- Paid but unpicked product orders can request recipient changes, but only reception can approve them.
- Product reviews unlock only after pickup is confirmed.
- Reception can search, view, and check in against valid rules but cannot override membership state.
- Only important promotion posts broadcast notifications.
- Sensitive admin actions require reason notes, and customer-facing account actions must send an explanation email.
- AI recommendations must use real user context: goals, health, and progress.

---
*Last updated: 2026-03-13 after v1.0 milestone archival*
