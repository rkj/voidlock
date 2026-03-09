# ADR 0056: Committed AI Plans with Invalidation Triggers

## Status

Proposed

## Context

### The Problem

Soldiers oscillate back and forth instead of making steady progress toward their goals. This is a recurring issue (voidlock-mfmt1, voidlock-74rd, voidlock-ybvar.1) that has been partially patched but never structurally resolved.

### Root Cause

The current AI architecture (`UnitAI.process()`) re-evaluates the full behavior stack **every 16ms tick**. Each behavior can issue a new single-cell `MOVE_TO` command that overrides the previous one. When two behaviors produce nearly-equal evaluations, or when geometry creates local optima, units flip between competing movement targets every tick.

Specific failure modes:

1. **Kiting oscillation** (SafetyBehavior): AVOID mode uses a greedy 1-cell neighbor scan. In corridors, the "best retreat cell" from position A is B, but from B it is A. The unit bounces forever.
1. **Behavior preemption churn**: A unit exploring gets interrupted by CombatBehavior (enemy spotted), then next tick SafetyBehavior overrides combat (threat too close), then CombatBehavior again (threat now further), cycling every tick.
1. **Exploration flickering**: Despite the 1000ms re-evaluation window, a discovered cell can trigger a new target that is in the opposite direction, causing a U-turn mid-path.

### Prior Fixes (Insufficient)

- **voidlock-74rd**: Added sticky target locking (1000ms `forcedTargetId`) -- only fixes *target selection* oscillation, not *movement* oscillation.
- **voidlock-mfmt1**: Added channeling/extraction guard in CombatManager -- only fixes extraction interruption, not general kiting.
- **voidlock-ybvar.1**: Refined LOS maintenance in AVOID mode -- improved scoring but kept the greedy 1-cell approach.

### Current Architecture (What Changes)

```
Every 16ms tick, per unit:
  UnitManager.update()
    -> processCommandQueue()
    -> processChanneling()
    -> combatManager.update()
    -> movementManager.updateUnitMovement()
    -> unitAi.process()          <-- RE-EVALUATES EVERYTHING
        -> SafetyBehavior        <-- Can override any active plan
        -> InteractionBehavior
        -> CombatBehavior        <-- Can override exploration
        -> ObjectiveBehavior
        -> ExplorationBehavior   <-- Can override combat retreat
```

The behavior stack priority ordering is correct. The problem is not *what* gets chosen, but *how often* it gets reconsidered.

## Decision

### Core Principle: Plan-Then-Execute with Triggered Re-evaluation

A unit commits to a **plan** (a behavior + a multi-cell path + a goal) and follows it to completion. Re-evaluation only happens when a **material world-state change** occurs, not on every tick.

This is the standard approach in tactical games (XCOM, Jagged Alliance, Cogmind). Even in real-time games, the AI "thinks" periodically or on events, not every frame.

### 1. Plan Structure

Add to the Unit type:

```
activePlan: {
  behavior: string;         // Which behavior produced this plan ("Exploring", "Kiting", "Rushing", etc.)
  goal: Vector2;            // The final destination
  committedUntil: number;   // Game time (state.t) until which this plan cannot be overridden by same-or-lower priority
  priority: number;         // Priority level of the behavior that created this plan (0=Safety, 1=Interaction, 2=Combat, 3=Objective, 4=Exploration)
} | null;
```

The existing `path`, `targetPos`, and `activeCommand` fields continue to handle execution. The `activePlan` is metadata about *why* the unit is moving and *when* re-evaluation is allowed.

### 2. Plan Commitment Rules

When `UnitAI.process()` runs:

```
IF unit.activePlan exists AND state.t < unit.activePlan.committedUntil:
  - Only evaluate behaviors with HIGHER priority (lower number) than activePlan.priority
  - If a higher-priority behavior fires, it replaces the plan
  - Otherwise, skip evaluation entirely (unit continues current movement)
ELSE:
  - Full behavior evaluation (current behavior)
  - Winning behavior sets a new activePlan with appropriate commitment duration
```

Safety (priority 0) can always interrupt. Combat (priority 2) can interrupt Objective/Exploration but not another Combat plan mid-execution. Exploration (priority 4) cannot interrupt anything.

### 3. Invalidation Triggers (When to Re-evaluate)

Instead of polling every tick, plans are invalidated by specific events. When an invalidation trigger fires, `activePlan.committedUntil` is set to 0 (forcing re-evaluation on the next tick).

| Trigger | Invalidates |
|---------|-------------|
| New enemy enters LOS | Exploration, Objective |
| All visible enemies die/flee | Combat, Safety (kiting) |
| Unit HP drops below 25% | Everything except Safety |
| New undiscovered area revealed (door opened, room entered) | Exploration |
| Objective state changes (picked up by ally, new one discovered) | Objective |
| Unit reaches plan goal | Everything (natural completion) |
| Path becomes blocked (door closed, obstacle) | Everything |
| Manual player command issued | Everything |

These triggers are checked at the point where the world state changes (in the relevant manager), not polled. For example, when `LineOfSight` detects a new enemy visible, it fires an invalidation for all units that can see it.

### 4. Anti-Backtracking Rule

A unit MUST NOT select a movement target that it occupied within the last N cells of its path history, unless:

- It is on a pathfound route to a distant goal (transitory backtracking is fine if A\* says so)
- It is retreating to an ally (grouping behavior)
- No forward progress is possible (cornered)

Implementation: maintain a small ring buffer (last 4-6 cell positions) per unit. Behaviors filter candidates against this buffer. This is a hard constraint, not a soft preference.

