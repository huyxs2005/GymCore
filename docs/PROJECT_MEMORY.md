# GymCore Project Memory (Working Notes)

Purpose: quick context snapshot so future work can resume without re-discovering decisions.

## 1) Tech stack and structure
- Backend: Spring Boot REST API (no Thymeleaf server-rendered pages).
- Frontend: React + Vite.
- Project folders: `backend/`, `frontend/`, `docs/`.

## 2) Auth + session decisions
- Login methods:
  - Email/password.
  - Google login for CUSTOMER / COACH / RECEPTIONIST.
  - ADMIN login is email/password only.
- Passwords are stored hashed (bcrypt) in DB.
- JWT approach:
  - Short-lived access token.
  - Longer-lived refresh token in HttpOnly cookie.
- OTP policy:
  - OTP expiry: 2 minutes.
  - Resend cooldown: 5 seconds.
  - Resend invalidates previous OTP.

## 3) Profile / account UI decisions
- Header account menu shows logged-in user identity.
- Profile page supports:
  - View/edit full name and phone.
  - Avatar upload + crop flow.
  - Change password.
- DOB/Gender visibility:
  - Visible/editable for CUSTOMER and COACH only.
  - Hidden for ADMIN and RECEPTIONIST.
- QR code:
  - Only CUSTOMER sees QR menu item/dialog (for check-in flow).

## 4) Forgot password flow
- Updated to 2-step UX:
  1. Request OTP + verify OTP on `/auth/forgot-password`.
  2. Redirect to `/auth/forgot-password/reset` after successful OTP verification.
- New password fields are only on reset page, not before OTP verification.

## 5) Email sending
- Auth mail service upgraded to multipart email (plain + HTML) with professional templates.
- HTML content is inline-styled (normal for email clients).
- Secrets (mail account/password) are env-based, not hardcoded in source.

## 6) Database status (docs)
- `docs/GymCore.txt` updated with:
  - Existing full gym schema.
  - VN phone normalization uniqueness on `Users.Phone` via computed `PhoneNormalized` + unique filtered index.
  - Added phone integrity checks: non-blank and must contain digits when `Phone` is provided.
  - Added required SQL `SET` options at schema start so computed/filtered indexes create cleanly in fresh DB runs.
  - Membership queue model:
    - `CustomerMemberships.Status` includes `SCHEDULED`.
    - Unique filtered indexes enforce max one `ACTIVE` and one `SCHEDULED` per customer.
    - Daily job `sp_RunDailyMembershipJobs` activates due `SCHEDULED` memberships.
  - Promotions support `BonusDurationDays` (for coupon discount + extra days at the same time).
  - Membership plan strictness:
    - Only `GYM_PLUS_COACH` can have `AllowsCoachBooking = 1`.
    - `GYM_ONLY` and `DAY_PASS` must have `AllowsCoachBooking = 0`.
  - Day pass membership validity enforcement:
    - `DAY_PASS` memberships must satisfy `StartDate = EndDate`.
  - Coach/PT booking tables include:
    - `TimeSlots` (8 fixed slots/day)
    - `CoachWeeklyAvailability` with `IsAvailable`
    - `PTRecurringRequests` with `DenyReason`
    - `PTRequestSlots`, `PTSessions`, `PTSessionNotes`
  - PT booking rule is strict:
    - `PTRecurringRequests.CustomerMembershipID` is `NOT NULL`
    - customer must have active Gym+Coach membership for booking flow.
  - New coach availability defaulting:
    - New rows in `Coaches` auto-seed `CoachWeeklyAvailability` for all 7 days x 8 slots.
  - Check-in/PT integrity is trigger-enforced (active membership checks, coach-booking eligibility, date coverage).

## 7) Seed data status
- `docs/InsertValues.txt` = required baseline seed (roles/users/profiles/time slots/plans/goals), idempotent.
- `docs/InsertTestingValues.txt` = optional example/testing seed (cart/orders/promotions/PT/check-in and more), idempotent.
  - Seeds multiple membership durations (day pass / 1m / 6m / 12m / 24m for gym-only and gym+coach).
  - Seeds one queued `SCHEDULED` membership sample for membership-switch testing.
  - Seeds promotion `SUMMERPLUS30` (5% + 30 bonus days) example.
  - Seeds coach weekly availability rows for testing flow.
  - Seeded plan/product demo prices were reduced to low values for easier local testing (1k/2k/3k scale and incremental tiers).
- Seeded login passwords:
  - Admin: `Admin123456!`
  - Receptionist: `Reception123456!`
  - Coach: `Coach123456!`
  - Customer: `Customer123456!`

## 7.1) Official DB run order (current)
1. `docs/GymCore.txt`
2. `docs/alter.txt`
3. `docs/InsertValues.txt`
4. `docs/InsertTestingValues.txt` (optional)

## 8) Env file convention for teammates
- Real local env files are gitignored.
- Templates committed:
  - `backend/.env.example`  -> copy to `backend/.env`
  - `frontend/.env.example` -> copy to `frontend/.env.local`
