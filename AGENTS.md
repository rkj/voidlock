# Instructions for AI Agents Working on Beads

> **📖 For detailed development instructions**, see [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md)
>
> This file provides a quick overview and reference. For in-depth operational details (development, testing, releases, git workflow), consult the detailed instructions.

## Project Overview

This is **beads** (command: `bd`), an issue tracker designed for AI-supervised coding workflows. We dogfood our own tool!

> **🤖 Using GitHub Copilot?** See [.github/copilot-instructions.md](.github/copilot-instructions.md) for a concise, Copilot-optimized version of these instructions that GitHub Copilot will automatically load.

## 🆕 What's New?

**New to bd or upgrading?** Run `bd info --whats-new` to see agent-relevant changes from recent versions:

```bash
bd info --whats-new          # Human-readable output
bd info --whats-new --json   # Machine-readable output
```

This shows the last 3 versions with workflow-impacting changes, avoiding the need to re-read all documentation. Examples:
- New commands and flags that improve agent workflows
- Breaking changes that require workflow updates
- Performance improvements and bug fixes
- Integration features (MCP, Agent Mail, git hooks)

**Why this matters:** bd releases weekly with major versions. This command helps you quickly understand what changed without parsing the full CHANGELOG.

### 🔄 After Upgrading bd

When bd is upgraded to a new version, follow this workflow:

```bash
# 1. Check what changed
bd info --whats-new

# 2. Update git hooks to match new bd version
bd hooks install

# 3. Regenerate BD_GUIDE.md if it exists (optional but recommended)
bd onboard --output .beads/BD_GUIDE.md

# 4. Check for any outdated hooks (optional)
bd info  # Shows warnings if hooks are outdated
```

**Why update hooks?** Git hooks (pre-commit, post-merge, pre-push) are versioned with bd. Outdated hooks may miss new auto-sync features or bug fixes. Running `bd hooks install` ensures hooks match your bd version.

**About BD_GUIDE.md:** This is an optional auto-generated file that separates bd-specific instructions from project-specific ones. If your project uses this file (in `.beads/BD_GUIDE.md`), regenerate it after upgrades to get the latest bd documentation. The file is version-stamped and should never be manually edited.

**Related:** See GitHub Discussion #239 for background on agent upgrade workflows.

## Human Setup vs Agent Usage

**IMPORTANT:** If you need to initialize bd, use the `--quiet` flag:

```bash
bd init --quiet  # Non-interactive, auto-installs git hooks, no prompts
```

**Why `--quiet`?** Regular `bd init` has interactive prompts (git hooks, merge driver) that confuse agents. The `--quiet` flag makes it fully non-interactive:

- Automatically installs git hooks
- Automatically configures git merge driver for intelligent JSONL merging
- No prompts for user input
- Safe for agent-driven repo setup

**If the human already initialized:** Just use bd normally with `bd create`, `bd ready`, `bd update`, `bd close`, etc.

**If you see "database not found":** Run `bd init --quiet` yourself, or ask the human to run `bd init`.

### Issue Tracking

We use bd (beads) for issue tracking instead of Markdown TODOs or external tools.

## Task Classification & Delegation

To optimize model usage, tasks are classified by complexity. This helps determine which model (e.g., `gemini-2.5-flash` vs `gemini-1.5-pro`) should handle them.

*   **Easy (`complexity:easy`)**: Self-contained tasks, minor UI tweaks, simple logic changes, well-defined inputs/outputs.
    *   *Delegate to:* `gemini-2.5-flash` (or equivalent efficient model).
*   **Medium (`complexity:medium`)**: Localized feature implementation, interactions between 2-3 components, standard refactoring.
    *   *Delegate to:* `gemini-2.5-flash` for execution, potentially `gemini-1.5-pro` for initial planning if ambiguous.
*   **Hard (`complexity:hard`)**: System-wide architectural changes, complex algorithms (pathfinding, procedural generation), vague requirements, debugging race conditions/determinism.
    *   *Delegate to:* `gemini-1.5-pro` (or equivalent reasoning-strong model).

**Labeling Workflow:**
*   Only "Pro" class models should perform the initial classification and labeling of tasks.
*   Use `bd update <id> --add-label complexity:<level>` to label tasks.

### CLI + Hooks (Recommended)

**RECOMMENDED**: Use the `bd` CLI with hooks for the best experience. This approach:

- **Minimizes context usage** - Only injects ~1-2k tokens via `bd prime` vs MCP tool schemas
- **Reduces compute cost** - Less tokens = less processing per request
- **Lower latency** - Direct CLI calls are faster than MCP protocol overhead
- **More sustainable** - Every token has compute/energy cost; lean prompts are greener
- **Universal** - Works with any AI assistant, not just MCP-compatible ones

