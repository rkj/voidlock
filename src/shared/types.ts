export type Vector2 = { x: number; y: number };

export enum CellType {
  Wall = 'Wall',
  Floor = 'Floor',
}

export type Cell = {
  x: number;
  y: number;
  type: CellType;
  roomId?: string;
  doorId?: string;
};

export type MapDefinition = {
  width: number;
  height: number;
  cells: Cell[];
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
  // M6: Queue and Visuals
  commandQueue: Command[];
  lastAttackTarget?: Vector2;
  lastAttackTime?: number;
};

export type Enemy = Entity & {
  type: string; 
  damage: number;
  attackRange: number;
  // M6: Visuals
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
}

export type Command = {
  type: CommandType;
  unitIds: string[];
  target: Vector2;
  queue?: boolean; // New flag to append instead of replace
};
