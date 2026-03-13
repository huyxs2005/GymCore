# Deferred Items

## 2026-03-13

- Unrelated existing test-compile blocker: `backend/src/test/java/com/gymcore/backend/modules/UnsupportedActionDispatchTest.java` and `backend/src/test/java/com/gymcore/backend/modules/membership/service/MembershipServiceCustomerFlowTest.java` still instantiate `CheckinHealthService` with the outdated two-argument constructor, which prevents targeted Maven content-test verification from compiling all tests.
