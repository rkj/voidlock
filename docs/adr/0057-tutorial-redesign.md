# ADR 0057: Tutorial Redesign - Scripted Scenario with Visible Controls

## Status
Proposed

## Context

### The Problem
The current tutorial (Prologue Mission 1) is broken and provides a terrible first-time player experience. Specific issues:

1. **Hidden controls**: The HUD is completely hidden (`setMissionHUDVisible(false)`) at mission start. The soldier panel, command buttons, threat meter, and objectives panel are all invisible. The player has no way to issue commands except by already knowing keyboard shortcuts ([1-4] for selection) or clicking directly on the map.

2. **Chicken-and-egg UI disclosure**: The HUD is only revealed when the `objective_sighted` tutorial step triggers, which requires the player to navigate across the entire map to get LOS on the objective. But the commands needed to navigate are hidden in the HUD. The "start" blocking message tells the player to "select a unit with [1-4]" but the soldier panel itself is invisible.

3. **Invulnerable soldier with no stakes**: The soldier's HP is clamped to 1, so the player can just stand and trade blows with the XenoMite forever. There is no sense of danger, urgency, or consequence. The tutorial teaches players that combat doesn't matter.

4. **No Director suppression**: The Director runs identically to normal missions. It can spawn additional enemies during the prologue, creating unscripted chaos in what should be a tightly controlled environment.

5. **Blind exploration model**: The tutorial relies on the regular AI (auto-explore) to carry the player forward. There is no scripted movement guidance (e.g., waypoints, highlighted cells). The player either watches the AI play itself or tries to click on the map with no visible feedback.

6. **Sequential step dependencies are fragile**: Each tutorial step requires the previous one to complete (`completedSteps.has("enemy_sighted") && checkObjectiveVisible(state)`). If any step's condition fails or fires out of order, the entire sequence breaks silently.

### Prior Work
- ADR 0042: Original prologue design (Advisor system, static map, sequential zones)
- ADR 0049: Progressive disclosure (UI lockdown, multi-mission unlock sequence)
- The implementation partially followed these ADRs but the result is not playable

### What Other Games Do
Good tutorials in tactical games (XCOM, Into the Breach, Invisible Inc, Fire Emblem) share common patterns:

