import { Vector2, WallDefinition } from "./geometry";

export enum CellType {
  Void = "Void",
  Floor = "Floor",
}

export enum BoundaryType {
  Open = "Open",
  Wall = "Wall",
  Door = "Door",
}

export type BoundaryDefinition = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: BoundaryType;
  doorId?: string;
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

export interface MapGenerationConfig {
  seed: number;
  width: number;
  height: number;
  type: MapGeneratorType;
  spawnPointCount?: number; // Optional, defaults to 1
  bonusLootCount?: number; // Optional, defaults to 0
}

export type MapDefinition = {
  width: number;
  height: number;
  generatorName?: string;
  cells: Cell[];
  walls?: WallDefinition[]; // Array of Wall boundaries
  boundaries?: BoundaryDefinition[];
  doors?: Door[]; // Array of Door entities
  spawnPoints?: SpawnPoint[];
  squadSpawn?: Vector2;
  squadSpawns?: Vector2[];
  extraction?: Vector2;
  objectives?: ObjectiveDefinition[];
  bonusLoot?: Vector2[];
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
  scrapRewarded?: boolean;
  xpRewarded?: boolean;
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

export interface IMapValidationResult {
  isValid: boolean;
  issues: string[];
}

export type Direction = "n" | "e" | "s" | "w";

export type TileCellDefinition = {
  x: number;
  y: number;
  openEdges: Direction[];
};

export type TileDoorSocket = {
  x: number;
  y: number;
  edge: Direction;
};

export type TileDefinition = {
  id: string;
  width: number;
  height: number;
  cells: TileCellDefinition[];
  doorSockets?: TileDoorSocket[];
};

export type TileReference = {
  tileId: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
};

export type TileAssembly = {
  tiles: TileReference[];
  tileDoors?: { tileIndex: number; socketIndex: number; id: string }[];
  doors?: {
    tileIndex: number;
    cellIndex: number;
    edge: Direction;
    id: string;
  }[];
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
