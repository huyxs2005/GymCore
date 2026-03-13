# Roadmap: GymCore Expansion

## Overview
This roadmap captures the next expansion milestone for GymCore. The plan strengthens commerce handoff, membership lifecycle logic, PT continuity, operational support tools, reminder discipline, progress visibility, and AI usefulness without diluting the existing product with unrelated modules.

## Phases
- [x] **Phase 1: Commerce Quick Wins** - safer pickup handoff, recipient change flow, reorder, and coupon wallet clarity
- [x] **Phase 2: Membership Lifecycle Core** - consistent purchase, renew, upgrade, and entitlement behavior
- [x] **Phase 3: PT Booking Core** - instant recurring PT booking with one primary coach
- [x] **Phase 4: Support and Ops Console** - safer admin and reception visibility with auditable actions
- [x] **Phase 5: PT Reschedule and Exceptions** - self-service PT changes and coach unavailability handling
- [x] **Phase 6: Reminder and Notification Discipline** - action-oriented reminders and controlled broadcast behavior
- [ ] **Phase 7: Customer Progress Hub** - unified progress, PT context, and note visibility
- [ ] **Phase 8: AI and Weekly Planning** - context-aware recommendations and mini weekly plans

### Phase 1: Commerce Quick Wins
**Goal**: Reduce paid-order handoff friction and increase conversion from existing shop traffic.

**Depends on**: Nothing (first phase)

**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04

**Success Criteria** (what must be TRUE):
1. Customers can request recipient changes on paid but unpicked orders.
2. Reception can resolve recipient-change requests from a single pending queue per order.
3. Customers can reorder directly from history.
4. Coupon wallet state is easier to understand and use.

**Plans**:
- [x] 01-01: Commerce handoff backend foundation
- [x] 01-02: Reorder and wallet-state foundation
- [x] 01-03: Customer and reception commerce UX integration

### Phase 2: Membership Lifecycle Core
**Goal**: Make membership purchase, renew, and upgrade behavior explicit and operationally safe.

**Depends on**: Nothing

**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06

**Success Criteria** (what must be TRUE):
1. Membership actions are resolved centrally with clear blocked reasons.
2. Renew always creates the next membership after expiry.
3. Upgrade applies immediately with day-based prorated credit.
4. Entitlements update immediately and scheduled old-context plans are cancelled on upgrade.

**Plans**:
- [x] 02-01: Membership lifecycle read model and action resolver
- [x] 02-02: Purchase and renew normalization
- [x] 02-03: Upgrade pricing and immediate entitlement rewrite
- [x] 02-04: Membership center UI integration and Phase 2 verification

### Phase 3: PT Booking Core
**Goal**: Replace PT request friction with instant recurring booking centered on one primary coach.

**Depends on**: Phase 2

**Requirements**: PT-01, PT-02, PT-03, PT-04

**Success Criteria** (what must be TRUE):
1. Eligible customers can book recurring PT instantly when slots are available.
2. One PT phase is tied to one primary coach.
3. Week-one selection becomes the recurring template for later weeks.
4. Customers can track PT schedule, notes, and progress from one dashboard.

**Plans**:
- [x] 03-01: PT booking backend foundation
- [x] 03-02: Recurring schedule generation and legacy-flow coexistence
- [x] 03-03: Customer PT dashboard and frontend integration

### Phase 4: Support and Ops Console
**Goal**: Give admin and reception the exact operational visibility they need without unsafe overrides.

**Depends on**: Phase 2

**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04

**Success Criteria** (what must be TRUE):
1. Admin has a support-first customer console.
2. Reception only sees operationally necessary information.
3. Sensitive actions require reason notes.
4. Customer-facing sensitive account actions send clear reason emails.

**Plans**:
- [x] 04-01: Support read-model backend foundation
- [x] 04-02: Sensitive-action governance and customer lock email
- [x] 04-03: Admin support console UI integration
- [x] 04-04: Reception operational UI and Phase 4 verification

### Phase 5: PT Reschedule and Exceptions
**Goal**: Make PT changes self-service where safe and exception-driven where manual control is needed.

**Depends on**: Phase 3

**Requirements**: PT-05, PT-06, PT-07, PT-08

**Success Criteria** (what must be TRUE):
1. Customers can reschedule valid future sessions before the cutoff.
2. Customers can update recurring PT from a future point onward.
3. Coaches can declare unavailable windows and inspect impacted sessions.
4. Replacement coach offers stay explicit and require customer acceptance.

**Plans**:
- [x] 05-01: Self-service PT reschedule backend foundation
- [x] 05-02: Future-series PT schedule change backend
- [x] 05-03: Coach unavailable blocks and exception backend
- [x] 05-04: Customer PT change and replacement acceptance UX
- [x] 05-05: Coach exception UX and Phase 5 verification

### Phase 6: Reminder and Notification Discipline
**Goal**: Turn notifications into an action layer and reduce noisy or ambiguous messaging.

**Depends on**: Phase 1, Phase 2

**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04

**Success Criteria** (what must be TRUE):
1. Users have a clear task and reminder center.
2. Membership expiry reminders run on the agreed 7/3/1 schedule.
3. Only important promotion posts broadcast notifications.
4. Read notifications remain accessible but less visually dominant.

**Plans**:
- [x] 06-01: Reminder-center backend foundation
- [x] 06-02: Reminder cadence and anti-spam scheduler discipline
- [x] 06-03: Important-only promotion broadcast discipline
- [x] 06-04: Reminder center UX and Phase 6 verification

### Phase 7: Customer Progress Hub
**Goal**: Give customers one place to understand progress, PT context, and recent coaching signal.

**Depends on**: Phase 3, Phase 5

**Requirements**: PROG-01

**Success Criteria** (what must be TRUE):
1. Customers can view unified progress and health history.
2. PT context and latest note signal are visible from the same hub.
3. The hub becomes the default destination for progress-oriented follow-up.

**Plans**:
- [x] 07-01: Progress-hub backend aggregation foundation
- [ ] 07-02: PT context and coaching-signal backend enrichment
- [ ] 07-03: Customer progress-hub UI integration
- [ ] 07-04: Phase 7 verification and route migration cleanup

### Phase 8: AI and Weekly Planning
**Goal**: Make AI recommendations context-aware, explainable, and directly useful for next actions.

**Depends on**: Phase 7

**Requirements**: AI-01, AI-02, AI-03

**Success Criteria** (what must be TRUE):
1. AI uses goals, health, and progress as real recommendation context.
2. Users can get a mini weekly plan instead of only generic content suggestions.
3. AI outputs link users back to real product actions such as PT booking or content detail.

**Plans**:
- [ ] 08-01: AI context-assembly backend foundation
- [ ] 08-02: Recommendation refinement and weekly-plan backend contracts
- [ ] 08-03: Customer knowledge and weekly-planner UX integration
- [ ] 08-04: Consultative chat context, action bridges, and Phase 8 verification

## Progress

| Phase | Plans Executed | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Commerce Quick Wins | 3/3 | Executed | 2026-03-13 |
| 2. Membership Lifecycle Core | 4/4 | Executed | 2026-03-13 |
| 3. PT Booking Core | 3/3 | Executed | 2026-03-13 |
| 4. Support and Ops Console | 4/4 | Executed | 2026-03-13 |
| 5. PT Reschedule and Exceptions | 5/5 | Executed | 2026-03-13 |
| 6. Reminder and Notification Discipline | 4/4 | Executed | 2026-03-13 |
| 7. Customer Progress Hub | 1/4 | In Progress | 2026-03-13 |
| 8. AI and Weekly Planning | 0/4 | Planned | - |
