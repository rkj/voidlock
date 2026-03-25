import type {
  MapDefinition,
  Command,
  GameState,
  WorkerMessage,
  MainMessage,
  ReplayData,
  RecordedCommand,
  SquadConfig,
  CommandLogEntry,
  MapGenerationConfig,
  CampaignNodeType} from "../shared/types";
import {
  MapGeneratorType,
  UnitStyle,
  MissionType,
  CommandType,
  EngineMode,
} from "../shared/types";
import type { MapFactory } from "./map/MapFactory";
import { Logger } from "../shared/Logger";

// Factory type for creating MapFactory instances based on config
type MapGeneratorFactory = (config: MapGenerationConfig) => MapFactory;

export interface GameClientInitConfig {
  seed: number;
  mapGeneratorType: MapGeneratorType;
  mapData?: MapDefinition;
  fogOfWarEnabled?: boolean;
  debugOverlayEnabled?: boolean;
  agentControlEnabled?: boolean;
  unitStyle?: UnitStyle;
  themeId?: string;
  squadConfig?: SquadConfig;
  missionType?: MissionType;
  width?: number;
  height?: number;
  spawnPointCount?: number;
  losOverlayEnabled?: boolean;
  startingThreatLevel?: number;
  initialTimeScale?: number;
  startPaused?: boolean;
  allowTacticalPause?: boolean;
  mode?: EngineMode;
  commandLog?: CommandLogEntry[];
  campaignNodeId?: string;
  targetTick?: number;
  baseEnemyCount?: number;
  enemyGrowthPerMission?: number;
  missionDepth?: number;
  nodeType?: CampaignNodeType;
  startingPoints?: number;
  bonusLootCount?: number;
  skipDeployment?: boolean;
  debugSnapshots?: boolean;
  debugSnapshotInterval?: number;
  initialSnapshots?: GameState[];
}

interface MissionConfig {
  seed: number;
  mapGeneratorType: MapGeneratorType;
  mapData?: MapDefinition;
  fogOfWarEnabled: boolean;
  debugOverlayEnabled: boolean;
  agentControlEnabled: boolean;
  squadConfig: SquadConfig;
  missionType: MissionType;
  width: number;
  height: number;
  spawnPointCount: number;
  losOverlayEnabled: boolean;
  startingThreatLevel: number;
  baseEnemyCount: number;
  enemyGrowthPerMission: number;
  missionDepth: number;
  initialTimeScale: number;
  startPaused: boolean;
  allowTacticalPause: boolean;
  campaignNodeId?: string;
  nodeType?: CampaignNodeType;
  bonusLootCount: number;
  skipDeployment: boolean;
}

export class GameClient {
  private worker: Worker;
  private mainListener: ((state: GameState) => void) | null = null;
  private extraListeners: ((state: GameState) => void)[] = [];
  private mapGeneratorFactory: MapGeneratorFactory;
  private isStopped: boolean = false;
  private currentSessionId: string | null = null;

  // Replay State
  private initialSeed: number = 0;
  private initialMap: MapDefinition | null = null;
  private initialSquadConfig: SquadConfig | null = null;
  private initialMissionType: MissionType = MissionType.Default;
  private initialNodeType?: CampaignNodeType;
  private initialMissionDepth: number = 0;
  private initialBaseEnemyCount: number = 3;
  private initialEnemyGrowthPerMission: number = 1;
  private initialStartingPoints?: number;
  private initialStartingThreatLevel: number = 0;
  private initialSkipDeployment: boolean = true;
  private initialAllowTacticalPause: boolean = true;
  private initialBonusLootCount: number = 0;
  private initialAgentControlEnabled: boolean = true;
  private initialUnitStyle: UnitStyle = UnitStyle.TacticalIcons;
  private initialThemeId: string = "default";
  private commandStream: RecordedCommand[] = [];
  private snapshots: GameState[] = [];
  private startTime: number = 0;

  // Speed State
  private currentScale: number = 1.0;
  private lastNonPausedScale: number = 1.0;
  private isPaused: boolean = false;
  private allowTacticalPause: boolean = true;

