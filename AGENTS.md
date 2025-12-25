# Instructions for AI Agents Working with Beads

> **🚨 CRITICAL MANDATE**: At the start of EVERY session, you MUST first run `bd list --status in_progress --json` to identify and resume work on tasks already in development. You are FORBIDDEN from running `bd ready` or starting new tasks until all `in_progress` items assigned to your role are either completed or clearly blocked.

> This file provides a quick overview and reference. For in-depth operational details (development, testing, releases, git workflow), consult the detailed instructions.

## Project Overview

This is Xenopurge, read @spec.md for details on the project.

### Issue Tracking

We use bd (beads) for issue tracking instead of Markdown TODOs or external tools.

## Task Classification & Delegation

To optimize model usage, tasks are classified by complexity. This helps determine which model (e.g., `gemini-3-flash` vs `gemini-3-pro`) should handle them.

**Labeling Workflow:**
*   Only "Pro" class models should perform the initial classification and labeling of tasks.
*   Use `bd update <id> --add-label complexity:<level>` to label tasks.

### CLI Quick Reference

**Essential commands for AI agents:**

```bash
# Find work
bd ready --json                                    # Unblocked issues
bd stale --days 30 --json                          # Forgotten issues

# Create and manage issues
bd create "Issue title" --description="Detailed context about the issue" -t bug|feature|task -p 0-4 --json
bd create "Found bug" --description="What the bug is and how it was discovered" -p 1 --deps discovered-from:<parent-id> --json
bd update <id> --status in_progress --json
bd close <id> --reason "Done" --json

# Search and filter
bd list --status open --priority 1 --json
bd list --label-any urgent,critical --json
bd show <id> --json
```

**AI agents**: Continue using CLI with `--json` flags. The monitor is for human supervision only.

### Workflow

1. **Check for ready work**: Run `bd ready` to see what's unblocked (or `bd stale` to find forgotten issues)
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Confirm spec.md contains all the details (or ask questions), Implement, test, document 
5. **Complete**: `bd close <id> --reason "Implemented"`

### IMPORTANT: Always Include Issue Descriptions

**Issues without descriptions lack context for future work.** When creating issues, always include a meaningful description with:

- **Why** the issue exists (problem statement or need)
- **What** needs to be done (scope and approach)
- **How** you discovered it (if applicable during work)

**Good examples:**

```bash
# Bug discovered during work
bd create "Fix auth bug in login handler" \
  --description="Login fails with 500 error when password contains special characters like quotes. Found while testing GH#123 feature. Stack trace shows unescaped SQL in auth/login.go:45." \
  -t bug -p 1 --deps discovered-from:bd-abc --json

# Feature request
bd create "Add password reset flow" \
  --description="Users need ability to reset forgotten passwords via email. Should follow OAuth best practices and include rate limiting to prevent abuse." \
  -t feature -p 2 --json

# Technical debt
bd create "Refactor auth package for testability" \
  --description="Current auth code has tight DB coupling making unit tests difficult. Need to extract interfaces and add dependency injection. Blocks writing tests for bd-xyz." \
  -t task -p 3 --json
```

**Bad examples (missing context):**

```bash
bd create "Fix auth bug" -t bug -p 1 --json  # What bug? Where? Why?
bd create "Add feature" -t feature --json     # What feature? Why needed?
bd create "Refactor code" -t task --json      # What code? Why refactor?
```

### Issue Types

- `bug` - Something broken that needs fixing
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature composed of multiple issues (supports hierarchical children)
- `chore` - Maintenance work (dependencies, tooling)

**Hierarchical children:** Epics can have child issues with dotted IDs (e.g., `bd-a3f8e9.1`, `bd-a3f8e9.2`). Children are auto-numbered sequentially. Up to 3 levels of nesting supported. The parent hash ensures unique namespace - no coordination needed between agents working on different epics.

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (nice-to-have features, minor bugs)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Dependency Types

