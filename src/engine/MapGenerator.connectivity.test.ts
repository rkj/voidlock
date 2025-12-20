import { describe, it, expect } from 'vitest';
import { MapGenerator } from './MapGenerator';
import { SpaceshipGenerator } from './generators/SpaceshipGenerator';
import { TreeShipGenerator } from './generators/TreeShipGenerator';
import { CellType, MapDefinition } from '../shared/types';

describe('MapGenerator Connectivity Guarantee', () => {
    const checkConnectivity = (map: MapDefinition, seed: number, genName: string) => {
        // 1. Validate using existing validator (checks for unreachable floor cells)
        // We need a dummy generator instance to access validate, or make it static.
        // It's not static.
        const validator = new MapGenerator(0);
        const result = validator.validate(map);
        
        expect(result.isValid, `${genName} seed ${seed} failed validation: ${result.issues.join(', ')}`).toBe(true);

        // 2. Additional check for "open walls to nowhere"
        for (const cell of map.cells) {
            if (cell.type !== CellType.Floor) continue;

            // Check all 4 neighbors
            const dirs = ['n', 'e', 's', 'w'] as const;
            const offsets = { n: {x:0, y:-1}, e: {x:1, y:0}, s: {x:0, y:1}, w: {x:-1, y:0} };

            for (const dir of dirs) {
                if (!cell.walls[dir]) {
                    // Wall is open, neighbor must be Floor
                    const off = offsets[dir];
                    const nx = cell.x + off.x;
                    const ny = cell.y + off.y;
                    
                    // Check bounds
                    if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) {
                            // Open to edge of map implies Void
                            expect.fail(`${genName} seed ${seed}: Cell ${cell.x},${cell.y} is open ${dir} to map edge (Void)`);
                            continue;
                    }

                    const neighbor = map.cells[ny * map.width + nx];
                    expect(neighbor.type, `${genName} seed ${seed}: Cell ${cell.x},${cell.y} is open ${dir} to Void cell ${nx},${ny}`).toBe(CellType.Floor);

                    // Check consistency: Neighbor must also have open wall
                    const opp = { n: 's', e: 'w', s: 'n', w: 'e' }[dir] as 'n'|'e'|'s'|'w';
                    expect(neighbor.walls[opp], `${genName} seed ${seed}: One-way wall detected! Cell ${cell.x},${cell.y} has open ${dir} wall, but neighbor ${nx},${ny} has closed ${opp} wall.`).toBe(false);
                }
            }
        }
    };

    it('MapGenerator: should never generate unreachable Floor cells or open walls to Void', () => {
        const attempts = 50; 
        for (let i = 0; i < attempts; i++) {
            const generator = new MapGenerator(i);
            const map = generator.generate(16, 16);
            checkConnectivity(map, i, 'MapGenerator');
        }
    });

    it('SpaceshipGenerator: should never generate unreachable Floor cells or open walls to Void', () => {
        const attempts = 50; 
        for (let i = 0; i < attempts; i++) {
            const generator = new SpaceshipGenerator(i, 32, 32);
            const map = generator.generate();
            checkConnectivity(map, i, 'SpaceshipGenerator');
        }
    });

    it('TreeShipGenerator: should never generate unreachable Floor cells or open walls to Void', () => {
        const attempts = 50; 
        for (let i = 0; i < attempts; i++) {
            const generator = new TreeShipGenerator(i, 16, 16);
            const map = generator.generate();
            checkConnectivity(map, i, 'TreeShipGenerator');
        }
    });
});
