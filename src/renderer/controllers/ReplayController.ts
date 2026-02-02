import { GameClient } from "@src/engine/GameClient";
import { GameState, EngineMode, UnitStyle } from "@src/shared/types";
import { Renderer } from "@src/renderer/Renderer";

export class ReplayController {
  private gameClient: GameClient;
  private renderer: Renderer | null = null;
  private onProgressUpdate: (progress: number) => void;
  private isReplaying: boolean = false;
  private totalTime: number = 0;
  private isLooping: boolean = false;

  constructor(
    gameClient: GameClient,
    onProgressUpdate: (progress: number) => void
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
      console.warn("ReplayController: No replay data available.");
      return;
    }

    this.totalTime = totalTime;
    this.isReplaying = true;
    this.gameClient.addStateUpdateListener(this.handleStateUpdate);
    this.gameClient.loadReplay(replayData);
    this.gameClient.setTimeScale(5.0);
  }

  public stopReplay() {
    if (!this.isReplaying) return;
    this.isReplaying = false;
    this.gameClient.removeStateUpdateListener(this.handleStateUpdate);
    // Note: we don't call gameClient.stop() here because it might be shared.
    // But in the context of Debrief screen, we want to stop it when leaving.
  }

  private handleStateUpdate = (state: GameState) => {
    if (state.settings.mode === EngineMode.Replay) {
      if (this.renderer) {
        this.renderer.render(state);
      }
      
      if (this.totalTime > 0) {
        const progress = (state.t / this.totalTime) * 100;
        this.onProgressUpdate(Math.min(100, progress));

        if (progress >= 100 && this.isLooping) {
          this.seek(0);
        }
      }
    }
  };

  public setPlaybackSpeed(speed: number) {
    this.gameClient.setTimeScale(speed);
  }

  public seek(progress: number) {
    if (this.totalTime <= 0) return;
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