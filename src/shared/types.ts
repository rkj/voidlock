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
  spawnPoints?: SpawnPoint[]; // Added spawn points
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
  sightRange: number; // Added sight range
};

export type Enemy = Entity & {
  type: string; 
  damage: number;
  attackRange: number;
};

export type SpawnPoint = {
  id: string;
  pos: Vector2;
  radius: number; // For now, just a point, but maybe area later
};

export type GameState = {
  t: number;
  map: MapDefinition;
  units: Unit[];
  enemies: Enemy[];
  // Fog of War data - array of "x,y" strings or coordinate objects
  visibleCells: string[]; 
  discoveredCells: string[];
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
};