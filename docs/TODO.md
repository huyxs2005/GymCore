# GymCore TODO (Post feature/coupon merge)

## Main Branch Merge Prep: `origin/main` -> current local branch
- [ ] Use the current local branch as source of truth for the next merge session.
  - Current local baseline branch: `alpha-0.1`
  - Do not run a blind `git merge origin/main`.
  - Preferred method: selective/manual port by subsystem.
- [ ] Keep Java on `25`.
  - Do not accept the `origin/main` downgrade back to Java `21`.
  - Preserve the local `backend/pom.xml` toolchain/runtime settings.
- [ ] Keep the current local JDBC/runtime config for this machine.
  - Preserve local `backend/src/main/resources/application.properties` datasource values.
  - Do not replace local SQL Server credentials with `origin/main` credentials or env defaults.
  - Local machine remains:
    - SQL Server auth on this machine
    - database `GymCore`
    - current working local login/password/settings
- [ ] Keep environment templates machine-neutral while preserving local runtime behavior.
  - Merge `backend/.env.example` and `frontend/.env.example` as templates/documentation only.
  - Do not commit real local secrets.
  - Keep Gemini placeholders available in backend env files:
    - `APP_AI_GEMINI_API_KEY=`
    - `APP_AI_GEMINI_MODEL=`
- [ ] Merge DB changes from `origin/main` only into the 4 canonical SQL docs.
  - Allowed targets only:
    - `docs/GymCore.txt`
    - `docs/alter.txt`
    - `docs/InsertValues.txt`
    - `docs/InsertTestingValues.txt`
  - Do not create extra SQL docs/files for the merge.
- [ ] Treat current local DB docs as stronger than `origin/main` where `main` removes already-working behavior.
  - Current local branch includes invoice pickup columns and related product/invoice flow support.
  - Current local branch keeps stricter membership/payment/reporting behavior that should not be downgraded.
- [ ] Review `origin/main` only for additive value.
  - Import only missing features/fixes that do not break:
    - PayOS flow
    - admin dashboard/reports
    - invoice/pickup flow
    - membership queue/renew/upgrade behavior
    - current local test suite
- [ ] Re-run the full regression gate after the merge.
  - Backend:
    - `.\mvnw.cmd test`
  - Frontend:
    - `npm run lint`
    - `npm run test:run -- --maxWorkers=1`
    - `npm run build`
  - DB smoke:
    - `docs/GymCore.txt`
    - `docs/alter.txt`
    - `docs/InsertValues.txt`
    - `docs/InsertTestingValues.txt`

## Selective Merge Plan: `origin/feature/coupon` -> `beta-test-0.2`
- [x] Keep `beta-test-0.2` as source of truth during merge.
  - Do not overwrite newer membership, PT, notification, auth, or coupon-target logic that already exists on this branch.
- [x] Ignore environment/bootstrap files from `origin/feature/coupon`.
  - Do not merge:
    - `backend/.env.example`
    - `frontend/.env.example`
    - any local env values
  - Keep current local/mainline configuration and startup flow.
- [x] Merge only additive product invoice + shipping support from `origin/feature/coupon`.
  - Backend candidates:
    - `backend/src/main/java/com/gymcore/backend/modules/product/controller/ProductSalesController.java`
    - `backend/src/main/java/com/gymcore/backend/modules/product/service/ProductSalesService.java`
    - `backend/src/main/java/com/gymcore/backend/modules/product/service/OrderInvoiceMailService.java`
    - `backend/src/main/java/com/gymcore/backend/modules/product/service/OrderInvoiceService.java`
  - Frontend candidates:
    - `frontend/src/features/product/api/adminInvoiceApi.js`
    - `frontend/src/pages/admin/AdminInvoicesPage.jsx`
    - route/nav wiring for the invoice page
- [x] Apply additive DB migration for the invoice feature before wiring code.
  - Run:
    - `docs/alter.txt`
  - Scope:
    - `Orders` shipping columns
    - `OrderInvoices`
    - `OrderInvoiceItems`
    - backfill invoice snapshots for already-paid product orders
