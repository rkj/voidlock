import { MapDefinition, CellType } from '../../../shared/types';
import { Graph } from '../../Graph';

// Helper to convert MapDefinition to an adjacency list for graph traversal
export function mapToAdjacencyList(map: MapDefinition): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const graph = new Graph(map);
  
  for (let y = 0; y < graph.height; y++) {
      for (let x = 0; x < graph.width; x++) {
          const cell = graph.cells[y][x];
          if (cell.type === CellType.Floor) {
              const cellKey = `${x},${y}`;
              adj.set(cellKey, []);
              
              const neighbors: {dx: number, dy: number, d: 'n'|'e'|'s'|'w'}[] = [
                  { dx: 0, dy: -1, d: 'n' },
                  { dx: 0, dy: 1, d: 's' },
                  { dx: 1, dy: 0, d: 'e' },
                  { dx: -1, dy: 0, d: 'w' }
              ];

              for (const {dx, dy, d} of neighbors) {
                  const nx = x + dx;
                  const ny = y + dy;
                  const b = cell.edges[d];
                  if (b && (!b.isWall || b.doorId)) {
                      const nCell = graph.cells[ny]?.[nx];
                      if (nCell && nCell.type === CellType.Floor) {
                          adj.get(cellKey)?.push(`${nx},${ny}`);
                      }
                  }
              }
          }
      }
  }

  return adj;
}

// Cycle detection using DFS
export function hasCycleDFS(adj: Map<string, string[]>): boolean {
  const visited = new Set<string>();

  function dfs(node: string, parent: string | null): boolean {
    visited.add(node);

    for (const neighbor of adj.get(node) || []) {
      if (neighbor === parent) continue; // Ignore edge to parent in undirected graph

      if (visited.has(neighbor)) {
        return true; // Cycle detected
      }

      if (dfs(neighbor, node)) {
        return true;
      }
    }

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

// Check if all Floor cells are connected (fully connected component)
export function checkConnectivity(map: MapDefinition): boolean {
    const adj = mapToAdjacencyList(map);
    if (adj.size === 0) return true;

    const start = adj.keys().next().value;
    if (!start) return true;
    const visited = new Set<string>();
    const queue: string[] = [start];
    visited.add(start);

    while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const neighbor of adj.get(curr) || []) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }

    return visited.size === adj.size;
}

// Calculate fill rate (ratio of Floor cells to total grid size)
export function calculateFillRate(map: MapDefinition): number {
    const floorCount = map.cells.filter(c => c.type === CellType.Floor).length;
    const totalArea = map.width * map.height;
    return floorCount / totalArea;
}