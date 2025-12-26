# src/engine/generators

This directory contains specific implementations of map generation strategies.

## Files

- `SpaceshipGenerator.ts`: A generator that builds spaceship-like layouts, often involving corridors and rooms.
- `TreeShipGenerator.ts`: Generates maps with a strict tree structure (no cycles) starting from corridors, aiming for a claustrophobic feel.
- `DenseShipGenerator.ts`: A high-density generator designed for maximum floor coverage and exploration depth.

## Functionality

- **Procedural Generation**: Uses seeded randomness to create diverse map layouts.
- **Constraints**: Adheres to strict rules about room sizes, corridor widths, and connectivity (e.g., no "open walls to nowhere").
- **Validation**: Includes logic to ensure generated maps are valid and playable.

## Connections

- Implements interfaces or patterns used by `src/engine/MapGenerator.ts`.
- Depends on `src/shared/PRNG.ts` and `src/shared/types.ts`.