**Setup (one-time):**

```bash
# Install bd CLI (see docs/INSTALLING.md)
brew install bd  # or other methods

# Initialize in your project
bd init --quiet

# Install hooks for automatic context injection
bd hooks install
```

**How it works:**

1. **SessionStart hook** runs `bd prime` automatically when Claude Code starts
2. `bd prime` injects a compact workflow reference (~1-2k tokens)
3. You use `bd` CLI commands directly (no MCP layer needed)
4. Git hooks auto-sync the database with JSONL

**Why context minimization matters:**

Even with 200k+ context windows, minimizing context is important:
- **Compute cost scales with tokens** - More context = more expensive inference
- **Latency increases with context** - Larger prompts take longer to process
- **Energy consumption** - Every token has environmental impact
- **Attention quality** - Models attend better to smaller, focused contexts

A 50k token MCP schema consumes the same compute whether you use those tools or not. The CLI approach keeps your context lean and focused.

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

# Sync (CRITICAL at end of session!)
bd sync  # Force immediate export/commit/push
```

**For comprehensive CLI documentation**, see [docs/CLI_REFERENCE.md](docs/CLI_REFERENCE.md).

### MCP Server (Alternative)

For Claude Desktop, Sourcegraph Amp, or other MCP-only environments where CLI access is limited, use the MCP server:

```bash
pip install beads-mcp
```

Add to MCP config:
```json
{
  "beads": {
    "command": "beads-mcp",
    "args": []
  }
}
```

**When to use MCP:**
- ✅ Claude Desktop (no shell access)
- ✅ MCP-only environments
- ✅ Environments where CLI is unavailable

**When to prefer CLI + hooks:**
- ✅ Claude Code, Cursor, Windsurf, or any environment with shell access
- ✅ When context efficiency matters (most cases)
- ✅ Multi-editor workflows (CLI is universal)

See `integrations/beads-mcp/README.md` for MCP documentation. For multi-repo MCP patterns, see [docs/MULTI_REPO_AGENTS.md](docs/MULTI_REPO_AGENTS.md).

### Import Configuration

bd provides configuration for handling edge cases during import, especially when dealing with hierarchical issues and deleted parents:

```bash
# Configure orphan handling for imports
bd config set import.orphan_handling "allow"      # Default: import orphans without validation
bd config set import.orphan_handling "resurrect"  # Auto-resurrect deleted parents as tombstones
bd config set import.orphan_handling "skip"       # Skip orphaned children with warning
bd config set import.orphan_handling "strict"     # Fail if parent is missing
```

**Modes explained:**

- **`allow` (default)** - Import orphaned children without parent validation. Most permissive, ensures no data loss even if hierarchy is temporarily broken.
- **`resurrect`** - Search JSONL history for deleted parents and recreate them as tombstones (Status=Closed, Priority=4). Preserves hierarchy with minimal data.
- **`skip`** - Skip orphaned children with a warning. Partial import succeeds but some issues are excluded.
- **`strict`** - Fail import immediately if a child's parent is missing. Use when database integrity is critical.

**When to use each mode:**

- Use `allow` (default) for daily imports and auto-sync - ensures no data loss
- Use `resurrect` when importing from another database that had parent deletions
- Use `strict` only for controlled imports where you need to guarantee parent existence
- Use `skip` rarely - only when you want to selectively import a subset

**Override per command:**
```bash
bd import -i issues.jsonl --orphan-handling resurrect  # One-time override
bd sync  # Uses import.orphan_handling config setting
```

See [docs/CONFIG.md](docs/CONFIG.md) for complete configuration documentation.

### Managing Daemons

bd runs a background daemon per workspace for auto-sync and RPC operations:

```bash
bd daemons list --json          # List all running daemons
bd daemons health --json        # Check for version mismatches
bd daemons logs . -n 100        # View daemon logs
bd daemons killall --json       # Restart all daemons
```

**After upgrading bd**: Run `bd daemons killall` to restart all daemons with new version.

### Event-Driven Daemon Mode (Experimental)

**NEW in v0.16+**: Event-driven mode replaces 5-second polling with instant reactivity (<500ms latency, 60% less CPU).

**Enable globally:**
```bash
export BEADS_DAEMON_MODE=events
bd daemons killall  # Restart daemons to apply
```

**For configuration, troubleshooting, and complete daemon management**, see [docs/DAEMON.md](docs/DAEMON.md).

### Web Interface (Monitor)

bd includes a built-in web interface for human visualization:

```bash
bd monitor                  # Start on localhost:8080
bd monitor --port 3000      # Custom port
```

**AI agents**: Continue using CLI with `--json` flags. The monitor is for human supervision only.

### Workflow

1. **Check for ready work**: Run `bd ready` to see what's unblocked (or `bd stale` to find forgotten issues)
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work**: If you find bugs or TODOs, create issues:
   - Old way (two commands): `bd create "Found bug in auth" --description="Details about the bug" -t bug -p 1 --json` then `bd dep add <new-id> <current-id> --type discovered-from`
   - New way (one command): `bd create "Found bug in auth" --description="Login fails with 500 when password has special chars" -t bug -p 1 --deps discovered-from:<current-id> --json`
5. **Complete**: `bd close <id> --reason "Implemented"`
6. **Sync at end of session**: `bd sync` (see "Agent Session Workflow" below)

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

### Optional: Agent Mail for Multi-Agent Coordination

**⚠️ NOT CURRENTLY CONFIGURED** - The mcp-agent-mail server is not set up for this project. Do not attempt to use mcp-agent-mail tools.

**For multi-agent workflows only** - if multiple AI agents work on the same repository simultaneously, consider using Agent Mail for real-time coordination:

**With Agent Mail enabled:**
```bash
# Configure environment (one-time per session)
export BEADS_AGENT_MAIL_URL=http://127.0.0.1:8765
export BEADS_AGENT_NAME=assistant-alpha
export BEADS_PROJECT_ID=my-project

