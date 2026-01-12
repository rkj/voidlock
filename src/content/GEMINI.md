# src/content

This directory contains static data definitions for the game, specifically tile libraries used by the map generator.

## Files

- `spaceHulkTiles.ts`: Contains `SpaceHulkTileLibrary`, a collection of tile definitions based on the 1993 Space Hulk board game (corridors, rooms, junctions).
- `tiles.ts`: Contains `SpaceHulkTiles`, another set of tile definitions including 1x1, 1x2, 1x3 corridors, junctions, corners, and 3x3 rooms.
- `CampaignEvents.ts`: Contains `CampaignEvents`, a collection of narrative events for the campaign mode.

## Functionality

- **Tile Definitions**: Each tile is defined by its dimensions (`width`, `height`) and a list of cells. Each cell specifies its relative position and which edges are "open" (`n`, `e`, `s`, `w`). Open edges allow movement and line-of-sight between cells and between adjacent tiles when assembled. Tiles can also include `doorSockets`, which define recommended locations for door placement at tile boundaries or internal segments.

## Connections

- Used by `src/engine/MapGenerator.ts` (and potentially other generators) to assemble complex maps from modular pieces.
- Depends on types defined in `src/shared/types.ts`.