  constructor(mapGeneratorFactory: MapGeneratorFactory) {
    this.mapGeneratorFactory = mapGeneratorFactory;
    // Vite handles this import with ?worker suffix
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onerror = (e) => {
      console.error("Worker error:", e.message, e.filename, e.lineno);
    };

    this.worker.onmessage = (e: MessageEvent<MainMessage>) => {
      if (this.isStopped) return;
      const msg = e.data;
      if (msg.type === "STATE_UPDATE") {
        // Session validation (Spec 8.12) - Only validate if sessionId is provided in the update
        const payloadSessionId = msg.payload.settings?.sessionId;
        if (this.currentSessionId && payloadSessionId && payloadSessionId !== this.currentSessionId) {
          console.warn(`[GameClient] Ignoring stale STATE_UPDATE for session ${payloadSessionId} (current: ${this.currentSessionId})`);
          return;
        }


        // Authoritative command sync from engine
        if (msg.payload.commandLog) {
          this.commandStream = msg.payload.commandLog.map((cl) => ({
            t: cl.tick,
            cmd: cl.command,
          }));
        }

        if (msg.payload.snapshots) {
          this.snapshots = msg.payload.snapshots;
        }

        if (
          typeof localStorage !== "undefined" &&
          msg.payload.settings.mode === EngineMode.Simulation
        ) {
          localStorage.setItem(
            "voidlock_mission_tick",
            Math.floor(msg.payload.t).toString(),
          );

          if (msg.payload.commandLog) {
            localStorage.setItem(
              "voidlock_mission_log",
              JSON.stringify(msg.payload.commandLog),
            );
          }
        }

        if (this.mainListener) {
          this.mainListener(msg.payload);
        }
        this.extraListeners.forEach((cb) => cb(msg.payload));
      }
    };
  }

  public init(cfg: GameClientInitConfig) {
    const p = GameClient.resolveInitConfig(cfg);

    this.isStopped = false;
    this.currentSessionId = Math.random().toString(36).substring(2, 15);
    this.storeInitialParams(p);

    const effectiveAllowTacticalPause = p.mode === EngineMode.Replay ? false : p.allowTacticalPause;
    const map = this.generateOrLoadMap({ seed: p.seed, width: p.width, height: p.height, mapGeneratorType: p.mapGeneratorType, spawnPointCount: p.spawnPointCount, bonusLootCount: p.bonusLootCount, mapData: p.mapData });

    this.initialMap = map;
    this.initCommandStream(p.commandLog, p.targetTick);
    this.initSpeedState(p.startPaused, effectiveAllowTacticalPause, p.initialTimeScale);

    this.postInitMessage({
      seed: p.seed, map, fogOfWarEnabled: p.fogOfWarEnabled, debugOverlayEnabled: p.debugOverlayEnabled,
      debugSnapshots: p.debugSnapshots, debugSnapshotInterval: p.debugSnapshotInterval,
      agentControlEnabled: p.agentControlEnabled, unitStyle: p.unitStyle, themeId: p.themeId,
      squadConfig: p.squadConfig, missionType: p.missionType, losOverlayEnabled: p.losOverlayEnabled,
      startingThreatLevel: p.startingThreatLevel, baseEnemyCount: p.baseEnemyCount,
      enemyGrowthPerMission: p.enemyGrowthPerMission, missionDepth: p.missionDepth,
      startingPoints: p.startingPoints, initialTimeScale: this.computeEffectiveTimeScale(),
      allowTacticalPause: effectiveAllowTacticalPause, mode: p.mode, initialCommandLog: p.commandLog,
      initialSnapshots: p.initialSnapshots, targetTick: p.targetTick, nodeType: p.nodeType,
      campaignNodeId: p.campaignNodeId, skipDeployment: p.skipDeployment,
    });

    if (p.mode === EngineMode.Simulation && typeof localStorage !== "undefined") {
      this.persistSimulationConfig({
        seed: p.seed, mapGeneratorType: p.mapGeneratorType, mapData: p.mapData,
        fogOfWarEnabled: p.fogOfWarEnabled, debugOverlayEnabled: p.debugOverlayEnabled,
        agentControlEnabled: p.agentControlEnabled, squadConfig: p.squadConfig,
        missionType: p.missionType, width: p.width, height: p.height,
        spawnPointCount: p.spawnPointCount, losOverlayEnabled: p.losOverlayEnabled,
        startingThreatLevel: p.startingThreatLevel, baseEnemyCount: p.baseEnemyCount,
        enemyGrowthPerMission: p.enemyGrowthPerMission, missionDepth: p.missionDepth,
        initialTimeScale: p.initialTimeScale, startPaused: p.startPaused,
        allowTacticalPause: p.allowTacticalPause, campaignNodeId: p.campaignNodeId,
        nodeType: p.nodeType, bonusLootCount: p.bonusLootCount, skipDeployment: p.skipDeployment,
      }, p.commandLog, p.targetTick);
    }
  }