# Workflow (identical commands)
bd ready                                    # Shows available work
bd update bd-42 --status in_progress       # Reserves issue instantly (<100ms)
# ... work on issue ...
bd close bd-42 "Done"                       # Releases reservation automatically
```

**Without Agent Mail (git-only mode):**
```bash
# No environment variables needed
bd ready                                    # Shows available work
bd update bd-42 --status in_progress       # Updates via git sync (2-5s latency)
# ... work on issue ...
bd close bd-42 "Done"                       # Updates via git sync
```

**Key differences:**
- **Latency**: <100ms (Agent Mail) vs 2-5s (git-only)
- **Collision prevention**: Instant reservation (Agent Mail) vs eventual consistency (git)
- **Setup**: Requires server + env vars (Agent Mail) vs zero config (git-only)

**When to use Agent Mail:**
- ✅ Multiple agents working concurrently
- ✅ Frequent status updates (high collision risk)
- ✅ Real-time coordination needed

**When to skip:**
- ✅ Single agent workflows
- ✅ Infrequent updates (low collision risk)
- ✅ Simplicity preferred over latency

See [docs/AGENT_MAIL_QUICKSTART.md](docs/AGENT_MAIL_QUICKSTART.md) for 5-minute setup, or [docs/AGENT_MAIL.md](docs/AGENT_MAIL.md) for complete documentation. Example code in [examples/python-agent/AGENT_MAIL_EXAMPLE.md](examples/python-agent/AGENT_MAIL_EXAMPLE.md).

### Deletion Tracking

When issues are deleted (via `bd delete` or `bd cleanup`), they are recorded in `.beads/deletions.jsonl`. This manifest:

- **Propagates deletions across clones**: When you pull, deleted issues from other clones are removed from your local database
- **Provides audit trail**: See what was deleted, when, and by whom with `bd deleted`
- **Auto-prunes**: Old records are automatically cleaned up during `bd sync` (configurable retention)

**Commands:**

```bash
bd delete bd-42                # Delete issue (records to manifest)
bd cleanup -f                  # Delete closed issues (records all to manifest)
bd deleted                     # Show recent deletions (last 7 days)
bd deleted --since=30d         # Show deletions in last 30 days
bd deleted bd-xxx              # Show deletion details for specific issue
bd deleted --json              # Machine-readable output
```

**How it works:**

1. `bd delete` or `bd cleanup` appends deletion records to `deletions.jsonl`
2. The file is committed and pushed via `bd sync`
3. On other clones, `bd sync` imports the deletions and removes those issues from local DB
4. Git history fallback handles edge cases (pruned records, shallow clones)

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

## Development Guidelines

> **📋 For complete development instructions**, see [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md)

**Quick reference:**

- **Go version**: 1.21+
- **Testing**: Use `BEADS_DB=/tmp/test.db` to avoid polluting production database
- **Before committing**: Run tests (`go test -short ./...`) and linter (`golangci-lint run ./...`)
- **End of session**: Always run `bd sync` to flush/commit/push changes
- **Git hooks**: Run `bd hooks install` to ensure DB ↔ JSONL consistency

See [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md) for detailed workflows, testing patterns, and operational procedures.



## Current Project Status

Run `bd stats` to see overall progress.

### Active Areas

- **Core CLI**: Mature, but always room for polish
- **Examples**: Growing collection of agent integrations
- **Documentation**: Comprehensive but can always improve
- **MCP Server**: Implemented at `integrations/beads-mcp/` with Claude Code plugin
- **Migration Tools**: Planned (see bd-6)

### 1.0 Milestone

We're working toward 1.0. Key blockers tracked in bd. Run:

```bash
bd dep tree bd-8  # Show 1.0 epic dependencies
```



## Common Development Tasks

See [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md) for detailed instructions on:

- Adding new commands
- Adding storage features
- Adding examples
- Building and testing
- Version management
- Release process

## Pro Tips for Agents

- Always use `--json` flags for programmatic use
- **Always run `bd sync` at end of session** to flush/commit/push immediately
- **Check `bd info --whats-new` at session start** if bd was recently upgraded
- **Run `bd hooks install`** if `bd info` warns about outdated git hooks
- Link discoveries with `discovered-from` to maintain context
- Check `bd ready` before asking "what next?"
- Auto-sync batches changes in 30-second window - use `bd sync` to force immediate flush
- Use `--no-auto-flush` or `--no-auto-import` to disable automatic sync if needed
- Use `bd dep tree` to understand complex dependencies
- Priority 0-1 issues are usually more important than 2-4
- Use `--dry-run` to preview import changes before applying
- Hash IDs eliminate collisions - same ID with different content is a normal update
- Use `--id` flag with `bd create` to partition ID space for parallel workers (e.g., `worker1-100`, `worker2-500`)

### Checking GitHub Issues and PRs

Use `gh` CLI tools for checking issues/PRs (see [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md) for details).

## Building, Testing, Versioning, and Releases

See [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md) for complete details on:

- Building and testing (`go build`, `go test`)
- Version management (`./scripts/bump-version.sh`)
- Release process (`./scripts/release.sh`)

---

**Remember**: We're building this tool to help AI agents like you! If you find the workflow confusing or have ideas for improvement, create an issue with your feedback.

Happy coding! 🔗

<!-- bd onboard section -->

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**FIRST TIME?** Just run `bd init` - it auto-imports issues from git:

```bash
bd init --prefix bd
```

**OSS Contributor?** Use the contributor wizard for fork workflows:

```bash
bd init --contributor  # Interactive setup for separate planning repo
```

**Team Member?** Use the team wizard for branch workflows:

```bash
bd init --team  # Interactive setup for team collaboration
```

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1.  **Prioritize In-Progress Tasks**: Always check for tasks already marked as `in_progress` first.
    *   To view currently in-progress tasks: `bd list --status in_progress --json`
2.  **Check ready work**: After addressing in-progress tasks, run `bd ready` to see other unblocked issues.
3.  **Claim your task**: `bd update <id> --status in_progress`
4.  **Work on it**: Implement, test, document
5.  **Discover new work?** Create linked issue:
    *   `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
