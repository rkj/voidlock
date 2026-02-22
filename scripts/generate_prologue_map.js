
const fs = require('fs');
const path = require('path');

const width = 6;
const height = 6;

const cells = [];
const walls = [];
const doors = [];
const spawnPoints = [];
const objectives = [];
let squadSpawn = { x: 1, y: 5 };
let extraction = { x: 5, y: 1 };

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
        }
    }
}

const floorSet = new Set(floorCells.map(c => `${c.x},${c.y}`));
function isFloor(x, y) {
    return floorSet.has(`${x},${y}`);
}

// Vertical walls (right of x)
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        // Wall between x and x+1
        const currentFloor = isFloor(x, y);
        const rightFloor = isFloor(x + 1, y);
        if (currentFloor !== rightFloor) {
            // Check if boundary is already processed? No need, strictly iterating right edges.
            // Wall at x+1 vertical.
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
    for (let y = 0; y < height; y++) {
        const currentFloor = isFloor(x, y);
        const bottomFloor = isFloor(x, y + 1);
        if (currentFloor !== bottomFloor) {
            walls.push({ p1: { x, y: y + 1 }, p2: { x: x + 1, y: y + 1 } });
        }
    }
    // Check top edge of y=0
    if (isFloor(x, 0)) {
        walls.push({ p1: { x, y: 0 }, p2: { x: x + 1, y: 0 } });
    }
}

function addDoor(x, y, orientation) {
    let segment;
    if (orientation === "Vertical") {
        // Wall at x+1
        const wIdx = walls.findIndex(w => 
            w.p1.x === x + 1 && w.p1.y === y && 
            w.p2.x === x + 1 && w.p2.y === y + 1
        );
        if (wIdx !== -1) walls.splice(wIdx, 1);
        segment = [{ x: x + 1, y }, { x: x + 1, y: y + 1 }];
    } else {
        // Wall at y+1 (bottom of cell x,y)
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

// Connections
// Corridor (1,3) -> Interaction (2,3) : Vertical Door between x=1 and x=2
addDoor(1, 3, "Vertical");

// Interaction (3,3) -> Objective (3,2) : Horizontal Door between y=3 and y=2?
// Wait, (3,2) is ABOVE (3,3). So the boundary is the top of (3,3) or bottom of (3,2).
// My iteration for Horizontal walls adds walls at y+1 (bottom).
// So for cell (3,2), the bottom wall is at y=3.
// For cell (3,3), the top wall is at y=3.
// So the boundary is at y=3.
// If I use addDoor(3, 2, "Horizontal"), it looks for wall at y+1 = 3. Correct.
addDoor(3, 2, "Horizontal");

// Objective (3,1) -> Extraction (4,1) : Vertical Door between x=3 and x=4
addDoor(3, 1, "Vertical");

// Spawn Points
spawnPoints.push({
    id: "enemy-1",
    pos: { x: 1, y: 3 },
    radius: 0
});

// Objectives
objectives.push({
    id: "obj-main",
    kind: "Recover",
    targetCell: { x: 3, y: 2 }
});

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
    bonusLoot: []
};

console.log(JSON.stringify(map, null, 2));
