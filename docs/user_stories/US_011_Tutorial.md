# US_011: First Contact (Prologue Tutorial)

## Persona & Goal

As a new player, I want to be guided through my first mission so that I learn the core mechanics before facing real challenges.

## Prerequisites

- New campaign started with "Simulation (Tutorial)" difficulty.
- Prologue mission launched from the Ready Room.

## Action List

### Phase 1: Observation
1. Mission begins → Advisor briefing dialog appears ("OPERATOR NOTICE: OPERATION FIRST LIGHT").
2. Click ACKNOWLEDGE → Game starts, unit explores autonomously.
3. Directive: "ASSET DEPLOYMENT INITIALIZED. Observe asset autonomous exploration."
4. Observe unit moving → Step auto-advances when unit moves 2+ cells from start.

### Phase 2: UI Tour
5. Directive updates to UI tour text → Wait ~5 seconds for auto-advance.

### Phase 3: Pause
6. Directive: "Pause the simulation using [Space] or the Pause button."
7. Press Space → Game pauses, step advances.

### Phase 4: Doors
8. Directive updates about doors → Wait for unit to open a door (auto-advance).

### Phase 5: Combat
9. Enemy sighted → Advisor message "ALERT: BIOLOGICAL CONTACT".
10. Click ACKNOWLEDGE → Observe unit engaging enemy automatically.
11. Step advances when enemy takes damage.

### Phase 6: Engagement — Ignore
12. Advisor message "TUTORIAL: REMOTE INTERVENTION" appears.
13. Click ACKNOWLEDGE → Directive: "Press [2] Engagement > [2] Ignore."
14. Press 2 → Engagement submenu appears (Engage / Ignore).
15. Press 2 → "Ignore (Run)" selected, unit selection appears.
16. Press 1 → La Forge set to Ignore (🏃 icon appears on soldier card).

### Phase 7: Engagement — Engage
17. Directive: "Press [2] > [1] to re-authorize engagement."
18. Press 2 → 1 → 1 → La Forge set back to Engage (⚔️ icon).
19. Step advances when enemy dies.

### Phase 8: Move to Objective
20. Advisor message "NOTICE: RECOVERY TARGET LOCATED".
21. Click ACKNOWLEDGE → Directive: "Press [1] Orders > [1] Move To Room > Select COMPARTMENT."
22. Press 1 → Orders submenu. Press 1 → Move To Room. Click target room → Select unit.
23. Unit moves to objective room → Step auto-advances when unit is within 1.5 cells of objective.

### Phase 9: Pickup
24. Directive: "Press [4] Pickup > Select DATA DISK."
25. Press 4 → Pickup submenu. Press 1 → "Collect Objective". Press 1 → Select La Forge.
26. Unit begins channeling (3s progress bar) → Item disappears on completion.
27. Step advances when unit has `carriedObjectiveId` set.

### Phase 10: Extract
28. Advisor message about extraction appears.
29. Click ACKNOWLEDGE → Directive: "Move to extraction zone and press [5] Extract."
30. Press 5 → Extract command. Select unit → Unit moves to extraction zone.
31. Unit begins extracting (5s) → Mission ends with "Won" status.

## Visual Acceptance Criteria

- Tutorial directive bar is visible at top of screen throughout, with green text on dark background.
- Advisor messages appear as modal overlays with portrait, illustration, and ACKNOWLEDGE button.
- Highlighted elements (soldier cards, command menu items, map cells) have a pulsing green border.
- Cell highlights track correctly when map is panned/zoomed.
- Soldier card shows correct engagement icon (⚔️ for Engage, 🏃 for Ignore).
- Channeling progress bar is centered over the unit during pickup.
- Objective list updates from ○ to ✔ upon collection.
- No tutorial steps get stuck or skip unexpectedly.
- All directive text fits within the directive bar without truncation.

## Known Issues

- **voidlock-tut01**: Pickup step gets stuck because objective id "obj-1" is not recognized as carryable by the engine. The tutorial condition checks `carriedObjectiveId` which is never set.
