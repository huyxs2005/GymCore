# GymCore Project Memory (Working Notes)

Purpose: quick context snapshot so future work can resume without re-discovering decisions.

## 0) Current repo baseline (Mar 26, 2026)
- Active working repo on this machine:
  - `C:\Users\Huy\Desktop\ky 7 fpt\SWP\GymCore`
- Current branch baseline:
  - `main`
- Local `main` was synced to `origin/main` on Mar 26, 2026.
- Runtime assumptions for this machine remain:
  - Java `25`
  - Microsoft SQL Server local datasource from `backend/src/main/resources/application.properties`
  - DB run order remains:
![1774509351395](image/PROJECT_MEMORY/1774509351395.png)![1774509353118](image/PROJECT_MEMORY/1774509353118.png)![1774509356198](image/PROJECT_MEMORY/1774509356198.png)![1774509356362](image/PROJECT_MEMORY/1774509356362.png)![1774509356526](image/PROJECT_MEMORY/1774509356526.png)![1774509356666](image/PROJECT_MEMORY/1774509356666.png)![1774509361118](image/PROJECT_MEMORY/1774509361118.png)![1774509373370](image/PROJECT_MEMORY/1774509373370.png)    1. `docs/GymCore.txt`
    2. `docs/alter.txt`
    3. `docs/InsertValues.txt`
    4. `docs/InsertTestingValues.txt` (optional)
- Env capability snapshot:
  - backend env supports Gemini, Google login, mail, and PayOS
  - frontend env supports Google login and API/base URL wiring
  - current local Gemini model used in docs/review:
    - `gemini-3-flash-preview`
  - safer stable fallback recommendation for this codebase:
    - `gemini-2.5-flash`

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
  - Promotions support `BonusDurationMonths` (for membership coupon discount + extra months at the same time).
  - Promotions now include explicit `ApplyTarget` in DB docs/migrations:
    - `ORDER` for product checkout coupons
    - `MEMBERSHIP` for membership checkout coupons
    - membership-target coupons may include discount-only, bonus-month-only, or discount + bonus months
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
  - Seeds promotion `SUMMERPLUS1M` (5% + 1 bonus month) example.
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
  - `backend/.env.example`      -> copy to `backend/.env`
  - `frontend/.env.local.example` -> copy to `frontend/.env.local`
- Team members must fill their own local values (JWT secret, Google client IDs, mail creds, etc.).

## 9) Content/AI implementation status
- Content APIs are no longer just placeholder scaffolding.
- The merged codebase now includes working admin/customer content surfaces for:
  - workouts/categories
  - foods/categories
  - goals
  - Gemini-backed assistant/chat wiring
- Remaining caution:
  - AI quality still depends on valid Gemini configuration and model compatibility
  - preview Gemini models may fall back or behave less predictably than stable models

## 10) Test status pattern
- Backend tests run with Maven wrapper.
- Frontend tests run with Vitest (`npm run test:run`).
- Recent state after major changes was green on both sides.

## 10.1) Latest verified validation snapshot (Mar 14, 2026)
- Backend:
  - `.\mvnw.cmd test` -> passed (`292` tests, `0` failures, `0` errors)
- Frontend:
  - `npm run lint` -> passed
  - `npm run test:run -- --maxWorkers=1` -> passed (`48` files, `194` tests)
  - `npm run build` -> passed
- Frontend coverage:
  - `npx vitest run --coverage --maxWorkers=1 --reporter=dot`
  - summary:
    - statements: `74.30%`
    - branches: `64.30%`
    - functions: `72.05%`
    - lines: `76.78%`
- Backend coverage:
  - JaCoCo is now wired into `backend/pom.xml`
  - `.\mvnw.cmd test` generates `backend/target/site/jacoco/index.html`
  - summary:
    - instructions: `54.36%`
    - branches: `42.99%`
    - methods: `58.90%`
    - lines: `55.76%`
