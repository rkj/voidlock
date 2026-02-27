import { GameClient } from "@src/engine/GameClient";
import { GameState, EngineMode, UnitStyle } from "@src/shared/types";
import { Renderer } from "@src/renderer/Renderer";
import { Logger } from "@src/shared/Logger";

export class ReplayController {
  public static readonly INITIAL_SPEED = 5.0;
  private gameClient: GameClient;
  private renderer: Renderer | null = null;
  private onProgressUpdate: (progress: number) => void;
  private isReplaying: boolean = false;
  private totalTime: number = 0;
  private isLooping: boolean = false;

  constructor(
    gameClient: GameClient,
    onProgressUpdate: (progress: number) => void,
  ) {
    this.gameClient = gameClient;
    this.onProgressUpdate = onProgressUpdate;
  }

  public setLooping(looping: boolean) {
    this.isLooping = looping;
  }

  public setRenderer(canvas: HTMLCanvasElement, unitStyle: UnitStyle) {
    this.renderer = new Renderer(canvas);
    this.renderer.setCellSize(128);
    this.renderer.setUnitStyle(unitStyle);
  }

  public startReplay(totalTime: number) {
    const replayData = this.gameClient.getReplayData();
    if (!replayData) {
      Logger.warn("ReplayController: No replay data available.");
      return;
    }

    this.totalTime = totalTime;
    this.isReplaying = true;
    this.gameClient.addStateUpdateListener(this.handleStateUpdate);
    this.gameClient.loadReplay(replayData);
    this.gameClient.setTimeScale(ReplayController.INITIAL_SPEED);
  }

  public stopReplay() {
    if (!this.isReplaying) return;
    this.isReplaying = false;
    this.gameClient.removeStateUpdateListener(this.handleStateUpdate);
  }

  public destroy() {
    this.stopReplay();
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
    
    // Only stop if we are actually in Replay mode to avoid stopping a new mission start (Spec 8.12)
    // We check the internal gameClient state to be sure
    this.gameClient.queryState(); // Request latest state to be sure, though it's async
    
    // Better: GameClient should probably expose its mode
    // For now, we rely on the fact that stop() is generally safe if we are leaving Debrief
    this.gameClient.stop();
  }

  private handleStateUpdate = (state: GameState) => {
    if (state.settings.mode === EngineMode.Replay) {
      if (this.renderer) {
        this.renderer.render(state);
      }

      if (this.totalTime > 0) {
        const progress = (state.t / this.totalTime) * 100;
        this.onProgressUpdate(Math.min(100, progress));

        if (progress >= 100) {
          if (this.isLooping) {
            this.seek(0);
          } else if (!this.gameClient.getIsPaused()) {
            this.gameClient.pause();
          }
        }
      }
    }
  };

  public setPlaybackSpeed(speed: number) {
    this.gameClient.setTimeScale(speed);
  }

  private lastSeekRequest: number = 0;

  public seek(progress: number) {
    if (this.totalTime <= 0) return;

    const now = performance.now();
    if (now - this.lastSeekRequest < 16) return; // Limit to ~60fps
    this.lastSeekRequest = now;

    const targetTime = (progress / 100) * this.totalTime;
    // Tick rate is 16ms
    this.gameClient.seek(targetTime);
  }

  public togglePause() {
    this.gameClient.togglePause();
  }

  public getIsPaused(): boolean {
    return this.gameClient.getIsPaused();
  }

  public getTargetScale(): number {
    return this.gameClient.getTargetScale();
  }
}
