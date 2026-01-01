# 5. Infinite Visibility & Stat Removal

**Date:** 2025-12-31
**Status:** Accepted

## Context

The game originally implemented a "Sight Range" stat (`sightRange`) for units, which defined a maximum radius for the Fog of War (FOW) calculation. This created a "lantern" effect where units could not see down long, unobstructed corridors if they exceeded their stat value.

This mechanic was deemed "ridiculous" and detrimental to the desired "Tactical Sci-Fi" experience, where visibility should be limited only by physical occlusion (walls, closed doors) rather than an arbitrary eye-strain limit.

## Decision

1.  **Remove `sightRange` from the Data Model**: The `sightRange` property will be removed from the `UnitStats` interface entirely. It will no longer be a configurable or displayable value.
2.  **Infinite Visibility Default**: The `LineOfSight` system will default to checking visibility for the entire map (or the effective map diagonal).
3.  **Occlusion Only**: Visibility is now strictly a function of "Line of Sight" (geometry), not "Range" (distance).

## Technical Implementation

-   **Performance**: The original `range` parameter served as an optimization (Bounding Box) for the raycasting algorithm.
-   **Mitigation**: The project has a strict constraint of **16x16 max map size** (`spec/map.md`). Iterating over 256 cells is computationally trivial.
    -   *Future Optimization*: Only relevant if map size constraints are lifted significantly (>128x128).
-   **Tests**: Extensive test suites relied on `sightRange` to create specific isolation scenarios. These tests must be updated to either accept global visibility or use walls/doors to construct the desired isolation.
