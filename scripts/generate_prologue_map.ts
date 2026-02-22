
import * as fs from 'fs';
import * as path from 'path';

// Minimal types to avoid importing from src
type Vector2 = { x: number; y: number };
type Cell = { x: number; y: number; type: "Floor" | "Void"; roomId?: string };
type WallDefinition = { p1: Vector2; p2: Vector2 };
type Door = { id: string; segment: Vector2[]; orientation: "Horizontal" | "Vertical"; state: "Closed" | "Open" | "Locked"; hp: number; maxHp: number; openDuration: number };
type SpawnPoint = { id: string; pos: Vector2; radius: number };
type ObjectiveDefinition = { id: string; kind: "Recover" | "Kill" | "Escort"; targetCell?: Vector2 };

const width = 6;
const height = 6;

const cells: Cell[] = [];
const walls: WallDefinition[] = [];
const doors: Door[] = [];
const spawnPoints: SpawnPoint[] = [];
const objectives: ObjectiveDefinition[] = [];
let squadSpawn: Vector2 = { x: 1, y: 5 };
let extraction: Vector2 = { x: 5, y: 1 };

// Define the path
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

// Fill cells
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const floor = floorCells.find(c => c.x === x && c.y === y);
        if (floor) {
            cells.push({ x, y, type: "Floor", roomId: floor.roomId });
        } else {
            // implicit void, but MapDefinition expects all cells or at least the ones in the grid?
            // Usually we only list Floor cells in the JSON to save space, assuming Void for others if strictly sparse.
            // But MapFactory.ts logic initializes grid with Void then updates.
            // Let's include only Floor cells.
        }
    }
}

// Add walls automatically around floor cells
// A wall exists if a floor cell is adjacent to a non-floor cell (or out of bounds)
const floorSet = new Set(floorCells.map(c => `${c.x},${c.y}`));

function isFloor(x: number, y: number) {
    return floorSet.has(`${x},${y}`);
}

// Vertical walls (right of x)
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) { // check right edge of x
        if (isFloor(x, y) !== isFloor(x + 1, y)) {
            walls.push({ p1: { x: x + 1, y }, p2: { x: x + 1, y: y + 1 } });
        }
    }
    // Check left edge of x=0
    if (isFloor(0, y)) {
        walls.push({ p1: { x: 0, y }, p2: { x: 0, y: y + 1 } });
    }
}

// Horizontal walls (bottom of y)
for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) { // check bottom edge of y
        if (isFloor(x, y) !== isFloor(x, y + 1)) {
            walls.push({ p1: { x, y: y + 1 }, p2: { x: x + 1, y: y + 1 } });
        }
    }
    // Check top edge of y=0
    if (isFloor(x, 0)) {
        walls.push({ p1: { x, y: 0 }, p2: { x: x + 1, y: 0 } });
    }
}

// Doors
// Door 1: (1,3) -> (2,3) (Vertical)
// Door 2: (3,3) -> (3,2) (Horizontal)
// Door 3: (3,1) -> (4,1) (Vertical)

function addDoor(x: number, y: number, orientation: "Horizontal" | "Vertical") {
    // Remove the wall at this location
    let segment: Vector2[];
    if (orientation === "Vertical") {
        // Wall is at x+1, from y to y+1
        // Actually the door coordinates usually align with the wall.
        // If door is between (1,3) and (2,3), the wall is at x=2.
        // So passed x should be 1 if we mean "right of 1".
        // Let's say x,y is the cell to the Left/Top of the door.
        
        // Remove wall at x+1
        const wIdx = walls.findIndex(w => 
            w.p1.x === x + 1 && w.p1.y === y && 
            w.p2.x === x + 1 && w.p2.y === y + 1
        );
        if (wIdx !== -1) walls.splice(wIdx, 1);
        
        segment = [{ x: x + 1, y }, { x: x + 1, y: y + 1 }];
    } else {
        // Horizontal: Bottom of y
        const wIdx = walls.findIndex(w => 
            w.p1.x === x && w.p1.y === y + 1 && 
            w.p2.x === x + 1 && w.p2.y === y + 1
        );
        if (wIdx !== -1) walls.splice(wIdx, 1);

        segment = [{ x, y: y + 1 }, { x: x + 1, y: y + 1 }];
    }

    doors.push({
        id: `door-${doors.length}`,
        orientation,
        state: "Closed",
        hp: 50,
        maxHp: 50,
        openDuration: 1,
        segment
    });
}

addDoor(1, 3, "Vertical");   // Between Corridor (1,3) and Interaction (2,3) -> Wall at x=2
addDoor(3, 2, "Horizontal"); // Between Interaction (3,3) and Objective (3,2) -> Wall at y=3. Wait, 3,2 is ABOVE 3,3. So wall is at bottom of 3,2 (y=3).
// Correct: (3,2) is y=2. (3,3) is y=3.
// Wall is between y=2 and y=3.
// So it's bottom of (3,2).
addDoor(3, 2, "Horizontal"); 

addDoor(3, 1, "Vertical");   // Between (3,1) and (4,1) -> Wall at x=4

// Spawn Points (Enemies)
spawnPoints.push({
    id: "enemy-1",
    pos: { x: 1, y: 3 }, // In corridor
    radius: 0
});

// Objectives
objectives.push({
    id: "obj-main",
    kind: "Recover", // "Recover" logic for Interaction Room? Or Objective Room?
    // Task says: "Interaction Room -> Objective Room".
    // "Objective Room" likely has the main objective.
    // "Interaction Room" might have a loot crate or secondary obj.
    // Let's put the main objective in Objective Room (3,2)
    targetCell: { x: 3, y: 2 }
});

// Map Definition
const map = {
    width,
    height,
    cells,
    walls,
    doors,
    spawnPoints,
    squadSpawn,
    extraction,
    objectives
};

console.log(JSON.stringify(map, null, 2));
