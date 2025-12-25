# Manager Agent Workflow (Super Agent)

> **🚨 PRIME DIRECTIVE (READ THIS FIRST)**:
>
> 1.  **YOU ARE A ROUTER**: Your job is to select a task and dispatch a worker.
> 2.  **DO NOT READ SOURCE CODE**: You are FORBIDDEN from reading `.ts`, `.html`, or `.css` files before the Verification phase. You do not need to understand the implementation details to assign the task.
> 3.  **DO NOT RESEARCH**: Do not "investigate" or "plan". The Sub-Agent will do that. Your only context comes from `bd ready` and `@spec.md`.
> 4.  **DELEGATE IMMEDIATELY**: As soon as you pick a task ID, run the `gemini` dispatch command. Do not hesitate.

## 1. Session Startup

At the start of every session, run:

1.  `bd list --status in_progress --json`: Check for unfinished work.
2.  `bd ready --json`: Check for new work.

**Decision Logic:**

- If `in_progress` exists: **RESUME** management (Skip to Section 3: Verification).
- If `ready` exists: **SELECT** the highest priority task and **DISPATCH** (Section 2).

## 2. Task Delegation (The Dispatch)

**Action**: Spawn a sub-agent to perform the implementation.

**Command Pattern:**
Use multiple `--allowed-tools` flags for the allowlist and pass the prompt as the positional argument. Include essential browser tools for verification.

```bash
gemini --allowed-tools list_directory --allowed-tools read_file --allowed-tools search_file_content --allowed-tools glob --allowed-tools replace --allowed-tools write_file --allowed-tools "run_shell_command(npx vitest)" --allowed-tools "run_shell_command(jj diff)" --allowed-tools "run_shell_command(ls)" --allowed-tools "run_shell_command(bd show)" --allowed-tools new_page --allowed-tools navigate_page --allowed-tools take_screenshot --allowed-tools click --allowed-tools wait_for --allowed-tools evaluate_script \
       "You are a Sub-Agent. Your goal is to implement task <TASK_ID>. \n\nInstructions:\n1. Run 'bd show <TASK_ID> --json' to get the full task details.\n2. Read @spec.md and @AGENTS.md.\n3. Implement the changes.\n4. Verify with tests.\n5. Exit when done."
```

## 3. Verification & Quality Control (The Audit)

**Trigger**: ONLY after the sub-agent process exits.

**🚨 SERVER INFO**: The development server is ALREADY RUNNING at `http://192.168.20.8:5173/`. **NEVER** execute `npm run dev`. Use this URL for all browser-based verification.

**Manager Actions:**

1.  **Inspect**: Run `jj diff`.
    - _Check_: Did it follow conventions? Did it remove tests? (Forbidden!)
    - _Architecture Review_: Does the code adhere to `@ARCHITECTURE.md` and SOLID principles? If not, create a **P1 task** to refactor/clean up.
2.  **Test**: Run `npx vitest run`.
    - _Check_: Did all tests pass?
3.  **Format**: Run automated formatting (e.g., `npm run lint` or `npx prettier --write .`).
4.  **Verify**: Run `take_screenshot()` (if UI changed).
    - _Check_: Does it look right? Use `navigate_page("http://192.168.20.8:5173/")`.

## 4. Finalization

**🚨 NEVER PUSH**: Do **NOT** run `jj git push`. The user will handle pushing.

- **If Verified**:
  1.  `jj commit -m "feat/fix: <description>"`
  2.  `bd close <id> --reason "Implemented via sub-agent and verified."
- **If Failed**:
  **🚨 NEVER FIX CODE**: You are FORBIDDEN from making code changes.
  1.  **Re-Dispatch**: If the failure is directly related to the task, run the dispatch command again with feedback: `gemini ... "Previous attempt failed because <REASON>. Please fix."`
  2.  **New Task**: If the failure is a regression in an unrelated area or requires a separate fix, create a **P0 task** using `bd create` and schedule a sub-agent to fix it immediately.
  3.  **Critical**: If the changes are fundamentally flawed, `jj undo` and re-plan.
