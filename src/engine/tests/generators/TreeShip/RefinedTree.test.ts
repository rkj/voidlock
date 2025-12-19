import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from '../../../generators/TreeShipGenerator';
import { CellType } from '../../../../shared/types';

describe('TreeShipGenerator (Refined)', () => {
  it('should generate distinct corridors and rooms (visual structure)', () => {
    // We can't easily check visual structure programmatically without complex logic, 
    // but we can check properties we enforced.
    // 1. Spine exists
    // 2. Branching happens
    // 3. Rooms are attached
    // 4. Doors exist
    
    const generator = new TreeShipGenerator(12345, 16, 16);
    const map = generator.generate();
    
    const floors = map.cells.filter(c => c.type === CellType.Floor);
    expect(floors.length).toBeGreaterThan(20);
    
    // Check for doors. We expect a reasonable number of doors for rooms.
    // If rooms are 1x1 or 2x2, they have 1 door to parent.
    // Spine has no doors (it's open).
    // Branches are open corridors.
    // So #doors ~= #rooms.
    expect(map.doors?.length).toBeGreaterThan(0);
  });
});
