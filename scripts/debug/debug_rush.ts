import { CoreEngine } from "./src/engine/CoreEngine.js";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  AIProfile,
  EnemyType,
} from "./src/shared/types/index.js";
import { isCellVisible } from "./src/shared/VisibilityUtils.js";

const mockMap = {
  width: 10,
  height: 10,
  cells: [],
  spawnPoints: [],
  extraction: { x: 9, y: 9 },
  objectives: [],
};
for (let y = 0; y < 10; y++) {
  for (let x = 0; x < 10; x++) {
    mockMap.cells.push({ x, y, type: "Floor" });
  }
}

const defaultSquad = {
  soldiers: [{ archetypeId: "scout" }],
  inventory: {},
};
const engine = new CoreEngine(mockMap, 123, defaultSquad, true, true);
engine.clearUnits();

engine.addUnit({
  id: "u1",
  pos: { x: 0.5, y: 0.5 },
  hp: 100,
  maxHp: 100,
  state: "Idle",
  stats: {
    damage: 20,
    fireRate: 500,
    accuracy: 1000,
    soldierAim: 100,
    attackRange: 2, // Short range
    speed: 200,
    equipmentAccuracyBonus: 0,
  },
  aiProfile: "RUSH",
  aiEnabled: true,
  commandQueue: [],
  archetypeId: "scout",
  kills: 0,
  damageDealt: 0,
  objectivesCompleted: 0,
});

engine.addEnemy({
  id: "e1",
  type: "XenoMite",
  pos: { x: 3.5, y: 0.5 },
  hp: 100,
  maxHp: 100,
  damage: 10,
  fireRate: 500,
  accuracy: 1000,
  attackRange: 2,
  speed: 0,
  difficulty: 1,
});

for (let i = 0; i < 6; i++) {
  engine.update(16.66);
  const u = engine.getState().units[0];
  console.log(`Tick ${i}: state=${u.state}, activeCommand=${u.activeCommand?.type}, pos=${u.pos.x}, ${u.pos.y}, dist=${Math.sqrt((u.pos.x - 3.5)**2 + (u.pos.y - 0.5)**2)}`);
}
