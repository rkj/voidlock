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
  extraction?: Vector2;
  objectives?: ObjectiveDefinition[];
};

export type ObjectiveDefinition = {
  id: string;
  kind: "Recover" | "Kill";
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
  attackRange: number;
  sightRange: number;
  engagementPolicy?: EngagementPolicy; // Default: 'ENGAGE'
  engagementPolicySource?: "Manual" | "Autonomous"; // Track origin of policy
  commandQueue: Command[];
  lastAttackTarget?: Vector2;
  lastAttackTime?: number;
  forcedTargetId?: string; // ID of enemy to focus fire on
  explorationTarget?: Vector2; // Current automated exploration goal
  aiEnabled?: boolean; // New: allow disabling autonomous behavior
  activeCommand?: Command; // Track currently executing command
  speed: number; // Tiles per second
  channeling?: ChannelingState; // New
};

export type Enemy = Entity & {
  type: string;
  damage: number;
  fireRate: number; // ms between shots
  attackRange: number;
  lastAttackTarget?: Vector2;
  lastAttackTime?: number;
  path?: Vector2[];
  targetPos?: Vector2;
  speed: number; // Tiles per second
};

export type SpawnPoint = {
  id: string;
  pos: Vector2;
  radius: number;
};

export type GameState = {
  t: number;
  map: MapDefinition;
  units: Unit[];
  enemies: Enemy[];
  visibleCells: string[];
  discoveredCells: string[];
  objectives: Objective[];
  threatLevel: number; // 0 to 100, representing Director intensity
  aliensKilled: number; // New
  casualties: number; // New
  status: "Playing" | "Won" | "Lost";
  debugOverlayEnabled?: boolean; // New
  losOverlayEnabled?: boolean; // New
};

// --- Replay ---

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

export type OverlayOption = {
  key: string;
  label: string;
  pos?: Vector2;
  unitId?: string;
};

// --- Archetype Definitions (Shared) ---
export type Archetype = {
  id: string;
  name: string;
  baseHp: number;
  damage: number;
  fireRate: number; // ms
  attackRange: number;
  sightRange: number;
  speed: number; // tiles per second
};

export const ArchetypeLibrary: { [id: string]: Archetype } = {
  assault: {
    id: "assault",
    name: "Assault",
    baseHp: 100,
    damage: 20,
    fireRate: 600,
    attackRange: 4,
    sightRange: 8,
    speed: 2,
  },
  medic: {
    id: "medic",
    name: "Medic",
    baseHp: 80,
    damage: 10,
    fireRate: 900,
    attackRange: 3,
    sightRange: 10,
    speed: 2.5,
  },
  heavy: {
    id: "heavy",
    name: "Heavy",
    baseHp: 120,
    damage: 30,
    fireRate: 1000,
    attackRange: 5,
    sightRange: 7,
    speed: 1.5,
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
    attackRange: 1,
    speed: 4.0,
    ai: "Melee",
  },
  [EnemyType.WarriorDrone]: {
    type: EnemyType.WarriorDrone,
    hp: 150,
    damage: 35,
    fireRate: 800,
    attackRange: 1,
    speed: 3.0,
    ai: "Melee",
  },
  [EnemyType.PraetorianGuard]: {
    type: EnemyType.PraetorianGuard,
    hp: 600,
    damage: 80,
    fireRate: 1500,
    attackRange: 1,
    speed: 2.2,
    ai: "Melee",
  },
  [EnemyType.SpitterAcid]: {
    type: EnemyType.SpitterAcid,
    hp: 120,
    damage: 30,
    fireRate: 1200,
    attackRange: 6,
    speed: 3.2,
    ai: "Ranged",
  },
  // Legacy support
  [EnemyType.SwarmMelee]: {
    type: EnemyType.SwarmMelee,
    hp: 50,
    damage: 15,
    fireRate: 800,
    attackRange: 1,
    speed: 2.8,
    ai: "Melee",
  },
  [EnemyType.Hive]: {
    type: EnemyType.Hive,
    hp: 1200,
    damage: 0,
    fireRate: 1000,
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
      };
    } // Updated
  | { type: "COMMAND"; payload: Command }
  | { type: "QUERY_STATE" }
  | { type: "SET_TICK_RATE"; payload: number }
  | { type: "SET_TIME_SCALE"; payload: number };

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
  globalExtraction?: { cell: Vector2 };
  globalObjectives?: { kind: "Recover" | "Kill"; cell: Vector2; id: string }[];
};
