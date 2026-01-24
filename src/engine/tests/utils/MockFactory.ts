import {
  Unit,
  UnitState,
  Enemy,
  EnemyType,
  GameState,
  EngineMode,
} from "../../../shared/types";

export function createMockUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "mock-unit",
    pos: { x: 0, y: 0 },
    hp: 100,
    maxHp: 100,
    state: UnitState.Idle,
    stats: {
      damage: 20,
      fireRate: 600,
      accuracy: 95,
      soldierAim: 90,
      attackRange: 10,
      speed: 20,
      equipmentAccuracyBonus: 0,
    },
    commandQueue: [],
    archetypeId: "assault",
    kills: 0,
    ...overrides,
  } as Unit;
}

export function createMockEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: "mock-enemy",
    pos: { x: 0, y: 0 },
    hp: 50,
    maxHp: 50,
    type: EnemyType.SwarmMelee,
    damage: 15,
    fireRate: 800,
    accuracy: 50,
    attackRange: 1,
    speed: 30,
    difficulty: 1,
    ...overrides,
  } as Enemy;
}

export function createMockGameState(
  overrides: Partial<GameState> = {},
): GameState {
  return {
    t: 0,
    map: {
      width: 10,
      height: 10,
      cells: [],
    },
    units: [],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [],
    stats: {
      threatLevel: 0,
      aliensKilled: 0,
      casualties: 0,
    },
    status: "Playing",
    settings: {
      mode: EngineMode.Simulation,
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
      timeScale: 1.0,
      isPaused: false,
      isSlowMotion: false,
    },
    squadInventory: {},
    ...overrides,
  } as GameState;
}