- DB smoke verification:
  - canonical run order succeeded on a temporary throwaway database:
    1. `docs/GymCore.txt`
    2. `docs/alter.txt`
    3. `docs/InsertValues.txt`
    4. `docs/InsertTestingValues.txt`
  - temp smoke DB used:
    - `GymCoreMergeSmoke_20260314`
  - temp smoke DB was deleted after verification

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
  - Customer no longer manually picks a PT repeat end date in the planner.
  - PT matching/request window starts from the next eligible Monday and ends at the coverage end of the active coach-enabled membership.
  - Customer uses `Search Coaches` after saving the planner template.
  - Customer cannot start a new PT booking flow if:
    - a PT request is already `PENDING`, or
    - an approved/current PT arrangement still has future scheduled sessions.
  - This is blocked in both backend validation and frontend UI.
  - Results separated into:
    - `Fully Match` (all desired slots available).
    - `Partial Match` (some overlap, e.g. already booked in selected range).
  - When at least one fully matched coach exists, only the full-match list is shown.
  - Otherwise only the partial-match list is shown.
  - Partial matches are sorted from least conflicted slots to most conflicted slots.
  - Partial-match conflicts are rendered inline, highlighted in red, and the customer can remove conflicted slots directly from the review UI.
  - Customer can open coach profile details from the match card avatar/profile action.
  - Customer sends booking request; coach approves/denies later.
  - Customer can cancel session.
  - Customer reschedule is request-based (coach approves/denies).
  - Customer can submit coach feedback (rating + comment) for completed sessions.
  - Session cancellation is counterpart-notified:
    - customer cancel -> coach notification
    - coach cancel -> customer notification
- Coach flow:
  - Update weekly availability.
  - Toggle whether coach is still accepting new PT customers / appears in customer matching results.
  - That intake toggle uses a confirmation popup before changing state.
  - Review booking requests (`PENDING`) and approve/deny.
  - Deny requires reason.
  - Review reschedule requests and approve/deny.
  - Coach can cancel scheduled PT sessions from coach schedule page.
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

## 19) Reception/frontdesk + customer shell updates (Mar 27, 2026)
- Reception check-in page was simplified and re-laid out:
  - QR check-in is the full-width top panel.
  - Manual customer lookup and customer information panels sit below it.
  - Reception workspace hero/header was removed from this page.
- Reception manual lookup behavior:
  - panel title is `Manual check-in`
  - lookup is live while typing (no explicit search button)
  - input placeholder is `Enter customer's name or phone number`
  - empty-result copy is `Customer not found`
- Reception customer information panel copy now uses:
  - `Customer information`
  - waiting state text `Waiting for customer's information.`
- Reception QR scanner behavior was hardened:
  - open-camera action text is `Open QR camera`
  - idle camera text is `Camera offline`
  - scanner now tries full-frame QR decoding first, then a centered crop
  - jsQR now uses `attemptBoth` inversion handling
  - BarcodeDetector empty-result path now falls back to jsQR in the same scan loop
- Reception access log wording/styling:
  - columns are `Timestamp`, `Name`, `Membership plan`, `Employee`
  - membership plan badge is green
  - timestamp and employee text are white
  - extra `Verified customer` sublabel was removed
- Customer account menu ordering changed:
  - `Check in QR` now appears directly under `View profile`
  - `Notifications` moved near the bottom of the list
- Customer AI widget exposure is restricted:
  - CUSTOMER sees the AI widget
  - ADMIN / RECEPTIONIST / COACH do not
- Membership payment success return flow:
  - success overlay no longer gets stuck
  - outside-click and countdown close both redirect customer to `/customer/coach-booking`
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
  - Product flow remains online checkout + in-store pickup.
  - Product orders now also store recipient/shipping-contact snapshot fields for invoice and handoff purposes.
- `docs/alter.txt` now includes idempotent compatibility migration blocks for:
  - strict membership coach-booking constraint (`CK_MembershipPlans_CoachBookingByType`)
  - day-pass date enforcement trigger (`TRG_CustomerMemberships_ValidateDayPassDate`)
  - new-coach full-week availability seeding trigger (`TRG_Coaches_SeedDefaultAvailability`)