  private static resolveInitConfig(cfg: GameClientInitConfig) {
    const base = GameClient.resolveBaseConfig(cfg);
    const extra = GameClient.resolveExtraConfig(cfg);
    return { ...base, ...extra };
  }

  private static resolveBaseConfig(cfg: GameClientInitConfig) {
    return {
      seed: cfg.seed,
      mapGeneratorType: cfg.mapGeneratorType,
      mapData: cfg.mapData,
      fogOfWarEnabled: cfg.fogOfWarEnabled ?? true,
      debugOverlayEnabled: cfg.debugOverlayEnabled ?? false,
      agentControlEnabled: cfg.agentControlEnabled ?? true,
      unitStyle: cfg.unitStyle ?? UnitStyle.TacticalIcons,
      themeId: cfg.themeId ?? "default",
      squadConfig: cfg.squadConfig ?? ({ soldiers: [], inventory: {} } as SquadConfig),
      missionType: cfg.missionType ?? MissionType.Default,
      width: cfg.width ?? 16,
      height: cfg.height ?? 16,
      spawnPointCount: cfg.spawnPointCount ?? 3,
      losOverlayEnabled: cfg.losOverlayEnabled ?? false,
      startingThreatLevel: cfg.startingThreatLevel ?? 0,
    };
  }

  private static resolveExtraConfig(cfg: GameClientInitConfig) {
    return {
      initialTimeScale: cfg.initialTimeScale ?? 1.0,
      startPaused: cfg.startPaused ?? false,
      allowTacticalPause: cfg.allowTacticalPause ?? true,
      mode: cfg.mode ?? EngineMode.Simulation,
      commandLog: cfg.commandLog ?? ([] as CommandLogEntry[]),
      campaignNodeId: cfg.campaignNodeId,
      targetTick: cfg.targetTick ?? 0,
      baseEnemyCount: cfg.baseEnemyCount ?? 3,
      enemyGrowthPerMission: cfg.enemyGrowthPerMission ?? 1,
      missionDepth: cfg.missionDepth ?? 0,
      nodeType: cfg.nodeType,
      startingPoints: cfg.startingPoints,
      bonusLootCount: cfg.bonusLootCount ?? 0,
      skipDeployment: cfg.skipDeployment ?? true,
      debugSnapshots: cfg.debugSnapshots ?? false,
      debugSnapshotInterval: cfg.debugSnapshotInterval ?? 0,
      initialSnapshots: cfg.initialSnapshots ?? ([] as GameState[]),
    };
  }

  private storeInitialParams(p: {
    seed: number;
    squadConfig: SquadConfig;
    missionType: MissionType;
    nodeType?: CampaignNodeType;
    missionDepth: number;
    baseEnemyCount: number;
    enemyGrowthPerMission: number;
    startingPoints?: number;
    startingThreatLevel: number;
    skipDeployment: boolean;
    allowTacticalPause: boolean;
    bonusLootCount: number;
    agentControlEnabled: boolean;
    unitStyle: UnitStyle;
    themeId: string;
  }): void {
    this.initialSeed = p.seed;
    this.initialSquadConfig = p.squadConfig;
    this.initialMissionType = p.missionType;
    this.initialNodeType = p.nodeType;
    this.initialMissionDepth = p.missionDepth;
    this.initialBaseEnemyCount = p.baseEnemyCount;
    this.initialEnemyGrowthPerMission = p.enemyGrowthPerMission;
    this.initialStartingPoints = p.startingPoints;
    this.initialStartingThreatLevel = p.startingThreatLevel;
    this.initialSkipDeployment = p.skipDeployment;
    this.initialAllowTacticalPause = p.allowTacticalPause;
    this.initialBonusLootCount = p.bonusLootCount;
    this.initialAgentControlEnabled = p.agentControlEnabled;
    this.initialUnitStyle = p.unitStyle;
    this.initialThemeId = p.themeId;
  }

