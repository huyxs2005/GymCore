# Requirements

## Scope
This milestone expands GymCore through focused improvements to commerce, membership lifecycle, PT continuity, support operations, reminders, progress visibility, and AI guidance.

## In Scope Requirements

### Commerce
- `COMM-01` Customer can submit a recipient-change request for an order that is paid but not yet picked up.
- `COMM-02` Reception can review and accept the single pending recipient-change request attached to an order.
- `COMM-03` Customer can buy again from order history with a low-friction reorder path.
- `COMM-04` Coupon wallet clearly differentiates claimed, used, expired, eligible-now, and manually entered coupon states.

### Membership
- `MEM-01` System returns the valid membership actions for the current user state, including blocked reasons.
- `MEM-02` Renew always creates the next membership after the current plan expires.
- `MEM-03` Upgrade applies immediately and computes credit from remaining days on the current plan.
- `MEM-04` Membership coupons can be applied during upgrade checkout.
- `MEM-05` Any scheduled membership tied to the old context is cancelled when upgrade succeeds.
- `MEM-06` PT entitlement from the upgraded plan becomes available immediately after successful upgrade.

### PT Core
- `PT-01` Customer can instantly book recurring PT when eligible and the selected slots are available.
- `PT-02` One active PT phase has one primary coach.
- `PT-03` Week-one PT slot selection becomes a recurring template for later weeks.
- `PT-04` Customer can view a PT dashboard with weekly schedule, next session, latest note, and latest progress.

### PT Exceptions
- `PT-05` Customer can reschedule one future PT session before the 12-hour cutoff.
- `PT-06` Customer can change a recurring PT schedule from a chosen future point onward.
- `PT-07` Coach can mark unavailable periods and review impacted sessions.
- `PT-08` Replacement coach can be offered only as an exception and requires customer acceptance.

### Operations and Support
- `OPS-01` Admin can use a support-first console that summarizes customer lifecycle state across membership, PT, orders, and account status.
- `OPS-02` Reception only sees the operational customer information needed for check-in, membership lookup, and pickup handling.
- `OPS-03` Sensitive admin actions require internal reason notes.
- `OPS-04` Sensitive customer account actions, including account lock, send a reason email to the customer.

### Notifications and Growth
- `NOTF-01` Users have an action-oriented task and reminder center.
- `NOTF-02` Membership expiry reminders send at 7, 3, and 1 days before expiry.
- `NOTF-03` Only promotion posts marked important broadcast notifications to customers.
- `NOTF-04` Read notifications remain visible in history but are visually de-emphasized.

### Progress and AI
- `PROG-01` Customer can view unified progress, PT context, latest notes, and health history in one hub.
- `AI-01` AI recommendations use goals, health, and progress as input.
- `AI-02` AI can produce a mini weekly plan.
- `AI-03` AI guides users toward real actions such as viewing content detail or starting PT booking.

## Out of Scope
- Group class booking
- Loyalty points or wallet cash-back systems
- Attendance streaks or broader gamification
- Waitlist management
- Nutrition subscription plans
- Multi-branch or multi-location support
- Refund and dispute center
- Social or community features

## Traceability

| Phase | Name | Covered Requirements |
|-------|------|----------------------|
| 1 | Commerce Quick Wins | COMM-01, COMM-02, COMM-03, COMM-04 |
| 2 | Membership Lifecycle Core | MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06 |
| 3 | PT Booking Core | PT-01, PT-02, PT-03, PT-04 |
| 4 | Support and Ops Console | OPS-01, OPS-02, OPS-03, OPS-04 |
| 5 | PT Reschedule and Exceptions | PT-05, PT-06, PT-07, PT-08 |
| 6 | Reminder and Notification Discipline | NOTF-01, NOTF-02, NOTF-03, NOTF-04 |
| 7 | Customer Progress Hub | PROG-01 |
| 8 | AI and Weekly Planning | AI-01, AI-02, AI-03 |

## Notes
- Commerce and notification work should reuse the current wallet, order, pickup, and notification infrastructure where possible.
- PT work should preserve historical PT data while migrating new bookings to the improved model.
- Membership lifecycle rules are explicitly driven by the business decisions already locked during product discussions.
- Execution status: `AI-01` is covered by Phase 8 Plan `08-01`; `AI-02` is now fully covered through Plans `08-02` and `08-03` with the backend-owned weekly-plan contract plus customer knowledge-page rendering; `AI-03` is now covered through Plan `08-03` via inline workout/food detail actions and coach-booking/progress-hub routing from AI outputs, while Plan `08-04` remains for consultative chat expansion and Phase 8 verification.