- DB rerun order remains unchanged:
  1. `docs/GymCore.txt`
  2. `docs/alter.txt`
  3. `docs/InsertValues.txt`
  4. `docs/InsertTestingValues.txt` (optional)

## 30) Admin backoffice completion (Mar 7, 2026)
- Admin dashboard at `/admin/dashboard` is now live, not a placeholder.
- Backend admin service now implements:
  - `get-dashboard-summary`
  - `get-revenue-overview`
- Admin dashboard was later narrowed into an operations page only.
  - Revenue analytics were removed from dashboard and moved fully into `/admin/reports`.
  - Dashboard now focuses on:
    - customers
    - staff accounts
    - locked staff
    - pending PT demand
    - awaiting pickup
    - live promotions
    - recent operational lists
- Admin reports at `/admin/reports` now own all revenue analytics.
  - Filter system is mutually exclusive, one active mode at a time:
    - `Quick range`
    - `Custom range`
  - Quick range owns preset windows such as:
    - `Today`
    - `7 days`
    - `30 days`
  - Reports page now uses one applied filter summary shared by:
    - KPI totals
    - main revenue chart
    - daily breakdown
    - export
  - Export format is Excel only (`.xlsx`) and always follows the exact applied filter.
- Admin users page at `/admin/users` is now a real staff-management surface.
- Staff management scope is explicit:
  - manage employee accounts only
  - supported roles: `ADMIN`, `COACH`, `RECEPTIONIST`
  - admin-created `CUSTOMER` accounts are forbidden in both UI and backend
- Admin users backend now supports:
  - staff list/search/filter
  - create staff
  - update staff
  - lock staff
  - unlock staff
- Coach staff creation/edit uses the existing `Coaches` profile model and preserves coach-specific fields.
- Admin self-protection rules are enforced:
  - cannot lock self
  - cannot deactivate self
  - cannot disable the last active admin
- Admin CRUD screens now follow a more consistent quality bar:
  - list/filter controls exist on the main admin management pages (`users`, `memberships`, `products`, `promotions`, `coach management`)
  - required admin-form inputs use explicit in-app validation/error messages instead of browser-native required-field popups

## 31) Latest verified test run (Mar 8, 2026)
- Backend: `.\mvnw.cmd test` -> passed (`245` tests, `0` failures, `0` errors).
- Frontend: `npm run test:run -- --maxWorkers=1` -> passed (`162` tests).
- Frontend lint: `npm run lint` -> passed.
- Frontend build: `npm run build` -> passed.
  - backend validation exceptions are surfaced back into those admin forms with concrete messages
- Additional release-readiness coverage added for:
  - backend content placeholder controller/service dispatch
  - backend PDF revenue report export path
  - frontend starter pages:
    - `CustomerKnowledgePage`
    - `ReceptionCustomersPage`
    - `AdminCoachInsightsPage`
  - frontend route guards for:
    - `/customer/knowledge`
    - `/reception/customers`

## 20) Latest verified test run (Mar 1, 2026)
- Backend: `.\mvnw.cmd test` -> passed (`124` tests, `0` failures, `0` errors).
- Frontend: `npm run test:run` -> passed (`18` files, `46` tests).
- Added regression coverage:
  - `frontend/src/components/frame/AppShell.test.jsx`
  - Verifies customer cart header button behavior:
    - shown on `/customer/shop`, click dispatches `gymcore:toggle-cart`
    - hidden outside shop routes.

## 20.1) Planned product shop upgrade (DB first, gym scope)
- Product redesign scope was narrowed intentionally.
- The app does not need Amazon/Shopee-level marketplace complexity.
- Planned schema direction is now:
  - keep `dbo.Products` as the sellable item
  - extend products with:
    - `ShortDescription`
    - `UsageInstructions`
    - `ThumbnailUrl`
  - add:
    - `dbo.ProductCategories`
    - `dbo.ProductCategoryMap`
    - `dbo.ProductImages`
