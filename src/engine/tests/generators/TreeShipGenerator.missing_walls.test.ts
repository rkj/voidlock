import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from '../../generators/TreeShipGenerator';
import { CellType } from '../../../shared/types';

describe('TreeShipGenerator Missing Walls Repro', () => {
  it('should generate correct walls for Seed 1766029929040 on 12x12 map', () => {
    const generator = new TreeShipGenerator(1766029929040, 12, 12);
    const map = generator.generate();

    const getCell = (x: number, y: number) => map.cells.find(c => c.x === x && c.y === y);
    const getType = (x: number, y: number) => {
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) return CellType.Wall;
        const c = getCell(x, y);
        return c ? c.type : CellType.Wall;
    };

    // Helper to verify wall exists against void
    const checkWallAgainstVoid = (x: number, y: number, dir: 'n'|'e'|'s'|'w') => {
        const cell = getCell(x, y);
        if (!cell || cell.type !== CellType.Floor) return; // Only care about floor cells

        let neighborType = CellType.Wall;
        if (dir === 'n') neighborType = getType(x, y - 1);
        if (dir === 'e') neighborType = getType(x + 1, y);
        if (dir === 's') neighborType = getType(x, y + 1);
        if (dir === 'w') neighborType = getType(x - 1, y);

        if (neighborType === CellType.Wall) {
            expect(cell.walls[dir], `Cell (${x},${y}) should have ${dir} wall against Void`).toBe(true);
        }
    };

    // Cell (5,3) missing East wall
    checkWallAgainstVoid(5, 3, 'e');

    // Cell (5,11) missing South wall
    checkWallAgainstVoid(5, 11, 's');

    // Cell (8,3) missing West wall
    checkWallAgainstVoid(8, 3, 'w');

    // Cell (10,5) missing South wall
    checkWallAgainstVoid(10, 5, 's');
  });
});
