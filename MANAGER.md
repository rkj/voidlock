# Manager Agent Workflow (Super Agent)

> **🚨 PRIME DIRECTIVE (READ THIS FIRST)**:

1. **USER INTERRUPT**: If the user asks a question or expresses confusion ("WTF"), **STOP**. Do not dispatch. Do not verify. Answer the user.
2. **TOOL FAILURE AUDIT**: When reviewing a sub-agent's work, check their logs. If `npm install` or any critical tool failed, **REJECT** the task. Do not accept "I wrote the code so it's done" if the environment is broken.
3. **YOU ARE A ROUTER**: Your job is to select a task and dispatch a worker.
4. **SEPARATE COMMANDS**: Always execute commands as separate tool calls. Do NOT chain them with `&&`, `||`, or `;`.
5. **DO NOT READ SOURCE CODE**: You are FORBIDDEN from reading `.ts`, `.html`, or `.css` files before the Verification phase. You do not need to understand the implementation details to assign the task.
6. **DO NOT RESEARCH**: Do not "investigate" or "plan". The Sub-Agent will do that. Your only context comes from `bd ready` and `@docs/spec/`.
7. **DELEGATE IMMEDIATELY**: As soon as you pick a task ID, run the `dispatch_agent.sh` command. Do not hesitate.
8. **EFFICIENT QUERYING**: NEVER run `bd list` without a `--status` filter (e.g., `bd list --status in_progress`). Unfiltered lists are too large and wasteful.
9. **ADR ENFORCEMENT**: Implementation details (class names, method signatures, patterns) belong in **ADRs** (`docs/adr/`), NOT in `docs/spec/` or Beads descriptions. If a complex task lacks an ADR, create a dependency task to write one first.
10. **TDD ENFORCEMENT**:
    - **Logic Bugs**: Must have a failing unit/integration test (JSDOM/Node).
    - **Visual/Layout Bugs**: MUST have a failing **E2E test** (`tests/e2e/`) using Puppeteer.
      - The test must navigate to the specific state.
      - It must capture a screenshot (for manual review) OR assert layout metrics (scrollTop, coordinates) in the browser context.
      - **Do not accept JSDOM tests for CSS/Scroll issues.**

## 1. Session Startup

At the start of every session, run:

1. `bd list --status in_progress --json`: Check for unfinished work.
1. [if in progress is empty] `bd ready --json -n 1`: Check for all actionable tasks that are unblocked.

**Decision Logic:**

- If `in_progress` exists: **RESUME** management (Skip to Section 3: Verification).
- If `ready` exists: **SELECT** the highest priority task.
  1. **CLAIM**: Run `bd update <TASK_ID> --status in_progress`.
  1. **DISPATCH**: Run the `dispatch_agent.sh` command (Section 2).
- **Dependency Management**: If a task is selected but you realize it has prerequisites, **DO NOT DISPATCH**. Use `bd dep add <TASK_ID> <PREREQ_ID>` and then run `bd ready` again.

## 2. Task Delegation (The Dispatch)

**Action**: Spawn a sub-agent to perform the implementation.

**Rules**:

1. **Strict Adherence to Beads**: You are ONLY allowed to dispatch tasks that currently exist in the Beads (bd) system.
1. **No Ad-Hoc Instructions**: Do not invent new task descriptions or requirements in the prompt. The sub-agent must rely on `bd show <TASK_ID>` for truth. If requirements change, update the Beads task first.
1. **Context Validation**: Before dispatching, ensure the Bead task description links to the relevant **ADRs** (for implementation details) and **Spec** sections (for behavior). If missing, update the Bead first.
1. **Adding Context (Non-Destructive)**: When adding info (errors, research), use comments.
   - **Strategy A (Subtask)**: Create a new dependent task (e.g., `bd create ...` then `bd dep add ...`). This is cleaner for long error logs.
   - **Strategy B (Comment)**: Use `bd comments add <TASK_ID> "<NEW_INFO>"`. This is preferred for error logs or simple feedback to the next agent.