- [x] Do not merge the promotion/coupon simplification from `origin/feature/coupon`.
  - Skip branch versions of:
    - `backend/src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java`
    - `backend/src/main/java/com/gymcore/backend/modules/promotion/controller/PromotionController.java`
    - `frontend/src/pages/admin/AdminPromotionsPage.jsx`
    - `frontend/src/pages/customer/CustomerPromotionsPage.jsx`
  - Reason:
    - current branch already has the stronger `PromotionPosts` + `ApplyTarget` + `BonusDurationMonths` model
    - branch version would downgrade the current implementation
- [x] Do not import weaker DB changes from `origin/feature/coupon`.
  - Do not make `UserPromotionClaims.SourcePostID` nullable.
  - Do not replace current payment-success logic with the older branch procedure.
  - Do not replace current seed/docs files wholesale.
- [x] Review branch-only utility/UI changes separately and merge only if they still add value after comparison.
  - Candidates to review manually:
    - `frontend/src/components/common/QrCodeDialog.jsx`
    - `frontend/src/pages/reception/ReceptionCheckinPage.jsx`
    - `backend/src/test/java/com/gymcore/backend/modules/checkin/service/CheckinHealthServiceTest.java`
    - `backend/src/test/java/com/gymcore/backend/modules/users/service/UserManagementServiceTest.java`
- [x] Preferred merge method: file-by-file/manual port, not branch merge.
  - Cherry-pick only if commit scope is narrow and additive.
  - Otherwise copy the specific logic into current files so current behavior stays intact.
- [x] Regression gate after the selective merge.
  - Backend:
    - `.\mvnw.cmd test`
  - Frontend:
    - `npm run lint`
    - `npm run test:run`
    - `npm run build`
  - DB smoke:
    - rerun `docs/GymCore.txt`
    - rerun `docs/alter.txt`
    - rerun `docs/InsertValues.txt`
    - rerun `docs/InsertTestingValues.txt`

## High Priority
- [x] Fix coupon lifecycle: coupon is marked used before payment succeeds; add proper transaction/compensation around external PayOS call.
  - `backend/src/main/java/com/gymcore/backend/modules/product/service/ProductSalesService.java`
- [x] Implement broken `POST /v1/promotions/apply` path with real preview behavior.
  - `backend/src/main/java/com/gymcore/backend/modules/promotion/controller/PromotionController.java`
  - `backend/src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java`
- [x] Ensure payment success always sets PayOS status to success (not left as `PENDING`).
  - `docs/alter.txt`

## Medium Priority
- [x] Complete bonus-duration coupon flow across backend, admin UI, and checkout compatibility.
  - `backend/src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java`
  - `frontend/src/pages/admin/AdminPromotionsPage.jsx`
  - `frontend/src/pages/customer/CustomerShopPage.jsx`
- [x] Block duplicate PT booking attempts when customer already has a pending PT request or an active PT arrangement.
  - `backend/src/main/java/com/gymcore/backend/modules/coach/service/CoachBookingService.java`
  - `frontend/src/pages/customer/CustomerCoachBookingPage.jsx`
- [x] Add notification center and PT/event alerts.
  - header bell dropdown with recent alerts
  - dedicated notifications page
  - profile dropdown entry
  - payment success / promotion / coupon / PT workflow notifications
  - PT cancellation counterpart notifications
- [x] Fix frontend tests after shared header changes (missing QueryClient context).
  - `frontend/src/routes/AppRouter.test.jsx`
  - `frontend/src/pages/reception/ReceptionCheckinPage.test.jsx`
- [x] Keep DB setup/run-order docs and code dependencies aligned for `alter.txt`.
  - `docs/InsertTestingValues.txt`

## Low Priority
- [x] Reduce sensitive/verbose PayOS request logging.
  - `backend/src/main/java/com/gymcore/backend/modules/product/service/PayOsService.java`
- [x] Handle PDF export failures correctly (no silent empty/invalid file with HTTP 200).
  - `backend/src/main/java/com/gymcore/backend/modules/admin/service/ReportService.java`
- [x] Clean merge artifact/junk code in admin service.
  - `backend/src/main/java/com/gymcore/backend/modules/admin/service/AdminService.java`
- [x] Remove dead duplicate page file (not routed).
  - `frontend/src/pages/customer/PromotionsPage.jsx`

