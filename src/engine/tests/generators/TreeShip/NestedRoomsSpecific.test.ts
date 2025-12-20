import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from '../../../generators/TreeShipGenerator';
import { MapGenerator } from '../../../MapGenerator';
import { CellType } from '../../../../shared/types';

describe('TreeShipGenerator Nested Room Specific', () => {
  it('should match snapshots for seed 1766029929040', async () => {
    const seed = 1766029929040;
    const generator = new TreeShipGenerator(seed, 8, 8);
    const map = generator.generate();

    const ascii = MapGenerator.toAscii(map);
    const json = JSON.stringify(map, null, 2);

    // Write JSON to file for permanent reference as requested
    const jsonPath = path.join(__dirname, 'NestedRoomsSpecific.map.json');
    fs.writeFileSync(jsonPath, json);

    // Expectations using snapshots
    await expect(ascii).toMatchFileSnapshot('./snapshots/NestedRoomsSpecific.ascii.txt');
    await expect(json).toMatchFileSnapshot('./snapshots/NestedRoomsSpecific.json');

    // Scan for 2x2 floor blocks
    for (let y = 0; y < map.height - 1; y++) {
      for (let x = 0; x < map.width - 1; x++) {
        const c00 = map.cells.find(c => c.x === x && c.y === y);
        const c10 = map.cells.find(c => c.x === x + 1 && c.y === y);
        const c01 = map.cells.find(c => c.x === x && c.y === y + 1);
        const c11 = map.cells.find(c => c.x === x + 1 && c.y === y + 1);

        if (
          c00?.type === CellType.Floor &&
          c10?.type === CellType.Floor &&
          c01?.type === CellType.Floor &&
          c11?.type === CellType.Floor
        ) {
          // Found a 2x2 floor block. Check internal walls.
          
          const isEdgeOpen = (cell: any, dir: 'n'|'e'|'s'|'w') => {
              return !cell.walls[dir];
          };

          const hasDoor = (cx: number, cy: number, dir: 'n'|'e'|'s'|'w') => {
              return map.doors?.some(d => {
                  const [p1, p2] = d.segment;
                  const isC1 = p1.x === cx && p1.y === cy;
                  const isC2 = p2.x === cx && p2.y === cy;
                  if (!isC1 && !isC2) return false;
                  
                  let d2: any = null;
                  if (p1.x === cx && p1.y === cy) {
                      if (p2.x === cx + 1) d2 = 'e';
                      else if (p2.x === cx - 1) d2 = 'w';
                      else if (p2.y === cy + 1) d2 = 's';
                      else if (p2.y === cy - 1) d2 = 'n';
                  } else {
                      if (p1.x === cx + 1) d2 = 'e';
                      else if (p1.x === cx - 1) d2 = 'w';
                      else if (p1.y === cy + 1) d2 = 's';
                      else if (p1.y === cy - 1) d2 = 'n';
                  }
                  return d2 === dir;
              });
          };

          const e1 = isEdgeOpen(c00, 'e') && !hasDoor(x, y, 'e');
          const e2 = isEdgeOpen(c00, 's') && !hasDoor(x, y, 's');
          const e3 = isEdgeOpen(c10, 's') && !hasDoor(x + 1, y, 's');
          const e4 = isEdgeOpen(c01, 'e') && !hasDoor(x, y + 1, 'e');

          expect(e1, `Edge (0,0)-E at ${x},${y} should be open`).toBe(true);
          expect(e2, `Edge (0,0)-S at ${x},${y} should be open`).toBe(true);
          expect(e3, `Edge (1,0)-S at ${x},${y} should be open`).toBe(true);
          expect(e4, `Edge (0,1)-E at ${x},${y} should be open`).toBe(true);
        }
      }
    }
  });
});