- Product categories should stay practical for a gym supplement shop:
  - Protein
  - Creatine
  - Mass Gainer
  - Pre-workout
  - BCAA
  - Vitamins
- Planned UX direction:
  - customer shop should be image-first with simple category filters and rating summary
  - product detail should show gallery, description, usage instructions, and reviews
  - admin product management should focus on thumbnail/gallery, price, category, and active/archive controls
  - customer reviews should later be reachable from both product detail and order history
- Important rollout rule:
  - DB-first change was completed before backend/frontend implementation.

## 20.2) Product shop upgrade implemented (Mar 7, 2026)
- The simplified gym-shop catalog is now implemented against the upgraded product schema.
- Customer shop now supports:
  - image-first product cards
  - category filters
  - richer product detail with gallery + usage instructions
  - pickup-oriented buying history with order IDs
  - review entry from order history for purchased products
- Admin product management now supports:
  - left sidebar admin shell
  - richer create/edit form
  - category assignment
  - image gallery editing with one primary image
  - archive action instead of hard delete
- Backend product flow now supports:
  - richer admin product payloads
  - archive endpoint for admin products
- Customer order history is now exposed in the profile dropdown as `Order history`.

## 20.3) Latest verification snapshot (Mar 7, 2026)
- Frontend:
  - `npm run lint` -> passed
  - `npm run test:run -- --maxWorkers=1` -> passed (`32` files, `107` tests)
  - `npm run build` -> passed
- Backend:
  - focused regression passed for changed product classes:
    - `ProductSalesServiceCheckoutTest`
    - `OrderInvoiceServiceTest`
    - `ProductSalesServiceAdminCatalogTest`
    - `ProductSalesControllerTest`
- Full backend Maven suite could not be completed on this machine in this run because the JVM hit native memory allocation failure before the test phase.
  - DB docs/migrations/seeds must be updated first
  - backend/frontend coding should start only after that schema is rerun locally

## 25) PT duplicate-booking guard (Mar 2, 2026)
- `backend/src/main/java/com/gymcore/backend/modules/coach/service/CoachBookingService.java` now blocks:
  - `customer-match-coaches`
  - `customer-create-booking-request`
  when customer already has:
  - a `PENDING` PT request, or
  - an `APPROVED` PT arrangement whose end date is still current.
- `frontend/src/pages/customer/CustomerCoachBookingPage.jsx` now preloads PT schedule state and shows a blocking modal before:
  - `Open Schedule Planner`
  - `Search Coaches`
- The blocking modal routes customer into `My PT Schedule` so they review the current PT state instead of starting another request.
- Regression coverage added:
  - `frontend/src/pages/customer/CustomerCoachBookingPage.test.jsx`
  - `backend/src/test/java/com/gymcore/backend/modules/coach/service/CoachBookingServiceTest.java`

## 26) Latest verified test run (Mar 2, 2026)
- Backend: `.\mvnw.cmd test` -> passed (`144` tests, `0` failures, `0` errors).
- Frontend: `npm run test:run` -> passed (`24` files, `65` tests).
- Frontend lint: `npm run lint` -> passed.

## 27) Notification center and PT event alerts (Mar 2, 2026)
- Backend notification handling is centralized in:
  - `backend/src/main/java/com/gymcore/backend/common/service/UserNotificationService.java`
- Notification API is exposed through:
  - `GET /api/v1/notifications`
  - `PATCH /api/v1/notifications/{id}/read`
  - `PATCH /api/v1/notifications/{id}/unread`
  - `PATCH /api/v1/notifications/read-all`

## 28) Selective merge planning for `origin/feature/coupon` (Mar 7, 2026)
- Current branch remains source of truth for:
  - membership flow
  - PT booking flow
  - notifications
  - explicit coupon target model (`ApplyTarget`, `BonusDurationMonths`, `PromotionPosts`)
- Useful additive delta identified on `origin/feature/coupon`:
  - product order shipping snapshot fields on `Orders`
  - `OrderInvoices`
  - `OrderInvoiceItems`
  - backend/frontend admin invoice center