## Product Shop Upgrade (Gym Scope, DB First)
- [x] Narrow product scope from marketplace-style catalog to a gym supplement shop.
  - Do not add marketplace-only complexity such as brands, seller features, or large attribute matrices.
  - Keep the product flow focused on:
    - supplement categories
    - product pictures
    - richer product detail
    - simple admin CRUD
    - customer order history + reviews

- [x] Update DB docs first for the gym-shop product model.
  - Updated:
    - `docs/GymCore.txt`
    - `docs/alter.txt`
    - `docs/InsertValues.txt`
    - `docs/InsertTestingValues.txt`
  - New schema support is limited to:
    - `dbo.ProductCategories`
    - `dbo.ProductCategoryMap`
    - `dbo.ProductImages`
    - richer `dbo.Products` content fields

- [x] Rerun DB scripts locally before any backend/frontend coding.
  - Run in order:
    - `docs/GymCore.txt`
    - `docs/alter.txt`
    - `docs/InsertValues.txt`
    - `docs/InsertTestingValues.txt`

- [x] Backend/API work after DB rerun.
  - Extend admin product APIs to support:
    - create
    - update
    - archive/unarchive
    - category assignment
    - image gallery CRUD
  - Extend customer product APIs to support:
    - category filtering
    - richer product detail payload
    - review-ready order-history responses

- [x] Frontend admin UX after DB rerun.
  - Replace the current minimal product manager with:
    - thumbnail-first product list
    - create/edit form for:
      - name
      - short description
      - full description
      - usage instructions
      - category
      - price
      - active/inactive
      - primary image + extra gallery images
  - Delete behavior should remain archive/soft-hide, not hard delete.

- [x] Frontend admin shell cleanup after product/admin CRUD expansion.
  - Replace the growing top-button admin navigation with a left sidebar.
  - Reason:
    - admin now has enough CRUD screens that header-style button groups will become cluttered
    - a sidebar will scale better for products, memberships, promotions, invoices, users, reports, and coach/customer management
  - Sidebar should later support:
    - clear section grouping
    - active-page highlight
    - responsive collapse on smaller screens
    - consistent admin-only layout across all admin pages
  - Implement after the product/admin CRUD round so the final nav structure is stable.

- [x] Frontend customer UX after DB rerun.
  - Customer shop should show:
    - product cards with image, name, short description, price, rating summary
    - practical category filters:
      - Protein
      - Creatine
      - Mass Gainer
      - Pre-workout
      - BCAA
      - Vitamins
    - detail page with:
      - image gallery
      - description
      - usage instructions
      - reviews
  - Profile dropdown should later expose:
    - `Order history`
    so customers can see order IDs and leave/view reviews for purchased items.

- [x] Test plan after DB + code work.
  - Backend:
    - category/image validation
    - only one primary image per product
  - Frontend:
    - admin product editor flow
    - customer product cards + detail page
    - category filtering
    - order-history review entry points

## Explicit Feature Task
- [x] Implement `/promotions/apply` as a pre-check preview endpoint (no order/payment creation), including:
  - coupon validity preview
  - discount preview
  - membership bonus-month preview
  - response contract for frontend apply-coupon UI

## Membership C-Section Merge (origin/membership -> beta-test-0.2)
- [x] Merge only C-scope membership files from `origin/membership` (keep `beta-test-0.2` as base):
  - `backend/src/main/java/com/gymcore/backend/modules/membership/controller/MembershipController.java`
  - `backend/src/main/java/com/gymcore/backend/modules/membership/service/MembershipService.java`
  - `backend/src/test/java/com/gymcore/backend/modules/membership/service/MembershipServiceCustomerFlowTest.java`
  - `frontend/src/features/membership/api/membershipApi.js`
  - `frontend/src/pages/customer/CustomerMembershipPage.jsx`
- [x] Do not merge unrelated/non-C changes (ignore env files and non-membership regressions).
- [x] Keep DB docs system as 4 files only:
  - `docs/GymCore.txt`
  - `docs/alter.txt`
  - `docs/InsertValues.txt`
  - `docs/InsertTestingValues.txt`
