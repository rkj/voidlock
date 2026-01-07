The build failed with TypeScript errors in multiple test files because the `HUDManager` constructor signature was changed, but not all call sites in tests were updated.

Errors:
- tests/renderer/ui/HUDManager_PauseConstraints.test.ts:73:11 - error TS2554: Expected 8 arguments, but got 6.
- tests/renderer/ui/HUDManager_Stats.test.ts:100:11 - error TS2554: Expected 8 arguments, but got 6.
- tests/renderer/ui/regression_kvi1_actions_visible_on_restart.test.ts:77:11 - error TS2554: Expected 8 arguments, but got 6.
- tests/renderer/ui/regression_pdxs_objective_hud.test.ts:64:11 - error TS2554: Expected 8 arguments, but got 6.
- tests/renderer/ui/regression_voidlock_6gl_debug_info.test.ts:29:11 - error TS2554: Expected 8 arguments, but got 6.

Please update all these files to provide the missing `onForceWin` and `onForceLose` arguments (use `vi.fn()` for mocks) to the `HUDManager` constructor. Ensure `npm run build` passes after your changes.