import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from '../../generators/TreeShipGenerator';
import { MapGenerator } from '../../MapGenerator';
import { CellType } from '../../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

describe('TreeShipGenerator Repro Seed 1766029929040', () => {
    it('should generate fully open 2x2 rooms', () => {
        const seed = 1766029929040;
        const generator = new TreeShipGenerator(seed, 16, 16);
        const map = generator.generate();

        const ascii = MapGenerator.toAscii(map);
        const snapshotPath = path.join(__dirname, 'snapshots', 'TreeShipGenerator.repro_x0f.16x16.golden.txt');
        
        if (!fs.existsSync(path.dirname(snapshotPath))) {
            fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
        }

        if (!fs.existsSync(snapshotPath)) {
            fs.writeFileSync(snapshotPath, ascii);
        } else {
            const expectedAscii = fs.readFileSync(snapshotPath, 'utf8');
            expect(ascii).toBe(expectedAscii);
        }

        // Find all 2x2 blocks of floor
        // A 2x2 block is (x,y), (x+1,y), (x,y+1), (x+1,y+1) all Floor
        // We want to check if they have internal walls.
        
        for (let y = 0; y < map.height - 1; y++) {
            for (let x = 0; x < map.width - 1; x++) {
                const c00 = map.cells[y * map.width + x];
                const c10 = map.cells[y * map.width + (x + 1)];
                const c01 = map.cells[(y + 1) * map.width + x];
                const c11 = map.cells[(y + 1) * map.width + (x + 1)];

                if (c00.type === CellType.Floor && c10.type === CellType.Floor &&
                    c01.type === CellType.Floor && c11.type === CellType.Floor) {
                    
                    // We found a 2x2 block.
                    // This *could* be two corridors next to each other, but the spec says "No Nested Rooms" 
                    // and "2x2 room must be fully open internally".
                    // If it's a room, it should be open.
                    // Let's strictly check internal walls.
                    
                    // Check horizontal internal wall between (x,y) and (x,y+1) -> c00.walls.s and c01.walls.n
                    const wall_00_s = c00.walls.s;
                    const wall_01_n = c01.walls.n;
                    
                    // Check horizontal internal wall between (x+1,y) and (x+1,y+1) -> c10.walls.s and c11.walls.n
                    const wall_10_s = c10.walls.s;
                    const wall_11_n = c11.walls.n;

                    // Check vertical internal wall between (x,y) and (x+1,y) -> c00.walls.e and c10.walls.w
                    const wall_00_e = c00.walls.e;
                    const wall_10_w = c10.walls.w;

                    // Check vertical internal wall between (x,y+1) and (x+1,y+1) -> c01.walls.e and c11.walls.w
                    const wall_01_e = c01.walls.e;
                    const wall_11_w = c11.walls.w;

                    // Ideally, a 2x2 room has NO internal walls.
                    // However, if we just happen to have adjacent corridors, we might have walls.
                    // But TreeShip logic specifically builds rooms. 
                    // Let's assert that IF we have a 2x2 block, it should be open.
                    // Or specifically look for the "NW Room" mentioned in the bug.
                    // Let's fail if ANY internal wall exists in a 2x2 floor block, 
                    // because TreeShip shouldn't accidentally create 2x2 blocks that aren't rooms 
                    // (corridors are 1 wide).
                    
                    const hasInternalWall = wall_00_s || wall_01_n || wall_10_s || wall_11_n ||
                                            wall_00_e || wall_10_w || wall_01_e || wall_11_w;

                    if (hasInternalWall) {
                        const failedMapPath = path.join(__dirname, 'snapshots', 'TreeShipGenerator.repro_x0f.failed.txt');
                        fs.writeFileSync(failedMapPath, MapGenerator.toAscii(map));
                        expect(hasInternalWall, `Found 2x2 block at ${x},${y} with internal walls! See ${failedMapPath}`).toBe(false);
                    }
                }
            }
        }
    });
});