- [x] Ensure C business rules are fully enforced:
  - one ACTIVE membership
  - renew from EndDate
  - upgrade immediate switch
  - day pass start=end
  - payment method audit on payment/order records
  - queued membership safety on payment success
- [x] Implement missing Admin membership plan actions (create/update) so C is fully complete.
- [x] Run full regression checks after merge:
  - backend `.\mvnw.cmd test`
  - frontend `npm run test -- --run`
  - automated service smoke coverage: membership purchase/renew/upgrade + PayOS return handling

## Coupon Redesign (Completed)
- [x] Redefine coupon behavior before further schema/app work.
  - Coupon must target exactly one checkout domain: `ORDER` or `MEMBERSHIP`.
  - Product coupon supports discount only.
  - Membership coupon supports:
    - discount only
    - extra membership months only
    - discount + extra membership months together
  - Customer must not be able to stack multiple coupons in one checkout.
  - One checkout can reference at most one claim / one promotion.

- [x] Update DB design to match the new coupon plan.
  - Replace day-based bonus logic with month-based membership extension.
  - Keep explicit `ApplyTarget` on promotions.
  - Add DB constraints so:
    - order-target coupons cannot carry membership bonus months
    - membership-target coupons may carry discount, bonus months, or both
    - coupon still must provide at least one benefit
    - one payment/order/membership checkout cannot store more than one coupon claim

- [x] Update backend coupon logic after the DB redesign.
  - Read persisted coupon target from DB instead of inferring from bonus fields.
  - Product checkout must only accept `ORDER` coupons.
  - Membership checkout must only accept `MEMBERSHIP` coupons.
  - Membership checkout must apply bonus months, not bonus days.
  - Keep claim usage one-time and non-stackable across all checkout flows.

- [x] Update frontend admin/customer flows after the DB redesign.
  - Admin coupon CRUD must expose explicit coupon target.
  - Admin UI must support membership coupon combinations:
    - discount only
    - extra months only
    - discount + extra months
  - Customer product checkout must show only valid product coupons.
  - Customer membership checkout must show only valid membership coupons.
  - Checkout UI must allow selecting only one coupon at a time.

- [x] Add regression coverage for the redesigned coupon rules.
  - Backend tests for product discount coupons.
  - Backend tests for membership discount-only coupons.
  - Backend tests for membership extra-month-only coupons.
  - Backend tests for membership discount + extra-month coupons.
  - Backend tests that stacked coupons are rejected.
  - Frontend tests for single-coupon checkout behavior in both shop and membership pages.

## Coupon Redesign Implementation Queue (Completed)
- [x] Backend: migrate `PromotionService` from bonus days to `ApplyTarget` + `BonusDurationMonths`.
  - `backend/src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java`
  - Update admin create/update coupon SQL to write:
    - `ApplyTarget`
    - `BonusDurationMonths`
  - Update customer post / wallet / apply-coupon queries to read:
    - `ApplyTarget`
    - `BonusDurationMonths`
  - Stop inferring coupon type from bonus fields.
  - Validate:
    - only one discount type (`DiscountPercent` or `DiscountAmount`)
    - at least one benefit exists
    - `ORDER` coupon cannot have bonus months
    - `MEMBERSHIP` coupon may have discount only, months only, or both

- [x] Backend: update product checkout to honor explicit coupon target.
  - `backend/src/main/java/com/gymcore/backend/modules/product/service/ProductSalesService.java`
  - Replace old bonus-day membership-only rejection with `ApplyTarget != 'ORDER'`.
  - Keep product checkout non-stackable: accept only one `promoCode`.
  - Keep order/payment storing only one `ClaimID`.

- [x] Backend: add membership coupon support to PayOS membership checkout.
  - `backend/src/main/java/com/gymcore/backend/modules/membership/service/MembershipService.java`
  - Add `promoCode` handling for:
    - purchase
    - renew
    - upgrade
  - Apply membership coupons only when `ApplyTarget = 'MEMBERSHIP'`.
  - Apply:
    - discount
    - bonus months
    - or both
  - Recompute membership end date using `BonusDurationMonths`.
  - Store single coupon `ClaimID` on payment / membership checkout.
  - Update pending-checkout reuse logic so different coupon selections do not incorrectly reuse the same pending payment link.
  - After payment success, mark membership coupon usage against `UsedOnMembershipID` correctly.

