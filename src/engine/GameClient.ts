import { MapDefinition, Command, GameState, WorkerMessage, MainMessage, ReplayData, RecordedCommand, MapGeneratorType, SquadConfig, MissionType } from '../shared/types';
import { MapGenerator } from './MapGenerator';

// Factory type for creating MapGenerator instances based on type
type MapGeneratorFactory = (seed: number, type: MapGeneratorType, mapData?: MapDefinition) => MapGenerator;

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

  constructor(mapGeneratorFactory: MapGeneratorFactory) {
    this.mapGeneratorFactory = mapGeneratorFactory;
    // Vite handles this import with ?worker suffix
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    
    this.worker.onmessage = (e: MessageEvent<MainMessage>) => {
      const msg = e.data;
      if (msg.type === 'STATE_UPDATE') {
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
    squadConfig: SquadConfig = [], // Default to empty array if not provided
    missionType: MissionType = MissionType.Default,
    width: number = 16,
    height: number = 16
  ) {
    this.initialSeed = seed;
    this.initialSquadConfig = squadConfig;
    // Use the factory to get the map, based on type and data
    const generator = this.mapGeneratorFactory(seed, mapGeneratorType, mapData);
    const map = mapGeneratorType === MapGeneratorType.Static ? generator.load(mapData!) : generator.generate(width, height, mapGeneratorType);

    this.initialMap = map;
    this.commandStream = [];
    this.startTime = Date.now();

    const msg: WorkerMessage = {
      type: 'INIT',
      payload: { seed, map, fogOfWarEnabled, debugOverlayEnabled, agentControlEnabled, squadConfig: squadConfig, missionType }
    };
    this.worker.postMessage(msg);
  }

  public sendCommand(cmd: Command) {
    // Record command
    const t = Date.now() - this.startTime;
    this.commandStream.push({ t, cmd });

    const msg: WorkerMessage = {
      type: 'COMMAND',
      payload: cmd
    };
    this.worker.postMessage(msg);
  }

  public getReplayData(): ReplayData | null {
    if (!this.initialMap || !this.initialSquadConfig) return null;
    return {
      seed: this.initialSeed,
      map: this.initialMap,
      squadConfig: this.initialSquadConfig,
      commands: [...this.commandStream]
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
    this.init(data.seed, MapGeneratorType.Static, data.map, true, false, true, data.squadConfig);
    
    // Schedule commands
    // Note: this relies on `setTimeout` accuracy which is poor.
    // Better: Engine supports "scheduleCommand(t, cmd)".
    // But protocol is `COMMAND`.
    // I'll stick to Client-side scheduling for now.
    
    // Reset start time to now so recorded `t` matches new flow
    // `init` resets `startTime`.
    
    data.commands.forEach(rc => {
      setTimeout(() => {
        // We bypass `sendCommand` to avoid re-recording?
        // Or we assume `loadReplay` is "watching" mode.
        // If we use `sendCommand`, it records again.
        // We should send directly to worker.
        const msg: WorkerMessage = {
          type: 'COMMAND',
          payload: rc.cmd
        };
        this.worker.postMessage(msg);
      }, rc.t);
    });
  }

  public onStateUpdate(cb: (state: GameState) => void) {
    this.onStateUpdateCb = cb;
  }

  public terminate() {
    this.worker.terminate();
  }
}