6.  **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### MCP Server (Alternative)

For MCP-only environments (Claude Desktop, no shell access), install the MCP server:

```bash
pip install beads-mcp
```

**Prefer CLI + hooks** when shell access is available - it uses less context and is more efficient.

### Managing AI-Generated Planning Documents

AI assistants often create planning and design documents during development:

- PLAN.md, IMPLEMENTATION.md, ARCHITECTURE.md
- DESIGN.md, CODEBASE_SUMMARY.md, INTEGRATION_PLAN.md
- TESTING_GUIDE.md, TECHNICAL_DESIGN.md, and similar files

**Best Practice: Use a dedicated directory for these ephemeral files**

**Recommended approach:**

- Create a `history/` directory in the project root
- Store ALL AI-generated planning/design docs in `history/`
- Keep the repository root clean and focused on permanent project files
- Only access `history/` when explicitly asked to review past planning

**Example .gitignore entry (optional):**

```
# AI planning documents (ephemeral)
history/
```

**Benefits:**

- ✅ Clean repository root
- ✅ Clear separation between ephemeral and permanent documentation
- ✅ Easy to exclude from version control if desired
- ✅ Preserves planning history for archaeological research
- ✅ Reduces noise when browsing the project

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ✅ Store AI planning docs in `history/` directory
- ✅ **New Change Request Workflow**: When a new change is requested, first update `spec.md` with the extra clarification, then create Beads tasks for the implementation.
- ✅ **No Pushes**: The agent must *not* push changes to the remote repository without explicit user instruction.
- ✅ **Version Control**: The agent must use `jj` commands exclusively for version control operations (commit, diff, status, etc.), and *never* use `git` commands directly, as this is a `jj` managed repository.
- ✅ **Development Server**: The agent must *never* run `npm run dev` or any development server command. Assume the user is managing the development server externally.
- ✅ **Commit Frequency**: The agent must commit changes after the completion of *every* Beads task.
- ✅ **Game Access URL**: The game is accessible at `http://192.168.20.8:5173/`. This URL should be used for all browser interactions.
- ✅ **Test Execution**: Unit tests should be run using `npx vitest run` to ensure non-interactive execution. Avoid running `npx vitest` without the `run` argument, as it defaults to an interactive watch mode that will never quit.
- ✅ **Test Execution**: Unit tests should be run using `npx vitest run` to ensure non-interactive execution. Avoid running `npx vitest` without the `run` argument, as it defaults to an interactive watch mode that will never quit.
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems
- ❌ Do NOT clutter repo root with planning documents

