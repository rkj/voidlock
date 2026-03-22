import type { GameClient } from "@src/engine/GameClient";
import type { GameState, UnitStyle } from "@src/shared/types";
import { EngineMode } from "@src/shared/types";
import { Renderer } from "@src/renderer/Renderer";
import { Logger } from "@src/shared/Logger";

import { ThemeManager } from "../ThemeManager";
import { AssetManager } from "../visuals/AssetManager";

export interface ReplayControllerConfig {
  gameClient: GameClient;
  themeManager: ThemeManager;
  assetManager: AssetManager;
  onProgressUpdate: (progress: number) => void;
}

export class ReplayController {
  public static readonly INITIAL_SPEED = 5.0;
  private gameClient: GameClient;
  private themeManager: ThemeManager;
  private assetManager: AssetManager;
  private renderer: Renderer | null = null;
  private onProgressUpdate: (progress: number) => void;
  private isReplaying: boolean = false;
  private totalTime: number = 0;
  private isLooping: boolean = false;

  constructor(config: ReplayControllerConfig) {
    this.gameClient = config.gameClient;
    this.themeManager = config.themeManager;
    this.assetManager = config.assetManager;
    this.onProgressUpdate = config.onProgressUpdate;
  }

  public setLooping(looping: boolean) {
    this.isLooping = looping;
  }

  public setRenderer(canvas: HTMLCanvasElement, unitStyle: UnitStyle) {
    this.renderer = new Renderer({
      canvas,
      themeManager: this.themeManager,
      assetManager: this.assetManager,
    });
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
    const wasReplaying = this.isReplaying;
    this.stopReplay();
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
    
    // Only stop if we are actually in Replay mode to avoid stopping a new mission start (Spec 8.12)
    if (wasReplaying) {
      this.gameClient.stop();
    }
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