- [x] Frontend: update admin coupon management UI to match the new schema.
  - `frontend/src/pages/admin/AdminPromotionsPage.jsx`
  - Replace old bonus-day form/input/display with:
    - `ApplyTarget`
    - `BonusDurationMonths`
  - Add target selector:
    - `ORDER`
    - `MEMBERSHIP`
  - Update coupon benefit formatting text:
    - product discount
    - membership extra months
    - membership discount + extra months

- [x] Frontend: update customer shop coupon flow to use explicit product coupons only.
  - `frontend/src/pages/customer/CustomerShopPage.jsx`
  - Filter wallet coupons by `ApplyTarget === 'ORDER'`.
  - Remove remaining bonus-day logic.
  - Keep one selected coupon in cart drawer only.
  - Keep direct PayOS redirect flow unchanged.

- [x] Frontend: add membership coupon picker and preview to membership checkout.
  - `frontend/src/pages/customer/CustomerMembershipPage.jsx`
  - Load wallet claims.
  - Filter to `ApplyTarget === 'MEMBERSHIP'`.
  - Allow only one selected membership coupon at a time.
  - Show membership coupon preview:
    - estimated discount
    - bonus months
    - final amount
  - Send selected `promoCode` into membership purchase / renew / upgrade API calls.

- [x] Frontend: update promotions display text to month-based membership bonuses.
  - `frontend/src/pages/customer/CustomerPromotionsPage.jsx`
  - Replace old day-based wording with `+N MONTH` / `+N MONTHS`.
  - Optionally show target-aware text so customers know whether a coupon is for product checkout or membership checkout.

- [x] Tests: refresh backend coverage after schema contract change.
  - `backend/src/test/java/com/gymcore/backend/modules/promotion/service/PromotionServiceTest.java`
  - `backend/src/test/java/com/gymcore/backend/modules/product/service/ProductSalesServiceCheckoutTest.java`
  - `backend/src/test/java/com/gymcore/backend/modules/membership/service/MembershipServiceCustomerFlowTest.java`
  - Replace all old bonus-day assumptions.
  - Add membership checkout coupon coverage end-to-end.

- [x] Tests: add or update frontend coverage for the redesigned coupon UX.
  - `frontend/src/pages/customer/CustomerShopPage.test.jsx`
  - `frontend/src/pages/customer/CustomerMembershipPage.test.jsx`
  - Update admin promotions tests if added later.

## Docs Cleanup
- [x] Remove remaining stale bonus-day wording from docs and project memory so all project docs reflect the month-based coupon model consistently.

## Engineering Recommendations
- [x] Replace placeholder `"status": "TODO"` responses with explicit, stable response states.
  - `backend/src/main/java/com/gymcore/backend/modules/users/service/UserManagementService.java`
  - `backend/src/main/java/com/gymcore/backend/modules/checkin/service/CheckinHealthService.java`
  - `backend/src/main/java/com/gymcore/backend/modules/content/service/ContentService.java`
  - `backend/src/main/java/com/gymcore/backend/modules/coach/service/CoachBookingService.java`
  - `backend/src/main/java/com/gymcore/backend/modules/admin/service/AdminService.java`
- [x] Reduce the frontend production bundle size with route-level lazy loading and chunk splitting.
  - `frontend/src/routes/AppRouter.jsx`
- [x] Configure Mockito as an explicit test agent instead of relying on dynamic self-attachment, to avoid future JDK compatibility issues.
  - `backend/pom.xml`

## BMI UI Refinements
- [x] Add smooth gauge animation when BMI changes on `Check-in & Health`.
  - `frontend/src/pages/customer/CustomerCheckinHealthPage.jsx`
- [x] Refine the BMI gauge visuals to match the mobile reference more closely.
  - tighten arc-label placement
  - sharpen the needle style
  - fine-tune spacing and typography
  - `frontend/src/pages/customer/CustomerCheckinHealthPage.jsx`
