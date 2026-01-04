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
  private replayTimeouts: any[] = [];

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
    this.commandStream = [];
    this.startTime = Date.now();

    // Reset speed state for new session
    this.isPaused = startPaused;
    this.allowTacticalPause = allowTacticalPause;
    this.currentScale = initialTimeScale;
    this.lastNonPausedScale = initialTimeScale;

    // Clear any pending replay timeouts
    this.replayTimeouts.forEach((id) => clearTimeout(id));
    this.replayTimeouts = [];

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
      },
    };
    this.worker.postMessage(msg);

    // Sync current scale to new worker
    this.sendTimeScaleToWorker(this.isPaused ? (this.allowTacticalPause ? 0.1 : 0.0) : this.currentScale);
  }

  public sendCommand(cmd: Command) {
    // Record command
    const t = Date.now() - this.startTime;
    this.commandStream.push({ t, cmd });

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
    // For now, just re-init. A true replay system would feed commands over time.
    // Spec: "Import to replay exact run".
    // Does it play back visually or just jump to end?
    // "Replay exact run" usually means visual playback.
    // But for "Deterministic Engine Skeleton", maybe just re-simulating instantly is enough to prove determinism?
    // "M3: Director + replay/export ... record/replay command stream".
    // I'll implement a fast-forward replay for now: init, then send all commands (with original timing delays? or just batch?)
    // If I send all at once, `CoreEngine` needs to handle `t` correctly.
    // Current `CoreEngine.applyCommand` doesn't take a timestamp. It applies "now".
    // If we replay, we need to inject commands at specific engine times.
    // The Engine needs to support "scheduled commands" or we must feed them in real-time (or fast-time) from Client.

    // Simplest Replay: Client re-inits, then sets timeouts to send commands at recorded `t`.
    this.init(
      data.seed,
      MapGeneratorType.Static,
      data.map,
      true,
      false,
      true,
      data.squadConfig,
    );

    // Schedule commands
    // Note: this relies on `setTimeout` accuracy which is poor.
    // Better: Engine supports "scheduleCommand(t, cmd)".
    // But protocol is `COMMAND`.
    // I'll stick to Client-side scheduling for now.

    // Reset start time to now so recorded `t` matches new flow
    // `init` resets `startTime`.

    data.commands.forEach((rc: RecordedCommand) => {
      const timeoutId = setTimeout(() => {
        // We bypass `sendCommand` to avoid re-recording?
        // Or we assume `loadReplay` is "watching" mode.
        // If we use `sendCommand`, it records again.
        // We should send directly to worker.
        const msg: WorkerMessage = {
          type: "COMMAND",
          payload: rc.cmd,
        };
        this.worker.postMessage(msg);

        // Remove from list when fired
        this.replayTimeouts = this.replayTimeouts.filter(
          (id) => id !== timeoutId,
        );
      }, rc.t);
      this.replayTimeouts.push(timeoutId);
    });
  }

  public onStateUpdate(cb: ((state: GameState) => void) | null) {
    this.onStateUpdateCb = cb;
  }

  public stop() {
    // Clear any pending replay timeouts
    this.replayTimeouts.forEach((id) => clearTimeout(id));
    this.replayTimeouts = [];

    const msg: WorkerMessage = {
      type: "STOP",
    };
    this.worker.postMessage(msg);
  }

  public terminate() {
    this.worker.terminate();
  }
}
