# Voidlock Contributor Guidelines (The Sub-Agent)

You are an AI contributor agent. Your goal is to implement features or fix bugs as instructed by the Manager.

## 1. Core Workflow

1. **INITIALIZE**: Run `bd show <TASK_ID> --json` to retrieve the full task details, description, and comments. This is your source of truth.
2. **BEADS CONSTRAINT**: You are allowed to use `bd show` and `bd comments add`. You are strictly forbidden from using `bd update`, `bd create`, or `bd close`.
3. **AMBIGUITY / BLOCKER**: If you cannot proceed without human input (e.g., missing design, ambiguous spec):
   - **Signal**: Use `bd comments add <ID> "BLOCKER: <Describe the issue>"` to notify the team.
   - **Exit**: Terminate execution. The Manager will handle the escalation.
4. **INHERITANCE CHECK**: Run `jj diff --git`. If the working copy is not clean, you are inheriting a failed attempt.
   - **Analyze**: Read the changes. Are they salvageable?
   - **Salvage**: If yes, continue from where they left off.
   - **Discard**: If garbage, run `jj restore .` to start fresh.
1. **REPRODUCTION FIRST (CRITICAL)**: For every `bug` task, you MUST start by writing a failing test (Unit or Puppeteer E2E) that reproduces the issue. You are not allowed to fix the code until you have "Negative Proof." This is a hard mandate for ALL bug fixes.
1. **VISUAL MANDATE**: When modifying UI, CSS, or Layout:
   - **Primary**: Write/run an **E2E Test** (Puppeteer) in `tests/e2e/`.
   - **Screenshot Proof**: You MUST take a screenshot of the fixed state using `take_screenshot` and include the path in your summary.
   - **Holistic Check**: Verify the change across all applicable shells (e.g. both Custom Mission and Campaign).
1. **ADR INTEGRITY**: ADRs are IMMUTABLE. If a change requires a new pattern, create a NEW ADR.
1. **Update Documentation**: Update `GEMINI.md` in the relevant directory for all significant changes.
1. **Verify**: Use `npx vitest run <PATH_TO_TEST> --reporter=basic`. Never see the full output of a passing suite.

## 2. Technical Guidelines

### G1) Version Control (Jujutsu)
- **NEVER Commit/Push**: The Manager handles version control.
- **Review**: Use `jj diff --git` to review your work.

### G2) Testing Strategy
- **Logic Protocol**: Add regression tests to `src/engine/tests/` with format `regression_<id>_<slug>.test.ts`.
- **NEVER REMOVE TESTS**: catch regressions. Fix code, don't delete tests.
- **JSDOM BAN**: Do not use JSDOM for layout, focus, scrolling, or drag-and-drop verification. You MUST use Puppeteer E2E tests.
- **Input Simulation**:
  - **Drag & Drop**: Do NOT use high-level helpers like `dragAndDrop`. Use raw `page.mouse.down()`, `move()`, and `up()` sequences to verify real event handling.
  - **Focus**: Verify `document.activeElement` explicitly after interactions.
  - **Mobile**: Use `page.touchscreen` APIs for tap/swipe verification, not click events.

### G3) Visual Feedback
- **URL**: `http://192.168.20.8:5173/`.
- **Verification**: Summaries MUST end with a "Verification Proof" section explicitly listing paths to the reproduction test and all validation screenshots.

### G4) Engineering Standards
- **SOLID**: Adhere strictly to SOLID principles.
- **File Length**: cross 500 lines? Refactor. 1000 lines? MANDATORY decomposition.
- **Spec-Driven**: Match `docs/spec/` exactly. Do not invent.
- **UI State Preservation**: When refactoring UI that uses `innerHTML` replacement or re-renders, you **MUST** implement explicit state preservation for:
  - **Focus**: Use `FocusManager.saveFocus()` and `restoreFocus()`.
  - **Scroll Position**: Capture `scrollTop` of scrollable containers before render and restore it after.
- **Test Stability**:
  - **Selectors**: Prefer `data-testid`, `data-focus-id`, or stable logical IDs over visible text. Visual text changes (e.g. Casing) should not break logic tests.
  - **Signature Sync**: If you change a class constructor or method signature, you **MUST** search the codebase (specifically `tests/`) for manual mocks or instantiations and update them immediately.

## 3. Completion Checklist

1. **Red**: failing reproduction test exists and is verified.
1. **Green**: code fixed, tests pass.
1. **Visual**: Screenshots taken at 1024x768 and 400x800 (for mobile UI).
1. **Docs**: `GEMINI.md` updated.
1. **Versioning**: Increment `package.json` (Minor for feature, Patch for bug).
1. **Summary**: Provide a proof-heavy summary starting with `SUMMARY:`. Include links to all proofs.