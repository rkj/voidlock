# Voidlock

**Deterministic Real-Time with Pause (RTwP) tactical squad combat in a claustrophobic spaceship environment.**

**Read `AGENTS.md` first** — it has the full codebase guide, conventions, build commands, jj usage, and beads workflow.

This file contains Gemini-specific context and sub-context pointers.

## Gemini-Specific Notes

- Per-directory `GEMINI.md` files provide local context for each subsystem. Keep them updated when architecture or folder structure changes.
- **Never use** `git` commands. This repo uses `jj` (Jujutsu). See AGENTS.md for commands.
- **Never use** `bd` commands. The project migrated to `br` (beads_rust). See AGENTS.md § "Issue Tracking".

## Sub-Contexts

- [Engine Context](./src/engine/GEMINI.md)
- [Renderer Context](./src/renderer/GEMINI.md)
- [Shared Types Context](./src/shared/GEMINI.md)
- [Scripts Context](./scripts/GEMINI.md)
- [Services Context](./src/services/GEMINI.md)
- [Architecture](./docs/ARCHITECTURE.md)
