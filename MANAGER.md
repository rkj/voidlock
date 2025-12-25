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
    *   **Command**: `sh gemini --approval-mode auto_edit --instruction "@AGENTS.md" "Implement the following task: <Detailed Task Description>"`
3.  **Observation**: Manager monitors the sub-agent's output stream to track progress.

## 4. Verification & Quality Control
After a sub-agent exits, the Manager MUST:
1.  **Code Review**: Inspect changes using `jj diff` and `read_file`. Ensure adherence to @ARCHITECTURE.md.
2.  **Automated Testing**: Run the full project test suite: `npx vitest run`.
3.  **Visual Verification**: Use `take_screenshot()` for UI-impacting changes.
4.  **Integration Check**: Verify that the sub-agent correctly addressed the problem statement and acceptance criteria.

## 5. Finalization
*   **Success**: `bd close <id> --reason "..."` and `jj commit -m "..."`.
*   **Correction**: Fix minor issues directly or dispatch corrective instructions to a new sub-agent instance.
