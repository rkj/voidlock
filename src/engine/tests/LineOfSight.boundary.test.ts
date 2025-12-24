import { describe, it, expect } from 'vitest';
import { LineOfSight } from '../LineOfSight';
import { GameGrid } from '../GameGrid';
import { CellType, MapDefinition } from '../../shared/types';

describe('LOS Boundary Logic', () => {
    it('should handle unit exactly on cell boundary', () => {
        const map: MapDefinition = {
            width: 3, height: 3,
            cells: Array.from({ length: 9 }, (_, i) => ({
                x: i % 3, y: Math.floor(i / 3), type: CellType.Floor,
                walls: { n: false, e: false, s: false, w: false }
            }))
        };
        const grid = new GameGrid(map);
        const los = new LineOfSight(grid.getGraph(), new Map());
        
        // Unit at 1.0, 2.5 (Left edge of 1,2)
        // Target at 0.5, 2.5 (Center of 0,2)
        const unitPos = { x: 1.0, y: 2.5 };
        const target = { x: 0.5, y: 2.5 };
        
        const hasLos = los.hasLineOfSight(unitPos, target);
        expect(hasLos).toBe(true);
    });

    it('should handle unit slightly inside cell boundary', () => {
        const map: MapDefinition = {
            width: 3, height: 3,
            cells: Array.from({ length: 9 }, (_, i) => ({
                x: i % 3, y: Math.floor(i / 3), type: CellType.Floor,
                walls: { n: false, e: false, s: false, w: false }
            }))
        };
        const grid = new GameGrid(map);
        const los = new LineOfSight(grid.getGraph(), new Map());
        
        const unitPos = { x: 1.0000001, y: 2.5 };
        const target = { x: 0.5, y: 2.5 };
        
        const hasLos = los.hasLineOfSight(unitPos, target);
        expect(hasLos).toBe(true);
    });
});