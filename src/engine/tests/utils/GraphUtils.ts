import { MapDefinition, CellType } from '../../../shared/types';

// Helper to convert MapDefinition to an adjacency list for graph traversal
export function mapToAdjacencyList(map: MapDefinition): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  
  // Initialize all floor cells as nodes
  map.cells.forEach(cell => {
    if (cell.type === CellType.Floor) {
      adj.set(`${cell.x},${cell.y}`, []);
    }
  });

  // Add edges for open walls between Floor cells
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
export function hasCycleDFS(adj: Map<string, string[]>): boolean {
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

// Calculate fill rate (ratio of Floor cells to total grid size)
export function calculateFillRate(map: MapDefinition): number {
    const floorCount = map.cells.filter(c => c.type === CellType.Floor).length;
    const totalArea = map.width * map.height;
    return floorCount / totalArea;
}
