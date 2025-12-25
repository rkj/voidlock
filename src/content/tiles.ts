import { TileDefinition } from "../shared/types";

export const SpaceHulkTiles: Record<string, TileDefinition> = {
  corridor_1x1: {
    id: "corridor_1x1",
    width: 1,
    height: 1,
    cells: [
      { x: 0, y: 0, openEdges: ["n", "s"] }, // Vertical corridor
    ],
  },
  corridor_1x2: {
    id: "corridor_1x2",
    width: 1,
    height: 2,
    cells: [
      { x: 0, y: 0, openEdges: ["n", "s"] },
      { x: 0, y: 1, openEdges: ["n", "s"] },
    ],
  },
  corridor_1x3: {
    id: "corridor_1x3",
    width: 1,
    height: 3,
    cells: [
      { x: 0, y: 0, openEdges: ["n", "s"] },
      { x: 0, y: 1, openEdges: ["n", "s"] },
      { x: 0, y: 2, openEdges: ["n", "s"] },
    ],
  },
  junction_t: {
    id: "junction_t",
    width: 1,
    height: 1,
    cells: [
      { x: 0, y: 0, openEdges: ["n", "e", "s"] }, // T-junction facing East
    ],
  },
  junction_cross: {
    id: "junction_cross",
    width: 1,
    height: 1,
    cells: [{ x: 0, y: 0, openEdges: ["n", "e", "s", "w"] }],
  },
  corner: {
    id: "corner",
    width: 1,
    height: 1,
    cells: [
      { x: 0, y: 0, openEdges: ["n", "e"] }, // L-corner North-East
    ],
  },
  room_3x3: {
    id: "room_3x3",
    width: 3,
    height: 3,
    cells: [
      // Top row
      { x: 0, y: 0, openEdges: ["e", "s"] },
      { x: 1, y: 0, openEdges: ["e", "s", "w", "n"] }, // Open North for connection? Or closed? Usually rooms have specific entry points.
      // Let's assume Room 3x3 has openings in the center of each wall.
      { x: 2, y: 0, openEdges: ["s", "w"] },
      // Middle row
      { x: 0, y: 1, openEdges: ["n", "e", "s", "w"] }, // Entry West
      { x: 1, y: 1, openEdges: ["n", "e", "s", "w"] }, // Center
      { x: 2, y: 1, openEdges: ["n", "e", "s", "w"] }, // Entry East
      // Bottom row
      { x: 0, y: 2, openEdges: ["n", "e"] },
      { x: 1, y: 2, openEdges: ["n", "e", "w", "s"] }, // Entry South
      { x: 2, y: 2, openEdges: ["n", "w"] },
    ],
  },
};
