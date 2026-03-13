# Deferred Items

## 2026-03-13

- `backend/src/test/java/com/gymcore/backend/modules/UnsupportedActionDispatchTest.java` no longer matches the current `UserManagementService` constructor. Maven `testCompile` fails there before `PromotionControllerTest` and `UserNotificationServiceTest` can run for plan `06-01`. This is pre-existing and unrelated to the reminder-center work.
- The same `UnsupportedActionDispatchTest.java` constructor mismatch still blocks `mvn -q -Dtest=PromotionServiceTest,PromotionControllerTest test` for plan `06-03`, so the promotion backend tests could not be executed through Maven even after the important-post changes were implemented. This remains pre-existing and outside the scope of the promotion broadcast plan.
