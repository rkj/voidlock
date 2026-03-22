# Voidlock — AI Agent Guide

This document helps AI agents (Claude, Gemini, Codex, etc.) navigate and contribute to the Voidlock codebase effectively.

## Project Overview

Voidlock is a deterministic Real-Time with Pause (RTwP) tactical squad combat game. TypeScript, HTML5 Canvas, Web Workers. No framework (vanilla TS + custom JSX).

## Information Sources

| What you need | Where to find it |
|---|---|
| Architecture & module boundaries | `docs/ARCHITECTURE.md` |
| Game design & behavior specs | `docs/spec/*.md` (start with `docs/spec/index.md`) |
| Architecture decisions & rationale | `docs/adr/*.md` (57+ ADRs) |
| Per-directory context | `GEMINI.md` in each directory |
| Contributor workflow (sub-agents) | `docs/AGENTS.md` |
| PM/planning workflow | `docs/PM.md` |
| Manager/orchestrator workflow | `docs/MANAGER.md` |
| Code review findings | `docs/CODE_REVIEW.md` |
| Dev guide & conventions | `docs/dev_guide.md` |

## Codebase Layout

```
src/
├── engine/          # Simulation (Web Worker) — deterministic, no DOM
│   ├── ai/          #   Enemy AI + unit behavior composition
│   ├── managers/    #   Domain managers (Unit, Enemy, Combat, Movement, etc.)
│   ├── generators/  #   Map generation algorithms
│   ├── campaign/    #   Campaign strategic layer
│   ├── config/      #   Game constants, difficulty
│   ├── map/         #   Map processing pipeline
│   └── persistence/ #   Save/load abstraction
├── renderer/        # Presentation (Main Thread) — Canvas + DOM
│   ├── app/         #   Application lifecycle (GameApp)
│   ├── visuals/     #   Canvas rendering layers
│   ├── screens/     #   Screen implementations
│   ├── controllers/ #   Input/command logic
│   ├── ui/          #   HUD panels, menus, modals
│   └── components/  #   Reusable UI components
├── shared/          # Types, constants, utilities (used by both)
├── content/         # Static game data (JSON)
└── harness/         # Bot infrastructure for balance testing

tests/               # All tests (mirrors src/ structure)
docs/                # Specs, ADRs, guides
```

## Key Conventions

### Architecture

- **Engine/Renderer split**: Engine runs in Web Worker (no DOM), Renderer on main thread. Communication via JSON messages (Commands/Observations).
- **Determinism**: Engine uses seeded PRNG. `Math.random()` is forbidden in engine code.
- **Manager pattern**: CoreEngine delegates to specialized managers. Each manager handles one domain.
- **Command pattern**: All game actions are Command objects for replay support.

### Code

- **Imports**: Use `@src/` alias for source imports.
- **No `any`**: Use `unknown` with type guards. No `as` casting, no `!` assertions.
- **No framework**: Vanilla TypeScript. UI uses custom JSX factory (ADR 0051).
- **File limit**: Manager classes should stay under ~500 lines.
- **Tests**: All in `tests/` directory, never co-located with source.
- **Regression tests**: Named `regression_<ticket_id>_<slug>.test.ts`.

### Documentation

- **GEMINI.md**: Per-directory context files. Keep concise — describe purpose and key files, link to ADRs for technical details.
- **ADRs are immutable**: Never edit an accepted ADR. Write a new one that supersedes it.
- **Specs describe behavior**: No code snippets in `docs/spec/` files.

### Version Control

- Uses **Jujutsu (jj)** for version control, not git.
- Uses **Beads (bd)** for task/issue tracking.

### Beads in jj Workspaces

The canonical beads database lives in `~/voidlock/.beads/` (the main repo). jj workspaces (e.g. `~/jj-voidlock-claude/`) must **share** the main repo's Dolt server — do NOT run `bd init` independently, as that creates a separate empty database.

To configure a jj workspace to share the main beads database:

1. Kill any orphaned Dolt server the workspace started: `kill $(cat .beads/dolt-server.pid)`
2. Set `.beads/metadata.json` to point at the main server:
   - `dolt_server_port`: read from `~/voidlock/.beads/dolt-server.port`
   - `dolt_database`: `"voidlock"` (must match main repo's `metadata.json`)
   - `project_id`: copy from `~/voidlock/.beads/metadata.json`
3. Verify with `bd list --status=open` — you should see the same issues as the main repo.

The port may change when the main repo's Dolt server restarts. If `bd` commands fail with "database not found", re-read the port from `~/voidlock/.beads/dolt-server.port` and update `.beads/metadata.json`.

## Quick Start for Agents

1. Read `docs/ARCHITECTURE.md` for the big picture
1. Read `docs/spec/index.md` to find the relevant spec for your task
1. Read the `GEMINI.md` in the directory you're working in
1. Check `docs/adr/` for any relevant architecture decisions
1. Run `npm run lint` after changes (TypeScript type check)
1. Run `npx vitest run <path>` for targeted tests

<!-- BEGIN BEADS INTEGRATION v:1 profile:full hash:d4f96305 -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

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
bd update <id> --claim --json
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

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->
