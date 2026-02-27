import {
  MapDefinition,
  Command,
  GameState,
  WorkerMessage,
  MainMessage,
  ReplayData,
  RecordedCommand,
  MapGeneratorType,
  UnitStyle,
  SquadConfig,
  MissionType,
  CommandType,
  EngineMode,
  CommandLogEntry,
  MapGenerationConfig,
  CampaignNodeType,
} from "../shared/types";
import { MapFactory } from "./map/MapFactory";

// Factory type for creating MapFactory instances based on config
type MapGeneratorFactory = (config: MapGenerationConfig) => MapFactory;

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

    this.worker.onmessage = (e: MessageEvent<MainMessage>) => {
      if (this.isStopped) return;
      const msg = e.data;
      if (msg.type === "STATE_UPDATE") {
        // Session validation (Spec 8.12)
        if (this.currentSessionId && msg.payload.settings.sessionId !== this.currentSessionId) {
          console.warn(`[GameClient] Ignoring stale STATE_UPDATE for session ${msg.payload.settings.sessionId} (current: ${this.currentSessionId})`);
          return;
        }

        console.log(`[GameClient] STATE_UPDATE t=${msg.payload.t} status=${msg.payload.status} mode=${msg.payload.settings.mode} sid=${msg.payload.settings.sessionId}`);
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

  public init(
    seed: number,
    mapGeneratorType: MapGeneratorType,
    mapData?: MapDefinition,
    fogOfWarEnabled: boolean = true,
    debugOverlayEnabled: boolean = false,
    agentControlEnabled: boolean = true,
    unitStyle: UnitStyle = UnitStyle.TacticalIcons,
    themeId: string = "default",
    squadConfig: SquadConfig = { soldiers: [], inventory: {} }, // Default to empty squad if not provided
    missionType: MissionType = MissionType.Default,
    width: number = 16,
    height: number = 16,
    spawnPointCount: number = 3,
    losOverlayEnabled: boolean = false,
    startingThreatLevel: number = 0,
    initialTimeScale: number = 1.0,
    startPaused: boolean = false,
    allowTacticalPause: boolean = true,
    mode: EngineMode = EngineMode.Simulation,
    commandLog: CommandLogEntry[] = [],
    campaignNodeId?: string,
    targetTick: number = 0,
    baseEnemyCount: number = 3,
    enemyGrowthPerMission: number = 1,
    missionDepth: number = 0,
    nodeType?: CampaignNodeType,
    startingPoints?: number,
    bonusLootCount: number = 0,
    skipDeployment: boolean = true,
    debugSnapshots: boolean = false,
    debugSnapshotInterval: number = 0,
    initialSnapshots: GameState[] = [],
  ) {
    this.isStopped = false;
    this.currentSessionId = Math.random().toString(36).substring(2, 15);
    this.initialSeed = seed;
    this.initialSquadConfig = squadConfig;
    this.initialMissionType = missionType;
    this.initialNodeType = nodeType;
    this.initialMissionDepth = missionDepth;
    this.initialBaseEnemyCount = baseEnemyCount;
    this.initialEnemyGrowthPerMission = enemyGrowthPerMission;
    this.initialStartingPoints = startingPoints;
    this.initialStartingThreatLevel = startingThreatLevel;
    this.initialSkipDeployment = skipDeployment;
    this.initialAllowTacticalPause = allowTacticalPause;
    this.initialBonusLootCount = bonusLootCount;
    this.initialAgentControlEnabled = agentControlEnabled;
    this.initialUnitStyle = unitStyle;
    this.initialThemeId = themeId;

    // In Replay mode, we force allowTacticalPause to false to ensure absolute pause (0.0 timescale)
    // and disable redundant "Active Pause" logic.
    const effectiveAllowTacticalPause =
      mode === EngineMode.Replay ? false : allowTacticalPause;

    const config: MapGenerationConfig = {
      seed,
      width,
      height,
      type: mapGeneratorType,
      spawnPointCount,
      bonusLootCount,
    };

    // Use the factory to get the map, based on type and data
    const generator = this.mapGeneratorFactory(config);
    const map =
      mapGeneratorType === MapGeneratorType.Static
        ? generator.load(mapData!)
        : generator.generate();

    this.initialMap = map;
    this.startTime = Date.now();

    // If we have a command log, synchronize startTime so subsequent commands have correct ticks
    const lastCommandTick =
      commandLog && commandLog.length > 0
        ? commandLog[commandLog.length - 1].tick
        : 0;

    const effectiveStartTimeTick = Math.max(lastCommandTick, targetTick);
    this.startTime -= effectiveStartTimeTick;

    if (commandLog && commandLog.length > 0) {
      this.commandStream = commandLog.map((cl) => ({
        t: cl.tick,
        cmd: cl.command,
      }));
    } else {
      this.commandStream = [];
    }

    // Reset speed state for new session
    this.isPaused = startPaused;
    this.allowTacticalPause = effectiveAllowTacticalPause;

    const minScale = this.allowTacticalPause ? 0.1 : 1.0;
    const clampedScale = Math.min(Math.max(initialTimeScale, minScale), 10.0);

    this.currentScale = clampedScale;
    this.lastNonPausedScale = clampedScale;

    const effectiveTimeScale = this.isPaused
      ? this.allowTacticalPause
        ? 0.1
        : 0.0
      : this.currentScale;

    const msg: WorkerMessage = {
      type: "INIT",
      payload: {
        seed,
        map,
        fogOfWarEnabled,
        debugOverlayEnabled,
        debugSnapshots,
        debugSnapshotInterval,
        agentControlEnabled,
        unitStyle,
        themeId,
        squadConfig: squadConfig,
        missionType,
        losOverlayEnabled,
        startingThreatLevel,
        baseEnemyCount,
        enemyGrowthPerMission,
        missionDepth,
        startingPoints,
        initialTimeScale: effectiveTimeScale,
        startPaused: this.isPaused,
        allowTacticalPause: effectiveAllowTacticalPause,
        mode,
        commandLog,
        initialSnapshots,
        targetTick,
        targetTimeScale: this.lastNonPausedScale,
        nodeType,
        campaignNodeId,
        skipDeployment,
        sessionId: this.currentSessionId,
      },
    };
    this.worker.postMessage(msg);

    if (mode === EngineMode.Simulation && typeof localStorage !== "undefined") {
      this.saveMissionConfig({
        seed,
        mapGeneratorType,
        mapData,
        fogOfWarEnabled,
        debugOverlayEnabled,
        agentControlEnabled,
        squadConfig,
        missionType,
        width,
        height,
        spawnPointCount,
        losOverlayEnabled,
        startingThreatLevel,
        baseEnemyCount,
        enemyGrowthPerMission,
        missionDepth,
        initialTimeScale,
        startPaused,
        allowTacticalPause,
        campaignNodeId,
        nodeType,
        bonusLootCount,
        skipDeployment,
      });

      // If we provided an initial command log, make sure it's also in the persistent log
      if (commandLog && commandLog.length > 0) {
        localStorage.setItem(
          "voidlock_mission_log",
          JSON.stringify(commandLog),
        );
      } else {
        localStorage.setItem("voidlock_mission_log", "[]");
      }

      if (targetTick > 0) {
        localStorage.setItem("voidlock_mission_tick", targetTick.toString());
      }
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
    // Convert RecordedCommand[] to CommandLogEntry[]
    const commandLog: CommandLogEntry[] = data.commands.map((rc) => ({
      tick: rc.t,
      command: rc.cmd,
    }));

    if (data.snapshots) {
      this.snapshots = data.snapshots;
    }

    this.init(
      data.seed,
      MapGeneratorType.Static,
      data.map,
      true, // fog
      false, // debug
      data.agentControlEnabled ?? true,
      data.unitStyle ?? UnitStyle.TacticalIcons,
      data.themeId ?? "default",
      data.squadConfig,
      data.missionType || MissionType.Default,
      data.map.width,
      data.map.height,
      0, // spawnPointCount (static map)
      false, // los
      data.startingThreatLevel ?? 0,
      1.0, // initialTimeScale
      false, // startPaused
      data.allowTacticalPause ?? true,
      EngineMode.Replay,
      commandLog,
      undefined, // campaignNodeId
      0, // targetTick
      data.baseEnemyCount ?? 3,
      data.enemyGrowthPerMission ?? 1,
      data.missionDepth ?? 0,
      data.nodeType,
      data.startingPoints,
      data.bonusLootCount ?? 0,
      data.skipDeployment ?? true,
      true, // debugSnapshots
      100, // debugSnapshotInterval (1.6s)
      this.snapshots,
    );
  }

  public seek(tick: number) {
    const data = this.getReplayData();
    if (!data) return;

    const commandLog: CommandLogEntry[] = data.commands.map((rc) => ({
      tick: rc.t,
      command: rc.cmd,
    }));

    this.init(
      data.seed,
      MapGeneratorType.Static,
      data.map,
      true, // fog
      false, // debug
      data.agentControlEnabled ?? true,
      data.unitStyle ?? UnitStyle.TacticalIcons,
      data.themeId ?? "default",
      data.squadConfig,
      data.missionType || MissionType.Default,
      data.map.width,
      data.map.height,
      0, // spawnPointCount (static map)
      false, // los
      data.startingThreatLevel ?? 0,
      this.currentScale, // preserve current speed
      this.isPaused, // preserve paused state
      data.allowTacticalPause ?? true,
      EngineMode.Replay,
      commandLog,
      undefined, // campaignNodeId
      tick, // targetTick
      data.baseEnemyCount ?? 3,
      data.enemyGrowthPerMission ?? 1,
      data.missionDepth ?? 0,
      data.nodeType,
      data.startingPoints,
      data.bonusLootCount ?? 0,
      data.skipDeployment ?? true,
      true, // debugSnapshots
      100, // debugSnapshotInterval (1.6s)
      this.snapshots,
    );
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