- Merge strategy is selective, not branch-wide:
  - ignore env/template file changes
  - ignore branch-side promotion simplification that would weaken current promotion-post flow
  - port invoice/shipping logic manually onto current code
- Additive DB script for this merge lives at:
  - folded into `docs/alter.txt`
- The selective merge has now been implemented on the main branch:
  - `Orders` stores recipient/shipping snapshot fields
  - successful paid product orders generate `OrderInvoices` and `OrderInvoiceItems`
  - invoice email sending is handled by backend after successful product payment confirmation
  - admin and receptionist can review invoices from dedicated invoice-center pages
  - product checkout remains pickup-only even though invoice/contact snapshot fields are stored
- Frontend notification UX now includes:
  - header bell dropdown with recent alerts
  - dedicated `/notifications` page
  - `Notifications` entry in account/profile dropdown
- Implemented notification triggers include:
  - membership payment success
  - product order payment success
  - coupon claimed successfully
  - new promotion post published to customers
  - PT request created
  - PT request approved / denied
  - PT session cancelled by customer or coach
  - PT reschedule request submitted
  - PT reschedule request approved / denied
- PT cancellation counterpart rules are now explicit in app behavior:
  - if a customer cancels a session, the assigned coach is notified
  - if a coach cancels a session, the customer is notified
- Frontend files added for notification UX:
  - `frontend/src/components/common/NotificationDropdown.jsx`
  - `frontend/src/pages/common/NotificationsPage.jsx`
  - `frontend/src/features/notification/api/notificationApi.js`

## 29) PT schedule UX refinement (Mar 2, 2026)
- `frontend/src/pages/coach/CoachSchedulePage.jsx`
  - Weekly availability is no longer the old wide table; it uses a Monday-Sunday selector with slot cards.
  - Booked sessions use a monthly calendar view similar to the customer PT page.
  - Calendar signal colors are status-aware:
    - scheduled/active dates stay green,
    - cancelled-only dates are red.
  - Selected booked-session date uses a separate blue ring so selection does not visually conflict with green/red status colors.
  - Selected availability summary is no longer an all-day chip wall; it uses a compact weekday drill-down with a themed custom dropdown.
  - Coaches can now toggle whether they accept new PT customers, and this toggle is confirmed via popup before it changes.
- `frontend/src/pages/customer/CustomerCoachBookingPage.jsx`
  - Top recurring-slot summary and planner modal summary were later simplified again into flatter inline groups instead of the earlier dropdown-heavy presentation.
  - The planner now focuses on recurring slots only; the manual end-date UI was removed.
  - The action button is `Search Coaches` instead of the old `Preview Matches`.
  - Customer cancel and reschedule actions both use in-app modals.
  - Customer can type cancellation reason and optional reschedule reason; coach can see those reasons in coach pages.
  - Customer can see coach cancellation reasons on cancelled PT sessions.
- Shared UI component retained:
  - `frontend/src/components/common/WeekdayDropdown.jsx`
  - still used by coach schedule availability summary flows.

## 35) Coach-booking UI and matching updates on `main` (Mar 26, 2026)
- Customer coach-booking page:
  - removed the old step chips:
    - `1. Plan`
    - `2. Preview`
    - `3. Request`
  - removed older helper cards such as:
    - `PT Dashboard`
    - `Booking guide / What happens next`
    - planner `Approval rule` / `Planner guide`
  - `Set Desired PT Schedule` remains as the main booking card heading without the old numeric prefix.
  - `Earliest possible start` helper text was removed from the visible card.
  - membership eligibility now shows a small status indicator beside the planner trigger:
    - `Checking coach plan`
    - `Coach plan active`
    - `Coach plan missing`
- Matching/review:
  - coach cards now include profile avatar/icon actions
  - coach profile modal shows richer detail
  - partial-match warnings show conflict reasons inline
  - conflict rows can be removed directly by the customer before proceeding
