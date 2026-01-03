# Verification Feedback: xenopurge-gemini-omfu

## Build Failures
The build failed due to `MockStorage` implementation in two test files missing required methods from the `StorageProvider` interface.

**Files:**
- `src/engine/tests/regression_0rdj_initial_equipment.test.ts`
- `tests/engine/regression_0rdj_initial_equipment.test.ts`

**Errors:**
```
error TS2420: Class 'MockStorage' incorrectly implements interface 'StorageProvider'.
  Type 'MockStorage' is missing the following properties from type 'StorageProvider': remove, clear
```

## Duplicate Test File
The file `src/engine/tests/regression_0rdj_initial_equipment.test.ts` is a duplicate of `tests/engine/regression_0rdj_initial_equipment.test.ts`.

## Instructions
1.  **Remove Duplicate**: Delete `src/engine/tests/regression_0rdj_initial_equipment.test.ts`. Use `run_shell_command("rm src/engine/tests/regression_0rdj_initial_equipment.test.ts")` or similar if previous attempts failed.
2.  **Fix MockStorage**: In `tests/engine/regression_0rdj_initial_equipment.test.ts`, add the missing `remove` and `clear` methods to the `MockStorage` class.
3.  **Verify**: Ensure `npm run build` passes.
