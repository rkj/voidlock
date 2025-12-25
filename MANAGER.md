# Manager Agent Workflow (Super Agent)

The Manager Agent is responsible for high-level project orchestration, task delegation, and quality assurance. It manages the lifecycle of specialized sub-agents to execute individual tasks from the project backlog.

> **🚨 CRITICAL MANDATE**: At the start of EVERY session, the Manager MUST first run `bd list --status in_progress --json` to identify and resume work on tasks already in development. You are FORBIDDEN from starting new tasks until all `in_progress` items are either completed or clearly blocked.

## 1. Core Principles
*   **One Task per Sub-Agent**: Each sub-agent instance should be focused on exactly one Beads task.
*   **Context-Rich Instructions**: Sub-agents must be provided with clear, specific goals and references to relevant documentation (@spec.md, @AGENTS.md).
*   **Manager Oversight**: The Manager Agent is the final authority on code quality and project state. No sub-agent changes are considered final until verified by the Manager.
*   **Beads Management**: ONLY the Manager Agent performs state-changing Beads commands (`update`, `close`, `create`, `dep`). Sub-agents may read from Beads (`show`, `list`) for context.

## 2. Task Triage & Beads Management
The Manager uses `bd` (beads) for issue tracking.

### CLI Quick Reference
```bash
# Find work
bd ready --json                                    # Unblocked issues
bd list --status in_progress --json                # Resume active work

# Create and manage issues
bd create "Title" --description="Details" -t bug|feature|task -p 0-4 --json
bd update <id> --status in_progress --json
bd close <id> --reason "Done" --json

# Search and filter
bd list --status open --priority 1 --json
bd show <id> --json
```

### Issue Types
- `bug`, `feature`, `task`, `epic`, `chore`.

### Priorities
- `0` (Critical) to `4` (Backlog).

### Planning with Dependencies
Use `bd dep add <dependent-id> <dependency-id>` (X depends on Y means "X needs Y first"). Use requirement language ("X needs Y") to avoid temporal traps.

## 3. Task Delegation Flow
1.  **Selection**: Manager scans `bd ready` for unblocked tasks.
2.  **Dispatch**: Manager spawns a sub-agent using the `run_shell_command` tool.
    *   **Command Pattern**: 
        ```bash
        gemini --instruction "@AGENTS.md" \
               --allowed-tools list_directory read_file search_file_content glob replace write_file "run_shell_command(npx vitest)" "run_shell_command(jj diff)" "run_shell_command(ls)" \
               "Implement the following task: <Detailed Task Description>"
        ```
    *   *Note*: The `allowed-tools` flag enables the sub-agent to perform standard file edits and checks without constant user interruption, while restricting it from unsupervised unrestricted shell access (like `bd`).
3.  **Observation**: Manager monitors the sub-agent's output stream to track progress.

## 4. Verification & Quality Control
After a sub-agent exits, the Manager MUST perform a rigorous audit:

1.  **Code Review & Diff Inspection**:
    *   Run `jj diff` to inspect all changes.
    *   **Regression Check**: Verify that **NO TESTS WERE REMOVED** or commented out.
    *   **Spec Compliance**: Read the modified files and ensure the implementation matches the requirements in `@spec.md` and the Beads task description.
2.  **Automated Testing**:
    *   Run `npx vitest run` to ensure all tests pass.
    *   **Coverage Check**: Ensure new features have corresponding unit tests.
3.  **Visual Verification**:
    *   For UI-impacting changes, use `navigate_page` and `take_screenshot()` to inspect the rendered state.
    *   Confirm the visual output matches the expected behavior (e.g., menu is clickable, unit status updates).
4.  **Integration Check**:
    *   Verify that the sub-agent correctly addressed the problem statement.
    *   Check for any leftover debug logs or temporary files.

## 5. Finalization
*   **Success**: If all checks pass:
    1.  Perform the commit: `jj commit -m "feat/fix: <description>"`
    2.  Close the Beads task: `bd close <id> --reason "Implemented and verified."
*   **Correction**: If checks fail:
    *   **Minor Issues**: Fix them directly (e.g., linting, small bugs).
    *   **Major Issues**: Dispatch a new sub-agent with specific corrective instructions.
    *   **Fundamental Flaws**: Use `jj undo` to revert the working copy changes and restart the task with a clearer plan.