- [x] Add clearer BMI interpretation copy such as `Healthy`, `Needs gain`, or `Needs reduction`.
  - `frontend/src/pages/customer/CustomerCheckinHealthPage.jsx`

## Product Pickup + Upload UX (Completed)
- [x] Add receptionist/admin pickup confirmation in the invoice center.
- [x] Add customer product review delete flow.
- [x] Replace admin raw image URL entry with uploaded product image flow.
- [x] Sync docs for pickup confirmation, review deletion, and product image upload.

## Product Feature Completion Roadmap
Goal: finish the product-shop feature in a few complete slices instead of continuing one-off UI/backend tweaks.

### Phase 1: Receptionist Pickup Workspace
- [x] Build a dedicated receptionist pickup page optimized for front-desk use.
  - Search by:
    - `Order ID`
    - invoice code
    - customer email
  - Show a compact result card with:
    - customer name
    - paid status
    - receipt email status
    - pickup status
    - item list
  - Support one-click `Confirm pickup` directly from the search result.
  - Add receptionist route + header/sidebar entry if the current invoice page is too admin-oriented.
- [x] Add pickup-state filters to invoice views.
  - `Awaiting pickup`
  - `Picked up`
  - optional `Email failed`
- [x] Add backend coverage for receptionist pickup search/use cases.
- [x] Add frontend tests for the new receptionist pickup flow.

### Phase 2: Product Gallery and Media Management
- [x] Improve admin product gallery management beyond simple upload.
  - reorder images
  - replace an existing image
  - remove uploaded image
  - clearer primary-image selection
- [x] Add backend cleanup rules for removed images.
  - avoid orphaned files when an image is removed from a product
  - keep file deletion conservative so shared/legacy URLs are not broken accidentally
- [x] Add validation for:
  - max image count per product
  - duplicate uploaded image rows
  - invalid primary-image states
- [x] Add backend/frontend regression coverage for image reorder/remove flows.

### Phase 3: Review Experience Completion
- [x] Add explicit review-state UX on product detail.
  - `Write review`
  - `Edit review`
  - `Delete review`
  - show the customer's own review separately from public review list
- [x] Improve order-history review visibility.
  - clearer reviewed/not-reviewed badges per purchased item
  - direct jump from order history to product detail
- [x] Add review quality guardrails.
  - trim empty comments
  - protect against accidental duplicate submits
  - keep rating/comment validation consistent across product detail and order history
- [x] Add tests for full review lifecycle consistency:
  - create
  - edit
  - delete
  - post-delete re-create

### Phase 4: Customer Product History and Supportability
- [x] Expand customer order history from a review entry page into a fuller purchase-history page.
  - better receipt summary
  - clearer pickup guidance
  - visible invoice / order status timeline
- [x] Expose pickup status cleanly to customers.
  - `Paid - awaiting pickup`
  - `Picked up`
  - email failure notice when receipt delivery failed
- [x] Add support-focused details for troubleshooting.
  - invoice code
  - order ID
  - payment timestamp
  - pickup timestamp when completed
- [x] Add tests for customer-facing pickup-status rendering.

### Phase 5: Admin Catalog Polish
- [x] Add admin product-list filters.
  - category
  - active / archived
  - has reviews
  - optional low-rated items
- [x] Add bulk-friendly catalog actions where useful.
  - archive/unarchive
  - quick category filtering
- [x] Improve admin product form UX.
  - clearer sectioning for:
    - basic info
    - pricing
    - categories
    - gallery
    - review snapshot
- [x] Add tests for admin filtering and archive-state UX.

### Phase 6: Operational Hardening
- [x] Add backend authorization regression for all new product operations.
  - customer-only review actions
  - admin-only image upload
  - admin/receptionist-only pickup confirmation
- [x] Add backend/file-storage hardening for image upload.
  - size/type validation edge cases
  - filename/path safety
  - broken upload cleanup
- [x] Add frontend error-state coverage for:
  - pickup confirmation failure
  - image upload failure
  - review delete/update failure
- [x] Re-run full regression after each phase:
  - backend `.\mvnw.cmd test`
  - frontend `npm run lint`
  - frontend `npm run test:run -- --maxWorkers=1`
  - frontend `npm run build`

