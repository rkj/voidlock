import { GameClient } from "@src/engine/GameClient";
import { TimeUtility } from "../TimeUtility";
import { ModalService } from "../ui/ModalService";
import { Logger } from "@src/shared/Logger";
import { GameState } from "@src/shared/types";

export interface UIOrchestratorDependencies {
  gameClient: GameClient;
  modalService: ModalService;
  getCurrentGameState: () => GameState | null;
}

export class UIOrchestrator {
  constructor(private deps: UIOrchestratorDependencies) {}

  public setupResponsiveDrawers() {
    const toggleSquad = document.getElementById("btn-toggle-squad");
    const toggleRight = document.getElementById("btn-toggle-right");
    const soldierPanel = document.getElementById("soldier-panel");
    const rightPanel = document.getElementById("right-panel");

    if (toggleSquad && soldierPanel) {
      toggleSquad.addEventListener("click", () => {
        soldierPanel.classList.toggle("active");
        if (rightPanel) rightPanel.classList.remove("active");
      });
    }

    if (toggleRight && rightPanel) {
      toggleRight.addEventListener("click", () => {
        rightPanel.classList.toggle("active");
        if (soldierPanel) soldierPanel.classList.remove("active");
      });
    }

    const gameContainer = document.getElementById("game-container");
    if (gameContainer) {
      gameContainer.addEventListener("click", () => {
        if (window.innerWidth < 768) {
          if (soldierPanel) soldierPanel.classList.remove("active");
          if (rightPanel) rightPanel.classList.remove("active");
        }
      });
    }
  }

  public setMissionHUDVisible(boolean: boolean) {
    const topBar = document.getElementById("top-bar");
    const soldierPanel = document.getElementById("soldier-panel");
    const rightPanel = document.getElementById("right-panel");
    const display = boolean ? "flex" : "none";
    if (topBar) topBar.style.display = display;
    if (soldierPanel) soldierPanel.style.display = display;
    if (rightPanel) rightPanel.style.display = display;
  }

  /**
   * Authoritative sync of the speed UI based on the GameClient state.
   */
  public syncSpeedUI() {
    const isPaused = this.deps.gameClient.getIsPaused();
    const timeScale = this.deps.gameClient.getTimeScale();

    const speedSlider = document.getElementById(
      "game-speed",
    ) as HTMLInputElement;
    if (speedSlider) {
      // Use Target Scale (the non-paused speed) for the slider position
      const targetScale = this.deps.gameClient.getTargetScale();
      speedSlider.value = TimeUtility.scaleToSlider(targetScale).toString();
    }

    const speedValue = document.getElementById("speed-value");
    if (speedValue) {
      speedValue.textContent = TimeUtility.formatSpeed(timeScale, isPaused);
    }

    const btnPause = document.getElementById("btn-pause");
    if (btnPause) {
      btnPause.textContent = isPaused ? "▶" : "⏸";
      btnPause.title = isPaused ? "Resume" : "Pause";
    }

    const btnPauseToggle = document.getElementById("btn-pause-toggle");
    if (btnPauseToggle) {
        btnPauseToggle.textContent = isPaused ? "▶ Play" : "|| Pause";
    }
  }

  public async copyWorldState() {
    const state = this.deps.getCurrentGameState();
    if (!state) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
      this.deps.modalService.alert("World state copied to clipboard!");
    } catch (err) {
      Logger.error("Failed to copy world state:", err);
    }
  }

  public exportReplay() {
    const replay = this.deps.gameClient.getReplayData();
    const blob = new Blob([JSON.stringify(replay, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voidlock-replay-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Authoritative toggle pause using GameClient methods.
   */
  public togglePause(onSync?: () => void) {
    this.deps.gameClient.togglePause();
    this.syncSpeedUI();
    if (onSync) onSync();
  }

  public setupAdditionalUIBindings(callbacks: {
    onAbortMission: () => void;
    onRetryMission: () => void;
    onForceWin: () => void;
    onForceLose: () => void;
  }) {
    const btnAbort = document.getElementById("btn-abort");
    if (btnAbort) btnAbort.onclick = () => callbacks.onAbortMission();

    const btnRetry = document.getElementById("btn-retry");
    if (btnRetry) btnRetry.onclick = () => callbacks.onRetryMission();

    const btnExport = document.getElementById("btn-export");
    if (btnExport) btnExport.onclick = () => this.exportReplay();

    // Standardized ID: game-speed
    const speedSlider = document.getElementById("game-speed") as HTMLInputElement;
    if (speedSlider) {
      speedSlider.oninput = () => {
        // Use logarithmic mapping from slider (0-100) to scale (0.1-10.0)
        const scale = TimeUtility.sliderToScale(parseFloat(speedSlider.value));
        this.deps.gameClient.setTimeScale(scale);
        this.syncSpeedUI();
      };
    }

    const btnPause = document.getElementById("btn-pause");
    if (btnPause) {
      btnPause.onclick = () => this.togglePause();
    }

    // btn-pause-toggle is also a pause button used in the mobile HUD
    const btnPauseToggle = document.getElementById("btn-pause-toggle");
    if (btnPauseToggle) {
      btnPauseToggle.onclick = () => this.togglePause();
    }
  }
}