### 5. Kiting Overhaul (SafetyBehavior Specific)

Replace the greedy 1-cell neighbor scan with goal-oriented retreat:

1. Identify a **retreat waypoint**: the nearest discovered cell that is >= N tiles from all visible threats AND maintains LOS to the primary threat (per spec).
1. **Pathfind** to that waypoint (using existing A\*), not neighbor-hop.
1. Commit to the path. Re-evaluate only if a new threat appears or the existing threat dies.

This mirrors how the low-HP retreat already works (pathfinds to a safe cell) but adds the LOS constraint from the spec.

### 6. Exploration Planning Improvement

Current: BFS finds closest undiscovered cell, issues 1-cell MOVE_TO, re-evaluates on arrival.

New: BFS finds closest undiscovered cell, pathfinds the full route, commits to it. Re-evaluate only when:

- The target cell gets discovered (by another unit or LOS expansion en route)
- A new area opens up that is significantly closer (< 70% current distance, keeping existing hysteresis)
- An invalidation trigger fires (enemy spotted, objective found)

The unit follows the full A\* path without per-cell re-evaluation. Arriving at intermediate cells on the path does NOT trigger behavior re-evaluation.

### 7. Commitment Durations

Plans are committed for a duration proportional to their path length, with a floor:

| Behavior | Minimum Commitment | Maximum Commitment |
|----------|-------------------|-------------------|
| Safety (retreat/kite) | 500ms | Until goal reached |
| Combat (rush/engage) | 500ms | Until goal reached |
| Objective (move to item) | 1000ms | Until goal reached |
| Exploration | 1000ms | Until goal reached |

The "until goal reached" means commitment lasts as long as the unit is making progress on its path. The minimum ensures at least N ticks of uninterrupted movement even if the situation changes slightly.

## Alternatives Considered

### Utility AI with Hysteresis

Score-based system where each behavior produces a 0.0-1.0 utility score, the active behavior gets a +0.2 momentum bonus, and a behavior must beat the incumbent by 0.15 to take over. Used in many commercial games (documented in Game AI Pro Ch. 9). Rejected because our behavior count is small (5-6) and the priority ordering is already correct -- the problem is re-evaluation frequency, not decision quality. Adding continuous scoring would require tuning response curves for marginal benefit.

### Behavior Trees with Blackboard

Industry standard (Unreal, CryEngine, Halo). Running nodes maintain state across ticks, so a "move to cell" sequence stays active until completion. Would solve the commitment problem naturally. Rejected as too heavy a refactor -- our behavior stack is functionally equivalent to a Selector node with priority ordering. We can get BT-like commitment semantics by adding plan metadata without rewriting the architecture.

### GOAP / HTN

Goal-Oriented Action Planning (F.E.A.R.) or Hierarchical Task Networks (Killzone). Both produce multi-step plans. Rejected as massive overkill -- our action space is 5-6 behaviors and plans are 1-2 steps long. The planning overhead is not justified.

### Influence Maps for Retreat

Maintain a 2D threat-influence grid updated every ~500ms. Units retreat down the gradient. Would produce smooth retreat paths without oscillation. Not rejected outright -- this is a good complement to the committed plan approach, specifically for computing retreat waypoints in step 5. Can be added later if pathfind-to-safe-cell proves insufficient.

## Consequences

### Positive

- Units commit to plans and follow through, eliminating oscillation
- Re-evaluation only on material world-state changes, not every tick
- Anti-backtracking rule prevents the most egregious failure mode (bouncing between two cells)
- Kiting uses pathfinding instead of greedy neighbor scan
- Architecture change is additive (new fields + early-return guard), not a rewrite

### Negative

- Units may occasionally continue a stale plan for up to the commitment duration before reacting to a change that is not covered by an invalidation trigger. This is a tuning concern, not an architectural one.
- Invalidation triggers must be wired into the relevant managers (LOS, CombatManager, MissionManager). This is additional coupling, but the events are natural extension points.
- The anti-backtracking ring buffer adds per-unit memory (negligible: 6 cell coords).

## Implementation Scope

Estimated files to modify (per task, respecting the 5-file limit):

**Task 1: Plan structure and commitment guard**

- `src/shared/types/units.ts` (add activePlan type)
- `src/engine/managers/UnitAI.ts` (commitment early-return)
- Each behavior file (set activePlan on commit) -- but this exceeds 5 files, so split by behavior pair

**Task 2: Kiting overhaul**

- `src/engine/ai/behaviors/SafetyBehavior.ts` (pathfind-based retreat)
- `src/engine/managers/UnitAI.ts` (if needed)

**Task 3: Invalidation trigger wiring**

- `src/engine/managers/UnitManager.ts` (trigger dispatch)
- `src/engine/managers/CombatManager.ts` (enemy visibility changes)
- `src/engine/LineOfSight.ts` (new area revealed)

**Task 4: Anti-backtracking**

- `src/shared/types/units.ts` (position history buffer)
- `src/engine/managers/MovementManager.ts` (record positions)
- `src/engine/ai/behaviors/SafetyBehavior.ts` (filter candidates)
- `src/engine/ai/behaviors/ExplorationBehavior.ts` (filter candidates)

## References

- ADR 0006: Autonomous Agent Architecture (original AI design)
- `docs/spec/ai.md` Section 2.1 (AVOID behavior spec)
- voidlock-mfmt1, voidlock-74rd, voidlock-ybvar.1 (prior bug fixes)
- Game AI Pro Ch. 9: Utility Theory (hysteresis/momentum concept)
- Game AI Pro Ch. 12: HTN Planners (plan commitment semantics)
