import { MapDefinition, Command, GameState, WorkerMessage, MainMessage } from '../shared/types';

export class GameClient {
  private worker: Worker;
  private onStateUpdateCb: ((state: GameState) => void) | null = null;

  constructor() {
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

  public init(seed: number, map: MapDefinition) {
    const msg: WorkerMessage = {
      type: 'INIT',
      payload: { seed, map }
    };
    this.worker.postMessage(msg);
  }

  public sendCommand(cmd: Command) {
    const msg: WorkerMessage = {
      type: 'COMMAND',
      payload: cmd
    };
    this.worker.postMessage(msg);
  }

  public onStateUpdate(cb: (state: GameState) => void) {
    this.onStateUpdateCb = cb;
  }

  public terminate() {
    this.worker.terminate();
  }
}
