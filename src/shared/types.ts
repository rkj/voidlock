export type Vector2 = { x: number; y: number };

export enum CellType {
  Wall = "Wall", // Now represents Void/Unreachable
  Floor = "Floor",
}

export type WallDefinition = {
  p1: Vector2;
  p2: Vector2;
};

export type Cell = {
  x: number;
  y: number;
  type: CellType;
  roomId?: string;
};

export type Door = {
  id: string;
  segment: Vector2[]; // Cells adjacent to the door's barrier segment
  orientation: "Horizontal" | "Vertical";
  state: "Open" | "Closed" | "Locked" | "Destroyed";
  hp: number;
  maxHp: number;
  openDuration: number; // in seconds
  openTimer?: number; // Countdown for state change (ms)
  targetState?: "Open" | "Closed" | "Locked"; // State door is transitioning to
};

export enum MapGeneratorType {
  Procedural = "Procedural",
  Static = "Static",
  TreeShip = "TreeShip",
  DenseShip = "DenseShip",
}

export type MapDefinition = {
  width: number;
  height: number;
  cells: Cell[];
  walls?: WallDefinition[]; // New: Array of Wall boundaries
  doors?: Door[]; // New: Array of Door entities
  spawnPoints?: SpawnPoint[];
  squadSpawn?: Vector2;
  squadSpawns?: Vector2[];
  extraction?: Vector2;
  objectives?: ObjectiveDefinition[];
};

export type SpawnPoint = {
  id: string;
  pos: Vector2;
  radius: number;
};

export type ObjectiveDefinition = {
  id: string;
  kind: "Recover" | "Kill" | "Escort";
  targetCell?: Vector2;
  targetEnemyId?: string;
};

export type ObjectiveState = "Pending" | "Completed" | "Failed";

export type Objective = ObjectiveDefinition & {
  state: ObjectiveState;
  visible?: boolean;
};

export interface Grid {
  width: number;
  height: number;
  isWalkable(x: number, y: number): boolean;
  // Check if movement between adjacent cells is allowed (no wall)
  canMove(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    doors?: Map<string, Door>,
    allowClosedDoors?: boolean,
  ): boolean;
}

export enum UnitState {
  Idle = "Idle",
  Moving = "Moving",
  Attacking = "Attacking",
  WaitingForDoor = "Waiting for Door",
  Channeling = "Channeling", // New
  Extracted = "Extracted",
  Dead = "Dead",
}

export type ChannelingState = {
  action: "Extract" | "Collect";
  remaining: number; // ms
  totalDuration: number; // ms
  targetId?: string; // ID of object/objective being interacted with
};

export type EngagementPolicy = "ENGAGE" | "IGNORE";

export type Entity = {
  id: string;
  pos: Vector2;
  hp: number;
  maxHp: number;
};

export type UnitStats = {
  damage: number;
  fireRate: number;
  accuracy: number;
  soldierAim: number;
  attackRange: number;
  sightRange: number;
  speed: number;
  equipmentAccuracyBonus: number;
};

export type Unit = Entity & {
  state: UnitState;
  stats: UnitStats;
  path?: Vector2[];
  targetPos?: Vector2;
  visualJitter?: Vector2; // New: slight offset to prevent stacking
  rightHand?: string;
  leftHand?: string;
  body?: string;
  feet?: string;
  activeWeaponId?: string; // New
  engagementPolicy?: EngagementPolicy; // Default: 'ENGAGE'
  engagementPolicySource?: "Manual" | "Autonomous"; // Track origin of policy
  commandQueue: Command[];
  lastAttackTarget?: Vector2;
  lastAttackTime?: number;
  forcedTargetId?: string; // ID of enemy to focus fire on
  explorationTarget?: Vector2; // Current automated exploration goal
  aiEnabled?: boolean; // New: allow disabling autonomous behavior
  activeCommand?: Command; // Track currently executing command
  channeling?: ChannelingState; // New
  archetypeId: string;
};

export type Mine = {
  id: string;
  pos: Vector2;
  damage: number;
  radius: number;
  ownerId: string;
};

// --- Item & Equipment Definitions ---

export type ItemType = "Passive" | "Active";

export type Item = {
  id: string;
  name: string;
  type: ItemType;
  // Passive effects
  hpBonus?: number;
  speedBonus?: number;
  accuracyBonus?: number;
  // Active effects
  action?: "Heal" | "Grenade" | "Mine" | "Scanner";
  charges?: number;
  cost: number;
};

export type EquipmentState = {
  body?: string;
  feet?: string;
  rightHand?: string;
  leftHand?: string;
};

