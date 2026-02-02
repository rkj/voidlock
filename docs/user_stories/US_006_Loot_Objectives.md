# US_006: Objective Extraction

## Persona & Goal

As a scavenger, I want to collect all available loot and objectives before extracting to maximize my Scrap gains.

## Prerequisites

- Tactical Mission active.
- Loot crate or Artifact visible on map.

## Action List

1. Select a unit.
2. Press `4` (Pickup) -> Target selection overlays appear on visible items.
3. Click/Press number for a "Data Disk" -> Unit moves to item.
4. Observe unit arrival -> Channeling progress bar appears (3.0s).
5. Observe completion -> Item disappears, unit Hud shows "Carrying Artifact".
6. Move unit to Extraction Zone (Green Grid) -> Unit begins "Extracting" (5.0s).

## Visual Acceptance Criteria

- Channeling progress bars are centered over the unit.
- Artifact icon appears next to the soldier name in the HUD when carried.
- Objectives list in the right panel updates from '○' to '✔' upon collection.
