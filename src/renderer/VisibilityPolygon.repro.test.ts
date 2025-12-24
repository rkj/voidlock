import { describe, it, expect } from 'vitest';
import { VisibilityPolygon } from './VisibilityPolygon';
import { MapDefinition, CellType, Vector2 } from '../shared/types';

describe('VisibilityPolygon Repro', () => {
    it('should NOT block horizontal ray with a vertical logical door segment', () => {
        // 6x6 Map
        const map: MapDefinition = {
            width: 6, height: 6,
            cells: [],
            doors: [{
                id: 'd-4',
                orientation: 'Horizontal', 
                state: 'Closed',
                // Logical segment connecting (1,2) and (1,3). 
                // This is a Vertical line geometrically (x=1, y=2 to 3)!
                segment: [{ x: 1, y: 2 }, { x: 1, y: 3 }],
                hp: 10, maxHp: 10, openDuration: 1
            }],
            spawnPoints: [], objectives: []
        };

        // Fill cells with open walls
        for (let y = 0; y < 6; y++) {
            for (let x = 0; x < 6; x++) {
                map.cells.push({ x, y, type: CellType.Floor, walls: { n: false, e: false, s: false, w: false } });
            }
        }

        // Add a wall at the end of the corridor to ensure rays are cast that way
        const cell02 = map.cells.find(c => c.x === 0 && c.y === 2);
        if (cell02) cell02.walls.w = true;

        const origin = { x: 3.5, y: 2.5 };
        const range = 10;

        const polygon = VisibilityPolygon.compute(origin, range, map);

        // Check if ANY point in the polygon has reached x < 1 (the target cell) inside the corridor
        const reachedTargetCorridor = polygon.some(p => p.x < 1 && p.y >= 2 && p.y <= 3);
        
        expect(reachedTargetCorridor, "LOS should reach cell 0,2").toBe(true);
    });
});