1. **No Backticks**: NEVER use backticks (`) in ANY command arguments or task descriptions. Use single quotes or plain text. This is a strict shell safety rule.

**Command Pattern:**
Use the helper script to dispatch the agent.

```bash
# Basic dispatch
run_shell_command("./scripts/dispatch_agent.sh <TASK_ID>")

# If you need to add context before dispatching:
# 1. Add comment: bd comments add <TASK_ID> "## New Context\n..."
# 2. Dispatch: run_shell_command("./scripts/dispatch_agent.sh <TASK_ID>")
```

## 3. Verification & Quality Control (The Audit)

**Trigger**: ONLY after the sub-agent process exits.

**🚨 SERVER INFO**: The development server is ALREADY RUNNING at `http://192.168.20.8:5173/`. **NEVER** execute `npm run dev`. Use this URL for all browser-based verification.

**Manager Actions:**

1. **Audit Logs (CRITICAL)**: Scroll up and read the sub-agent's output.
   - _Check_: Did you see "Tool execution denied"? If yes, **FAIL** immediately.
   - _Check_: Did you see "npm install" fail? If yes, **FAIL** immediately.
   - _Check_: Did the agent comment out tests to make them pass? **FAIL** immediately.
2. **Inspect**: Execute `jj diff --git` to review all file status and content changes in a single view.
   - _Check_: Did it follow conventions? Did it remove tests? (Forbidden!)
   - _Architecture Review_: Does the code adhere to `@docs/ARCHITECTURE.md` and SOLID principles? If the code _validly_ changes the architecture (based on an ADR), ensure `@docs/ARCHITECTURE.md` is updated.
   - _Standards Check_: Verify adherence to **SOLID**, **TDD** (failing test exists?), and **Spec** compliance. Reject spaghetti code or "quick fixes".
   - _Documentation (MANDATORY)_: Ensure `GEMINI.md` files in modified directories were updated. If the high-level system design changed, ensure `@docs/ARCHITECTURE.md` is updated. If documentation is missing or outdated, you MUST fail verification and re-dispatch with instructions to update it.
3. **Test**: Run `npx vitest run`.
   - **Token Efficiency**: For large test suites, avoid dumping all output to stdout.
   - **Targeted Testing**: Run `npx vitest run <PATH_TO_TEST>` (or `npm run test <PATH_TO_TEST>`) to test only relevant files.
   - **Full Verification**: Redirect output: `npx vitest run > <temp_dir>/test.log 2>&1`.
   - **Check for failure**: `grep "FAIL" <temp_dir>/test.log`. If it exists, read only the failing parts.
   - _Check_: **CRITICAL**: All changes MUST be confirmed by tests first. Sub-agents are required to write/update tests before or alongside implementation.
4. **Verify (Visual)**: If the task touched UI, CSS, or Layout:
   - **YOU MUST** navigate to the **specific screen and state** modified. A screenshot of the Main Menu is **NOT** verification.
   - **Interactive Validation**: Use `click`, `fill`, and `evaluate_script` to reach the feature. If fixing a bug, you must reproduce the state (e.g., scroll down, open modal) before capturing the screenshot.
   - **DO NOT TRUST** JSDOM tests for layout/scrolling. Look at the image.
   - _🚨 Regression Rule_: If browser validation discovers a problem that automated tests missed, the sub-agent MUST be re-dispatched with an instruction to FIRST write a failing test for the issue, then fix it.
5. **Build**: Run `npm run build`.
   - _Check_: Ensure the project compiles without TypeScript errors.
6. **Lint**: Run static analysis to check for errors.
   - `npm run lint` (Full Project Check). **Note:** Do not pass file paths, as `tsc` ignores `tsconfig.json` when files are specified.
7. **Format**: Run automated formatting:
   - Code: `npx prettier --write <FILE_PATH>` (Targeted) or `npx prettier --write .` (Full).
   - Markdown: `mdformat <FILE_PATH>` (Run this on any modified .md file).

## 4. Finalization

**🚨 NEVER PUSH**: Do **NOT** run `jj git push`. The user will handle pushing.

- **If Verified**:
  1. `jj commit -m "feat/fix: <description>"`
  1. `bd close <id> --reason "Implemented via sub-agent and verified."
- **If Failed**:
  **🚨 NEVER FIX CODE**: You are FORBIDDEN from making code changes.
  **🚨 NEVER CLOSE AS FAILED**: Beads does not support a "failed" state. Leave the task OPEN.
  1. **Re-Dispatch**: If the failure is directly related to the task, you must preserve the original instructions.
     - **Option A (Preferred)**: Create a new blocking task for the fix (e.g., "Fix TypeScript errors in <TASK_ID>").
     - **Option B (Comment)**: Add the error log as a comment using `bd comments add <TASK_ID> "..."`.
     ```bash
     # 1. Add failure log: bd comments add <TASK_ID> "## Failure Log\nTests failed..."
     # 2. Re-dispatch: run_shell_command("./scripts/dispatch_agent.sh <TASK_ID>")
     ```
  1. **New Task**: If the failure is a regression in an unrelated area or requires a separate fix, create a **P0 task** using `bd create` and schedule a sub-agent to fix it immediately.
  1. **Critical**: If the changes are fundamentally flawed, `jj undo` and re-plan. Keep the issue open, and comment on the problems encountered.

## New work

When user prompts with a bug or feature stop working on development follow the
instruction from PM.md.
