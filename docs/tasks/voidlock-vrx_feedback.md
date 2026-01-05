Mr Tinkleberry. The build failed with 8 TypeScript errors because several test files use mock `SoldierMissionResult` objects that are now missing the required `xpBefore` property, and some tests are missing the `afterEach` import.

Please fix the following:

1. tests/engine/managers/CampaignManager.test.ts: Add `xpBefore: 0` to mock results.
2. tests/engine/managers/Progression.test.ts: Add `xpBefore: 0` to mock results (4 occurrences).
3. tests/shared/campaign_types.test.ts: Add `xpBefore: 0` to mock result.
4. tests/renderer/InputManager.test.ts: Import `afterEach` from `vitest`.
5. tests/renderer/QKeyNavigation.test.ts: Import `afterEach` from `vitest`.

Ensure `npm run build` passes before submitting.