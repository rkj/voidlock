
import { MissionManager } from "./src/engine/managers/MissionManager";
import { GameState, MissionType, CellType, MapGeneratorType } from "./src/shared/types";
import { PRNG } from "./src/shared/PRNG";

// Mock dependencies
const prng = new PRNG(12345);
const missionManager = new MissionManager(prng);

const mockMap = {
    width: 10,
    height: 10,
    cells: [
        { x: 5, y: 5, type: CellType.Floor, roomId: "room-1" }
    ],
    objectives: [
        { id: "map-obj-1", kind: "Recover", targetCell: { x: 5, y: 5 } }
    ],
    extraction: { x: 0, y: 0 }
};

const state: Partial<GameState> = {
    t: 0,
    seed: 12345,
    missionType: MissionType.Default,
    map: mockMap as any,
    units: [],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [],
    stats: {
        aliensKilled: 0,
        scrapGained: 0,
        intelGained: 0,
        unitsLost: 0,
        shotsFired: 0,
        shotsHit: 0
    } as any,
    settings: {
        debugOverlayEnabled: false
    } as any
};

console.log("--- CASE 1: MissionType.Default (Should be optional loot, but currently mandatory) ---");
missionManager.initializeObjectives(state as GameState, { soldiers: [], inventory: {} });
console.log("Objectives:", JSON.stringify(state.objectives, null, 2));
const hasMapObj = state.objectives?.some(o => o.id === "map-obj-1");
console.log("Has map-obj-1 in objectives?", hasMapObj);

console.log("
--- CASE 2: MissionType.DestroyHive (Should be optional loot) ---");
state.missionType = MissionType.DestroyHive;
state.objectives = [];
missionManager.initializeObjectives(state as GameState, { soldiers: [], inventory: {} });
console.log("Objectives:", JSON.stringify(state.objectives, null, 2));
const hasMapObj2 = state.objectives?.some(o => o.id === "map-obj-1");
console.log("Has map-obj-1 in objectives?", hasMapObj2);

console.log("
--- CASE 3: MissionType.RecoverIntel (Should be mandatory) ---");
state.missionType = MissionType.RecoverIntel;
state.objectives = [];
missionManager.initializeObjectives(state as GameState, { soldiers: [], inventory: {} });
console.log("Objectives:", JSON.stringify(state.objectives, null, 2));
const hasMapObj3 = state.objectives?.some(o => o.id === "map-obj-1");
console.log("Has map-obj-1 in objectives?", hasMapObj3);
