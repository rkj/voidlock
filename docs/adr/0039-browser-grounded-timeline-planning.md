# ADR 0039: Browser-Grounded Timeline Planning

## Status

Proposed

## Date

2026-02-08

## Supersedes

This ADR supersedes `docs/adr/0038-progress-video-capture-pipeline.md`.

## Problem Statement

We need one end-to-end process that generates a progress video for the game from project inception to today.

The output video is built from screenshots captured at commits over time.\
For each buildable commit, we need correct screenshots of major UI states:

- `mission` (required)
- `main_menu` (optional when present)
- `config` (optional when present)
- `campaign` (optional when present)

Then we compose and render those screenshots into timeline frames and MP4.

The main difficulty is UI drift: each commit can have different ids, labels, and click paths.\
A single global click recipe is not reliable across history.

## Decision

Adopt a two-phase architecture:

1. **Planning phase (checkpoint-only, browser-grounded)**

- Build or repair navigation plans at selected checkpoint commits.
- Plans are validated against a running browser session for that checkpoint before acceptance.

2. **Capture phase (deterministic, no agent)**

- Execute compiled per-commit plans at scale.
- Enforce mission-required policy and fail loudly on wrong/missing mission.

The agent is used only to propose plans.\
The browser executor is the source of truth.

## High-Level Approach

### A) Build commit dataset

- `manifest.json`: ordered commits and timestamps.
- `navigation_map.json`: static UI hints extracted per commit.
- `screen_topology_changes.json`: checkpoints where navigation-relevant structure changes.

### B) Produce checkpoint plans

- For each checkpoint, produce a playbook (mission/config/campaign actions; main menu is root capture).
- Validate checkpoint plan in browser.
- Save accepted plan to `navigation_playbooks.json`.

### C) Compile to per-commit plans

- Expand checkpoint plans to exact `commit -> actions` rows in `commit_playbooks.jsonl`.
- This gives deterministic capture input and allows commit-level overrides without recomputing everything.

### D) Run full capture

- For each commit: checkout, start dev server, clear storage, navigate from `/`, execute target flow, verify target, capture.
- Mission must exist unless commit is explicitly allowlisted.

### E) Assemble and render

- Normalize screenshots, fill missing optional slots with placeholders, compose frames, render MP4.

## Detailed Design

## 1) Fixed Capture Contract

- Viewport is fixed at `1440x900`.
- Each target screen is captured from a fresh root flow:

1. Clear origin storage.
1. Navigate to `/`.
1. Execute target actions.
1. Wait for readiness.
1. Capture full viewport.

Notes:

- Scroll is allowed and required for out-of-viewport elements before click.
- Destructive actions are always blocked (`abort`, `abandon`, `give up`, `surrender`, `reset`).

## 2) Screen Semantics

- `main_menu`: root menu state, no click flow required.
- `config`: mission setup/loadout/equipment state before launch.
- `campaign`: campaign shell/sector/barracks-type state.
- `mission`: active mission/gameplay state.

Mission is required because it is the core product progression signal across commits.

## 3) Plan Quality Gates

### Verification

Verification means runtime browser checks before screenshot acceptance:

- expected UI signals for target must be present
- conflicting states must not be the only detected state
- page must be healthy (no Vite/error overlay)

### Bad plan

A plan is bad if any of these happen:

- labeled `mission` but lands on non-mission screen
- uses blocked destructive action
- depends on controls that are absent in the checkpoint UI
- cannot be replayed after storage reset + root navigation

## 4) Why Compile Checkpoint Plans to Per-Commit Rows

Compiling checkpoint plans to `commit_playbooks.jsonl` is required for:

- deterministic execution per commit
- partial repair (fix one commit/checkpoint without touching all history)
- reusing already validated plan work in later runs

## 5) Operational Workflow

1. Run checkpoint planning/validation.
1. Review checkpoint screenshots.
1. Patch only broken checkpoint plans.
1. Recompile per-commit plan DB.
1. Run full capture with no agent.
1. Render timeline video.

This allows iterative repair without wiping all timeline artifacts.

## Consequences

Positive:

- Higher correctness for mission labeling.
- Reusable plan database across reruns.
- Clear separation between "plan generation" and "bulk capture".

Tradeoff:

- Requires maintaining checkpoint plans as project UI evolves.
