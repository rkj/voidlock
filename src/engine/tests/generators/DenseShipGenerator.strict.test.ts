import { describe, it, expect } from 'vitest';
import { DenseShipGenerator } from '../../generators/DenseShipGenerator';
import { MapGenerator } from '../../MapGenerator';
import { CellType } from '../../../shared/types';

describe('DenseShipGenerator Strict', () => {
  it('should generate a valid starship layout for Seed 1766029929040', () => {
    const generator = new DenseShipGenerator(1766029929040, 12, 12);
    const map = generator.generate();

    console.log(`
Map Dump (Seed 1766029929040):
${MapGenerator.toAscii(map)}
`);
    console.log(`
Debug Map:
${generator.toDebugString()}
`);

    // 1. Check for Room Rectangularity & Dimensions
    // Group by roomId
    const rooms = new Map<string, {x: number, y: number}[]>();
    map.cells.forEach(c => {
        if (c.type === CellType.Floor && c.roomId) {
            if (!rooms.has(c.roomId)) rooms.set(c.roomId, []);
            rooms.get(c.roomId)!.push({x: c.x, y: c.y});
        }
    });

    rooms.forEach((cells, id) => {
        if (id.startsWith('room-')) {
            const xs = cells.map(c => c.x);
            const ys = cells.map(c => c.y);
            const w = Math.max(...xs) - Math.min(...xs) + 1;
            const h = Math.max(...ys) - Math.min(...ys) + 1;
            
            // Must be rectangular
            expect(cells.length, `Room ${id} is not rectangular`).toBe(w * h);
            
            // Must be 1x1, 1x2, 2x1, or 2x2
            const valid = (w === 1 && h === 1) || (w === 1 && h === 2) || (w === 2 && h === 1) || (w === 2 && h === 2);
            expect(valid, `Room ${id} has invalid dims ${w}x${h}`).toBe(true);
        }
    });

    // 2. Verify Acyclic Tree Structure (Connectivity)
    // BFS to check connectivity and count edges
    if (map.spawnPoints && map.spawnPoints.length > 0) {
        const start = map.spawnPoints[0].pos;
        const visited = new Set<string>();
        const queue = [start];
        visited.add(`${start.x},${start.y}`);

        let edges = 0;
        let head = 0;
        while (head < queue.length) {
            const curr = queue[head++];
            const cell = map.cells.find(c => c.x === curr.x && c.y === curr.y)!;

            const neighbors = [
                { x: curr.x + 1, y: curr.y, wall: 'e' },
                { x: curr.x - 1, y: curr.y, wall: 'w' },
                { x: curr.x, y: curr.y + 1, wall: 's' },
                { x: curr.x, y: curr.y - 1, wall: 'n' }
            ];

            neighbors.forEach(n => {
                if (n.x >= 0 && n.x < map.width && n.y >= 0 && n.y < map.height) {
                    // Check if passage exists (wall is open OR door exists)
                    const hasWall = (cell.walls as any)[n.wall];
                    const hasDoor = map.doors?.some(d => 
                        d.segment.some(s => s.x === curr.x && s.y === curr.y) &&
                        d.segment.some(s => s.x === n.x && s.y === n.y)
                    );

                    if (!hasWall || hasDoor) {
                        // Found an edge
                        if (!visited.has(`${n.x},${n.y}`)) {
                            visited.add(`${n.x},${n.y}`);
                            queue.push(n);
                            edges++;
                        }
                    }
                }
            });
        }

        const floorCells = map.cells.filter(c => c.type === CellType.Floor);
        // All floor cells must be reachable
        expect(visited.size, 'Not all floor cells are reachable').toBe(floorCells.length);
        
        // Tree property: Edges = Vertices - 1
        expect(edges, 'Graph contains cycles').toBe(floorCells.length - 1);
    }
  });
});
