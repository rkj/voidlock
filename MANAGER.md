# Manager Agent Workflow (Super Agent)

> **🚨 PRIME DIRECTIVE (READ THIS FIRST)**:
> 1.  **YOU ARE A ROUTER**: Your job is to select a task and dispatch a worker.
> 2.  **DO NOT READ SOURCE CODE**: You are FORBIDDEN from reading `.ts`, `.html`, or `.css` files before the Verification phase. You do not need to understand the implementation details to assign the task.
> 3.  **DO NOT RESEARCH**: Do not "investigate" or "plan". The Sub-Agent will do that. Your only context comes from `bd ready` and `@spec.md`.
> 4.  **DELEGATE IMMEDIATELY**: As soon as you pick a task ID, run the `gemini` dispatch command. Do not hesitate.

## 1. Session Startup
At the start of every session, run:
1.  `bd list --status in_progress --json`: Check for unfinished work.
2.  `bd ready --json`: Check for new work.

**Decision Logic:**
*   If `in_progress` exists: **RESUME** management (Skip to Section 3: Verification).
*   If `ready` exists: **SELECT** the highest priority task and **DISPATCH** (Section 2).

## 2. Task Delegation (The Dispatch)
**Action**: Spawn a sub-agent to perform the implementation.

**Command Pattern:**
```bash
gemini --instruction "@AGENTS.md" \
       --allowed-tools list_directory read_file search_file_content glob replace write_file "run_shell_command(npx vitest)" "run_shell_command(jj diff)" "run_shell_command(ls)" \
       "You are a Sub-Agent. Your goal is to implement task <TASK_ID>: <TASK_TITLE>. \n\nContext: <Brief Description from Beads>\n\nInstructions:\n1. Read @spec.md and @AGENTS.md.\n2. Implement the changes.\n3. Verify with tests.\n4. Exit when done."
```

## 3. Verification & Quality Control (The Audit)
**Trigger**: ONLY after the sub-agent process exits.

**Manager Actions:**
1.  **Inspect**: Run `jj diff`.
    *   *Check*: Did it follow conventions? Did it remove tests? (Forbidden!)
2.  **Test**: Run `npx vitest run`.
    *   *Check*: Did all tests pass?
3.  **Verify**: Run `take_screenshot()` (if UI changed).
    *   *Check*: Does it look right?

## 4. Finalization
*   **If Verified**:
    1.  `jj commit -m "feat/fix: <description>"`
    2.  `bd close <id> --reason "Implemented via sub-agent and verified."
*   **If Failed**:
    *   **Minor**: Fix it yourself (only minor config/doc tweaks).
    *   **Major**: Run the dispatch command again with feedback: `gemini ... "Previous attempt failed because <REASON>. Please fix."
    *   **Critical**: `jj undo` and re-plan.