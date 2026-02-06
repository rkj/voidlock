import { Vector2 } from "./geometry";

export enum UnitState {
  Idle = "Idle",
  Moving = "Moving",
  Attacking = "Attacking",
  WaitingForDoor = "Waiting for Door",
  Channeling = "Channeling",
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

export type Attacker = {
  id: string;
  pos: Vector2;
  hp?: number;
  lastAttackTime?: number;
  lastAttackTarget?: Vector2;
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
  name?: string;
  tacticalNumber?: number;
  state: UnitState;
  stats: UnitStats;
  path?: Vector2[];
  targetPos?: Vector2;
  visualJitter?: Vector2;
  rightHand?: string;
  leftHand?: string;
  body?: string;
  feet?: string;
  activeWeaponId?: string;
  engagementPolicy?: EngagementPolicy;
  engagementPolicySource?: "Manual" | "Autonomous";
  aiProfile: AIProfile;
  commandQueue: Command[];
  lastAttackTarget?: Vector2;
  lastAttackTime?: number;
  forcedTargetId?: string;
  explorationTarget?: Vector2;
  aiEnabled?: boolean;
  activeCommand?: Command;
  channeling?: ChannelingState;
  archetypeId: string;
  carriedObjectiveId?: string;
  kills: number;
  damageDealt: number;
  objectivesCompleted: number;
  isDeployed?: boolean;
};

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
  sniper: {
    id: "sniper",
    name: "Sniper",
    baseHp: 80,
    damage: 60,
    fireRate: 2000,
    accuracy: 95,
    soldierAim: 90,
    attackRange: 15,
    speed: 20,
    aiProfile: AIProfile.STAND_GROUND,
    leftHand: "combat_knife",
    rightHand: "sniper_rifle",
  },
  demolitionist: {
    id: "demolitionist",
    name: "Demolitionist",
    baseHp: 110,
    damage: 25,
    fireRate: 100,
    accuracy: 75,
    soldierAim: 70,
    attackRange: 3,
    speed: 18,
    aiProfile: AIProfile.RUSH,
    leftHand: "combat_knife",
    rightHand: "flamer",
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
  XenoMite = "xeno-mite",
  WarriorDrone = "warrior-drone",
  PraetorianGuard = "praetorian-guard",
  SpitterAcid = "spitter-acid",
  SwarmMelee = "swarm-melee",
  Hive = "hive",
  Boss = "boss",
  AlienScout = "alien-scout",
  Grunt = "grunt",
  Melee = "melee",
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
  forcedTargetId?: string;
  targetLockUntil?: number;
};

export type SquadSoldierConfig = {
  id?: string;
  name?: string;
  tacticalNumber?: number;
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
};

// --- Command Protocol ---

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
  START_MISSION = "START_MISSION",
  DEPLOY_UNIT = "DEPLOY_UNIT",
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

export type DeployUnitCommand = {
  type: CommandType.DEPLOY_UNIT;
  unitId: string;
  target: Vector2;
  label?: string;
};

export type StartMissionCommand = {
  type: CommandType.START_MISSION;
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
  | DebugForceLoseCommand
  | DeployUnitCommand
  | StartMissionCommand;

export enum UnitStyle {
  Sprites = "Sprites",
  TacticalIcons = "TacticalIcons",
}
