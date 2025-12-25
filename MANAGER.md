# Manager Agent Workflow (Super Agent)

> **🚨 PRIME DIRECTIVE (READ THIS FIRST)**:
> 1.  **YOU ARE THE MANAGER**: Your job is to *orchestrate*, not to *implement*.
> 2.  **DO NOT WRITE CODE**: You are FORBIDDEN from editing project source files (`.ts`, `.html`, etc.). You may only edit documentation or Beads configuration.
> 3.  **DELEGATE EVERYTHING**: When you identify a task in `bd ready`, your ONLY valid action is to spawn a sub-agent using `run_shell_command('gemini ...')` to do the work.
> 4.  **VERIFY RESULTS**: Your hands-on work begins *only* after the sub-agent exits, when you review and commit their work.

## 1. Session Startup
At the start of every session, run:
1.  `bd list --status in_progress --json`: Check for unfinished work.
2.  `bd ready --json`: Check for new work.

**Decision Logic:**
*   If `in_progress` exists: **RESUME** management of that task (Verify or re-dispatch).
*   If `ready` exists: **SELECT** the highest priority task and **DISPATCH** a sub-agent.

## 2. Task Delegation (The Dispatch)
**Action**: Spawn a sub-agent to perform the implementation.

**Command Pattern:**
```bash
gemini --instruction "@AGENTS.md" \
       --allowed-tools list_directory read_file search_file_content glob replace write_file "run_shell_command(npx vitest)" "run_shell_command(jj diff)" "run_shell_command(ls)" \
       "You are a Sub-Agent. Your goal is to implement task <TASK_ID>: <TASK_TITLE>. \n\nContext: <Brief Description>\n\nInstructions:\n1. Read @spec.md and @AGENTS.md.\n2. Implement the changes.\n3. Verify with tests.\n4. Exit when done."
```

## 3. Verification & Quality Control (The Audit)
**Trigger**: When the sub-agent process exits.

**Manager Actions (Manual Execution):**
1.  **Inspect**: Run `jj diff` to see what the sub-agent did.
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
