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
} from "../shared/types";
import { MapGenerator } from "./MapGenerator";

// Factory type for creating MapGenerator instances based on type
type MapGeneratorFactory = (
  seed: number,
  type: MapGeneratorType,
  mapData?: MapDefinition,
) => MapGenerator;

export class GameClient {
  private worker: Worker;
  private onStateUpdateCb: ((state: GameState) => void) | null = null;
  private mapGeneratorFactory: MapGeneratorFactory;

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
      const msg = e.data;
      if (msg.type === "STATE_UPDATE") {
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
  ) {
    this.initialSeed = seed;
    this.initialSquadConfig = squadConfig;
    // Use the factory to get the map, based on type and data
    const generator = this.mapGeneratorFactory(seed, mapGeneratorType, mapData);
    const map =
      mapGeneratorType === MapGeneratorType.Static
        ? generator.load(mapData!)
        : generator.generate(width, height, mapGeneratorType, spawnPointCount);

    this.initialMap = map;
    this.startTime = Date.now();

    // If we have a command log, synchronize startTime so subsequent commands have correct ticks
    if (commandLog && commandLog.length > 0) {
      const lastTick = commandLog[commandLog.length - 1].tick;
      this.startTime -= lastTick;
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
    this.currentScale = initialTimeScale;
    this.lastNonPausedScale = initialTimeScale;

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
        initialTimeScale,
        startPaused,
        allowTacticalPause,
        mode,
        commandLog,
      },
    };
    this.worker.postMessage(msg);

    // Sync current scale to new worker
    this.sendTimeScaleToWorker(this.isPaused ? (this.allowTacticalPause ? 0.1 : 0.0) : this.currentScale);

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
        initialTimeScale,
        startPaused,
        allowTacticalPause,
        campaignNodeId,
      });

      // If we provided an initial command log, make sure it's also in the persistent log
      if (commandLog && commandLog.length > 0) {
        localStorage.setItem("voidlock_mission_log", JSON.stringify(commandLog));
      } else {
        localStorage.setItem("voidlock_mission_log", "[]");
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
    let effectiveScale = scale;
    if (!this.allowTacticalPause && scale < 1.0) {
      effectiveScale = 1.0;
    }

    if (this.isPaused) {
      this.lastNonPausedScale = effectiveScale;
      // Do not update worker immediately, keep at paused value (0.1 or 0.0)
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
      this.sendTimeScaleToWorker(this.allowTacticalPause ? 0.1 : 0.0);
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
    if (this.isPaused) this.resume();
    else this.pause();
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
    );
  }

  public onStateUpdate(cb: ((state: GameState) => void) | null) {
    this.onStateUpdateCb = cb;
  }

  public stop() {
    this.clearMissionData();
    const msg: WorkerMessage = {
      type: "STOP",
    };
    this.worker.postMessage(msg);
  }

  public terminate() {
    this.clearMissionData();
    this.worker.terminate();
  }
}
