import { describe, it, expect } from 'vitest';
import { MapGenerator } from '../../MapGenerator';
import { MapDefinition, CellType } from '../../../shared/types';

describe('MapGenerator Sanitize', () => {
    it('should fix one-way walls (inconsistent open/closed)', () => {
        const map: MapDefinition = {
            width: 2, height: 1,
            cells: [
                { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }, // 0,0 Closed East
                { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } }  // 1,0 Open West (Inconsistent)
            ],
            spawnPoints: [{id:'sp', pos:{x:1, y:0}, radius:1}], // Spawn at 1,0
            extraction: {x:1, y:0}
        };

        // Before sanitize
        expect(map.cells[0].walls.e).toBe(true);
        expect(map.cells[1].walls.w).toBe(false);

        MapGenerator.sanitize(map);

        // After sanitize
        // 0,0 is reachable from 1,0 because sanitizer uses '1,0' walls to traverse?
        // Sanitizer flood fill: checks !cell.walls[dir].
        // From 1,0 (West). 1,0.w is false. So can traverse to 0,0.
        // So 0,0 is reachable.
        
        // Consistency check should open 0,0 East.
        expect(map.cells[0].walls.e).toBe(false); // Fixed
        expect(map.cells[1].walls.w).toBe(false); // Remained Open
    });

    it('should close walls adjacent to Void/Wall', () => {
        const map: MapDefinition = {
            width: 2, height: 1,
            cells: [
                { x: 0, y: 0, type: CellType.Wall, walls: { n: true, e: true, s: true, w: true } },
                { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } } // Open to Wall
            ],
            spawnPoints: [{id:'sp', pos:{x:1, y:0}, radius:1}],
            extraction: {x:1, y:0}
        };

        MapGenerator.sanitize(map);

        expect(map.cells[1].walls.w).toBe(true); // Fixed (Closed)
    });
});
