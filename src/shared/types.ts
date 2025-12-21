export type Vector2 = { x: number; y: number };

export enum CellType {
  Wall = 'Wall', // Now represents Void/Unreachable
  Floor = 'Floor',
}

export type Cell = {
  x: number;
  y: number;
  type: CellType;
  // Thin walls on edges
  walls: {
    n: boolean;
    e: boolean;
    s: boolean;
    w: boolean;
  };
  roomId?: string;
};

export type Door = {
  id: string;
  segment: Vector2[]; // Cells adjacent to the door's barrier segment
  orientation: 'Horizontal' | 'Vertical';
  state: 'Open' | 'Closed' | 'Locked' | 'Destroyed';
  hp: number;
  maxHp: number;
  openDuration: number; // in seconds
  openTimer?: number; // Countdown for state change (ms)
  targetState?: 'Open' | 'Closed' | 'Locked'; // State door is transitioning to
};

export enum MapGeneratorType {
  Procedural = 'Procedural',
  Static = 'Static',
  TreeShip = 'TreeShip',
  DenseShip = 'DenseShip',
}

export type MapDefinition = {
  width: number;
  height: number;
  cells: Cell[];
  doors?: Door[]; // New: Array of Door entities
  spawnPoints?: SpawnPoint[]; 
  extraction?: Vector2; 
  objectives?: ObjectiveDefinition[];
};

export type ObjectiveDefinition = {
  id: string;
  kind: 'Recover' | 'Kill'; 
  targetCell?: Vector2; 
  targetEnemyId?: string; 
};

export type ObjectiveState = 'Pending' | 'Completed' | 'Failed';

export type Objective = ObjectiveDefinition & {
  state: ObjectiveState;
};

export interface Grid {
  width: number;
  height: number;
  isWalkable(x: number, y: number): boolean;
  // Check if movement between adjacent cells is allowed (no wall)
  canMove(fromX: number, fromY: number, toX: number, toY: number, doors?: Map<string, Door>, allowClosedDoors?: boolean): boolean;
}

export enum UnitState {
  Idle = 'Idle',
  Moving = 'Moving',
  Attacking = 'Attacking',
  WaitingForDoor = 'Waiting for Door', // New
  Extracted = 'Extracted', 
  Dead = 'Dead', 
}

export type EngagementPolicy = 'ENGAGE' | 'IGNORE';

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
  commandQueue: Command[];
  lastAttackTarget?: Vector2;
  lastAttackTime?: number;
  forcedTargetId?: string; // ID of enemy to focus fire on
  explorationTarget?: Vector2; // Current automated exploration goal
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
  status: 'Playing' | 'Won' | 'Lost';
  debugOverlayEnabled?: boolean; // New
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
  "assault": { id: "assault", name: "Assault", baseHp: 100, damage: 20, fireRate: 500, attackRange: 4, sightRange: 8, speed: 2 },
  "medic": { id: "medic", name: "Medic", baseHp: 80, damage: 10, fireRate: 750, attackRange: 3, sightRange: 10, speed: 2.5 },
  "heavy": { id: "heavy", name: "Heavy", baseHp: 120, damage: 30, fireRate: 700, attackRange: 5, sightRange: 7, speed: 1.5 }
};

// --- Protocol ---

export type SquadConfig = { archetypeId: string, count: number }[]; // New type for Squad Config

export enum MissionType {
  Default = 'Default',
  ExtractArtifacts = 'ExtractArtifacts',
  DestroyHive = 'DestroyHive',
}

export type WorkerMessage = 
  | { type: 'INIT'; payload: { seed: number; map: MapDefinition; fogOfWarEnabled: boolean; debugOverlayEnabled: boolean; agentControlEnabled: boolean; squadConfig: SquadConfig; missionType?: MissionType; } } // Updated
  | { type: 'COMMAND'; payload: Command }
  | { type: 'QUERY_STATE' };

export type MainMessage =
  | { type: 'STATE_UPDATE'; payload: GameState }
  | { type: 'EVENT'; payload: any };

export enum CommandType {
  MOVE_TO = 'MOVE_TO',
  OPEN_DOOR = 'OPEN_DOOR',
  LOCK_DOOR = 'LOCK_DOOR',
  ATTACK_TARGET = 'ATTACK_TARGET',
  SET_ENGAGEMENT = 'SET_ENGAGEMENT',
  STOP = 'STOP', // New
}

export type MoveCommand = { type: CommandType.MOVE_TO; unitIds: string[]; target: Vector2; queue?: boolean; };
export type OpenDoorCommand = { type: CommandType.OPEN_DOOR; unitIds: string[]; doorId: string; queue?: boolean; };
export type LockDoorCommand = { type: CommandType.LOCK_DOOR; unitIds: string[]; doorId: string; queue?: boolean; };
export type AttackTargetCommand = { type: CommandType.ATTACK_TARGET; unitId: string; targetId: string; queue?: boolean; };
export type SetEngagementCommand = { type: CommandType.SET_ENGAGEMENT; unitIds: string[]; mode: EngagementPolicy; queue?: boolean; };
export type StopCommand = { type: CommandType.STOP; unitIds: string[]; }; // New

export type Command = MoveCommand | OpenDoorCommand | LockDoorCommand | AttackTargetCommand | SetEngagementCommand | StopCommand; // Updated

export interface IMapValidationResult {
  isValid: boolean;
  issues: string[];
}

// --- Tile Assembly ---

export type Edge = 'n' | 'e' | 's' | 'w';

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
  doors?: { tileIndex: number, cellIndex: number, edge: Edge, id: string }[]; // Optional door placement relative to tiles?
  // Actually, simplest is to define doors in global coordinates or relative to a tile.
  // For now, let's assume we extract doors from the tiles themselves if they have "sockets" or just add them manually later.
  // The GDD example has a separate "doors" array with global coords.
  // Let's stick to the GDD example format mostly.
  globalDoors?: { cell: Vector2, orientation: 'Horizontal' | 'Vertical', id: string }[];
  globalSpawnPoints?: { cell: Vector2, id: string }[];
  globalExtraction?: { cell: Vector2 };
  globalObjectives?: { kind: 'Recover' | 'Kill', cell: Vector2, id: string }[];
};