export const ItemLibrary: { [id: string]: Item } = {
  frag_grenade: {
    id: "frag_grenade",
    name: "Frag Grenade",
    type: "Active",
    action: "Grenade",
    charges: 2,
    cost: 15,
  },
  medkit: {
    id: "medkit",
    name: "Medkit",
    type: "Active",
    action: "Heal",
    charges: 1,
    cost: 10,
  },
  mine: {
    id: "mine",
    name: "Landmine",
    type: "Active",
    action: "Mine",
    charges: 2,
    cost: 15,
  },
  scanner: {
    id: "scanner",
    name: "Scanner",
    type: "Active",
    action: "Scanner",
    charges: 3,
    cost: 20,
  },
  combat_boots: {
    id: "combat_boots",
    name: "Combat Boots",
    type: "Passive",
    speedBonus: 5, // +0.5 tiles/s
    cost: 0,
  },
  mag_lev_boots: {
    id: "mag_lev_boots",
    name: "Mag-Lev Boots",
    type: "Passive",
    speedBonus: 10, // +1.0 tiles/s
    cost: 30,
  },
  light_recon: {
    id: "light_recon",
    name: "Light Recon Armor",
    type: "Passive",
    hpBonus: 50,
    speedBonus: 2,
    cost: 20,
  },
  heavy_plate: {
    id: "heavy_plate",
    name: "Heavy Plate Armor",
    type: "Passive",
    hpBonus: 150,
    speedBonus: -5,
    accuracyBonus: -10,
    cost: 50,
  },
};

// --- Archetype Definitions (Shared) ---
export type Archetype = {
  id: string;
  name: string;
  baseHp: number;
  damage: number;
  fireRate: number; // ms
  accuracy: number; // Hit chance percentage at 5 tiles (DEPRECATED)
  soldierAim: number; // Base hit percentage (0-100)
  attackRange: number;
  sightRange: number;
  speed: number; // Speed factor (x10 integer, e.g. 15 = 1.5 tiles/s)
  rightHand?: string;
  leftHand?: string;
  body?: string;
  feet?: string;
};

export type WeaponType = "Melee" | "Ranged";

export type Weapon = {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number; // ms
  accuracy: number; // Percentage modifier relative to soldierAim
  range: number;
  cost: number;
};

export const WeaponLibrary: { [id: string]: Weapon } = {
  combat_knife: {
    id: "combat_knife",
    name: "Combat Knife",
    type: "Melee",
    damage: 15,
    fireRate: 400,
    accuracy: 10,
    range: 1,
    cost: 0,
  },
  power_sword: {
    id: "power_sword",
    name: "Power Sword",
    type: "Melee",
    damage: 35,
    fireRate: 800,
    accuracy: 15,
    range: 1,
    cost: 25,
  },
  thunder_hammer: {
    id: "thunder_hammer",
    name: "Thunder Hammer",
    type: "Melee",
    damage: 80,
    fireRate: 1500,
    accuracy: 5,
    range: 1,
    cost: 40,
  },
  pistol: {
    id: "pistol",
    name: "Pistol",
    type: "Ranged",
    damage: 15,
    fireRate: 500,
    accuracy: 0,
    range: 6,
    cost: 10,
  },
  pulse_rifle: {
    id: "pulse_rifle",
    name: "Pulse Rifle",
    type: "Ranged",
    damage: 20,
    fireRate: 600,
    accuracy: 5,
    range: 10,
    cost: 20,
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    type: "Ranged",
    damage: 40,
    fireRate: 1000,
    accuracy: -10,
    range: 4,
    cost: 25,
  },
  flamer: {
    id: "flamer",
    name: "Flamer",
    type: "Ranged",
    damage: 25,
    fireRate: 100,
    accuracy: -5,
    range: 3,
    cost: 35,
  },
};

export const ArchetypeLibrary: { [id: string]: Archetype } = {
  assault: {
    id: "assault",
    name: "Assault",
    baseHp: 100,
    damage: 20,
    fireRate: 600,
    accuracy: 95,
    soldierAim: 90,
    attackRange: 10,
    sightRange: 100,
    speed: 20,
    leftHand: "combat_knife",
    rightHand: "pulse_rifle",
  },
  medic: {
    id: "medic",
    name: "Medic",
    baseHp: 80,
    damage: 15,
    fireRate: 500,
    accuracy: 85,
    soldierAim: 80,
    attackRange: 6,
    sightRange: 100,
    speed: 25,
    leftHand: "combat_knife",
    rightHand: "pistol",
  },
  heavy: {
    id: "heavy",
    name: "Heavy",
    baseHp: 120,
    damage: 40,
    fireRate: 1000,
    accuracy: 75,
    soldierAim: 70,
    attackRange: 4,
    sightRange: 100,
    speed: 15,
    leftHand: "thunder_hammer",
    rightHand: "shotgun",
  },
  vip: {
    id: "vip",
    name: "VIP",
    baseHp: 100,
    damage: 0,
    fireRate: 0,
    accuracy: 50,
    soldierAim: 50,
    attackRange: 0,
    sightRange: 6,
    speed: 22,
  },
};