- **Controls are always visible.** The tutorial highlights specific UI elements, it never hides them. Hiding the entire HUD is hostile to the player.
- **Directed action, not autonomy.** The game tells the player "click HERE" and highlights the target, rather than hoping the AI or the player figures it out.
- **Immediate consequence, not invulnerability.** The player sees a unit take damage and understands HP matters. If invulnerability is needed, it should be invisible (e.g., the enemy just doesn't attack hard enough to kill, or a scripted rescue happens).
- **Scripted encounters, not procedural.** Enemy placement, timing, and behavior are fully controlled. No Director, no random spawns.
- **Short, fast, completable in 2-3 minutes.** The prologue should be the shortest mission in the game, not a full-length mission with hidden UI.

## Decision

### Core Principle: Visible, Directed, Consequential

The tutorial must always show the player what they can do, tell them what to do next, and let them feel the consequences of their actions.

### 1. Always-Visible HUD with Highlights

**Never hide the HUD.** All UI elements (soldier panel, command buttons, objectives, threat meter) are visible from the start. Instead of hiding controls and revealing them, the tutorial **highlights** specific elements when they become relevant.

- **Highlight system**: A pulsing glow or arrow overlay on the relevant UI element (e.g., "click this soldier card", "click Move", "click this cell"). The highlight is visually distinct (animated border, arrow indicator) and attached to a specific DOM element.
- **Dimming** (optional): Non-relevant UI elements can be dimmed (opacity: 0.5) but never hidden (display: none). The player should always see the full UI shape even if some parts are not yet active.
- **Input gating**: During a directed step, only the highlighted action is clickable. Other buttons are visually present but disabled. This prevents the player from skipping ahead while keeping the UI visible.

### 2. Scripted Scenario with Waypoints

Replace the "hope the player explores" model with explicit scripted steps. Each step has:

- A **directive**: text telling the player what to do ("Move your soldier to the marked cell")
- A **highlight target**: a UI element or map cell that pulses
- A **completion condition**: what the player must do to advance (e.g., unit reaches cell X, enemy dies, objective picked up)
- A **gate**: input is restricted to only the relevant action until the step completes

**Step sequence for Mission 1:**

| Step | Directive | Highlight | Completion | Notes |
|------|-----------|-----------|------------|-------|
| 1. Select unit | "Click your soldier to select them" | Soldier card in panel | Unit is selected | Keyboard [1] also works |
| 2. Move | "Click the highlighted cell to move" | Target cell on map (2-3 cells ahead) | Unit reaches cell | Teaches click-to-move |
| 3. Door | "Your soldier will open the door automatically" | Door cell | Door opens | Passive step, auto-advances |
| 4. Combat intro | "Enemy spotted! Your soldier fires automatically" | Enemy unit + threat meter | Enemy takes damage | Pause briefly, explain threat meter |
| 5. Survive combat | "Keep fighting!" | None (free play) | Enemy dies | Player watches auto-combat or manually engages |
| 6. Objective | "Move to the objective to recover it" | Objective cell on map | Objective collected | Teaches objective interaction |
| 7. Extract | "Move to the extraction zone to complete the mission" | Extraction cell | Unit extracts | Teaches extraction |

### 3. Honest Difficulty Instead of Invulnerability

Remove the HP clamp (`Math.max(1, ...)`) for the prologue. Instead, make the encounter genuinely survivable:

- **Weak enemy**: The tutorial XenoMite should have reduced stats (e.g., 20 HP, 5 damage, 30% accuracy) so the soldier wins easily but still takes visible damage.
- **Medkit**: Place a medkit on the path between combat and the objective, and add a tutorial step to teach item pickup/usage.
- **If the soldier "dies"**: Instead of invisible invulnerability, show a scripted rescue ("Mother" advisor intervenes, heals the unit to 50% HP, and says "Emergency medical protocol engaged. Be more careful, Commander."). This teaches the player that HP matters while preventing a softlock.

### 4. Director Suppressed

During `MissionType.Prologue`, the Director MUST NOT spawn additional enemies. The only enemy on the map is the one pre-placed in the static map. This ensures the encounter is 100% scripted and predictable.

### 5. Simplified Map

The current prologue map (9 cells in an L-shape across a 6x6 grid) is adequate in layout but the zones should be tighter:

- Start room (1 cell) -> short corridor (1-2 cells) -> combat room (2 cells) -> objective room (2 cells) -> extraction (1 cell)
- Total: 7-8 walkable cells, completable in 2-3 minutes
- One door between corridor and combat room (teaches doors)
- Enemy pre-placed in combat room (not in the corridor where the player starts)
- Medkit between combat room and objective room

### 6. Tutorial Step Engine

Replace the current condition-polling approach with an explicit state machine:

```
TutorialStep {
  id: string;
  directive: string;              // Text shown to player
  advisorMessage?: AdvisorMessage; // Optional blocking modal (for narrative beats)
  highlightTarget?: {
    type: "ui-element" | "map-cell" | "unit";
    selector: string;             // CSS selector or cell coordinate
  };
  completionCondition: (state: GameState) => boolean;
  inputGate?: {                   // Restrict input to specific actions
    allowedActions: string[];     // e.g., ["select-unit", "move-to-cell"]
  };
  onEnter?: () => void;           // Side effects when step activates
  onComplete?: () => void;        // Side effects when step completes
}
```

The step engine:
- Maintains a `currentStepIndex: number`
- On each game state update, checks ONLY the current step's completion condition (not all steps)
- Advances to the next step when the condition is met
- No dependency chains, no out-of-order firing, no fragile step.has() checks

### 7. Mission 2 and 3 (Unchanged Scope)

The progressive unlock flow for Mission 2 (Ready Room) and Mission 3 (Sector Map) from ADR 0049 is sound in concept and does not need a redesign. The fixes here are scoped to Mission 1 only.

## Alternatives Considered

### Keep hidden HUD with better messaging
Could improve the blocking messages to be more explicit about keyboard shortcuts. Rejected because hiding the entire UI is fundamentally hostile -- the player should always see what's available, even if some parts are disabled.

### Full non-interactive cinematic
Replace the tutorial with a video or scripted animation showing gameplay. Rejected because learn-by-doing is always more effective than learn-by-watching, and it would require significant asset creation.

### Skip tutorial entirely, use tooltips
Show contextual tooltips on first encounter with each mechanic. Rejected because tooltips are easily dismissed and forgotten, and don't provide the scripted "safe first encounter" that a prologue provides.

## Consequences

### Positive
- Player always sees the full UI, reducing confusion
- Directed steps eliminate the "what do I do?" paralysis
- Honest difficulty teaches real combat consequences
- State machine is simpler and more robust than condition-chain polling
- Director suppression prevents unscripted chaos
- Completable in 2-3 minutes (shortest mission)

### Negative
- Requires a highlight/pulse system for UI elements (new visual component)
- Input gating requires integration with the command system to filter allowed actions
- Removing invulnerability requires tuning the tutorial enemy to be very weak
- Scripted rescue (if soldier "dies") is a new mechanic only used once

### Migration
- ADR 0042 and 0049 are superseded for Mission 1 behavior. Their concepts for Mission 2/3 progressive unlock remain valid.
- The existing TutorialManager, AdvisorOverlay, and prologue map are refactored, not replaced.

## Implementation Scope

**Task 1: Always-visible HUD + highlight system**
- UIOrchestrator.ts (remove setMissionHUDVisible(false) for prologue)
- New highlight component (CSS pulse/arrow overlay)
- TutorialManager.ts (highlight API)

**Task 2: Tutorial step engine (state machine)**
- TutorialManager.ts (replace condition-chain with step machine)
- Define step sequence with directives + completion conditions

**Task 3: Input gating during tutorial steps**
- CommandExecutor or MenuController (filter allowed actions per step)
- TutorialManager.ts (expose current allowed actions)

**Task 4: Director suppression in prologue**
- Director.ts (skip spawning when MissionType.Prologue)

**Task 5: Honest difficulty (remove invulnerability, weak enemy, scripted rescue)**
- CombatManager.ts (remove HP clamp)
- EnemyManager.ts (remove HP clamp)
- GameConstants.ts or prologue config (tutorial enemy stats)
- TutorialManager.ts (scripted rescue logic)

**Task 6: Updated prologue map + medkit placement**
- prologue.json (update map, add medkit loot)

**Task 7: Regression tests**
- Tests for step sequencing, highlight triggers, input gating, Director suppression

## References
- ADR 0042: Tutorial System - The Prologue (original design, partially superseded)
- ADR 0049: Guided Progressive Disclosure (Mission 2/3 flow, still valid)
- `docs/spec/tutorial.md` (spec to be updated alongside this ADR)
