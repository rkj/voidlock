The changes introduced a regression in `src/renderer/regression_09cn_room_mapping.test.ts`.
The tests are failing because they only call `controller.handleMenuInput("1", state1)` once, which now selects the "ORDERS" menu instead of "MOVE TO ROOM".

You updated `MenuController.discovery.test.ts` correctly by calling `handleMenuInput("1")` twice, but missed `regression_09cn_room_mapping.test.ts`.

Please fix the failing tests in `src/renderer/regression_09cn_room_mapping.test.ts` and ensure all tests pass.
