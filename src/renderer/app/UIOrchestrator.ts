import { GameClient } from "@src/engine/GameClient";
import { ModalService } from "../ui/ModalService";
import { Logger } from "@src/shared/Logger";
import { GameState } from "@src/shared/types";
import { TimeUtility } from "../TimeUtility";

export interface UIOrchestratorDependencies {
  gameClient: GameClient;
  modalService: ModalService;
  getCurrentGameState: () => GameState | null;
}

export class UIOrchestrator {
  constructor(private deps: UIOrchestratorDependencies) {}

  public setupResponsiveDrawers() {
    // Use delegated event listeners at the body level because these toggles
    // are injected/replaced dynamically by HUDManager (ADR 0052).
    document.body.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const toggleSquad = target.closest("#btn-toggle-squad");
      const toggleRight = target.closest("#btn-toggle-right");
      
      const soldierPanel = document.getElementById("soldier-panel");
      const rightPanel = document.getElementById("right-panel");

      if (toggleSquad && soldierPanel) {
        e.stopPropagation();
        soldierPanel.classList.toggle("active");
        if (rightPanel) rightPanel.classList.remove("active");
      }

      if (toggleRight && rightPanel) {
        e.stopPropagation();
        rightPanel.classList.toggle("active");
        if (soldierPanel) soldierPanel.classList.remove("active");
      }
    });

    const gameContainer = document.getElementById("game-container");
    if (gameContainer) {
      gameContainer.addEventListener("click", () => {
        if (window.innerWidth < 768) {
          const soldierPanel = document.getElementById("soldier-panel");
          const rightPanel = document.getElementById("right-panel");
          if (soldierPanel) soldierPanel.classList.remove("active");
          if (rightPanel) rightPanel.classList.remove("active");
        }
      });
    }
  }

  public setMissionHUDVisible(visible: boolean) {
    const state = this.deps.getCurrentGameState();
    const isPrologue = state?.missionType === "Prologue";
    
    // In prologue, we never hide the HUD, but we might dim it (via binders)
    if (isPrologue && !visible) {
        return; 
    }

    const topBar = document.getElementById("top-bar");
    const soldierPanel = document.getElementById("soldier-panel");
    const rightPanel = document.getElementById("right-panel");
    const display = visible ? "flex" : "none";
    if (topBar) topBar.style.display = display;
    if (soldierPanel) soldierPanel.style.display = display;
    if (rightPanel) rightPanel.style.display = display;
  }

  /**
   * Authoritative sync of the speed UI based on the GameClient state.
   * NOTE: Most mission UI labels are handled by HUDManager from the authoritative engine state.
   */
  public syncSpeedUI() {
    // Immediate feedback for local state changes if needed, 
    // but mission labels are now authoritative from HUDManager (ADR 0048).
    const speedSlider = document.getElementById("game-speed") as HTMLInputElement;
    if (speedSlider) {
      const targetScale = this.deps.gameClient.getTargetScale();
      const sliderVal = TimeUtility.scaleToSlider(targetScale);
      
      // Only update if not focused to avoid fighting the user
      if (document.activeElement !== speedSlider) {
        speedSlider.value = sliderVal.toString();
      }
    }
  }

  public async copyWorldState() {
    const state = this.deps.getCurrentGameState();
    if (!state) return;

    const json = JSON.stringify(state, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      Logger.info("World state copied to clipboard.");
    } catch (err) {
      Logger.error("Failed to copy world state:", err);
    }
  }

  public togglePause() {
    this.deps.gameClient.togglePause();
  }

  public exportReplay() {
    const replay = this.deps.gameClient.getReplayData();
    if (!replay) {
      this.deps.modalService.alert("No replay data available.");
      return;
    }

    const blob = new Blob([JSON.stringify(replay)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voidlock_replay_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  public setupAdditionalUIBindings(callbacks: {
    onAbortMission: () => void;
    onRetryMission: () => void;
    onForceWin: () => void;
    onForceLose: () => void;
    onTimeScaleChange?: (scale: number) => void;
  }) {
    // Handle global speed slider input (ADR 0048)
    document.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      if (target && (target.id === "game-speed" || target.classList.contains("mobile-speed-slider"))) {
        // Skip if this input event was triggered by UIBinder programmatic sync
        if (target.getAttribute("data-is-binding") === "true") return;

        const val = parseFloat(target.value);
        const scale = TimeUtility.sliderToScale(val);
        
        if (callbacks.onTimeScaleChange) {
          callbacks.onTimeScaleChange(scale);
        } else {
          // Fallback if callback not provided
          if (this.deps.gameClient.getIsPaused() && scale > 0) {
            this.deps.gameClient.resume();
          }
          this.deps.gameClient.setTimeScale(scale);
          this.syncSpeedUI();
        }
      }
    });
  }
}
