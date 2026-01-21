import { Vector2 } from "./geometry";
import { LootItem, Mine } from "./items";
import { MapDefinition, Objective } from "./map";
import { Command, Enemy, SquadConfig, Unit } from "./units";
import { CampaignNodeType } from "../campaign_types";

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

export type AttackEvent = {
  attackerId: string;
  attackerPos: Vector2;
  targetId: string;
  targetPos: Vector2;
  time: number;
};

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

export enum MissionType {
  Default = "Default",
  ExtractArtifacts = "ExtractArtifacts",
  DestroyHive = "DestroyHive",
  EscortVIP = "EscortVIP",
  RecoverIntel = "RecoverIntel",
}

export type GameState = {
  t: number;
  seed: number;
  missionType: MissionType;
  nodeType?: CampaignNodeType;
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
  attackEvents?: AttackEvent[];
  mines: Mine[];
};

// --- Protocol ---

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
        nodeType?: CampaignNodeType;
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
        campaignNodeId?: string;
      };
    }
  | { type: "COMMAND"; payload: Command }
  | { type: "QUERY_STATE" }
  | { type: "SET_TICK_RATE"; payload: number }
  | { type: "SET_TIME_SCALE"; payload: number }
  | { type: "STOP" };

export type MainMessage =
  | { type: "STATE_UPDATE"; payload: GameState }
  | { type: "EVENT"; payload: any };

export type OverlayOption = {
  key: string;
  label: string;
  pos: Vector2;
  id?: string;
  renderOnBoard?: boolean;
};

export interface ThemeConfig {
  id: string;
  name: string;
  colors: Record<string, string>;
}
