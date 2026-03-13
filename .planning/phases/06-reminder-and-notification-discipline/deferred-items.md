# Deferred Items

## 2026-03-13

- `backend/src/test/java/com/gymcore/backend/modules/UnsupportedActionDispatchTest.java` no longer matches the current `UserManagementService` constructor. Maven `testCompile` fails there before `PromotionControllerTest` and `UserNotificationServiceTest` can run for plan `06-01`. This is pre-existing and unrelated to the reminder-center work.