### Recommended Delivery Order
- [x] Batch A: Phase 1 + Phase 4
  - completes the real pickup workflow from customer purchase to receptionist handoff
- [x] Batch B: Phase 2 + Phase 5
  - completes catalog/media management for admins
- [x] Batch C: Phase 3 + Phase 6
  - completes the review lifecycle and hardens the new product surface area

## Admin Backoffice Completion

### Admin Dashboard Completion (Completed)
- [x] Replaced the starter page at `/admin/dashboard` with a real admin overview screen.
- [x] Implemented backend admin actions:
  - `get-dashboard-summary`
  - `get-revenue-overview`
- [x] Added dashboard KPI coverage for:
  - customers
  - memberships
  - staff
  - PT bookings
  - commerce/pickup
  - promotions
- [x] Added operational widgets:
  - recent payments
  - awaiting pickup orders
  - expiring memberships
  - pending PT requests
  - invoice email failures
  - alert list
- [x] Added revenue widgets and filters:
  - presets: `today`, `7 days`, `30 days`, `this month`
  - custom `from` / `to`
  - trend series
  - membership vs product split
- [x] Added quick links into the existing admin modules.
- [x] Added backend/frontend tests for dashboard data, date range handling, and controller contracts.

### Admin Users / Staff Management Completion (Completed)
- [x] Replaced the starter page at `/admin/users` with a real staff management screen.
- [x] Implemented backend admin user actions:
  - `admin-get-users`
  - `admin-create-staff`
  - `admin-update-staff`
  - `admin-lock-user`
  - `admin-unlock-user`
- [x] Enforced the employee-only rule in both backend and frontend.
  - Admin may create/manage only:
    - `ADMIN`
    - `COACH`
    - `RECEPTIONIST`
  - Admin cannot create `CUSTOMER` accounts from this page or API.
- [x] Added staff listing/search/filter support for:
  - role
  - name/email/phone query
  - locked status
  - active status
- [x] Added role-aware staff creation/edit UX.
  - common account fields
  - coach-specific profile fields
  - explicit employee-only page copy
- [x] Added operational account rules:
  - lock reason required
  - self-lock rejected
  - last active admin protection
  - self-deactivation protection
- [x] Added backend/frontend tests for:
  - employee-only role selector
  - create/edit staff
  - customer-role rejection
  - lock/unlock flows
  - controller contracts and service exceptions

### Admin CRUD Filter + Validation Pass (Completed)
- [x] Standardized admin CRUD filtering across the main management screens:
  - `/admin/users`
  - `/admin/memberships`
  - `/admin/products`
  - `/admin/promotions`
  - `/admin/coaches`
- [x] Replaced browser-native required-field behavior with explicit in-app validation/error surfaces where admin forms collect required data.
- [x] Added regression coverage for:
  - admin filter payloads / filtered views
  - custom validation messages on empty or malformed submissions
  - backend exception handling for rejected admin updates

### Admin Backoffice Validation (Mar 7, 2026)
- [x] Backend: `.\mvnw.cmd test` -> passed (`222` tests)
- [x] Frontend: `npm run lint` -> passed
- [x] Frontend: `npm run test:run -- --maxWorkers=1` -> passed (`153` tests)
- [x] Frontend: `npm run build` -> passed

### Admin Reports Overhaul (Completed)
- [x] Redesign `/admin/reports` so the filter system uses one active reporting mode at a time.
  - Replace the current overlapping controls with mutually exclusive modes:
    - `Quick range`
    - `Custom range`
  - Do not show competing date controls simultaneously.
  - Quick range owns short preset windows:
    - `Today`
    - `7 days`
    - `30 days`
  - Custom range uses only exact `from` / `to` dates.

- [x] Replace the current mixed filter-card layout with a cleaner reporting header.
  - Top area should clearly separate:
    - page title
    - short explanation
    - current applied filter summary
    - export action
    - report mode selector
  - Remove the current competing multi-card filter layout.

- [x] Add a single applied-filter summary bar above analytics.
  - Examples:
    - `Applied filter: Last 30 days`
    - `Applied filter: March 2026`
    - `Applied filter: Year 2025`
    - `Applied filter: March 1, 2026 to March 7, 2026`
  - Chart, KPIs, table, and export must all reflect this same applied filter.

