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
- [ ] Merge only C-scope membership files from `origin/membership` (keep `beta-test-0.2` as base):
  - `backend/src/main/java/com/gymcore/backend/modules/membership/controller/MembershipController.java`
  - `backend/src/main/java/com/gymcore/backend/modules/membership/service/MembershipService.java`
  - `backend/src/test/java/com/gymcore/backend/modules/membership/service/MembershipServiceCustomerFlowTest.java`
  - `frontend/src/features/membership/api/membershipApi.js`
  - `frontend/src/pages/customer/CustomerMembershipPage.jsx`
- [ ] Do not merge unrelated/non-C changes (ignore env files and non-membership regressions).
- [ ] Keep DB docs system as 4 files only:
  - `docs/GymCore.txt`
  - `docs/alter.txt`
  - `docs/InsertValues.txt`
  - `docs/InsertTestingValues.txt`
- [ ] Ensure C business rules are fully enforced:
  - one ACTIVE membership
  - renew from EndDate
  - upgrade immediate switch
  - day pass start=end
  - payment method audit on payment/order records
  - queued membership safety on payment success
- [ ] Implement missing Admin membership plan actions (create/update) so C is fully complete.
- [ ] Run full regression checks after merge:
  - backend `.\mvnw.cmd test`
  - frontend `npm run test -- --run`
  - manual smoke: membership purchase/renew/upgrade + PayOS return/webhook

## Deferred (By Decision)
- [ ] Expose and test PayOS webhook endpoint publicly (tunnel/deployment) for real signed callback verification.
