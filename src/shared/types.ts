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

export type Unit = Entity & {
  state: UnitState;
  path?: Vector2[];
  targetPos?: Vector2;
  visualJitter?: Vector2; // New: slight offset to prevent stacking
  damage: number;
  fireRate: number; // ms between shots
  accuracy: number; // Hit chance percentage at 5 tiles
  attackRange: number;
  sightRange: number;
  meleeWeaponId?: string; // New
  rangedWeaponId?: string; // New
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
  speed: number; // Speed factor (x10 integer, e.g. 15 = 1.5 tiles/s)
  channeling?: ChannelingState; // New
  archetypeId: string;
};

// --- Archetype Definitions (Shared) ---
export type Archetype = {
  id: string;
  name: string;
  baseHp: number;
  damage: number;
  fireRate: number; // ms
  accuracy: number; // Hit chance percentage at 5 tiles
  attackRange: number;
  sightRange: number;
  speed: number; // Speed factor (x10 integer, e.g. 15 = 1.5 tiles/s)
  meleeWeaponId?: string; // New
  rangedWeaponId?: string; // New
};

export type WeaponType = "Melee" | "Ranged";

export type Weapon = {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number; // ms
  accuracy: number; // Hit chance at 5 tiles
  range: number;
};

export const WeaponLibrary: { [id: string]: Weapon } = {
  knife: {
    id: "knife",
    name: "Knife",
    type: "Melee",
    damage: 15,
    fireRate: 400,
    accuracy: 100,
    range: 1,
  },
  sword: {
    id: "sword",
    name: "Sword",
    type: "Melee",
    damage: 35,
    fireRate: 800,
    accuracy: 100,
    range: 1,
  },
  hammer: {
    id: "hammer",
    name: "Hammer",
    type: "Melee",
    damage: 80,
    fireRate: 1500,
    accuracy: 100,
    range: 1,
  },
  pistol: {
    id: "pistol",
    name: "Pistol",
    type: "Ranged",
    damage: 15,
    fireRate: 500,
    accuracy: 85,
    range: 6,
  },
  pulse_rifle: {
    id: "pulse_rifle",
    name: "Pulse Rifle",
    type: "Ranged",
    damage: 20,
    fireRate: 600,
    accuracy: 95,
    range: 10,
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    type: "Ranged",
    damage: 40,
    fireRate: 1000,
    accuracy: 75,
    range: 4,
  },
  flamethrower: {
    id: "flamethrower",
    name: "Flamethrower",
    type: "Ranged",
    damage: 25,
    fireRate: 100,
    accuracy: 80,
    range: 3,
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
    attackRange: 10,
    sightRange: 100,
    speed: 20,
    meleeWeaponId: "knife",
    rangedWeaponId: "pulse_rifle",
  },
  medic: {
    id: "medic",
    name: "Medic",
    baseHp: 80,
    damage: 15,
    fireRate: 500,
    accuracy: 85,
    attackRange: 6,
    sightRange: 100,
    speed: 25,
    meleeWeaponId: "knife",
    rangedWeaponId: "pistol",
  },
  heavy: {
    id: "heavy",
    name: "Heavy",
    baseHp: 120,
    damage: 40,
    fireRate: 1000,
    accuracy: 75,
    attackRange: 4,
    sightRange: 100,
    speed: 15,
    meleeWeaponId: "hammer",
    rangedWeaponId: "shotgun",
  },
  vip: {
    id: "vip",
    name: "VIP",
    baseHp: 100,
    damage: 0,
    fireRate: 0,
    accuracy: 50,
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

// --- Protocol ---

export type SquadConfig = { archetypeId: string; count: number }[]; // New type for Squad Config

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

export type Command =
  | MoveCommand
  | OpenDoorCommand
  | LockDoorCommand
  | AttackTargetCommand
  | SetEngagementCommand
  | StopCommand
  | ResumeAiCommand;

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
