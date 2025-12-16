import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from '../../generators/TreeShipGenerator';
import { MapDefinition, CellType, Door } from '../../../shared/types';

describe('TreeShipGenerator Door Validation', () => {
  const checkDoors = (map: MapDefinition) => {
    map.doors?.forEach(door => {
      // Check all segments of the door
      door.segment.forEach(seg => {
        const { x, y } = seg;
        let c1, c2;

        if (door.orientation === 'Vertical') {
          // Door connects (x,y) and (x+1,y)
          c1 = map.cells.find(c => c.x === x && c.y === y);
          c2 = map.cells.find(c => c.x === x + 1 && c.y === y);
        } else {
          // Door connects (x,y) and (x,y+1)
          c1 = map.cells.find(c => c.x === x && c.y === y);
          c2 = map.cells.find(c => c.x === x && c.y === y + 1);
        }

        // Both must exist and be Floor
        if (!c1 || c1.type !== CellType.Floor || !c2 || c2.type !== CellType.Floor) {
            throw new Error(`Door ${door.id} at (${x},${y}) orientation ${door.orientation} connects to invalid/void cell. C1: ${c1?.type}, C2: ${c2?.type}`);
        }
      });
    });
  };

  it('should only place doors between two floor cells (100 iterations)', () => {
    for (let i = 0; i < 100; i++) {
      const generator = new TreeShipGenerator(i, 20, 20);
      const map = generator.generate();
      checkDoors(map);
    }
  });
});
