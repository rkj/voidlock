import { describe, it, expect } from 'vitest';
import { MapValidator } from '@src/engine/map/MapValidator';
import { MapDefinition, CellType, WallDefinition, Door, SpawnPoint, ObjectiveDefinition, Vector2 } from '@src/shared/types';
import * as fs from 'fs';
import * as path from 'path';

describe('Prologue Map Generation & Validation', () => {
    it('should generate a valid prologue map', () => {
        const width = 6;
        const height = 6;
        const floorCells = [
            { x: 1, y: 5, roomId: "start" },
            { x: 1, y: 4, roomId: "corridor" },
            { x: 1, y: 3, roomId: "corridor" },
            { x: 2, y: 3, roomId: "interaction" },
            { x: 3, y: 3, roomId: "interaction" },
            { x: 3, y: 2, roomId: "objective" },
            { x: 3, y: 1, roomId: "objective" },
            { x: 4, y: 1, roomId: "extraction" },
            { x: 5, y: 1, roomId: "extraction" }
        ];

        const cells = floorCells.map(c => ({
            x: c.x,
            y: c.y,
            type: CellType.Floor,
            roomId: c.roomId
        }));

        const floorSet = new Set(floorCells.map(c => `${c.x},${c.y}`));
        const isFloor = (x: number, y: number) => floorSet.has(`${x},${y}`);

        const walls: WallDefinition[] = [];
        const openBoundaries = new Set<string>();

        // Doors
        const doors: Door[] = [];
        const addDoor = (x: number, y: number, orientation: "Horizontal" | "Vertical") => {
            const id = `door-${doors.length + 1}`;
            
            let segment: Vector2[];
            if (orientation === "Vertical") {
                 // Door between (x,y) and (x+1,y)
                 const k = [`${x},${y}`, `${x+1},${y}`].sort().join("--");
                 openBoundaries.add(k);
                 segment = [{x, y}, {x: x+1, y}];
            } else {
                 // Door between (x,y) and (x,y+1)
                 const k = [`${x},${y}`, `${x},${y+1}`].sort().join("--");
                 openBoundaries.add(k);
                 segment = [{x, y}, {x, y: y+1}];
            }
            doors.push({
                id,
                orientation,
                state: "Closed",
                hp: 50,
                maxHp: 50,
                openDuration: 1,
                segment
            });
        };

        // Note: x,y in addDoor refers to the Top-Left cell of the pair
        addDoor(1, 3, "Vertical");   // (1,3)-(2,3)
        addDoor(3, 2, "Horizontal"); // (3,2)-(3,3)
        addDoor(3, 1, "Vertical");   // (3,1)-(4,1)

        // Generate Walls
        // Vertical boundaries
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width - 1; x++) {
                // Boundary between (x,y) and (x+1,y)
                const key = [`${x},${y}`, `${x+1},${y}`].sort().join("--");
                
                const f1 = isFloor(x, y);
                const f2 = isFloor(x + 1, y);
                
                if (f1 && f2) {
                    // Internal connection. Open.
                } else {
                    // Either one is void, or both are void.
                    // If not a door, add wall.
                    if (!openBoundaries.has(key)) {
                        walls.push({ p1: { x: x + 1, y }, p2: { x: x + 1, y: y + 1 } });
                    }
                }
            }
        }
        
        // Horizontal boundaries
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height - 1; y++) {
                const key = [`${x},${y}`, `${x},${y+1}`].sort().join("--");
                const f1 = isFloor(x, y);
                const f2 = isFloor(x, y + 1);
                
                if (f1 && f2) {
                     // Open
                } else {
                    if (!openBoundaries.has(key)) {
                        walls.push({ p1: { x, y: y + 1 }, p2: { x: x + 1, y: y + 1 } });
                    }
                }
            }
        }

        // Map Borders
        // Left (x=0)
        for(let y=0; y<height; y++) walls.push({ p1: {x:0, y}, p2: {x:0, y: y+1} });
        // Right (x=width)
        for(let y=0; y<height; y++) walls.push({ p1: {x:width, y}, p2: {x:width, y: y+1} });
        // Top (y=0)
        for(let x=0; x<width; x++) walls.push({ p1: {x, y:0}, p2: {x: x+1, y:0} });
        // Bottom (y=height)
        for(let x=0; x<width; x++) walls.push({ p1: {x, y:height}, p2: {x: x+1, y:height} });


        const map: MapDefinition = {
            width,
            height,
            cells,
            walls,
            doors,
            spawnPoints: [{ id: "enemy-1", pos: { x: 1, y: 3 }, radius: 0 }],
            squadSpawn: { x: 1, y: 5 },
            squadSpawns: [{ x: 1, y: 5 }],
            extraction: { x: 5, y: 1 },
            objectives: [{ id: "obj-main", kind: "Recover", targetCell: { x: 3, y: 2 } }],
            bonusLoot: []
        };
        
        // Write file
        const outputPath = path.resolve(process.cwd(), 'src/content/maps/prologue.json');
        fs.writeFileSync(outputPath, JSON.stringify(map, null, 2));
        
        // Validate
        const validation = MapValidator.validate(map);
        if (!validation.isValid) {
            console.error(JSON.stringify(validation.issues, null, 2));
        }
        expect(validation.isValid).toBe(true);
    });
});
