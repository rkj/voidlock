
import * as fs from 'fs';
import * as path from 'path';

// Minimal types to avoid importing from src
type Vector2 = { x: number; y: number };
type Cell = { x: number; y: number; type: "Floor" | "Void"; roomId?: string };
type WallDefinition = { p1: Vector2; p2: Vector2 };
type Door = { id: string; segment: Vector2[]; orientation: "Horizontal" | "Vertical"; state: "Closed" | "Open" | "Locked"; hp: number; maxHp: number; openDuration: number };
type SpawnPoint = { id: string; pos: Vector2; radius: number };
type ObjectiveDefinition = { id: string; kind: "Recover" | "Kill" | "Escort"; targetCell?: Vector2 };

const width = 8;
const height = 8;

const cells: Cell[] = [];
const walls: WallDefinition[] = [];
const doors: Door[] = [];
const spawnPoints: SpawnPoint[] = [];
const objectives: ObjectiveDefinition[] = [];
let squadSpawn: Vector2 = { x: 1, y: 5 };
let extraction: Vector2 = { x: 4, y: 1 };

// Define the path (7-8 cells)
const floorCells = [
    { x: 1, y: 5, roomId: "start" },
    { x: 1, y: 4, roomId: "corridor" },
    { x: 1, y: 3, roomId: "combat" },
    { x: 2, y: 3, roomId: "combat" },
    { x: 2, y: 2, roomId: "medkit" },
    { x: 3, y: 2, roomId: "objective" },
    { x: 4, y: 2, roomId: "objective" },
    { x: 4, y: 1, roomId: "extraction" }
];

// Fill cells
const floorSet = new Set(floorCells.map(c => `${c.x},${c.y}`));
for (const floor of floorCells) {
    cells.push({ x: floor.x, y: floor.y, type: "Floor", roomId: floor.roomId });
}

function isFloor(x: number, y: number) {
    return floorSet.has(`${x},${y}`);
}

// Vertical walls (right of x)
for (let y = 0; y < height; y++) {
    for (let x = -1; x < width; x++) { // check right edge of x
        if (isFloor(x, y) !== isFloor(x + 1, y)) {
            walls.push({ p1: { x: x + 1, y }, p2: { x: x + 1, y: y + 1 } });
        }
    }
}

// Horizontal walls (bottom of y)
for (let x = 0; x < width; x++) {
    for (let y = -1; y < height; y++) { // check bottom edge of y
        if (isFloor(x, y) !== isFloor(x, y + 1)) {
            walls.push({ p1: { x, y: y + 1 }, p2: { x: x + 1, y: y + 1 } });
        }
    }
}

// Doors
function addDoor(c1x: number, c1y: number, c2x: number, c2y: number, orientation: "Horizontal" | "Vertical") {
    // Remove the wall at this location
    // Wall between c1 and c2
    const minX = Math.min(c1x, c2x);
    const minY = Math.min(c1y, c2y);
    const maxX = Math.max(c1x, c2x);
    const maxY = Math.max(c1y, c2y);

    let p1: Vector2, p2: Vector2;
    if (orientation === "Horizontal") {
        // Wall at maxY, from minX to maxX+1
        p1 = { x: minX, y: maxY };
        p2 = { x: minX + 1, y: maxY };
    } else {
        // Wall at maxX, from minY to maxY+1
        p1 = { x: maxX, y: minY };
        p2 = { x: maxX, y: minY + 1 };
    }

    const wIdx = walls.findIndex(w => 
        (w.p1.x === p1.x && w.p1.y === p1.y && w.p2.x === p2.x && w.p2.y === p2.y) ||
        (w.p1.x === p2.x && w.p1.y === p2.y && w.p2.x === p1.x && w.p2.y === p1.y)
    );
    if (wIdx !== -1) walls.splice(wIdx, 1);

    doors.push({
        id: `door-${doors.length + 1}`,
        orientation,
        state: "Closed",
        hp: 50,
        maxHp: 50,
        openDuration: 1,
        segment: [{ x: c1x, y: c1y }, { x: c2x, y: c2y }]
    });
}

addDoor(1, 3, 1, 4, "Horizontal"); // Between Corridor (1,4) and Combat (1,3)

// Spawn Points (Enemies)
spawnPoints.push({
    id: "enemy-1",
    pos: { x: 2, y: 3 }, // In combat room
    radius: 0
});

// Objectives
objectives.push({
    id: "obj-main",
    kind: "Recover",
    targetCell: { x: 4, y: 2 }
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
    squadSpawns: [squadSpawn],
    extraction,
    objectives,
    bonusLoot: [
        { x: 2, y: 2 } // Medkit location
    ]
};

const output = JSON.stringify(map, null, 2);
fs.writeFileSync(path.join(__dirname, '../src/content/maps/prologue.json'), output);
console.log("New prologue.json generated successfully.");