export enum EnemyType {
  XenoMite = "Xeno-Mite",
  WarriorDrone = "Warrior-Drone",
  PraetorianGuard = "Praetorian-Guard",
  SpitterAcid = "Spitter-Acid",
  SwarmMelee = "SwarmMelee", // Legacy
  Hive = "Hive",
  Boss = "Boss",
  AlienScout = "alien_scout",
  Grunt = "Grunt",
  Melee = "Melee",
}

export const EnemyArchetypeLibrary: {
  [id: string]: {
    type: EnemyType;
    hp: number;
    damage: number;
    fireRate: number;
    accuracy: number;
    attackRange: number;
    speed: number;
    ai: "Melee" | "Ranged";
  };
} = {
  [EnemyType.XenoMite]: {
    type: EnemyType.XenoMite,
    hp: 50,
    damage: 15,
    fireRate: 400,
    accuracy: 50,
    attackRange: 1,
    speed: 30,
    ai: "Melee",
  },
  [EnemyType.WarriorDrone]: {
    type: EnemyType.WarriorDrone,
    hp: 150,
    damage: 35,
    fireRate: 800,
    accuracy: 75,
    attackRange: 1,
    speed: 24,
    ai: "Melee",
  },
  [EnemyType.PraetorianGuard]: {
    type: EnemyType.PraetorianGuard,
    hp: 600,
    damage: 80,
    fireRate: 1500,
    accuracy: 85,
    attackRange: 1,
    speed: 18,
    ai: "Melee",
  },
  [EnemyType.SpitterAcid]: {
    type: EnemyType.SpitterAcid,
    hp: 120,
    damage: 30,
    fireRate: 1200,
    accuracy: 90,
    attackRange: 6,
    speed: 28,
    ai: "Ranged",
  },
  // Legacy support
  [EnemyType.SwarmMelee]: {
    type: EnemyType.SwarmMelee,
    hp: 50,
    damage: 15,
    fireRate: 800,
    accuracy: 50,
    attackRange: 1,
    speed: 30,
    ai: "Melee",
  },
  [EnemyType.Hive]: {
    type: EnemyType.Hive,
    hp: 1200,
    damage: 0,
    fireRate: 1000,
    accuracy: 100,
    attackRange: 0,
    speed: 0,
    ai: "Melee",
  },
};

export type Enemy = Entity & {
  type: EnemyType;
  damage: number;
  fireRate: number;
  accuracy: number;
  attackRange: number;
  speed: number;
  difficulty: number;
  path?: Vector2[];
  targetPos?: Vector2;
  lastAttackTime?: number;
  lastAttackTarget?: Vector2;
};

export enum EngineMode {
  Simulation = "Simulation",
  Replay = "Replay",
}

export type CommandLogEntry = {
  tick: number;
  command: Command;
};

export type RecordedCommand = {
  t: number;
  cmd: Command;
};

export type ReplayData = {
  seed: number;
  map: MapDefinition;
  squadConfig: SquadConfig;
  commands: RecordedCommand[];
};

export type GameStatus = "Playing" | "Won" | "Lost";

export type SimulationSettings = {
  mode: EngineMode;
  debugOverlayEnabled: boolean;
  losOverlayEnabled: boolean;
  timeScale: number;
  isPaused: boolean;
  isSlowMotion: boolean;
};

export type MissionStats = {
  threatLevel: number;
  aliensKilled: number;
  casualties: number;
};

export type GameState = {
  t: number;
  map: MapDefinition;
  units: Unit[];
  enemies: Enemy[];
  visibleCells: string[];
  discoveredCells: string[];
  objectives: Objective[];
  stats: MissionStats;
  status: GameStatus;
  settings: SimulationSettings;
  commandLog?: CommandLogEntry[];
  squadInventory: { [itemId: string]: number };
};

// --- Protocol ---

export type SquadSoldierConfig = {
  archetypeId: string;
  rightHand?: string;
  leftHand?: string;
  body?: string;
  feet?: string;
};

export type SquadConfig = {
  soldiers: SquadSoldierConfig[];
  inventory: { [itemId: string]: number };
}; // Updated type for Squad Config

