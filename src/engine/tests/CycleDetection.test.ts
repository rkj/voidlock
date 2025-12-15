import { describe, it, expect } from 'vitest';
import { MapDefinition, CellType } from '../../shared/types'; // Assuming types are here

// --- Helper Functions (Copied from TreeShipGenerator.cycle.test.ts) ---

// Helper to convert MapDefinition to an adjacency list for graph traversal
function mapToAdjacencyList(map: MapDefinition): Map<string, string[]> {
  const adj = new Map<string, string[]>();

  map.cells.forEach(cell => {
    if (cell.type === CellType.Floor) {
      adj.set(`${cell.x},${cell.y}`, []);
    }
  });

  map.cells.forEach(cell => {
    if (cell.type === CellType.Floor) {
      const { x, y, walls } = cell;
      const cellKey = `${x},${y}`;

      const neighbors = [
        { dx: 0, dy: -1, wallCheck: walls.n, key: `${x},${y - 1}` }, // North
        { dx: 0, dy: 1, wallCheck: walls.s, key: `${x},${y + 1}` },  // South
        { dx: 1, dy: 0, wallCheck: walls.e, key: `${x + 1},${y}` },  // East
        { dx: -1, dy: 0, wallCheck: walls.w, key: `${x - 1},${y}` }  // West
      ];

      neighbors.forEach(neighbor => {
        const neighborCell = map.cells.find(c => c.x === x + neighbor.dx && c.y === y + neighbor.dy);
        // An edge exists if the wall is open AND the neighbor is also a Floor cell
        if (!neighbor.wallCheck && neighborCell && neighborCell.type === CellType.Floor) {
          adj.get(cellKey)?.push(neighbor.key);
        }
      });
    }
  });

  return adj;
}

// Cycle detection using DFS
function hasCycleDFS(adj: Map<string, string[]>): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, parent: string | null): boolean {
    visited.add(node);
    recursionStack.add(node);

    for (const neighbor of adj.get(node) || []) {
      if (neighbor === parent) continue; // Ignore edge to parent in undirected graph

      if (recursionStack.has(neighbor)) {
        return true; // Cycle detected
      }

      if (!visited.has(neighbor)) {
        if (dfs(neighbor, node)) {
          return true;
        }
      }
    }
    recursionStack.delete(node);
    return false;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      if (dfs(node, null)) {
        return true;
      }
    }
  }
  return false;
}

// --- Test Cases ---

describe('Cycle Detection Utilities', () => {

  it('should detect no cycles in a simple acyclic graph (line)', () => {
    const map: MapDefinition = {
      width: 3, height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: true } },
        { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: false } },
        { x: 2, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } },
      ],
      doors: [], spawnPoints: [], objectives: [], extraction: undefined
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(false);
  });

  it('should detect a simple cycle in a square graph', () => {
    const map: MapDefinition = {
      width: 2, height: 2,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: false, w: true } },
        { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: false, w: false } },
        { x: 0, y: 1, type: CellType.Floor, walls: { n: false, e: false, s: true, w: true } },
        { x: 1, y: 1, type: CellType.Floor, walls: { n: false, e: true, s: true, w: false } },
      ],
      doors: [], spawnPoints: [], objectives: [], extraction: undefined
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(true);
  });

  it('should detect no cycles in a map with disconnected components (acyclic)', () => {
    const map: MapDefinition = {
      width: 4, height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }, // Disconnected 1
        { x: 1, y: 0, type: CellType.Wall, walls: { n: true, e: true, s: true, w: true } },  // Wall
        { x: 2, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }, // Disconnected 2
        { x: 3, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }, // Disconnected 3
      ],
      doors: [], spawnPoints: [], objectives: [], extraction: undefined
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(false);
  });
  
  it('should detect a cycle in a more complex graph (figure 8)', () => {
    //   A---B
    //   |   |
    //   D---C---E
    //       |   |
    //       F---G
    const map: MapDefinition = {
        width: 5, height: 3,
        cells: [
            // Row 0
            { x: 0, y: 0, type: CellType.Floor, walls: { n:true, e:false, s:false, w:true } }, // A
            { x: 1, y: 0, type: CellType.Floor, walls: { n:true, e:true, s:false, w:false } },  // B
            { x: 2, y: 0, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            { x: 3, y: 0, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            { x: 4, y: 0, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            // Row 1
            { x: 0, y: 1, type: CellType.Floor, walls: { n:false, e:false, s:true, w:true } }, // D
            { x: 1, y: 1, type: CellType.Floor, walls: { n:false, e:false, s:false, w:false } }, // C
            { x: 2, y: 1, type: CellType.Floor, walls: { n:true, e:true, s:true, w:false } },  // E
            { x: 3, y: 1, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            { x: 4, y: 1, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            // Row 2
            { x: 0, y: 2, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            { x: 1, y: 2, type: CellType.Floor, walls: { n:false, e:false, s:true, w:true } }, // F
            { x: 2, y: 2, type: CellType.Floor, walls: { n:true, e:true, s:true, w:false } },  // G
            { x: 3, y: 2, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            { x: 4, y: 2, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
        ],
        doors: [], spawnPoints: [], objectives: [], extraction: undefined
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(true);
  });
});