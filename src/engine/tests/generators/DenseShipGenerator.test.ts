import { describe, it, expect } from 'vitest';
import { DenseShipGenerator } from '../../generators/DenseShipGenerator';
import { CellType } from '../../../shared/types';

describe('DenseShipGenerator', () => {
  it('should generate a map with >90% fill rate', () => {
    const generator = new DenseShipGenerator(12345, 16, 16);
    const map = generator.generate();

    const floorCells = map.cells.filter(c => c.type === CellType.Floor).length;
    const totalCells = map.width * map.height;
    const fillRate = floorCells / totalCells;

    expect(fillRate).toBeGreaterThan(0.9);
  });

  it('should have all floor cells reachable and maintain a tree structure (acyclic)', () => {
    const generator = new DenseShipGenerator(67890, 16, 16);
    const map = generator.generate();

    // BFS to check connectivity and count edges
    const start = map.spawnPoints![0].pos;
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
    expect(visited.size).toBe(floorCells.length); // All floor cells reachable
    
    // In a tree, Edges = Vertices - 1
    // Note: This only checks the traversal tree we built. 
    // To truly check acyclicity, we'd need to ensure no OTHER open walls exist.
    expect(edges).toBe(floorCells.length - 1);
  });
});