  private generateOrLoadMap(p: {
    seed: number;
    width: number;
    height: number;
    mapGeneratorType: MapGeneratorType;
    spawnPointCount: number;
    bonusLootCount: number;
    mapData?: MapDefinition;
  }): MapDefinition {
    const config: MapGenerationConfig = {
      seed: p.seed,
      width: p.width,
      height: p.height,
      type: p.mapGeneratorType,
      spawnPointCount: p.spawnPointCount,
      bonusLootCount: p.bonusLootCount,
    };
    const generator = this.mapGeneratorFactory(config);
    Logger.info(`GameClient: init mapGeneratorType=${p.mapGeneratorType}, hasMapData=${!!p.mapData}`);
    if (p.mapGeneratorType === MapGeneratorType.Static) {
      if (!p.mapData) throw new Error("mapData is required for Static map generator");
      return generator.load(p.mapData);
    }
    return generator.generate();
  }

  private initCommandStream(commandLog: CommandLogEntry[], targetTick: number): void {
    this.startTime = Date.now();
    const lastCommandTick = commandLog.length > 0 ? commandLog[commandLog.length - 1].tick : 0;
    this.startTime -= Math.max(lastCommandTick, targetTick);

    this.commandStream = commandLog.length > 0
      ? commandLog.map((cl) => ({ t: cl.tick, cmd: cl.command }))
      : [];
  }

  private initSpeedState(startPaused: boolean, allowTacticalPause: boolean, initialTimeScale: number): void {
    this.isPaused = startPaused;
    this.allowTacticalPause = allowTacticalPause;
    const minScale = allowTacticalPause ? 0.1 : 1.0;
    const clampedScale = Math.min(Math.max(initialTimeScale, minScale), 10.0);
    this.currentScale = clampedScale;
    this.lastNonPausedScale = clampedScale;
  }

  private computeEffectiveTimeScale(): number {
    if (!this.isPaused) return this.currentScale;
    return this.allowTacticalPause ? 0.1 : 0.0;
  }

  private postInitMessage(payload: Extract<WorkerMessage, { type: "INIT" }>["payload"]): void {
    const msg: WorkerMessage = { type: "INIT", payload };
    this.worker.postMessage(msg);
  }

  private persistSimulationConfig(
    config: MissionConfig,
    commandLog: CommandLogEntry[],
    targetTick: number,
  ): void {
    this.saveMissionConfig(config);
    if (commandLog.length > 0) {
      localStorage.setItem("voidlock_mission_log", JSON.stringify(commandLog));
    } else {
      localStorage.setItem("voidlock_mission_log", "[]");
    }
    if (targetTick > 0) {
      localStorage.setItem("voidlock_mission_tick", targetTick.toString());
    }
  }

