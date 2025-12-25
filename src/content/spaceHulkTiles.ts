import { TileDefinition } from "../shared/types";

export const SpaceHulkTileLibrary: { [id: string]: TileDefinition } = {
  // 1x1 Corridor Tile
  corridor_1x1_A: {
    id: "corridor_1x1_A",
    width: 1,
    height: 1,
    cells: [
      { x: 0, y: 0, openEdges: ["n", "s"] }, // Open North and South, making it a straight vertical corridor
    ],
  },
  // 1x2 Corridor Tile
  corridor_1x2_A: {
    id: "corridor_1x2_A",
    width: 1,
    height: 2,
    cells: [
      { x: 0, y: 0, openEdges: ["n", "s"] }, // Connects North and South
      { x: 0, y: 1, openEdges: ["n", "s"] }, // Connects North and South
    ],
  },
  // 2x1 Corridor Tile
  corridor_2x1_A: {
    id: "corridor_2x1_A",
    width: 2,
    height: 1,
    cells: [
      { x: 0, y: 0, openEdges: ["w", "e"] }, // Open West and East
      { x: 1, y: 0, openEdges: ["w", "e"] }, // Open West and East
    ],
  },
  // Basic 2x2 Room Tile (all internal walls open)
  room_2x2_A: {
    id: "room_2x2_A",
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, openEdges: ["e", "s"] },
      { x: 1, y: 0, openEdges: ["w", "s"] },
      { x: 0, y: 1, openEdges: ["n", "e"] },
      { x: 1, y: 1, openEdges: ["n", "w"] },
    ],
  },
  // T-Junction (vertical entry, horizontal exits)
  junction_T_A: {
    id: "junction_T_A",
    width: 3,
    height: 3,
    cells: [
      { x: 1, y: 0, openEdges: ["s"] }, // Entry point
      { x: 0, y: 1, openEdges: ["e"] },
      { x: 1, y: 1, openEdges: ["n", "e", "w"] }, // Junction center
      { x: 2, y: 1, openEdges: ["w"] },
      { x: 1, y: 2, openEdges: ["n"] }, // Exit point (straight through)
    ],
  },
};