- `blocks` - Hard dependency (issue X blocks issue Y)
- `related` - Soft relationship (issues are connected)
- `parent-child` - Epic/subtask relationship
- `discovered-from` - Track issues discovered during work (automatically inherits parent's `source_repo`)

Only `blocks` dependencies affect the ready work queue.

**Note:** When creating an issue with a `discovered-from` dependency, the new issue automatically inherits the parent's `source_repo` field. This ensures discovered work stays in the same repository as the parent task.

### Planning Work with Dependencies

When breaking down large features into tasks, use **beads dependencies** to sequence work - NOT phases or numbered steps.

**⚠️ COGNITIVE TRAP: Temporal Language Inverts Dependencies**

Words like "Phase 1", "Step 1", "first", "before" trigger temporal reasoning that **flips dependency direction**. Your brain thinks:
- "Phase 1 comes before Phase 2" → "Phase 1 blocks Phase 2" → `bd dep add phase1 phase2`

But that's **backwards**! The correct mental model:
- "Phase 2 **depends on** Phase 1" → `bd dep add phase2 phase1`

**Solution: Use requirement language, not temporal language**

Instead of phases, name tasks by what they ARE, and think about what they NEED:

```bash
# ❌ WRONG - temporal thinking leads to inverted deps
bd create "Phase 1: Create buffer layout" ...
bd create "Phase 2: Add message rendering" ...
bd dep add phase1 phase2  # WRONG! Says phase1 depends on phase2

# ✅ RIGHT - requirement thinking
bd create "Create buffer layout" ...
bd create "Add message rendering" ...
bd dep add msg-rendering buffer-layout  # msg-rendering NEEDS buffer-layout
```

**Verification**: After adding deps, run `bd blocked` - tasks should be blocked by their prerequisites, not their dependents.

**Example breakdown** (for a multi-part feature):
```bash
# Create tasks named by what they do, not what order they're in
bd create "Implement conversation region" -t task -p 1
bd create "Add header-line status display" -t task -p 1
bd create "Render tool calls inline" -t task -p 2
bd create "Add streaming content support" -t task -p 2

# Set up dependencies: X depends on Y means "X needs Y first"
bd dep add header-line conversation-region    # header needs region
bd dep add tool-calls conversation-region     # tools need region
bd dep add streaming tool-calls               # streaming needs tools

# Verify with bd blocked - should show sensible blocking
bd blocked
```

### Duplicate Detection & Merging

AI agents should proactively detect and merge duplicate issues to keep the database clean:

**Automated duplicate detection:**

```bash
# Find all content duplicates in the database
bd duplicates

# Automatically merge all duplicates
bd duplicates --auto-merge

# Preview what would be merged
bd duplicates --dry-run

# During import
bd import -i issues.jsonl --dedupe-after
```

**Detection strategies:**

1. **Before creating new issues**: Search for similar existing issues

   ```bash
   bd list --json | grep -i "authentication"
   bd show bd-41 bd-42 --json  # Compare candidates
   ```

2. **Periodic duplicate scans**: Review issues by type or priority

   ```bash
   bd list --status open --priority 1 --json  # High-priority issues
   bd list --issue-type bug --json             # All bugs
   ```

3. **During work discovery**: Check for duplicates when filing discovered-from issues
   ```bash
   # Before: bd create "Fix auth bug" --description="Details..." --deps discovered-from:bd-100
   # First: bd list --json | grep -i "auth bug"
   # Then decide: create new or link to existing
   ```

**Merge workflow:**

```bash
# Step 1: Identify duplicates (bd-42 and bd-43 duplicate bd-41)
bd show bd-41 bd-42 bd-43 --json

# Step 2: Preview merge to verify
bd merge bd-42 bd-43 --into bd-41 --dry-run

# Step 3: Execute merge
bd merge bd-42 bd-43 --into bd-41 --json

# Step 4: Verify result
bd dep tree bd-41  # Check unified dependency tree
bd show bd-41 --json  # Verify merged content
```

**What gets merged:**

- ✅ All dependencies from source → target
- ✅ Text references updated across ALL issues (descriptions, notes, design, acceptance criteria)
- ✅ Source issues closed with "Merged into bd-X" reason
- ❌ Source issue content NOT copied (target keeps its original content)

**Important notes:**

- Merge preserves target issue completely; only dependencies/references migrate
- If source issues have valuable content, manually copy it to target BEFORE merging
- Cannot merge in daemon mode yet (bd-190); use `--no-daemon` flag
- Operation cannot be undone (but git history preserves the original)

**Best practices:**

- Merge early to prevent dependency fragmentation
- Choose the oldest or most complete issue as merge target
- Add labels like `duplicate` to source issues before merging (for tracking)
- File a discovered-from issue if you found duplicates during work:
  ```bash
  bd create "Found duplicates during bd-X" \
    --description="Issues bd-A, bd-B, and bd-C are duplicates and need merging" \
    -p 2 --deps discovered-from:bd-X --json
  ```

# Agent & Developer Guidelines

## G1) Agent Workflow Instructions
* **🚨🚨🚨 NEVER RUN `bd sync` 🚨🚨🚨**: The `bd sync` command is strictly forbidden in this repository. It interferes with the `jj` (Jujutsu) workflow and causes database synchronization/prefix issues.
* **🚨🚨🚨 ONE TASK AT A TIME 🚨🚨🚨**: Unless explicitly specified otherwise, the agent MUST perform exactly ONE Beads task per turn cycle (implement, verify, commit) and then ask the user for instruction on what to do next. **DO NOT START A NEW TASK WITHOUT USER DIRECT INPUT.**
* **Interrupted Requests**: If the user provides a Feature Request (FR) or reports a Bug while another task is `in_progress`, the agent MUST record the request in Beads (create issue) and then immediately resume the current task. Do not update the spec or implement the new request until the current task is complete and the user explicitly instructs to start the new one.
* **🚨🚨🚨 NEVER REMOVE TESTS 🚨🚨🚨**: Their purpose is to catch regressions. Do not remove any tests from the codebase unless explicitly asked to do so by the user.
* **Clarification First:** When a new change request is received, you must first update `spec.md` with the new clarification/requirement.
* **Task Creation:** After updating the spec, create a Beads task for the requested change.
* **Implementation:** Only after the above steps are completed should you proceed with code implementation.
* **Strict Verification:** A task is **NEVER** considered complete unless `npx vitest run` passes successfully. You must run the full test suite before marking a task as done.
* **Version Control:**
    * Use `jj` (Jujutsu) commands exclusively.
    * **NEVER** use `git` commands directly.
    * Commit changes after the completion of *every* Beads task.
    * **`jj commit` Behavior Clarification:** The `jj commit` command intentionally places the working copy in a new, empty commit on top of the changes. This is the correct and desired behavior, and agents must not attempt to `abandon`, create new branches, or otherwise interfere with this workflow. Simply continue working, and `jj` will manage the changes. Consult [A Short Guide to Jujutsu (jj) for Git Users](https://www.paped.com/guides/a-short-guide-to-jujutsu-jj-for-git-users/) before performing any `jj` operation other than `commit`.
* **No Pushes:** Do not push changes to remote without explicit user instruction.
* **Dev Server:** Do not run `npm run dev`. Assume the user manages the server.
* **Visual Verification (Screenshots):** After completing major tasks involving UI changes or visual output, take a screenshot for visual verification. Use `navigate_page` to ensure the correct page is loaded, `run_shell_command('sleep 10')` to allow the page to fully render, and then `take_screenshot()` to capture the visual state. Critically, **always review the captured screenshot** to ensure the visual output matches expectations.
* **Avoid Duplication:** Do not duplicate helper functions or test logic across multiple files. Create shared utility files (e.g., `src/engine/tests/utils/`) and import them. If you see duplication, refactor it.

## G2) Testing Strategy

* **🚨🚨🚨 NEVER REMOVE TESTS 🚨🚨🚨**: Their purpose is to catch regressions. Do not remove any tests from the codebase unless explicitly asked to do so by the user (e.g., if a feature was removed from the spec). If a test is failing, fix the code or update the test to match the new behavior, but do not delete it.

*   **Unit Test First:** For core mechanics (Grid, Pathfinder, LOS), write tests before implementation.

*   **Non-Interactive:** Run tests using `npx vitest run`. Never use watch mode.
* **Micro-Maps:** Define small, fixed JSON `MapDefinition`s directly within tests (e.g., 2x2 grids) to cover specific scenarios:
    * Paths blocked by walls/doors.
    * Complex shared-wall configurations.
* **Recursion Guard:** If `Maximum call stack size exceeded` occurs, dump the Pathfinding grid state to JSON immediately for analysis.

## G3) Visual Debugging & Feedback
* **Game Access URL**: The game is accessible at `http://192.168.20.8:5173/`. This URL should be used for all browser interactions.
* **Visual Verification**: Use `take_screenshot()` to inspect the rendered state of the game, including the Canvas.
* **User Feedback**: When reporting visual issues, the user must provide text descriptions (e.g., "Door at 3,4 is yellow but soldier walked through it").
* **Map Viewer App:**
    * Use the standalone Map Viewer (milestone M15 in spec) to verify map generation logic if available.
    * If the Map Viewer is not built, rely on console logs of the `MapDefinition` JSON.

## G5) Feature/Task Completion Checklist
When finishing a feature or a Beads task, you MUST perform the following steps in order:
1.  **Strict Verification**: Execute `npx vitest run`. All tests MUST pass. A task is not complete if tests are failing.
2.  **Visual Verification**: For any UI or rendering changes, navigate to the game URL, take a screenshot, and **carefully review it** to ensure the visual state matches expectations.
3.  **Versioning (Strict SemVer)**:
    *   Check the current version in `package.json`.
    *   **Features:** If the task added new functionality, increment the **MINOR** version (e.g., 0.1.0 -> 0.2.0).
    *   **Bug Fixes/Tasks:** If the task was a bug fix or refactor, increment the **PATCH** version (e.g., 0.1.0 -> 0.1.1).
    *   Update `package.json` with the new version.
4.  **Task Closure**: Close the task in Beads using `bd close <id> --reason "Detailed explanation of work done"`.
5.  **Commit**: Record the changes using `jj commit -m "Your descriptive message"`.
6.  **No Pushes**: Never push to the remote repository unless explicitly instructed by the user.

