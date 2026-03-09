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

## Quick Start for Agents

1. Read `docs/ARCHITECTURE.md` for the big picture
1. Read `docs/spec/index.md` to find the relevant spec for your task
1. Read the `GEMINI.md` in the directory you're working in
1. Check `docs/adr/` for any relevant architecture decisions
1. Run `npm run lint` after changes (TypeScript type check)
1. Run `npx vitest run <path>` for targeted tests
