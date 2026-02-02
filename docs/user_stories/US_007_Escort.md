# US_007: V.I.P. Protection

## Persona & Goal

As a tactical commander, I want to use the Escort command to protect a vulnerable VIP while they move toward extraction.

## Prerequisites

- Active mission of type "Escort VIP".
- VIP and at least one soldier are alive and visible.

## Action List

1. Select a Soldier (Press `1-4`).
2. Press `1` (Orders) -> Orders menu opens.
3. Press `4` (Escort) -> Target selection overlays appear on friendly units.
4. Observe Target Options -> **ONLY** the VIP (or an artifact carrier) should have a selection number. Standard soldiers must NOT be targets.
5. Press the number corresponding to the VIP -> Soldier enters "Escorting" state.
6. Observe the Soldier -> Moves toward the VIP and adjusts speed to match.

## Visual Acceptance Criteria

- Context Header in menu shows "Orders > Escort".
- VIP selection overlay is distinct and high-contrast.
- Soldier's status label in HUD shows "Escorting [VIP Name]".
- The "Escort" menu option is disabled if only one unit (the VIP) is alive.
