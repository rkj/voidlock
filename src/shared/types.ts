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
};

export interface Grid {
  width: number;
  height: number;
  isWalkable(x: number, y: number): boolean;
}

export enum UnitState {
  Idle = 'Idle',
  Moving = 'Moving',
}

export type Entity = {
  id: string;
  pos: Vector2;
  hp: number;
  maxHp: number;
};

export type Unit = Entity & {
  state: UnitState;
  path?: Vector2[]; // Added for pathfinding
  targetPos?: Vector2;
};

export type Enemy = Entity & {
  type: string; // e.g., 'SwarmMelee', 'Ambusher'
};


export type GameState = {
  t: number;
  map: MapDefinition;
  units: Unit[];
  enemies: Enemy[]; // Added for enemies
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