- [x] Keep all revenue analytics in `/admin/reports` only.
  - Dashboard should remain an operations overview page.
  - Reports should own:
    - revenue totals
    - range-specific analytics
    - charting
    - date-based breakdown
    - export

- [x] Redesign the KPI section on `/admin/reports`.
  - Keep only useful range-bound metrics:
    - total revenue
    - membership revenue
    - product revenue
    - average per day
  - Tighten spacing and visual hierarchy so the page reads like a report, not a dashboard clone.

- [x] Redesign the main chart section for readability.
  - Keep one primary chart for the applied range.
  - Improve chart labeling, spacing, and hierarchy.
  - Avoid the current cluttered split-card presentation.

- [x] Redesign `Revenue by day`.
  - Replace the current cluttered presentation with a cleaner analysis section.
  - Use a compact daily breakdown layout with clearer spacing and lower visual noise.
  - Keep large ranges readable instead of rendering a dense wall of rows.
  - Preserve useful revenue-per-day detail without turning the page into a spreadsheet dump.

- [x] Make export explicit and filter-aware: Excel only.
  - Export format must be `.xlsx`.
  - Export must use the exact currently applied filter:
    - quick range
    - custom range
  - Exported content must match the on-screen report for that filter:
    - KPI totals
    - range context
    - daily breakdown rows
  - Filename should reflect the active filter, for example:
    - `GymCore_Revenue_2026-03.xlsx`
    - `GymCore_Revenue_2025.xlsx`
    - `GymCore_Revenue_2026-03-01_to_2026-03-07.xlsx`

- [x] Refactor frontend report state into one source of truth.
  - Maintain one active mode plus one applied payload.
  - Prevent contradictory filter payloads from being generated.
  - Ensure the API payload is built only from the active mode.

- [x] Align backend/controller support with the cleaned report contract.
  - Keep support for:
    - `preset`
    - `month`
    - `year`
    - `from`
    - `to`
  - Update export handling so Excel generation respects the active applied filter.
  - Adjust controller/service tests where payload expectations change.

- [x] Add regression coverage for the reports overhaul.
  - Frontend:
    - mode switching hides irrelevant controls
    - quick preset sends only preset payload
    - custom range sends only `from` / `to`
    - applied filter summary updates correctly
    - Excel export uses the current applied filter
    - redesigned daily breakdown renders cleanly
  - Backend:
    - quick-range/custom filter validation remains correct
    - Excel export respects incoming filters

- [x] Re-run full validation after the reports overhaul.
  - Backend:
    - `.\mvnw.cmd test`
  - Frontend:
    - `npm run lint`
    - `npm run test:run -- --maxWorkers=1`
    - `npm run build`

### Admin Reports Validation (Mar 8, 2026)
- [x] Backend: `.\mvnw.cmd test` -> passed (`245` tests)
- [x] Frontend: `npm run lint` -> passed
- [x] Frontend: `npm run test:run -- --maxWorkers=1` -> passed (`162` tests)
- [x] Frontend: `npm run build` -> passed

### Release Readiness Validation (Mar 8, 2026)
- [x] Added backend regression coverage for:
  - `backend/src/test/java/com/gymcore/backend/modules/content/controller/ContentControllerTest.java`
  - `backend/src/test/java/com/gymcore/backend/modules/content/service/ContentServiceTest.java`
  - `backend/src/test/java/com/gymcore/backend/modules/admin/service/ReportServiceTest.java`
- [x] Added frontend regression coverage for:
  - `frontend/src/pages/customer/CustomerKnowledgePage.test.jsx`
  - `frontend/src/pages/reception/ReceptionCustomersPage.test.jsx`
  - `frontend/src/pages/admin/AdminCoachInsightsPage.test.jsx`
  - extended `frontend/src/routes/AppRouter.test.jsx` for `/customer/knowledge` and `/reception/customers`
- [x] Full release gate rerun after those additions:
  - Backend: `.\mvnw.cmd test`
  - Frontend: `npm run lint`
  - Frontend: `npm run test:run -- --maxWorkers=1`
  - Frontend: `npm run build`
