# src/engine/generators

This directory contains specific implementations of map generation strategies.

## Files

- `SpaceshipGenerator.ts`: A generator that builds spaceship-like layouts using a constructive spanning-tree algorithm to guarantee connectivity (ADR 0014).
- `TreeShipGenerator.ts`: Generates maps with a strict tree structure (no cycles) starting from corridors, aiming for a claustrophobic feel.
- `DenseShipGenerator.ts`: A high-density generator designed for maximum floor coverage and exploration depth.
- `SectorMapGenerator.ts`: Generates the campaign sector map (DAG) with varying node types and connectivity. Now supports dynamic length (ranks) based on the campaign's `mapGrowthRate` to ensure players reach the 12x12 map size cap.
- `PlacementValidator.ts`: Utility for tracking occupied cells and enforcing entity placement exclusivity (Squad Spawn, Enemy Spawn, Extraction, Objectives).

## Functionality

- **Procedural Generation**: Uses seeded randomness to create diverse map layouts. Now standardized to produce corner-to-corner geometric segments for `WallDefinition`.
- **Constraints**: Adheres to strict rules about room sizes, corridor widths, and connectivity (e.g., no "open walls to nowhere").
- **Validation**: Includes logic to ensure generated maps are valid and playable.

## Connections

- Implements interfaces or patterns used by `src/engine/MapGenerator.ts`.
- Depends on `src/shared/PRNG.ts` and `src/shared/types.ts`.
