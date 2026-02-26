import { GameClient } from "@src/engine/GameClient";
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
   * NOTE: Most mission UI labels are handled by HUDManager from the authoritative engine state.
   * This method provides immediate feedback for local client state changes.
   */
  public syncSpeedUI() {
    // Immediate feedback for local state changes if needed, 
    // but mission labels are now authoritative from HUDManager (ADR 0048).
    // We keep this method for any non-mission UI that might need it.
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

  public setupAdditionalUIBindings(_callbacks: {
    onAbortMission: () => void;
    onRetryMission: () => void;
    onForceWin: () => void;
    onForceLose: () => void;
  }) {
    // This method is now mostly legacy as InputBinder handles most global events (ADR 0047).
    // It remains for any dynamic or specific tactical UI elements not covered by InputBinder.
  }
}