- Coach availability:
  - coach can hide from future customer matches while keeping existing sessions/requests intact
  - this is persisted without a DB schema change and filtered out during customer match generation

## 28) Latest verified test run (Mar 2, 2026)
- Backend: `.\mvnw.cmd test` -> passed (`146` tests, `0` failures, `0` errors).
- Frontend: `npm run test:run` -> passed (`27` files, `70` tests).
- Frontend lint: `npm run lint` -> passed.
- Frontend build: `npm run build` -> passed.

## 21) Customer check-in health UI update (Mar 1, 2026)
- `frontend/src/pages/customer/CustomerCheckinHealthPage.jsx` now includes a circular BMI meter (car-speedometer style):
  - segmented color ring:
    - low BMI = gray
    - optimal BMI = green
    - high BMI = red
  - needle rotates based on current BMI value
  - center shows BMI number and current level label.

## 22) Coach booking UX update (Mar 1, 2026)
- `frontend/src/pages/customer/CustomerCoachBookingPage.jsx`:
  - "Set Desired PT Schedule" is compacted into a button-first flow.
  - Clicking opens a planner modal with:
    - date range controls
    - month calendar
    - per-date slot picking panel
    - removable selected date-slot chips.
  - Coach match display remains split into:
    - `Fully Match`
    - `Partial Match`
  - Coach review modal uses transparent match indicators for readability:
    - matched rows: green tinted (`.../10`)
    - unmatched rows: red tinted (`.../10`)
  - Booking confirm is blocked until all unmatched slots are resolved.

## 23) Customer shop/cart UX update (Mar 1, 2026)
- `frontend/src/components/frame/AppShell.jsx`:
  - customer cart icon added to header and shown only on `/customer/shop`
  - positioned between notifications and profile menu
  - badge shows cart item count
  - supports pulse animation event (`gymcore:cart-pulse`).
- `frontend/src/pages/customer/CustomerShopPage.jsx`:
  - replaced side checkout panel with cart drawer flow.
  - add-to-cart "fly to cart" animation is implemented.
  - product cards/detail include quantity `+/-` controls.
  - two actions on products:
    - `Add` / `Add to cart`
    - `Buy now` (opens cart + checkout confirm immediately, no extra cart-icon click needed).
  - cart drawer includes:
    - items, quantity update/remove
    - subtotal and coupon preview area
    - checkout action and order history.

## 24) Shared footer refinement (Mar 1, 2026)
- `frontend/src/components/frame/AppShell.jsx` footer refreshed to a more professional layout:
  - 3-column structure (brand, contact, quick links)
  - gradient background and cleaner spacing/typography
  - concise operational info and pickup note in footer bottom row.

## 20.3) Product pickup + review management upgrade (Mar 7, 2026)
- Product invoice center now supports receptionist/admin pickup confirmation.
- A dedicated receptionist pickup page now exists at `/reception/pickup` for fast front-desk order handoff.
- Pickup state is tracked on `OrderInvoices` via:
  - `PickedUpAt`
  - `PickedUpByUserID`
- Customer order history is now a fuller purchase-history screen with:
  - search
  - pickup status
  - receipt email state
  - invoice code
  - payment timestamp
  - product deep links back to shop detail
- Customer product reviews now support full self-service lifecycle:
  - create
  - update
  - delete
- Review eligibility is now consistently pickup-based across backend flows.
  - Customer must have a picked-up invoice item for the product before review create/update is allowed.
- Review management is available from both:
  - product detail page
  - customer order history page
- Invoice operations are now more support-friendly:
  - admin/reception can resend product receipt emails from the invoice center
  - product payments now have an explicit product-owned webhook endpoint in addition to the return flow
- Admin product gallery entry no longer depends on raw image URLs in the UI.
  - Admin uploads image files and the backend stores them under `/uploads/products/...`.
- Admin catalog now includes:
  - status/category/review filters
  - archive/restore actions
  - gallery reorder/remove
  - conservative file cleanup for removed managed uploads

