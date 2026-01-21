import {
  MapDefinition,
  Command,
  GameState,
  WorkerMessage,
  MainMessage,
  ReplayData,
  RecordedCommand,
  MapGeneratorType,
  SquadConfig,
  MissionType,
  CommandType,
  EngineMode,
  CommandLogEntry,
  MapGenerationConfig,
} from "../shared/types";
import { MapFactory } from "./map/MapFactory";

// Factory type for creating MapFactory instances based on config
type MapGeneratorFactory = (config: MapGenerationConfig) => MapFactory;

export class GameClient {
  private worker: Worker;
  private onStateUpdateCb: ((state: GameState) => void) | null = null;
  private mapGeneratorFactory: MapGeneratorFactory;
  private isStopped: boolean = false;

  // Replay State
  private initialSeed: number = 0;
  private initialMap: MapDefinition | null = null;
  private initialSquadConfig: SquadConfig | null = null;
  private commandStream: RecordedCommand[] = [];
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
        if (typeof localStorage !== "undefined" && msg.payload.settings.mode === EngineMode.Simulation) {
          localStorage.setItem("voidlock_mission_tick", Math.floor(msg.payload.t).toString());
        }
        if (this.onStateUpdateCb) {
          this.onStateUpdateCb(msg.payload);
        }
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
    nodeType?: string, // Actually CampaignNodeType but string is fine for the client
    bonusLootCount: number = 0,
  ) {
    this.isStopped = false;
    this.initialSeed = seed;
    this.initialSquadConfig = squadConfig;

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
    const lastCommandTick = commandLog && commandLog.length > 0
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
    this.allowTacticalPause = allowTacticalPause;

    const minScale = this.allowTacticalPause ? 0.1 : 1.0;
    const clampedScale = Math.min(Math.max(initialTimeScale, minScale), 10.0);

    this.currentScale = clampedScale;
    this.lastNonPausedScale = clampedScale;

    const msg: WorkerMessage = {
      type: "INIT",
      payload: {
        seed,
        map,
        fogOfWarEnabled,
        debugOverlayEnabled,
        agentControlEnabled,
        squadConfig: squadConfig,
        missionType,
        losOverlayEnabled,
        startingThreatLevel,
        baseEnemyCount,
        enemyGrowthPerMission,
        missionDepth,
        initialTimeScale: clampedScale,
        startPaused,
        allowTacticalPause,
        mode,
        commandLog,
        targetTick,
        nodeType: nodeType as any,
        campaignNodeId,
      },
    };
    this.worker.postMessage(msg);

    // Sync current scale to new worker
    this.sendTimeScaleToWorker(
      this.isPaused ? (this.allowTacticalPause ? 0.05 : 0.0) : this.currentScale,
    );

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
      });

      // If we provided an initial command log, make sure it's also in the persistent log
      if (commandLog && commandLog.length > 0) {
        localStorage.setItem("voidlock_mission_log", JSON.stringify(commandLog));
      } else {
        localStorage.setItem("voidlock_mission_log", "[]");
      }

      if (targetTick > 0) {
        localStorage.setItem("voidlock_mission_tick", targetTick.toString());
      }
    }
  }

  private saveMissionConfig(config: any) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("voidlock_mission_config", JSON.stringify(config));
    }
  }

  private appendCommand(cmd: Command) {
    if (typeof localStorage === "undefined") return;
    try {
      const logStr = localStorage.getItem("voidlock_mission_log") || "[]";
      const log: CommandLogEntry[] = JSON.parse(logStr);
      log.push({
        tick: Date.now() - this.startTime,
        command: cmd,
      });
      localStorage.setItem("voidlock_mission_log", JSON.stringify(log));
    } catch (e) {
      console.error("Failed to append command to persistent log", e);
    }
  }

  public clearMissionData() {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("voidlock_mission_config");
      localStorage.removeItem("voidlock_mission_log");
      localStorage.removeItem("voidlock_mission_tick");
    }
  }

  public sendCommand(cmd: Command) {
    // Record command
    const t = Date.now() - this.startTime;
    this.commandStream.push({ t, cmd });

    // Auto-save command
    this.appendCommand(cmd);

    const msg: WorkerMessage = {
      type: "COMMAND",
      payload: cmd,
    };
    this.worker.postMessage(msg);
  }

  public toggleDebugOverlay(enabled: boolean) {
    this.sendCommand({
      type: CommandType.TOGGLE_DEBUG_OVERLAY,
      enabled,
    });
  }

  public toggleLosOverlay(enabled: boolean) {
    this.sendCommand({
      type: CommandType.TOGGLE_LOS_OVERLAY,
      enabled,
    });
  }

  public forceWin() {
    this.sendCommand({
      type: CommandType.DEBUG_FORCE_WIN,
    });
  }

  public forceLose() {
    this.sendCommand({
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
      // Do not update worker immediately, keep at paused value (0.05 or 0.0)
    } else {
      this.currentScale = effectiveScale;
      this.lastNonPausedScale = effectiveScale;
      this.sendTimeScaleToWorker(effectiveScale);
    }
  }

  public pause() {
    if (!this.isPaused) {
      this.isPaused = true;
      this.lastNonPausedScale = this.currentScale;
      this.sendTimeScaleToWorker(this.allowTacticalPause ? 0.05 : 0.0);
    }
  }

  public resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.currentScale = this.lastNonPausedScale;
      this.sendTimeScaleToWorker(this.currentScale);
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
      return this.allowTacticalPause ? 0.05 : 0.0;
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

  public getReplayData(): ReplayData | null {
    if (!this.initialMap || !this.initialSquadConfig) return null;
    return {
      seed: this.initialSeed,
      map: this.initialMap,
      squadConfig: this.initialSquadConfig,
      commands: [...this.commandStream],
    };
  }

  public loadReplay(data: ReplayData) {
    // Convert RecordedCommand[] to CommandLogEntry[]
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
      true, // agent
      data.squadConfig,
      MissionType.Default, // missionType (should ideally be in ReplayData too)
      data.map.width,
      data.map.height,
      0, // spawnPointCount (static map)
      false, // los
      0, // startingThreat
      1.0, // initialTimeScale
      false, // startPaused
      true, // allowTacticalPause
      EngineMode.Replay,
      commandLog,
      undefined, // campaignNodeId
      0, // targetTick
      3, // baseEnemyCount
      1, // enemyGrowthPerMission
      0, // missionDepth
      undefined, // nodeType
      0, // bonusLootCount
    );
  }

  public onStateUpdate(cb: ((state: GameState) => void) | null) {
    this.onStateUpdateCb = cb;
  }

  public stop() {
    this.isStopped = true;
    this.clearMissionData();
    const msg: WorkerMessage = {
      type: "STOP",
    };
    this.worker.postMessage(msg);
  }

  public terminate() {
    this.isStopped = true;
    this.clearMissionData();
    this.worker.terminate();
  }
}