For more details, see README.md and QUICKSTART.md.

<!-- /bd onboard section -->

## Project Implementation Status

**Current Status**: Prototype Complete (Milestones M1-M8)

### Architecture
- **Tech Stack**: Vite + Vanilla TypeScript
- **Core Components**:
  - **Engine (Web Worker)**: Deterministic simulation loop, single source of truth (`src/engine/`).
  - **Renderer (Main Thread)**: HTML5 Canvas rendering (`src/renderer/`).
  - **Communication**: JSON protocol via `postMessage` (`GameClient` wrapper).

### State Management
- `GameState` is maintained exclusively in the Worker (`CoreEngine`).
- Immutable snapshots are sent to the Renderer for every tick (or on demand).
- Determinism ensured via seeded PRNG and recorded command streams.

### Key Features
*   **M1: Engine Skeleton**: Deterministic tick loop, `GameGrid`, `Pathfinder` (A*).
*   **M2: Combat & Fog**: Fog of War (Raycasting), Unit/Enemy entities, Combat logic, Objectives/Extraction.
*   **M3: Director & Replay**: AI Director for spawning, JSON replay system, Difficulty ramping.
*   **M4: Agent Harness**: `BotHarness` and `SimpleBot` for automated testing.
*   **M5: Content-pack**: `MapGenerator` interface and procedural generation.
*   **M6: Advanced UI**: Soldier List Panel, Keyboard Controls ('M'), Combat Tracers, Command Queuing.
*   **M7: Thin Walls**: Refactored grid for edge-based walls and maze generation.
*   **M8: Polished Level**: Fixed 16x16 Space Hulk-style spaceship layout, 128px tile visuals.

### Running the Project
```bash
npm install
npm run dev
```

# Agent & Developer Guidelines

## G1) Agent Workflow Instructions
* **Clarification First:** When a new change request is received, you must first update `xenopurge-spec.md` with the new clarification/requirement.
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
* **Unit Test First:** For core mechanics (Grid, Pathfinder, LOS), write tests before implementation.
* **Non-Interactive:** Run tests using `npx vitest run`. Never use watch mode.
* **Micro-Maps:** Define small, fixed JSON `MapDefinition`s directly within tests (e.g., 2x2 grids) to cover specific scenarios:
    * Paths blocked by walls/doors.
    * Complex shared-wall configurations.
* **Recursion Guard:** If `Maximum call stack size exceeded` occurs, dump the Pathfinding grid state to JSON immediately for analysis.

## G3) Visual Debugging & Feedback
* **Agent Limitations:** You (the Agent) cannot see the rendered Canvas. You operate in a headless environment.
* **User Feedback:** When reporting visual issues, the user must provide text descriptions (e.g., "Door at 3,4 is yellow but soldier walked through it").
* **Map Viewer App:**
    * Use the standalone Map Viewer (milestone M15 in spec) to verify map generation logic if available.
    * If the Map Viewer is not built, rely on console logs of the `MapDefinition` JSON.

## G4) Critical Runtime Errors
* **Infinite Recursion:** A known risk in pathfinding on complex grids. If observed, prioritize fixing the recursion exit conditions in `Pathfinder.ts` immediately.

## Next Steps / Handover

**INSTRUCTION FOR AGENTS:**
Upon loading this context, your first action should be to check the issue tracker for open work.
1. Run `bd ready` to see the prioritized list of open tasks.
2. Start working on the tasks in order (top to bottom).
3. Do not implement features not tracked in beads.
