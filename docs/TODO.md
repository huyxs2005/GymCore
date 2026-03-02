# GymCore TODO (Post feature/coupon merge)

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

## Explicit Feature Task
- [x] Implement `/promotions/apply` as a pre-check preview endpoint (no order/payment creation), including:
  - coupon validity preview
  - discount preview
  - membership `BonusDurationDays` preview
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
  - automated service smoke coverage: membership purchase/renew/upgrade + PayOS return/webhook

## Deferred (By Decision)
- [ ] Optional/later: expose and test PayOS webhook endpoint publicly (tunnel/deployment) for real signed callback verification.

## Coupon Redesign Plan
- [ ] Redefine coupon behavior before further schema/app work.
  - Coupon must target exactly one checkout domain: `ORDER` or `MEMBERSHIP`.
  - Product coupon supports discount only.
  - Membership coupon supports:
    - discount only
    - extra membership months only
    - discount + extra membership months together
  - Customer must not be able to stack multiple coupons in one checkout.
  - One checkout can reference at most one claim / one promotion.

- [ ] Update DB design to match the new coupon plan.
  - Replace day-based bonus logic with month-based membership extension.
  - Review whether `BonusDurationDays` should become `BonusDurationMonths`, or whether a compatibility migration is needed.
  - Keep explicit `ApplyTarget` on promotions.
  - Add DB constraints so:
    - order-target coupons cannot carry membership bonus months
    - membership-target coupons may carry discount, bonus months, or both
    - coupon still must provide at least one benefit
    - one payment/order/membership checkout cannot store more than one coupon claim

- [ ] Update backend coupon logic after the DB redesign.
  - Read persisted coupon target from DB instead of inferring from bonus fields.
  - Product checkout must only accept `ORDER` coupons.
  - Membership checkout must only accept `MEMBERSHIP` coupons.
  - Membership checkout must apply bonus months, not bonus days.
  - Keep claim usage one-time and non-stackable across all checkout flows.

- [ ] Update frontend admin/customer flows after the DB redesign.
  - Admin coupon CRUD must expose explicit coupon target.
  - Admin UI must support membership coupon combinations:
    - discount only
    - extra months only
    - discount + extra months
  - Customer product checkout must show only valid product coupons.
  - Customer membership checkout must show only valid membership coupons.
  - Checkout UI must allow selecting only one coupon at a time.

- [ ] Add regression coverage for the redesigned coupon rules.
  - Backend tests for product discount coupons.
  - Backend tests for membership discount-only coupons.
  - Backend tests for membership extra-month-only coupons.
  - Backend tests for membership discount + extra-month coupons.
  - Backend tests that stacked coupons are rejected.
  - Frontend tests for single-coupon checkout behavior in both shop and membership pages.

## Coupon Redesign Implementation Queue
- [ ] Backend: migrate `PromotionService` from `BonusDurationDays` to `ApplyTarget` + `BonusDurationMonths`.
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

- [ ] Backend: update product checkout to honor explicit coupon target.
  - `backend/src/main/java/com/gymcore/backend/modules/product/service/ProductSalesService.java`
  - Replace old `BonusDurationDays` membership-only rejection with `ApplyTarget != 'ORDER'`.
  - Keep product checkout non-stackable: accept only one `promoCode`.
  - Keep order/payment storing only one `ClaimID`.

- [ ] Backend: add membership coupon support to PayOS membership checkout.
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

- [ ] Frontend: update admin coupon management UI to match the new schema.
  - `frontend/src/pages/admin/AdminPromotionsPage.jsx`
  - Replace `BonusDurationDays` form/input/display with:
    - `ApplyTarget`
    - `BonusDurationMonths`
  - Add target selector:
    - `ORDER`
    - `MEMBERSHIP`
  - Update coupon benefit formatting text:
    - product discount
    - membership extra months
    - membership discount + extra months

- [ ] Frontend: update customer shop coupon flow to use explicit product coupons only.
  - `frontend/src/pages/customer/CustomerShopPage.jsx`
  - Filter wallet coupons by `ApplyTarget === 'ORDER'`.
  - Remove remaining `BonusDurationDays` logic.
  - Keep one selected coupon in cart drawer only.
  - Keep direct PayOS redirect flow unchanged.

- [ ] Frontend: add membership coupon picker and preview to membership checkout.
  - `frontend/src/pages/customer/CustomerMembershipPage.jsx`
  - Load wallet claims.
  - Filter to `ApplyTarget === 'MEMBERSHIP'`.
  - Allow only one selected membership coupon at a time.
  - Show membership coupon preview:
    - estimated discount
    - bonus months
    - final amount
  - Send selected `promoCode` into membership purchase / renew / upgrade API calls.

- [ ] Frontend: update promotions display text to month-based membership bonuses.
  - `frontend/src/pages/customer/CustomerPromotionsPage.jsx`
  - Replace old `+N DAYS` wording with `+N MONTH` / `+N MONTHS`.
  - Optionally show target-aware text so customers know whether a coupon is for product checkout or membership checkout.

- [ ] Tests: refresh backend coverage after schema contract change.
  - `backend/src/test/java/com/gymcore/backend/modules/promotion/service/PromotionServiceTest.java`
  - `backend/src/test/java/com/gymcore/backend/modules/product/service/ProductSalesServiceCheckoutTest.java`
  - `backend/src/test/java/com/gymcore/backend/modules/membership/service/MembershipServiceCustomerFlowTest.java`
  - Replace all `BonusDurationDays` assumptions.
  - Add membership checkout coupon coverage end-to-end.

- [ ] Tests: add or update frontend coverage for the redesigned coupon UX.
  - `frontend/src/pages/customer/CustomerShopPage.test.jsx`
  - Add a new membership-page test file if still missing:
    - `frontend/src/pages/customer/CustomerMembershipPage.test.jsx`
  - Update admin promotions tests if added later.

- [ ] Cleanup pass after implementation.
  - Replace stale docs references still mentioning `BonusDurationDays`.
  - Re-run:
    - `docs/GymCore.txt`
    - `docs/alter.txt`
    - `docs/InsertValues.txt`
    - `docs/InsertTestingValues.txt`
  - Run full regression:
    - backend `.\mvnw.cmd test`
    - frontend `npm run lint`
    - frontend `npm run test:run`
    - frontend `npm run build`

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
