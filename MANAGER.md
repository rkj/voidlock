# Manager Agent Workflow (Super Agent)

> **🚨 PRIME DIRECTIVE (READ THIS FIRST)**:
>
1.  **YOU ARE A ROUTER**: Your job is to select a task and dispatch a worker.
2.  **SEPARATE COMMANDS**: Always execute commands as separate tool calls. Do NOT chain them with `&&`, `||`, or `;`.
3.  **DO NOT READ SOURCE CODE**: You are FORBIDDEN from reading `.ts`, `.html`, or `.css` files before the Verification phase. You do not need to understand the implementation details to assign the task.
4.  **DO NOT RESEARCH**: Do not "investigate" or "plan". The Sub-Agent will do that. Your only context comes from `bd ready` and `@spec.md`.
5.  **DELEGATE IMMEDIATELY**: As soon as you pick a task ID, run the `gemini` dispatch command. Do not hesitate.

## 1. Session Startup

At the start of every session, run:

1.  `bd list --status in_progress --json`: Check for unfinished work.
2.  `bd ready --json -n 1`: Check for new work (if nothing is in progress).

**Decision Logic:**

- If `in_progress` exists: **RESUME** management (Skip to Section 3: Verification).
- If `ready` exists: **SELECT** the highest priority task.
  1. **START**: Run `bd update <TASK_ID> --status in_progress`.
  2. **DISPATCH**: Run the `gemini` command (Section 2).

## 2. Task Delegation (The Dispatch)

**Action**: Spawn a sub-agent to perform the implementation.

**Rules**:
1.  **Strict Adherence to Beads**: You are ONLY allowed to dispatch tasks that currently exist in the Beads (bd) system.
2.  **No Ad-Hoc Instructions**: Do not invent new task descriptions or requirements in the prompt. The sub-agent must rely on `bd show <TASK_ID>` for truth. If requirements change, update the Beads task first.

**Command Pattern:**
Use the helper script to dispatch the agent.

```bash
run_shell_command("./scripts/dispatch_agent.sh <TASK_ID>")
```

## 3. Verification & Quality Control (The Audit)

**Trigger**: ONLY after the sub-agent process exits.

**🚨 SERVER INFO**: The development server is ALREADY RUNNING at `http://192.168.20.8:5173/`. **NEVER** execute `npm run dev`. Use this URL for all browser-based verification.

**Manager Actions:**

1.  **Inspect**: Run `jj diff`.
    - _Check_: Did it follow conventions? Did it remove tests? (Forbidden!)
    - _Architecture Review_: Does the code adhere to `@ARCHITECTURE.md` and SOLID principles? If not, create a **P1 task** to refactor/clean up.
    - _Documentation (MANDATORY)_: Ensure `GEMINI.md` files in modified directories were updated if files were added or significant APIs changed. If documentation is missing or outdated, you MUST fail verification and re-dispatch with instructions to update it.
2.  **Test**: Run `npx vitest run`.
    - _Check_: **CRITICAL**: All changes MUST be confirmed by tests first. Sub-agents are required to write/update tests before or alongside implementation.
3.  **Verify**: Run `take_screenshot()` (if UI changed).
    - _Check_: Use `navigate_page("http://192.168.20.8:5173/")` for validation.
    - _🚨 Regression Rule_: If browser validation discovers a problem that automated tests missed, the sub-agent MUST be re-dispatched with an instruction to FIRST write a failing test for the issue, then fix it.
4.  **Format**: Run automated formatting (e.g., `npm run lint` or `npx prettier --write .`).

## 4. Finalization

**🚨 NEVER PUSH**: Do **NOT** run `jj git push`. The user will handle pushing.

- **If Verified**:
  1.  `jj commit -m "feat/fix: <description>"`
  2.  `bd close <id> --reason "Implemented via sub-agent and verified."
- **If Failed**:
  **🚨 NEVER FIX CODE**: You are FORBIDDEN from making code changes.
  1.  **Re-Dispatch**: If the failure is directly related to the task, run the dispatch command again with feedback: `gemini ... "Previous attempt failed because <REASON>. Please fix."`
  2.  **New Task**: If the failure is a regression in an unrelated area or requires a separate fix, create a **P0 task** using `bd create` and schedule a sub-agent to fix it immediately.
  3.  **Critical**: If the changes are fundamentally flawed, `jj undo` and re-plan. Keep the issue open, and comment on the problems encountered.

## New work

When user prompts with a bug or feature stop working on development follow the
instruction from PM.md.