## 32) Shared customer shell + AI widget refinements (Mar 14, 2026)
- Customer/global header navigation order is now:
  1. `Check-in & Health`
  2. `Progress Hub`
  3. `Coach Booking`
  4. `Promotions`
  5. `Membership`
  6. `Product Shop`
  7. `Workout/Food/AI`
- Header layout was flattened:
  - desktop nav no longer uses the old card-like capsule treatment
  - header spacing was widened so nav/actions use more of the available row
- AI chat widget is now mounted from the shared shell instead of only one page.
  - It appears across authenticated workspace pages.
  - It is no longer limited to the customer knowledge page.
- AI chat intro and language behavior:
  - intro now shows two paragraphs:
    - English
    - Vietnamese
  - actual assistant replies should default to the user's language
  - Gemini prompt now explicitly requests plain-text responses with language consistency
  - frontend strips markdown artifacts like `**bold**` before rendering assistant text
- Gemini local-runtime hardening:
  - backend chat config now resolves Gemini settings from:
    - Spring-bound properties
    - OS env vars
    - local `.env` files
  - this was added so local chat still works when `.env` loading differs across startup flows

## 33) Public landing page direction (Mar 14, 2026)
- Landing page hero is now moving toward an image/video-led marketing layout rather than a grid of feature cards.
- Current hero decisions:
  - no hero CTA button for now
  - customer-facing marketing copy only; remove internal/editorial wording
  - background media slot is a looping local video placeholder:
    - `frontend/public/media/landing-hero.mp4`
  - video should remain:
    - muted
    - looped
    - inline
    - slightly blurred/darkened for text readability
- Hero support row under the main copy now uses three theme words:
  - `Train`
  - `Recover`
  - `Belong`
- Important UI preference captured from current iteration:
  - do not solve wrapping complaints by rewriting approved copy first
  - prefer layout/width adjustments before changing the sentence itself
- Contact strip under hero:
  - opening hours / hotline / address remain
  - old boxed card treatment was removed in favor of a flatter row

## 34) Public homepage polish pass (Mar 15, 2026)
- Public landing page was further refined into a more customer-facing marketing homepage.
- Hero:
  - local looping video remains the hero background
  - no hero CTA in the hero itself
  - support row remains `Train / Recover / Belong`
- Contact strip below hero:
  - hotline text is now plain text, not a clickable phone link
  - address is directly clickable to Google Maps
  - address text uses proper Vietnamese spelling:
    - `Khu đô thị FPT City, Ngũ Hành Sơn, Đà Nẵng 550000`
  - homepage address hover now uses an explicit green hover color instead of the amber `gym-*` token
- Header/footer hover behavior:
  - header nav hover now uses explicit green, not the amber `gym-*` token
  - footer clickable links also use the same hover treatment
  - note: `frontend/src/index.css` overrides `text-gym-*` toward amber, so true green hover states must use explicit emerald overrides
- `Why GymCore` section:
  - copy was rewritten for customers instead of internal/admin wording
  - right-side placeholders were replaced with real local images
  - collage layout now uses:
    - gym room
    - QR check-in
    - coach discussion
- `Membership` section:
  - merged old member-journey content into the membership area
  - comparison now shows what each membership includes/excludes with green checks and red X marks
  - one shared `Buy now` button sits under the left membership pricing block
  - `Gym + Coach membership required for PT booking` is plain yellow text, not a chip/card
- `Supplement Products` section:
  - placeholder was replaced with the local `creatin.jpg` asset
  - section includes one shared `Buy now` button plus plain yellow `Pickup at gym only` text
- FAQ:
  - old `Before You Visit` rows were replaced with a customer-facing FAQ accordion
  - no item is open by default
- Image styling decisions for the public landing page:
  - landing-page images now use sharp rectangular corners
  - `creatin.jpg` is no longer forced into a cropped/letterboxed box
  - membership consultation and product images now use the same subtle hover treatment as the other landing images
- CSS cleanup preference:
  - repeated landing/homepage styles should gradually move from large JSX class strings into shared classes in `frontend/src/index.css`