  private saveMissionConfig(config: MissionConfig) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("voidlock_mission_config", JSON.stringify(config));
    }
  }

  public clearMissionData() {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("voidlock_mission_config");
      localStorage.removeItem("voidlock_mission_log");
      localStorage.removeItem("voidlock_mission_tick");
    }
  }

  public applyCommand(cmd: Command) {
    // Record command using engine ticks for determinism
    // Note: We no longer push to commandStream here manually.
    // It will be synced from the authoritative engine state in the next update.

    const msg: WorkerMessage = {
      type: "COMMAND",
      payload: cmd,
    };
    this.worker.postMessage(msg);
  }

  public toggleDebugOverlay(enabled: boolean) {
    this.applyCommand({
      type: CommandType.TOGGLE_DEBUG_OVERLAY,
      enabled,
    });
  }

  public toggleLosOverlay(enabled: boolean) {
    this.applyCommand({
      type: CommandType.TOGGLE_LOS_OVERLAY,
      enabled,
    });
  }

  public forceWin() {
    this.applyCommand({
      type: CommandType.DEBUG_FORCE_WIN,
    });
  }

  public forceLose() {
    this.applyCommand({
      type: CommandType.DEBUG_FORCE_LOSE,
    });
  }

  public queryState() {
    const msg: WorkerMessage = {
      type: "QUERY_STATE",
    };
    this.worker.postMessage(msg);
  }

  public getFullState() {
    this.queryState();
  }

  public setTickRate(rate: number) {
    const msg: WorkerMessage = {
      type: "SET_TICK_RATE",
      payload: rate,
    };
    this.worker.postMessage(msg);
  }

  public setTimeScale(scale: number) {
    const minScale = this.allowTacticalPause ? 0.1 : 1.0;
    const effectiveScale = Math.min(Math.max(scale, minScale), 10.0);

    if (this.isPaused) {
      this.lastNonPausedScale = effectiveScale;
      // Do not update worker's timeScale immediately, keep at paused value (0.1 or 0.0)
      // But we DO update the targetTimeScale so it's reflected in the engine state (ADR 0048)
      this.sendTargetTimeScaleToWorker(effectiveScale);
    } else {
      this.currentScale = effectiveScale;
      this.lastNonPausedScale = effectiveScale;
      this.sendTimeScaleToWorker(effectiveScale);
      this.sendTargetTimeScaleToWorker(effectiveScale);
    }
  }

  public pause() {
    if (!this.isPaused) {
      this.isPaused = true;
      this.lastNonPausedScale = this.currentScale;
      this.sendPausedToWorker(true);
      this.sendTimeScaleToWorker(this.allowTacticalPause ? 0.1 : 0.0);
      // Ensure targetTimeScale is also synced
      this.sendTargetTimeScaleToWorker(this.lastNonPausedScale);
    }
  }

  public resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.currentScale = this.lastNonPausedScale;
      this.sendPausedToWorker(false);
      this.sendTimeScaleToWorker(this.currentScale);
      this.sendTargetTimeScaleToWorker(this.currentScale);
    }
  }

  public togglePause() {
    if (this.isPaused) {
      this.resume();
    } else if (this.allowTacticalPause) {
      this.pause();
    }
  }

  public freezeForDialog() {
    if (!this.isPaused) {
      this.lastNonPausedScale = this.currentScale;
    }
    this.isPaused = true;
    this.sendPausedToWorker(true);
    this.sendTimeScaleToWorker(0.0);
    this.sendTargetTimeScaleToWorker(0.0);
  }

  public unfreezeAfterDialog() {
    if (this.isPaused) {
      this.isPaused = false;
      this.currentScale = this.lastNonPausedScale;
      this.sendPausedToWorker(false);
      this.sendTimeScaleToWorker(this.currentScale);
      this.sendTargetTimeScaleToWorker(this.currentScale);
    }
  }

  public getTimeScale(): number {
    if (this.isPaused) {
      return this.allowTacticalPause ? 0.1 : 0.0;
    }
    return this.currentScale;
  }

  public getTargetScale(): number {
    return this.lastNonPausedScale;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  private sendTimeScaleToWorker(scale: number) {
    const msg: WorkerMessage = {
      type: "SET_TIME_SCALE",
      payload: scale,
    };
    this.worker.postMessage(msg);
  }

  private sendTargetTimeScaleToWorker(scale: number) {
    const msg: WorkerMessage = {
      type: "SET_TARGET_TIME_SCALE",
      payload: scale,
    };
    this.worker.postMessage(msg);
  }

  private sendPausedToWorker(paused: boolean) {
    const msg: WorkerMessage = {
      type: "SET_PAUSED",
      payload: paused,
    };
    this.worker.postMessage(msg);
  }

  public getReplayData(): ReplayData | null {
    if (!this.initialMap || !this.initialSquadConfig) return null;
    return {
      seed: this.initialSeed,
      missionType: this.initialMissionType,
      map: this.initialMap,
      squadConfig: this.initialSquadConfig,
      commands: [...this.commandStream],
      snapshots: [...this.snapshots],
      nodeType: this.initialNodeType,
      missionDepth: this.initialMissionDepth,
      baseEnemyCount: this.initialBaseEnemyCount,
      enemyGrowthPerMission: this.initialEnemyGrowthPerMission,
      startingPoints: this.initialStartingPoints,
      startingThreatLevel: this.initialStartingThreatLevel,
      skipDeployment: this.initialSkipDeployment,
      allowTacticalPause: this.initialAllowTacticalPause,
      bonusLootCount: this.initialBonusLootCount,
      agentControlEnabled: this.initialAgentControlEnabled,
      unitStyle: this.initialUnitStyle,
      themeId: this.initialThemeId,
    };
  }

  public loadReplay(data: ReplayData) {
    const commandLog: CommandLogEntry[] = data.commands.map((rc) => ({
      tick: rc.t,
      command: rc.cmd,
    }));

    if (data.snapshots) {
      this.snapshots = data.snapshots;
    }

    this.init({
      seed: data.seed,
      mapGeneratorType: MapGeneratorType.Static,
      mapData: data.map,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      agentControlEnabled: data.agentControlEnabled ?? true,
      unitStyle: data.unitStyle ?? UnitStyle.TacticalIcons,
      themeId: data.themeId ?? "default",
      squadConfig: data.squadConfig,
      missionType: data.missionType || MissionType.Default,
      width: data.map.width,
      height: data.map.height,
      spawnPointCount: 0,
      losOverlayEnabled: false,
      startingThreatLevel: data.startingThreatLevel ?? 0,
      initialTimeScale: 1.0,
      startPaused: false,
      allowTacticalPause: data.allowTacticalPause ?? true,
      mode: EngineMode.Replay,
      commandLog,
      campaignNodeId: undefined,
      targetTick: 0,
      baseEnemyCount: data.baseEnemyCount ?? 3,
      enemyGrowthPerMission: data.enemyGrowthPerMission ?? 1,
      missionDepth: data.missionDepth ?? 0,
      nodeType: data.nodeType,
      startingPoints: data.startingPoints,
      bonusLootCount: data.bonusLootCount ?? 0,
      skipDeployment: data.skipDeployment ?? true,
      debugSnapshots: true,
      debugSnapshotInterval: 100,
      initialSnapshots: this.snapshots,
    });
  }

  public seek(tick: number) {
    const data = this.getReplayData();
    if (!data) return;

    const commandLog: CommandLogEntry[] = data.commands.map((rc) => ({
      tick: rc.t,
      command: rc.cmd,
    }));

    this.init({
      seed: data.seed,
      mapGeneratorType: MapGeneratorType.Static,
      mapData: data.map,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      agentControlEnabled: data.agentControlEnabled ?? true,
      unitStyle: data.unitStyle ?? UnitStyle.TacticalIcons,
      themeId: data.themeId ?? "default",
      squadConfig: data.squadConfig,
      missionType: data.missionType || MissionType.Default,
      width: data.map.width,
      height: data.map.height,
      spawnPointCount: 0,
      losOverlayEnabled: false,
      startingThreatLevel: data.startingThreatLevel ?? 0,
      initialTimeScale: this.currentScale,
      startPaused: this.isPaused,
      allowTacticalPause: data.allowTacticalPause ?? true,
      mode: EngineMode.Replay,
      commandLog,
      campaignNodeId: undefined,
      targetTick: tick,
      baseEnemyCount: data.baseEnemyCount ?? 3,
      enemyGrowthPerMission: data.enemyGrowthPerMission ?? 1,
      missionDepth: data.missionDepth ?? 0,
      nodeType: data.nodeType,
      startingPoints: data.startingPoints,
      bonusLootCount: data.bonusLootCount ?? 0,
      skipDeployment: data.skipDeployment ?? true,
      debugSnapshots: true,
      debugSnapshotInterval: 100,
      initialSnapshots: this.snapshots,
    });
  }

  public onStateUpdate(cb: ((state: GameState) => void) | null) {
    this.mainListener = cb;
  }

  public addStateUpdateListener(cb: (state: GameState) => void) {
    this.extraListeners.push(cb);
  }

  public removeStateUpdateListener(cb: (state: GameState) => void) {
    this.extraListeners = this.extraListeners.filter((l) => l !== cb);
  }

  public stop() {
    this.isStopped = true;
    // We no longer clear state update listeners here to allow DebriefScreen
    // to continue receiving updates for replay if stop() was called during mission end.
    this.clearMissionData();
    const msg: WorkerMessage = {
      type: "STOP",
    };
    this.worker.postMessage(msg);
  }

  public clearStateUpdateListeners() {
    this.mainListener = null;
    this.extraListeners = [];
  }

  public terminate() {
    this.isStopped = true;
    this.clearMissionData();
    this.worker.terminate();
  }
}
