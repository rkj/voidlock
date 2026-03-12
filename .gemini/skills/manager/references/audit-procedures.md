# Audit & Verification Procedures

This reference documents the mandatory verification steps for the Quality Gatekeeper.

## 🚨 SERVER INFO
The development server is at `http://localhost:5199/`. Use this for all browser-based verification.

## Mandatory Sequential Verification

You MUST execute every step below in order. Do NOT skip any step.

### Step 1: Audit Beads
- **Comment Check**: Run `bd show <TASK_ID> --json`. If a "BLOCKER" comment exists, **ESCALATE TO HUMAN INPUT** immediately.

### Step 2: Audit Logs
- **Crash Check**: Scan agent output for "Loop detected", "TimeoutError", or "Operation Cancelled".
- **Tool Failure**: Did `npm install` fail? Did the agent bypass a tool failure? **FAIL VERIFICATION** if found.

### Step 3: Diff Review (MANDATORY)
1. Run `jj diff --git` for ALL changes.
2. **File Count Check**: Modified source files (excluding tests/GEMINI.md) must be <= 5. If > 5, **FAIL VERIFICATION** and escalate for decomposition.
3. **Deletion Audit**: Check every deleted line. Verify it wasn't a regression of layout, visibility, or logic.
4. **Scope Creep Check**: Ensure only files required by the task were touched.

### Step 4: Visual Audit (UI/CSS/Layout)
- Use `navigate_page` to visit the affected screen.
- Use `take_screenshot` at **1024x768** and **400x800**.
- Compare against **Product Spec** and "Negative Proof" from planning.

### Step 5: Test Verification
1. Run `npx vitest run <PATH_TO_TEST> --reporter=basic`.
2. **Robustness Audit**: Does the test use mocks that bypass the bug?
3. **Mock Integrity**: Verify all manual mocks were updated for class signature changes.
4. **Failure Mode**: Ensure the test verifies the failure mode/negative case, not just the "Happy Path".

### Step 6: UI State Audit
- **Focus Check**: Search for `FocusManager` usage to save/restore focus.
- **Scroll Check**: Verify `scrollTop` preservation.

### Step 7: Regression Audit
- Search closed beads for similar titles (`bd list --status closed | grep <keyword>`).
- Confirm fix works where previous attempts failed.

### Step 8: Build & Lint
- Ensure `npm run build` and `npm run lint` pass.

### Step 9: Spec Compliance Check
- Audit `jj diff --git` for **SOLID** and **Spec** compliance.
