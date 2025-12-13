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
  canMove(fromX: number, fromY: number, toX: number, toY: number, doors?: Map<string, Door>): boolean;
}

export enum UnitState {
  Idle = 'Idle',
  Moving = 'Moving',
  Attacking = 'Attacking',
  Extracted = 'Extracted', 
  Dead = 'Dead', 
}

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
  damage: number;
  attackRange: number;
  sightRange: number;
  commandQueue: Command[];
  lastAttackTarget?: Vector2;
  lastAttackTime?: number;
};

export type Enemy = Entity & {
  type: string; 
  damage: number;
  attackRange: number;
  lastAttackTarget?: Vector2;
  lastAttackTime?: number;
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
  status: 'Playing' | 'Won' | 'Lost';
};

// --- Replay ---

export type RecordedCommand = {
  t: number; 
  cmd: Command;
};

export type ReplayData = {
  seed: number;
  map: MapDefinition;
  commands: RecordedCommand[];
};

// --- Protocol ---

export type WorkerMessage = 
  | { type: 'INIT'; payload: { seed: number; map: MapDefinition } }
  | { type: 'COMMAND'; payload: Command }
  | { type: 'QUERY_STATE' };

export type MainMessage =
  | { type: 'STATE_UPDATE'; payload: GameState }
  | { type: 'EVENT'; payload: any };

export enum CommandType {
  MOVE_TO = 'MOVE_TO',
  OPEN_DOOR = 'OPEN_DOOR',
  LOCK_DOOR = 'LOCK_DOOR',
}

export type MoveCommand = { type: CommandType.MOVE_TO; unitIds: string[]; target: Vector2; queue?: boolean; };
export type OpenDoorCommand = { type: CommandType.OPEN_DOOR; unitIds: string[]; doorId: string; queue?: boolean; };
export type LockDoorCommand = { type: CommandType.LOCK_DOOR; unitIds: string[]; doorId: string; queue?: boolean; };

export type Command = MoveCommand | OpenDoorCommand | LockDoorCommand;