export enum MissionType {
  Default = "Default",
  ExtractArtifacts = "ExtractArtifacts",
  DestroyHive = "DestroyHive",
  EscortVIP = "EscortVIP",
}

export type WorkerMessage =
  | {
      type: "INIT";
      payload: {
        seed: number;
        map: MapDefinition;
        fogOfWarEnabled: boolean;
        debugOverlayEnabled: boolean;
        agentControlEnabled: boolean;
        squadConfig: SquadConfig;
        missionType?: MissionType;
        losOverlayEnabled?: boolean;
        startingThreatLevel?: number;
        initialTimeScale?: number;
        startPaused?: boolean;
        mode?: EngineMode;
        commandLog?: CommandLogEntry[];
      };
    } // Updated
  | { type: "COMMAND"; payload: Command }
  | { type: "QUERY_STATE" }
  | { type: "SET_TICK_RATE"; payload: number }
  | { type: "SET_TIME_SCALE"; payload: number }
  | { type: "STOP" };

export type MainMessage =
  | { type: "STATE_UPDATE"; payload: GameState }
  | { type: "EVENT"; payload: any };

export enum CommandType {
  MOVE_TO = "MOVE_TO",
  OPEN_DOOR = "OPEN_DOOR",
  LOCK_DOOR = "LOCK_DOOR",
  ATTACK_TARGET = "ATTACK_TARGET",
  SET_ENGAGEMENT = "SET_ENGAGEMENT",
  STOP = "STOP",
  RESUME_AI = "RESUME_AI",
  USE_ITEM = "USE_ITEM",
}

export type MoveCommand = {
  type: CommandType.MOVE_TO;
  unitIds: string[];
  target: Vector2;
  queue?: boolean;
  label?: string;
};
export type OpenDoorCommand = {
  type: CommandType.OPEN_DOOR;
  unitIds: string[];
  doorId: string;
  queue?: boolean;
  label?: string;
};
export type LockDoorCommand = {
  type: CommandType.LOCK_DOOR;
  unitIds: string[];
  doorId: string;
  queue?: boolean;
  label?: string;
};
export type AttackTargetCommand = {
  type: CommandType.ATTACK_TARGET;
  unitId: string;
  targetId: string;
  queue?: boolean;
  label?: string;
};
export type SetEngagementCommand = {
  type: CommandType.SET_ENGAGEMENT;
  unitIds: string[];
  mode: EngagementPolicy;
  queue?: boolean;
  label?: string;
};
export type StopCommand = {
  type: CommandType.STOP;
  unitIds: string[];
  queue?: boolean;
  label?: string;
};
export type ResumeAiCommand = {
  type: CommandType.RESUME_AI;
  unitIds: string[];
  queue?: boolean;
  label?: string;
};

export type UseItemCommand = {
  type: CommandType.USE_ITEM;
  itemId: string;
  target?: Vector2;
  queue?: boolean;
  label?: string;
};

export type Command =
  | MoveCommand
  | OpenDoorCommand
  | LockDoorCommand
  | AttackTargetCommand
  | SetEngagementCommand
  | StopCommand
  | ResumeAiCommand
  | UseItemCommand;

export interface IMapValidationResult {
  isValid: boolean;
  issues: string[];
}

// --- Tile Assembly ---

export type Edge = "n" | "e" | "s" | "w";

export type TileCellDefinition = {
  x: number;
  y: number;
  openEdges: Edge[];
};

export type TileDefinition = {
  id: string;
  width: number;
  height: number;
  cells: TileCellDefinition[];
};

export type TileReference = {
  tileId: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
};

export type TileAssembly = {
  tiles: TileReference[];
  doors?: { tileIndex: number; cellIndex: number; edge: Edge; id: string }[]; // Optional door placement relative to tiles?
  // Actually, simplest is to define doors in global coordinates or relative to a tile.
  // For now, let's assume we extract doors from the tiles themselves if they have "sockets" or just add them manually later.
  // The GDD example has a separate "doors" array with global coords.
  // Let's stick to the GDD example format mostly.
  globalDoors?: {
    cell: Vector2;
    orientation: "Horizontal" | "Vertical";
    id: string;
  }[];
  globalSpawnPoints?: { cell: Vector2; id: string }[];
  globalSquadSpawn?: { cell: Vector2 };
  globalExtraction?: { cell: Vector2 };
  globalObjectives?: { kind: "Recover" | "Kill"; cell: Vector2; id: string }[];
};

export type OverlayOption = {
  key: string;
  label: string;
  pos: Vector2;
};

export * from "./campaign_types";
