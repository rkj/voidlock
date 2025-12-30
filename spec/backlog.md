# Backlog & Future Features

This document contains planned features and specifications that are not yet part of the core implemented game loop.

---

## Future Weapon System Integration (Planned)

_Refers to former section 3.3.5_

Currently, `accuracy` is a single stat conflating soldier skill and weapon performance. In the future (post-Weapon/Item implementation), this will be split:

- **Soldier Aim (Skill):** Base hit percentage (0-100).
- **Weapon Modifiers:**
  - **Accuracy Mod:** Bonus/Penalty to base aim (e.g., Sniper +10, Shotgun -20).
  - **Effective Range:** Replaces the hardcoded "5 tiles" constant in the formula.
- **Revised Formula:** `HitChance = ((SoldierAim + WeaponMod) / 100) * (WeaponEffectiveRange / Distance)`

---

## Campaign Screen (Placeholder for M9+)

_Refers to former section 8.2 (UI Screen Flow)_

1.  **Campaign Screen**
    - List of available missions (currently empty or "Coming Soon").
    - "Back" button -> Main Menu.

---

## Space Hulk (1993) map import plan

_Refers to former section 10_

Space Hulk maps are built from modular corridor/room tiles arranged on a square grid, with doors and entry points central to scenario setup. ([BoardGameGeek][2])

### Target import format

Define an intermediate “tile assembly” format:

```json
{
  "tileSet": "spacehulk-1993-2e",
  "tiles": [
    { "tileId": "corridor_1x4_A", "origin": [10, 5], "rotation": 90 },
    { "tileId": "room_3x3_B", "origin": [14, 5], "rotation": 0 }
  ],
  "doors": [{ "cell": [13, 5], "orientation": "E" }],
  "entryPoints": [{ "cell": [2, 18], "id": "EP1" }],
  "extraction": { "cell": [30, 2] },
  "objectives": [{ "kind": "Recover", "cells": [[20, 9]] }]
}
```

### Import pipeline

1.  **Tile definitions library** (manually authored once): each tile is a set of occupied floor cells relative to origin, plus door sockets.
2.  Assemble tiles → rasterize to `CellGrid`.
3.  Validate connectivity, door placement legality, spawn points and objective reachability.
4.  Save as native `MapDefinition` for the engine.

### Legal note (practical constraint)

Do not ship copyrighted scans/assets. Keep importer expecting **user-provided** definitions or community-authored _clean-room_ tile geometry.

---

## Implementation milestones (Future)

_Refers to former section 11_

- **M8+**: Campaign Mode & Advanced Progression (See Beads for details).
