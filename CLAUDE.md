# Voidlock — Claude Code Context

**Read `AGENTS.md` first** — it has the full codebase guide, conventions, build commands, jj usage, and beads workflow.

This file contains only Claude-specific overrides.

## Claude-Specific Rules

- **Never use** `TodoWrite`, `TaskCreate`, or markdown files for tracking. Use `br` (beads_rust) exclusively.
- **Never use** `git` commands. This repo uses `jj` (Jujutsu). See AGENTS.md for commands.
- **Prefer `jj commit`** over `jj describe` — `describe` doesn't start a new change, easy to forget `jj new`.
- **Regression tests**: `tests/engine/repro/regression_<ticket>_<slug>.test.ts`

## Workspace Context

This is a **jj workspace** (`jj-voidlock-claude`), not the main repo. The main repo is at `~/voidlock/`.
See AGENTS.md § "jj Workspaces" and § "Troubleshooting" for beads DB issues.
