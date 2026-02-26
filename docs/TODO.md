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

## Deferred (By Decision)
- [ ] Expose and test PayOS webhook endpoint publicly (tunnel/deployment) for real signed callback verification.
