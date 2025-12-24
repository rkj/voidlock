import { describe, it, expect } from 'vitest';
import { LineOfSight } from '../LineOfSight';
import { Grid, CellType, Door } from '../../shared/types';

class MockGrid implements Grid {
  width = 3;
  height = 3;
  walls = {
      '1,2': { w: false }, // 1,2 connects to 0,2
      '0,2': { e: false }
  };
  
  isWalkable(x: number, y: number) { return true; }
  canMove(fx: number, fy: number, tx: number, ty: number, doors: any) {
      if (fx === 1 && fy === 2 && tx === 0 && ty === 2) return true;
      if (fx === 0 && fy === 2 && tx === 1 && ty === 2) return true;
      return false; // Only 0,2 <-> 1,2 allowed for test
  }
}

describe('LOS Boundary Logic', () => {
    it('should handle unit exactly on cell boundary', () => {
        const grid = new MockGrid();
        const los = new LineOfSight(grid, new Map());
        
        // Unit at 1.0, 2.5 (Left edge of 1,2)
        // Target at 0.5, 2.5 (Center of 0,2)
        const unitPos = { x: 1.0, y: 2.5 };
        const target = { x: 0.5, y: 2.5 };
        
        const hasLos = los.hasLineOfSight(unitPos, target);
        console.log(`LOS from 1.0, 2.5 to 0.5, 2.5: ${hasLos}`);
        expect(hasLos).toBe(true);
    });

    it('should handle unit slightly inside cell boundary', () => {
        const grid = new MockGrid();
        const los = new LineOfSight(grid, new Map());
        
        const unitPos = { x: 1.0000001, y: 2.5 };
        const target = { x: 0.5, y: 2.5 };
        
        const hasLos = los.hasLineOfSight(unitPos, target);
        console.log(`LOS from 1.0000001, 2.5 to 0.5, 2.5: ${hasLos}`);
        expect(hasLos).toBe(true);
    });
});
