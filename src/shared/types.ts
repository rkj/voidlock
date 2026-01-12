export type Vector2 = { x: number; y: number };

export enum CellType {
  Void = "Void",
  Floor = "Floor",
}

export enum BoundaryType {
  Open = "Open",
  Wall = "Wall",
  Door = "Door",
}

export type WallDefinition = {
  p1: Vector2;
  p2: Vector2;
};

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

export enum UnitStyle {
  Sprites = "Sprites",
  TacticalIcons = "TacticalIcons",
}

export interface MapGenerationConfig {
  seed: number;
  width: number;
  height: number;
  type: MapGeneratorType;
  spawnPointCount?: number; // Optional, defaults to 1
}

export type MapDefinition = {
  width: number;
  height: number;
  generatorName?: string;
  cells: Cell[];
  walls?: WallDefinition[]; // New: Array of Wall boundaries
  boundaries?: BoundaryDefinition[];
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

export enum UnitState {
  Idle = "Idle",
  Moving = "Moving",
  Attacking = "Attacking",
  WaitingForDoor = "Waiting for Door",
  Channeling = "Channeling", // New
  Extracted = "Extracted",
  Dead = "Dead",
}

export enum AIProfile {
  STAND_GROUND = "STAND_GROUND",
  RUSH = "RUSH",
  RETREAT = "RETREAT",
}

export type ChannelingState = {
  action: "Extract" | "Collect" | "Pickup" | "UseItem";
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
  aiProfile: AIProfile;
  commandQueue: Command[];
  lastAttackTarget?: Vector2;
  lastAttackTime?: number;
  forcedTargetId?: string; // ID of enemy to focus fire on
  explorationTarget?: Vector2; // Current automated exploration goal
  aiEnabled?: boolean; // New: allow disabling autonomous behavior
  activeCommand?: Command; // Track currently executing command
  channeling?: ChannelingState; // New
  archetypeId: string;
  carriedObjectiveId?: string; // New: ID of objective being carried (e.g. artifact)
  kills: number;
  damageDealt: number;
  objectivesCompleted: number;
};

export type Mine = {
  id: string;
  pos: Vector2;
  damage: number;
  radius: number;
  ownerId: string;
};

export type LootItem = {
  id: string;
  itemId: string;
  pos: Vector2;
  objectiveId?: string;
};

// --- Item & Equipment Definitions ---

export type ItemType = "Passive" | "Active";

export type Item = {
  id: string;
  name: string;
  type: ItemType;
  description?: string;
  // Passive effects
  hpBonus?: number;
  speedBonus?: number;
  accuracyBonus?: number;
  // Active effects
  action?: "Heal" | "Grenade" | "Mine" | "Scanner";
  charges?: number;
  channelTime?: number; // New: time in ms to use the item
  healAmount?: number; // New: amount of HP to recover
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
    description: "Anti-personnel explosive with a moderate blast radius.",
    action: "Grenade",
    charges: 2,
    cost: 15,
  },
  medkit: {
    id: "medkit",
    name: "Medkit",
    type: "Active",
    description: "Portable medical supplies to treat injuries in the field.",
    action: "Heal",
    charges: 1,
    channelTime: 2000,
    healAmount: 50,
    cost: 10,
  },
  stimpack: {
    id: "stimpack",
    name: "Stimpack",
    type: "Active",
    description:
      "A single-use chemical stimulant that provides instant minor healing.",
    action: "Heal",
    charges: 1,
    healAmount: 25,
    cost: 5,
  },
  mine: {
    id: "mine",
    name: "Landmine",
    type: "Active",
    description: "Proximity-detonated explosive. Good for covering retreats.",
    action: "Mine",
    charges: 2,
    channelTime: 3000,
    cost: 15,
  },
  scanner: {
    id: "scanner",
    name: "Scanner",
    type: "Active",
    description: "Reveals enemies and objectives through fog of war.",
    action: "Scanner",
    charges: 3,
    cost: 20,
  },
  combat_boots: {
    id: "combat_boots",
    name: "Combat Boots",
    type: "Passive",
    description: "Standard issue tactical footwear.",
    speedBonus: 5, // +0.5 tiles/s
    cost: 0,
  },
  mag_lev_boots: {
    id: "mag_lev_boots",
    name: "Mag-Lev Boots",
    type: "Passive",
    description:
      "Advanced boots that reduce friction, significantly increasing movement speed.",
    speedBonus: 10, // +1.0 tiles/s
    cost: 30,
  },
  light_recon: {
    id: "light_recon",
    name: "Light Recon Armor",
    type: "Passive",
    description:
      "Lightweight plating that provides protection without sacrificing mobility.",
    hpBonus: 50,
    speedBonus: 2,
    cost: 20,
  },
  heavy_plate: {
    id: "heavy_plate",
    name: "Heavy Plate Armor",
    type: "Passive",
    description:
      "Thick ceramic plating. Provides massive HP but slows the user and slightly impairs aim.",
    hpBonus: 150,
    speedBonus: -5,
    accuracyBonus: -10,
    cost: 50,
  },
  artifact_heavy: {
    id: "artifact_heavy",
    name: "Heavy Artifact",
    type: "Passive",
    description:
      "A heavy alien artifact. Its weight and strange energy fields significantly slow the carrier and impair their aim.",
    speedBonus: -10,
    accuracyBonus: -15,
    cost: 0,
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
  speed: number; // Speed factor (x10 integer, e.g. 15 = 1.5 tiles/s)
  aiProfile: AIProfile;
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
  description?: string;
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
    description: "A reliable blade for close-quarters combat.",
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
    description: "Energized blade that shears through armor with ease.",
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
    description: "A massive hammer that releases a kinetic blast upon impact.",
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
    description: "Standard semi-automatic sidearm.",
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
    description: "Versatile assault rifle with good range and rate of fire.",
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
    description: "Devastating at short range, but quickly loses effectiveness.",
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
    description:
      "Projects a stream of liquid fire. Inaccurate but fast firing.",
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
    speed: 20,
    aiProfile: AIProfile.RUSH,
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
    speed: 25,
    aiProfile: AIProfile.RETREAT,
    leftHand: "combat_knife",
    rightHand: "pistol",
  },
  scout: {
    id: "scout",
    name: "Scout",
    baseHp: 80,
    damage: 15,
    fireRate: 400,
    accuracy: 90,
    soldierAim: 85,
    attackRange: 8,
    speed: 30,
    aiProfile: AIProfile.RETREAT,
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
    speed: 15,
    aiProfile: AIProfile.STAND_GROUND,
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
    speed: 22,
    aiProfile: AIProfile.RETREAT,
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
  allowTacticalPause: boolean;
};

export type MissionStats = {
  threatLevel: number;
  aliensKilled: number;
  elitesKilled: number;
  scrapGained: number;
  casualties: number;
};

export type GameState = {
  t: number;
  seed: number;
  missionType: MissionType;
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
  loot: LootItem[];
};

// --- Protocol ---

export type SquadSoldierConfig = {
  id?: string;
  archetypeId: string;
  rightHand?: string;
  leftHand?: string;
  body?: string;
  feet?: string;
  hp?: number;
  maxHp?: number;
  soldierAim?: number;
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
  RecoverIntel = "RecoverIntel",
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
        baseEnemyCount?: number;
        enemyGrowthPerMission?: number;
        missionDepth?: number;
        initialTimeScale?: number;
        startPaused?: boolean;
        allowTacticalPause?: boolean;
        mode?: EngineMode;
        commandLog?: CommandLogEntry[];
        targetTick?: number;
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
  SET_ENGAGEMENT = "SET_ENGAGEMENT",
  STOP = "STOP",
  RESUME_AI = "RESUME_AI",
  USE_ITEM = "USE_ITEM",
  OVERWATCH_POINT = "OVERWATCH_POINT",
  EXPLORE = "EXPLORE",
  PICKUP = "PICKUP",
  ESCORT_UNIT = "ESCORT_UNIT",
  EXTRACT = "EXTRACT",
  TOGGLE_DEBUG_OVERLAY = "TOGGLE_DEBUG_OVERLAY",
  TOGGLE_LOS_OVERLAY = "TOGGLE_LOS_OVERLAY",
  DEBUG_FORCE_WIN = "DEBUG_FORCE_WIN",
  DEBUG_FORCE_LOSE = "DEBUG_FORCE_LOSE",
}

export type MoveCommand = {
  type: CommandType.MOVE_TO;
  unitIds: string[];
  target: Vector2;
  queue?: boolean;
  label?: string;
};

export type ExtractCommand = {
  type: CommandType.EXTRACT;
  unitIds: string[];
  queue?: boolean;
  label?: string;
};

export type EscortUnitCommand = {
  type: CommandType.ESCORT_UNIT;
  unitIds: string[];
  targetId: string;
  queue?: boolean;
  label?: string;
};

export type OverwatchPointCommand = {
  type: CommandType.OVERWATCH_POINT;
  unitIds: string[];
  target: Vector2;
  queue?: boolean;
  label?: string;
};

export type ExploreCommand = {
  type: CommandType.EXPLORE;
  unitIds: string[];
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
  unitIds: string[];
  itemId: string;
  target?: Vector2;
  targetUnitId?: string;
  queue?: boolean;
  label?: string;
};

export type PickupCommand = {
  type: CommandType.PICKUP;
  unitIds: string[];
  lootId: string;
  queue?: boolean;
  label?: string;
};

export type ToggleDebugOverlayCommand = {
  type: CommandType.TOGGLE_DEBUG_OVERLAY;
  enabled: boolean;
  label?: string;
};

export type ToggleLosOverlayCommand = {
  type: CommandType.TOGGLE_LOS_OVERLAY;
  enabled: boolean;
  label?: string;
};

export type DebugForceWinCommand = {
  type: CommandType.DEBUG_FORCE_WIN;
  label?: string;
};

export type DebugForceLoseCommand = {
  type: CommandType.DEBUG_FORCE_LOSE;
  label?: string;
};

export type Command =
  | MoveCommand
  | OpenDoorCommand
  | LockDoorCommand
  | SetEngagementCommand
  | StopCommand
  | ResumeAiCommand
  | UseItemCommand
  | OverwatchPointCommand
  | ExploreCommand
  | PickupCommand
  | EscortUnitCommand
  | ExtractCommand
  | ToggleDebugOverlayCommand
  | ToggleLosOverlayCommand
  | DebugForceWinCommand
  | DebugForceLoseCommand;

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

export type TileDoorSocket = {
  x: number;
  y: number;
  edge: Edge;
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
  id?: string;
};

export interface ThemeConfig {
  id: string;
  name: string;
  colors: Record<string, string>;
}

export * from "./campaign_types";
