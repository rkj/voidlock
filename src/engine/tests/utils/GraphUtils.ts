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

// Check if all Floor cells are connected (fully connected component)
export function checkConnectivity(map: MapDefinition): boolean {
    const floorCells = map.cells.filter(c => c.type === CellType.Floor);
    if (floorCells.length === 0) return true; // Empty map is connected? Or trivial.

    const start = floorCells[0];
    const visited = new Set<string>();
    const queue: {x: number, y: number}[] = [start];
    visited.add(`${start.x},${start.y}`);

    const getCell = (x: number, y: number) => map.cells.find(c => c.x === x && c.y === y);

    while (queue.length > 0) {
        const curr = queue.shift()!;
        const currCell = getCell(curr.x, curr.y);
        if (!currCell) continue;

        // Check neighbors
        // Connectivity is defined by OPEN WALLS.
        // TreeShipGenerator opens walls when placing rooms/doors.
        // So we check cell.walls property.
        
        const neighbors = [
            { dx: 0, dy: -1, wall: 'n' as const, opp: 's' as const },
            { dx: 0, dy: 1, wall: 's' as const, opp: 'n' as const },
            { dx: 1, dy: 0, wall: 'e' as const, opp: 'w' as const },
            { dx: -1, dy: 0, wall: 'w' as const, opp: 'e' as const }
        ];

        for (const n of neighbors) {
            // Check if wall is OPEN or if there is a DOOR
            let connected = !currCell.walls[n.wall];

            if (!connected && map.doors) {
                const nx = curr.x + n.dx;
                const ny = curr.y + n.dy;
                // Check if a door connects these two cells
                const hasDoor = map.doors.some(d => {
                    const hasC1 = d.segment.some(s => s.x === curr.x && s.y === curr.y);
                    const hasC2 = d.segment.some(s => s.x === nx && s.y === ny);
                    return hasC1 && hasC2;
                });
                if (hasDoor) connected = true;
            }

            if (connected) {
                const nx = curr.x + n.dx;
                const ny = curr.y + n.dy;
                const key = `${nx},${ny}`;
                
                if (!visited.has(key)) {
                    const neighborCell = getCell(nx, ny);
                    // Must be a Floor cell
                    if (neighborCell && neighborCell.type === CellType.Floor) {
                        visited.add(key);
                        queue.push({x: nx, y: ny});
                    }
                }
            }
        }
    }

    // Connectivity is valid if visited count equals floor cell count
    return visited.size === floorCells.length;
}

// Calculate fill rate (ratio of Floor cells to total grid size)
export function calculateFillRate(map: MapDefinition): number {
    const floorCount = map.cells.filter(c => c.type === CellType.Floor).length;
    const totalArea = map.width * map.height;
    return floorCount / totalArea;
}
