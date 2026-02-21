# ADR 0038: Progress Video Capture Pipeline

## Status

Proposed

## Date

2026-02-08

## Supersedes

This ADR supersedes `docs/adr/0043-timeline-capture-navigation-architecture.md`.

## Problem Statement

We need to generate a video showing game progress over time.

To do that, we must:

1. Capture screenshots of major UI screens for each commit.
1. Keep screen labels correct (for example, mission screenshot must actually be mission).
1. Stitch the resulting frames into a timeline video.

The repository evolves heavily across commits (screen names, ids, labels, and flows change), so the system must determine how to navigate each commit without assuming one universal flow.

## High-Level Approach

Use two separate workflows:

1. **Plan authoring workflow (agent-assisted, iterative, reusable)**

   - Produces and maintains navigation plans.
   - Can be run independently and incrementally.
   - Does not have to rerun for already-good historical commits.

1. **Capture workflow (deterministic executor)**

   - Uses existing plans only.
   - Does not call the agent.
   - Captures screenshots for commits, then video render uses those screenshots.

This separation is required so we can improve plans for a broken era/commit without wiping `timeline/` artifacts or regenerating everything.

## Terminology

- **Change-point commit**: a commit where navigation-relevant UI structure changes (screen ids/action ids/targets differ from previous state).
- **Plan**: ordered navigation steps for target screens (`mission`, `main_menu`, `config`, `campaign`).
- **Compiled per-commit plan DB**: exact plan selected for each commit after inheritance/reuse rules are applied.

## Detailed Design

### Step 1: Build Commit Manifest

Input:

- git history

Output:

- `timeline/manifest.json`

Purpose:

- Defines which commits will be captured, in order.

### Step 2: Analyze Navigation Metadata

Input:

- `timeline/manifest.json`

Output:

- `timeline/navigation_map.json`

Purpose:

- Extract per-commit UI hints (ids/targets/action ids) to detect where plan updates are needed.

### Step 3: Detect Change-Point Commits

Input:

- `timeline/navigation_map.json`

Output:

- `timeline/screen_topology_changes.json`

Purpose:

- Identify commits where navigation behavior likely changed.
- These commits become plan authoring checkpoints.

### Step 4: Plan Authoring (Independent of Capture)

Input:

- change-point commits + current plan artifacts

Output:

- `timeline/navigation_playbooks.json` (checkpoint-level plans)
- `timeline/commit_playbooks.jsonl` (compiled per-commit plans)

Rules:

- Agent can propose plan updates for specific change-point commits.
- Existing good plans remain untouched unless explicitly revised.
- We can patch one broken change-point/commit and recompile without wiping timeline outputs.

Allowed step primitives:

- `click:#<id>`
- `wait:<N>ms`
- `noop`
- optional text-click fallback in executor

Disallowed primitives:

- DOM force-show/style manipulation
- destructive navigation actions (`reset`, `abort`, `give up`, `abandon`, `surrender`)

### Why Compile to Per-Commit Plans

Compiling checkpoint plans into `timeline/commit_playbooks.jsonl` gives:

1. Exact deterministic input for each commit capture run.
1. Targeted override support (single-commit fix without changing neighbors).
1. Reuse of previously validated plans without re-invoking the agent.
1. Faster reruns (capture consumes one ready DB, no plan inference at runtime).

### Step 5: Deterministic Capture (No Agent Calls)

Input:

- `timeline/manifest.json`
- `timeline/commit_playbooks.jsonl`

Output:

- `screenshots/<timestamp>_<screen>_<sha>.png`

Execution protocol per target screen:

1. Clear origin storage state.
1. Navigate to `/`.
1. Execute steps for target screen.
1. Scroll target into view before click attempts.
1. Verify target screen state in-browser.
1. Capture screenshot.

Mission policy:

- Mission screenshot is required for every buildable commit.
- Only allowed exception: SHA listed in `timeline/mission_allowlist.txt`.
- If mission cannot be reached for a non-allowlisted commit, capture fails for that commit.

Viewport:

- Use fixed viewport for consistency: `1440 x 900`.

### Step 6: Verification Before Screenshot

Verification is browser-state based (not expensive image recognition by default):

- Check expected DOM/UI signals for target screen before screenshot.
- Reject risky/incorrect states before capture (for example, campaign view while target is mission).
- If verification is ambiguous, mark commit as failed and patch plan; do not silently accept mislabeled screenshots.

Definition of a bad plan:

- Navigates to wrong screen but labels it as another screen.
- Uses blocked destructive actions.
- Depends on unavailable controls for that commit and cannot recover.

### Step 7: Frame Assembly and Render

Input:

- captured screenshots

Output:

- frame index + final MP4

Purpose:

- Normalize, deduplicate, compose timeline frames, render final video.

## Reuse and Incremental Repair Workflow

This is the operational loop for ongoing work:

1. Run manifest/analyze/change-point detection.
1. Use existing `timeline/commit_playbooks.jsonl` as baseline.
1. Identify failing commit(s) from capture logs.
1. Patch only the relevant change-point or commit-level plan.
1. Recompile plan DB.
1. Rerun capture from failed commit onward.
1. Keep previous successful screenshots and timeline artifacts.

This prevents full reruns and preserves already-good agent work.

## Consequences

Positive:

- Reusable plan knowledge over time.
- Deterministic capture runs.
- Fast targeted repair for broken eras/commits.
- Better label correctness for mission/config/campaign/main menu screenshots.

Negative:

- Requires maintaining a plan DB and an explicit failure-repair loop.
- Requires clear verifier rules per target screen.
