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

## Issue Tracking: Beads (bd)

Use `bd` for all task/issue tracking. Never use TodoWrite, TaskCreate, or markdown files for tracking.

- `bd ready` — find available work
- `bd create --title="..." --description="..." --type=bug --priority=1` — create issue
- `bd update <id> --claim` — claim work
- `bd close <id> --reason="..."` — complete work

## jj Workspace + Beads Setup

This is a **jj workspace** (`jj-voidlock-claude`), not the main repo. The main repo is at `~/voidlock/`.

Beads database is shared with the main repo's Dolt server. If `bd` commands fail with "database not found":
1. Read the current port: `cat ~/voidlock/.beads/dolt-server.port`
2. Update `.beads/metadata.json` with the correct `dolt_server_port`

## Code

- See `AGENTS.md` for full codebase guide, architecture, and conventions
- See `GEMINI.md` files in each directory for local context
- Run `npm run lint` after changes
- Run `npx vitest run <path>` for targeted tests
- Regression tests: `tests/engine/repro/regression_<ticket>_<slug>.test.ts`
