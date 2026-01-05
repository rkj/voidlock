import { TileDefinition } from "../shared/types";

/**
 * Space Hulk (1993) Tile Library
 * Based on the modular corridor and room tiles from the classic board game.
 * 
 * Coordinate system: x (column), y (row). (0,0) is top-left of the tile.
 * openEdges: list of edges that are NOT walled off within the tile.
 * doorSockets: suggested locations where doors can be placed.
 */
export const SpaceHulkTileLibrary: { [id: string]: TileDefinition } = {
  // --- Corridors ---
  
  corridor_1x1: {
    id: "corridor_1x1",
    width: 1,
    height: 1,
    cells: [{ x: 0, y: 0, openEdges: ["n", "s"] }],
    doorSockets: [
      { x: 0, y: 0, edge: "n" },
      { x: 0, y: 0, edge: "s" }
    ]
  },

  corridor_1x2: {
    id: "corridor_1x2",
    width: 1,
    height: 2,
    cells: [
      { x: 0, y: 0, openEdges: ["n", "s"] },
      { x: 0, y: 1, openEdges: ["n", "s"] }
    ],
    doorSockets: [
      { x: 0, y: 0, edge: "n" },
      { x: 0, y: 1, edge: "n" },
      { x: 0, y: 1, edge: "s" }
    ]
  },

  corridor_1x3: {
    id: "corridor_1x3",
    width: 1,
    height: 3,
    cells: [
      { x: 0, y: 0, openEdges: ["n", "s"] },
      { x: 0, y: 1, openEdges: ["n", "s"] },
      { x: 0, y: 2, openEdges: ["n", "s"] }
    ],
    doorSockets: [
      { x: 0, y: 0, edge: "n" },
      { x: 0, y: 1, edge: "n" },
      { x: 0, y: 2, edge: "n" },
      { x: 0, y: 2, edge: "s" }
    ]
  },

  corridor_1x4: {
    id: "corridor_1x4",
    width: 1,
    height: 4,
    cells: [
      { x: 0, y: 0, openEdges: ["n", "s"] },
      { x: 0, y: 1, openEdges: ["n", "s"] },
      { x: 0, y: 2, openEdges: ["n", "s"] },
      { x: 0, y: 3, openEdges: ["n", "s"] }
    ],
    doorSockets: [
      { x: 0, y: 0, edge: "n" },
      { x: 0, y: 1, edge: "n" },
      { x: 0, y: 2, edge: "n" },
      { x: 0, y: 3, edge: "n" },
      { x: 0, y: 3, edge: "s" }
    ]
  },

  // --- Junctions ---

  junction_t: {
    id: "junction_t",
    width: 1,
    height: 1,
    cells: [{ x: 0, y: 0, openEdges: ["n", "e", "s"] }],
    doorSockets: [
      { x: 0, y: 0, edge: "n" },
      { x: 0, y: 0, edge: "e" },
      { x: 0, y: 0, edge: "s" }
    ]
  },

  junction_cross: {
    id: "junction_cross",
    width: 1,
    height: 1,
    cells: [{ x: 0, y: 0, openEdges: ["n", "e", "s", "w"] }],
    doorSockets: [
      { x: 0, y: 0, edge: "n" },
      { x: 0, y: 0, edge: "e" },
      { x: 0, y: 0, edge: "s" },
      { x: 0, y: 0, edge: "w" }
    ]
  },

  corner_l: {
    id: "corner_l",
    width: 1,
    height: 1,
    cells: [{ x: 0, y: 0, openEdges: ["s", "e"] }],
    doorSockets: [
      { x: 0, y: 0, edge: "s" },
      { x: 0, y: 0, edge: "e" }
    ]
  },

  // --- Rooms ---

  room_3x3: {
    id: "room_3x3",
    width: 3,
    height: 3,
    cells: [
      // Top row
      { x: 0, y: 0, openEdges: ["e", "s"] },
      { x: 1, y: 0, openEdges: ["e", "w", "s", "n"] }, // Entry North
      { x: 2, y: 0, openEdges: ["w", "s"] },
      // Middle row
      { x: 0, y: 1, openEdges: ["n", "s", "e", "w"] }, // Entry West
      { x: 1, y: 1, openEdges: ["n", "e", "s", "w"] }, // Center
      { x: 2, y: 1, openEdges: ["n", "s", "w", "e"] }, // Entry East
      // Bottom row
      { x: 0, y: 2, openEdges: ["n", "e"] },
      { x: 1, y: 2, openEdges: ["n", "e", "w", "s"] }, // Entry South
      { x: 2, y: 2, openEdges: ["n", "w"] }
    ],
    doorSockets: [
      { x: 1, y: 0, edge: "n" },
      { x: 2, y: 1, edge: "e" },
      { x: 1, y: 2, edge: "s" },
      { x: 0, y: 1, edge: "w" }
    ]
  },

  room_2x2: {
    id: "room_2x2",
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, openEdges: ["e", "s", "n"] }, // Entry North
      { x: 1, y: 0, openEdges: ["w", "s", "e"] }, // Entry East
      { x: 0, y: 1, openEdges: ["n", "e", "w"] }, // Entry West
      { x: 1, y: 1, openEdges: ["n", "w", "s"] }  // Entry South
    ],
    doorSockets: [
      { x: 0, y: 0, edge: "n" },
      { x: 1, y: 0, edge: "e" },
      { x: 1, y: 1, edge: "s" },
      { x: 0, y: 1, edge: "w" }
    ]
  }
};