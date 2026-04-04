# Voidlock — AI Agent Guide

This is the canonical reference for all AI agents (Claude, Gemini, Codex) working on this project.
Agent-specific files (CLAUDE.md, root GEMINI.md) should only contain overrides; everything shared lives here.

## Project Overview

Voidlock is a deterministic Real-Time with Pause (RTwP) tactical squad combat game.
TypeScript, HTML5 Canvas, Web Workers. No framework (vanilla TS + custom JSX).

- **Build System:** Vite
- **Testing:** Vitest (unit/integration) + Puppeteer (E2E)
- **Version Control:** Jujutsu (jj) — see below
- **Issue Tracking:** Beads (`br`) — see below

## Build & Run Commands

```bash
npm run dev              # Dev server (local network)
npm run build            # tsc + vite build
npm run lint             # Full TypeScript type check
npx vitest run <path>    # Targeted tests
npm run test             # All tests
npm run test:e2e         # E2E tests (requires visual env)
npm run process-assets   # Optimize raw assets
npm run balance-sim      # Headless simulation stats
```

## Information Sources

| What you need | Where to find it |
|---|---|
| Architecture & module boundaries | `docs/ARCHITECTURE.md` |
| Game design & behavior specs | `docs/spec/*.md` (start with `docs/spec/index.md`) |
| Architecture decisions & rationale | `docs/adr/*.md` (57+ ADRs) |
| Per-directory context | `GEMINI.md` in each directory |
| User stories for visual audits | `docs/user_stories/` |
| Dev guide & conventions | `docs/dev_guide.md` |
| Code review findings | `docs/CODE_REVIEW.md` |

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
- **No circular deps**: Engine must never import Renderer. Children must not import parents — use interfaces (`IDirector`) or DI.

### Code

- **Imports**: Use `@src/` alias for source imports.
- **No `any`**: Use `unknown` with type guards. No `as` casting, no `!` assertions.
- **No framework**: Vanilla TypeScript. UI uses custom JSX factory (ADR 0051).
- **File limit**: Manager classes should stay under ~500 lines.
- **Tests**: All in `tests/` directory, never co-located with source.
- **Regression tests**: Named `regression_<ticket_id>_<slug>.test.ts` in `tests/engine/repro/`.
- **Styles**: Use CSS variables and existing patterns in `src/styles/`.
- **Performance**: No deep cloning in loops. Use spatial partitioning for O(N²) checks. Don't allocate in render().

### Documentation

- **GEMINI.md**: Per-directory context files. Keep concise — describe purpose and key files, link to ADRs for technical details.
- **ADRs are immutable**: Never edit an accepted ADR. Write a new one that supersedes it.
- **Specs describe behavior**: No code snippets in `docs/spec/` files.

### Verification Protocol

After **every** code modification:

1. `npm run lint` — 0 TypeScript errors
2. `npx vitest run <path>` — targeted tests pass
3. Fix issues immediately, don't leave for later

## Version Control: Jujutsu (jj), NOT git

This repo uses **jj** (Jujutsu). Do NOT use git commands.

```bash
jj status          # Show working copy changes
jj log             # Show commit history
jj diff            # Show changes
jj commit -m "msg" # Commit and start new change (preferred)
jj new             # Start new change on top of current
jj squash          # Squash into parent
```

Key differences from git:
- No staging area. All file changes are automatically part of the working copy.
- No `git add`, `git commit`, `git push`. Use `jj commit`.
- **Do NOT use `jj describe`** — it sets the message but doesn't start a new change, easy to forget `jj new` afterward.

### jj Workspaces

This may be a **jj workspace** (e.g., `jj-voidlock-claude`), not the main repo (at `~/voidlock/`).
Workspaces share the same commit history. `.beads/issues.jsonl` is tracked by jj, so issue state travels with commits.

## Issue Tracking: Beads (`br`)

Use `br` (beads_rust) for ALL task/issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Quick Reference

```bash
br ready                                    # Find available work
br create --title="..." --type=bug --priority=1  # Create issue
br update <id> --claim                      # Claim work
br close <id> --reason="..."                # Complete work
br list                                     # List issues
br show <id>                                # Show issue details
```

### Issue Types & Priorities

Types: `bug`, `feature`, `task`, `epic`, `chore`
Priorities: `0` (critical) → `4` (backlog). Default: `2`.

### Workflow

1. `br ready` — find unblocked work
2. `br update <id> --claim` — claim it
3. Implement, test, document
4. `br close <id> --reason="Done"` — complete it
5. `jj commit` — captures updated JSONL with your code changes

### Beads in jj Workspaces

- `.beads/issues.jsonl` is tracked by jj — all workspaces share it automatically.
- Each workspace has a local `.beads/beads.db` (SQLite cache, gitignored).
- `br` auto-imports from the JSONL when the DB is missing or stale.
- JSONL is line-based, so non-overlapping changes merge cleanly across workspaces.

### Multi-Agent Coordination

- Claim your issue with `br update <id> --claim` before starting work.
- Commit frequently so other workspaces can rebase and see your claims.
- If two agents claim the same issue, the later rebase will show a JSONL conflict — resolve by keeping the first claim.

### Troubleshooting

**"Database error: query returned more than one row"**

This means the local SQLite cache (`.beads/beads.db`) is corrupted. The JSONL is the source of truth; the DB is just a cache. Fix:

```bash
rm -f .beads/beads.db
br init --prefix voidlock --force
```

Common causes:
- Manual SQL modifications to the DB
- Partial or interrupted `br init`
- DB schema mismatch after `br` version upgrade

The `config` and `metadata` tables lack UNIQUE constraints on `key`, so duplicate rows can cause this error. A clean re-init from JSONL always resolves it.

**`br` commands fail after rebasing**

The JSONL may have changed underneath the DB cache. Same fix: `rm .beads/beads.db && br init --prefix voidlock --force`.

**Issues added manually to JSONL**

If you append JSON directly to `issues.jsonl` (e.g., because `br create` is broken), make sure to delete the DB and re-init afterward so `br` picks up the new entries.

## Quick Start for Agents

1. Read `docs/ARCHITECTURE.md` for the big picture
2. Read `docs/spec/index.md` to find the relevant spec for your task
3. Read the `GEMINI.md` in the directory you're working in
4. Check `docs/adr/` for any relevant architecture decisions
5. `br ready` — check for assigned work
6. `npm run lint` after changes
7. `npx vitest run <path>` for targeted tests

## Landing the Plane (Session Completion)

1. **File issues for remaining work** — `br create` for anything needing follow-up
2. **Run quality gates** (if code changed) — tests, linters, builds
3. **Update issue status** — close finished work, update in-progress items
4. **Commit** — `jj commit -m "..."` to capture everything