- Team members must fill their own local values (JWT secret, Google client IDs, mail creds, etc.).

## 9) Content/AI API scaffolding
- `ContentController` includes placeholder endpoints for:
  - workouts/categories
  - foods/categories
  - goals
  - AI recommendations
- Current implementation is barebones placeholder responses; business logic still to implement.

## 10) Test status pattern
- Backend tests run with Maven wrapper.
- Frontend tests run with Vitest (`npm run test:run`).
- Recent state after major changes was green on both sides.

## 10.1) Latest verified test run (Feb 27, 2026)
- Backend: `.\mvnw.cmd test` -> passed (`110` tests).
- Frontend: `npm run test -- --run` -> passed (`14` files, `38` tests).

## 11) Working principle reminders
- Keep secrets out of git.
- Use env templates for onboarding.
- Keep SQL seed scripts idempotent.
- Prefer structured mapping tables over free-text parsing for filtering.

## 12) Check-in UX decisions (finalized Feb 17, 2026)
- Reception check-in supports two flows:
  - QR camera scan.
  - Manual search+select by partial `phone` or `fullName`.
- QR scan flow is one-shot:
  - First successful detect/check-in stops camera.
  - Success/failure popup is shown.
  - Receptionist uses explicit action to scan next customer.
- Membership validation errors are shown directly in check-in result (no silent fail).
- Reception check-in timestamps are shown in VN-friendly format `dd/mm/yy HH:mm`.

## 13) Authz routing decisions (finalized Feb 17, 2026)
- Frontend route guards enforce both:
  - Authenticated session.
  - Correct role for route namespace.
- Unauthorized route access behavior:
  - Redirect to `/` (default page).
  - No 403 page shown to end users.

## 14) Shared layout decisions (finalized Feb 17, 2026)
- App uses shared global shell (header + footer) across pages.
- Removed duplicate page-level header/footer where applicable.
- Removed `Workspace` button/link from global header/footer.
- Footer layout fixed with flex-column shell so it stays visually consistent at page bottom.

## 15) Customer QR exposure decisions
- QR entry in account menu is CUSTOMER-only.
- Customer QR dialog:
  - Centered via portal/modal rendering.
  - No token copy button.
- Reception screen:
  - No manual token paste fallback input.

## 16) Coach booking/training support (current implementation)
- Customer flow:
  - Must set desired recurring weekly day+slot first.
  - Then preview coach matching by date range and desired slots.
  - Results separated into:
    - `Fully Match` (all desired slots available).
    - `Partial Match` (some overlap, e.g. already booked in selected range).
  - Customer sends booking request; coach approves/denies later.
  - Customer can cancel session.
  - Customer reschedule is request-based (coach approves/denies).
  - Customer can submit coach feedback (rating + comment) for completed sessions.
- Coach flow:
  - Update weekly availability.
  - Review booking requests (`PENDING`) and approve/deny.
  - Deny requires reason.
  - Review reschedule requests and approve/deny.
  - View own schedule, customer list/profile/history, update progress, notes, and feedback.
- Admin flow:
  - View coaches, coach students, and coach/customer feedback views through coach-management endpoints.

## 17) Layout/UI architecture memory
- App now uses one shared global shell header/footer; duplicate page headers were removed.
- `WorkspaceScaffold` is content wrapper only (no duplicate top nav/user bar).

## 18) README onboarding updates (Feb 28, 2026)
- Root `README.md` now documents the exact DB execution order for local setup:
  1. `docs/GymCore.txt`
  2. `docs/alter.txt`
  3. `docs/InsertValues.txt`
  4. `docs/InsertTestingValues.txt` (optional)
- Root `README.md` now explicitly tells teammates where to change SQL Server auth:
  - `backend/src/main/resources/application.properties`
  - `spring.datasource.username`
  - `spring.datasource.password`
  - `spring.datasource.url`
- `frontend/README.md` was replaced with project-specific notes:
  - points to `../README.md` for full setup
  - references backend datasource config location for SQL credentials.

## 19) Membership/Payment policy alignment (Mar 1, 2026)
- `docs/Usecase functions.txt` and DB docs are aligned on payment channels:
  - Membership checkout channel is PayOS redirect.
  - System payment methods tracked for audit are `PAYOS` and `CASH`.
  - Product flow remains online checkout + in-store pickup, with no shipping.
- `docs/alter.txt` now includes idempotent compatibility migration blocks for:
  - strict membership coach-booking constraint (`CK_MembershipPlans_CoachBookingByType`)
  - day-pass date enforcement trigger (`TRG_CustomerMemberships_ValidateDayPassDate`)
  - new-coach full-week availability seeding trigger (`TRG_Coaches_SeedDefaultAvailability`)
- DB rerun order remains unchanged:
  1. `docs/GymCore.txt`
  2. `docs/alter.txt`
  3. `docs/InsertValues.txt`
  4. `docs/InsertTestingValues.txt` (optional)
