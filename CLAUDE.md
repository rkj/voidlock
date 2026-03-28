# Voidlock — Claude Code Context

## Version Control: Jujutsu (jj), NOT git

This repo uses **jj** (Jujutsu). Do NOT use git commands. Key differences:

- `jj status` — show working copy changes
- `jj log` — show commit history
- `jj diff` — show changes
- `jj commit -m "message"` — commit working copy and start a new change (preferred)
- `jj new` — start a new change on top of the current one
- `jj squash` — squash into parent
- There is no staging area. All file changes are automatically part of the working copy commit.
- No `git add`, `git commit`, `git push`. If asked to commit, use `jj commit`.
- Do NOT use `jj describe` — it sets the message but doesn't start a new change, easy to forget `jj new` afterward.

## Issue Tracking: Beads (`br`)

Use `br` (beads_rust) for all task/issue tracking. Never use TodoWrite, TaskCreate, or markdown files for tracking.

- `br ready` — find available work
- `br create --title="..." --description="..." --type=bug --priority=1` — create issue
- `br update <id> --claim` — claim work
- `br close <id> --reason="..."` — complete work

## jj Workspace + Beads Setup

This is a **jj workspace** (`jj-voidlock-claude`), not the main repo. The main repo is at `~/voidlock/`.

`.beads/issues.jsonl` is tracked by jj — all workspaces share it automatically.
Each workspace has a local `.beads/beads.db` (SQLite cache, gitignored).
If the DB is stale or missing, `br` auto-imports from the JSONL on next command.

## Code

- See `AGENTS.md` for full codebase guide, architecture, and conventions
- See `GEMINI.md` files in each directory for local context
- Run `npm run lint` after changes
- Run `npx vitest run <path>` for targeted tests
- Regression tests: `tests/engine/repro/regression_<ticket>_<slug>.test.ts`
