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
- Uses **Beads (`br`)** for task/issue tracking (SQLite + JSONL, no Dolt).

### Beads in jj Workspaces

`.beads/issues.jsonl` is tracked by jj, so issue state travels with commits.
Each workspace has a local `.beads/beads.db` (SQLite cache, gitignored).
`br` auto-imports from the JSONL when the DB is missing or stale.

To set up a new workspace: `br init --prefix voidlock` — the JSONL is already there via jj.

**Sync workflow:**
- `br` auto-flushes DB → `issues.jsonl` after every mutation
- `jj commit` captures the updated JSONL with your code changes
- Other workspaces see it after rebasing onto your commit
- JSONL is line-based, so non-overlapping changes merge cleanly

**Multi-agent coordination:**
- Different agents/workspaces may work in parallel on separate branches
- Claim your issue with `br update <id> --claim` before starting work
- Commit frequently so other workspaces can rebase and see your claims
- If two agents claim the same issue, the later rebase will show a JSONL conflict — resolve by keeping the first claim

## Quick Start for Agents

1. Read `docs/ARCHITECTURE.md` for the big picture
1. Read `docs/spec/index.md` to find the relevant spec for your task
1. Read the `GEMINI.md` in the directory you're working in
1. Check `docs/adr/` for any relevant architecture decisions
1. Run `npm run lint` after changes (TypeScript type check)
1. Run `npx vitest run <path>` for targeted tests

<!-- BEGIN BEADS INTEGRATION v:2 profile:full -->
## Issue Tracking with `br` (beads_rust)

**IMPORTANT**: This project uses **`br` (beads_rust)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why br?

- Dependency-aware: Track blockers and relationships between issues
- Simple: SQLite + JSONL, no Dolt server required
- Agent-optimized: JSON output, ready work detection
- Prevents duplicate tracking systems and confusion

### Quick Start

```bash
br ready                    # Check for ready work
br create --title="Issue title" --description="Context" --type=bug --priority=1
br update <id> --claim      # Claim a task
br close <id> --reason "Completed"
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

1. **Check ready work**: `br ready` shows unblocked issues
2. **Claim your task**: `br update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue with `br create`
5. **Complete**: `br close <id> --reason "Done"`

### Important Rules

- Use `br` for ALL task tracking
- Check `br ready` before asking "what should I work on?"
- Do NOT create markdown TODO lists or use external issue trackers

## Landing the Plane (Session Completion)

1. **File issues for remaining work** — `br create` for anything needing follow-up
2. **Run quality gates** (if code changed) — Tests, linters, builds
3. **Update issue status** — Close finished work, update in-progress items
4. **Sync beads** — `br sync --flush-only` to export DB to JSONL

<!-- END BEADS INTEGRATION -->
