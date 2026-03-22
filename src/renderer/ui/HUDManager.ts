import type { GameState, Unit } from "@src/shared/types";
import type { MenuController } from "@src/renderer/MenuController";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { UIBinder } from "@src/renderer/ui/UIBinder";
import { HUDTopBar, HUDSoldierPanel, HUDRightPanel, HUDMobileActionPanel, HUDTutorialDirective } from "@src/renderer/ui/HUD";
import { FocusManager } from "@src/renderer/utils/FocusManager";

import {
  DeploymentPanel,
  CommandMenuPanel,
  ObjectivesPanel,
  EnemyIntelPanel,
  SoldierListPanel,
  GameOverPanel
} from "@src/renderer/ui/panels/HUDPanels";

export interface HUDManagerConfig {
  menuController: MenuController;
  tutorialManager: any;
  onUnitClick: (unit: Unit, shiftHeld?: boolean) => void;
  onAbortMission: () => void;
  onMenuInput: (key: string, shiftHeld?: boolean) => void;
  onCopyWorldState: () => void;
  onForceWin: () => void;
  onForceLose: () => void;
  onStartMission: () => void;
  onDeployUnit: (unitId: string, x: number, y: number) => void;
}

export class HUDManager {
  private binder: UIBinder;
  private currentState: GameState | null = null;
  private selectedUnitId: string | null = null;

  private menuController: MenuController;
  private tutorialManager: any;
  private onUnitClick: (unit: Unit, shiftHeld?: boolean) => void;
  private onAbortMission: () => void;
  private onMenuInput: (key: string, shiftHeld?: boolean) => void;
  private onCopyWorldState: () => void;
  private onForceWin: () => void;
  private onForceLose: () => void;
  private onStartMission: () => void;
  private onDeployUnit: (unitId: string, x: number, y: number) => void;

  private deploymentPanel: DeploymentPanel;
  private commandMenuPanel: CommandMenuPanel;
  private objectivesPanel: ObjectivesPanel;
  private enemyIntelPanel: EnemyIntelPanel;
  private soldierListPanel: SoldierListPanel;
  private gameOverPanel: GameOverPanel;

  constructor(config: HUDManagerConfig) {
    this.menuController = config.menuController;
    this.tutorialManager = config.tutorialManager;
    this.onUnitClick = config.onUnitClick;
    this.onAbortMission = config.onAbortMission;
    this.onMenuInput = config.onMenuInput;
    this.onCopyWorldState = config.onCopyWorldState;
    this.onForceWin = config.onForceWin;
    this.onForceLose = config.onForceLose;
    this.onStartMission = config.onStartMission;
    this.onDeployUnit = config.onDeployUnit;

    this.binder = new UIBinder();
    
    this.deploymentPanel = new DeploymentPanel({
      onDeployUnit: this.onDeployUnit,
      onStartMission: this.onStartMission,
      onAbortMission: this.onAbortMission,
      onUnitClick: (unit) => this.onUnitClick(unit),
      getCurrentState: () => this.currentState,
      getBinder: () => this.binder,
      getSelectedUnitId: () => this.selectedUnitId
    });

    this.commandMenuPanel = new CommandMenuPanel({
      menuController: this.menuController,
      onMenuInput: this.onMenuInput,
      onAbortMission: this.onAbortMission,
      getBinder: () => this.binder
    });

    this.objectivesPanel = new ObjectivesPanel();
    this.enemyIntelPanel = new EnemyIntelPanel();

    this.soldierListPanel = new SoldierListPanel({
      onUnitClick: this.onUnitClick
    });

    this.gameOverPanel = new GameOverPanel({
      onAbortMission: this.onAbortMission,
      objectivesPanel: this.objectivesPanel
    });

    this.setupTransformers();
    this.initializeHUD();
  }

  private initializeHUD() {
    const missionScreen = document.getElementById("screen-mission");
    if (!missionScreen) return;

    const missionBody = document.getElementById("mission-body");
    if (!missionBody) return;

    const topBar = document.getElementById("top-bar");
    const soldierPanel = document.getElementById("soldier-panel");
    const rightPanel = document.getElementById("right-panel");
    const mobileActionPanel = document.getElementById("mobile-action-panel");
    const tutorialDirective = document.getElementById("tutorial-directive");

    if (topBar) topBar.remove();
    if (soldierPanel) soldierPanel.remove();
    if (rightPanel) rightPanel.remove();
    if (mobileActionPanel) mobileActionPanel.remove();
    if (tutorialDirective) tutorialDirective.remove();

    missionScreen.insertBefore(HUDTopBar() as Node, missionBody);
    missionScreen.insertBefore(HUDTutorialDirective() as Node, missionBody);
    missionScreen.insertBefore(HUDSoldierPanel() as Node, missionBody);
    missionBody.appendChild(HUDRightPanel() as Node);
    missionScreen.appendChild(HUDMobileActionPanel() as Node);

    // Initial scan
    this.binder.initialize(document.body);
  }

  private setupTransformers() {
    this.binder.registerTransformer("toSeconds", (val) => ((val as number) / 1000).toFixed(1));
    this.binder.registerTransformer("threatPercent", (val) => `${Math.floor(val as number)}%`);
    
    const getThreatClass = (val: number) => {
      if (val > 70) return "threat-danger";
      if (val > 30) return "threat-warning";
      return "threat-success";
    };

    this.binder.registerTransformer("threatFillClass", (val) => `threat-fill ${getThreatClass(val as number)}`);
    this.binder.registerTransformer("threatValueClass", (val) => `threat-value ${getThreatClass(val as number)}`);

    this.binder.registerTransformer("threatVisibility", (_, state) => {
      const isDeployment = state.status === "Deployment";
      return !isDeployment;
    });

    this.binder.registerTransformer("speedVisibility", (_, state) => {
      const isDeployment = state.status === "Deployment";
      return !isDeployment;
    });

    this.binder.registerTransformer("threatDimmed", (_, state) => {
      const isPrologue = state.missionType === "Prologue";
      const threatLevel = state.stats.threatLevel || 0;
      const aliensKilled = state.stats.aliensKilled || 0;
      const hasContact = threatLevel > 1 || aliensKilled > 0;
      return isPrologue && !hasContact ? "tutorial-dimmed" : "";
    });

    this.binder.registerTransformer("speedDimmed", (_, state) => {
      const isPrologue = state.missionType === "Prologue";
      return isPrologue ? "tutorial-dimmed" : "";
    });

    this.binder.registerTransformer("soldierPanelDimmed", (_, state) => {
      const isPrologue = state.missionType === "Prologue";
      // Only dimmed if not yet reached a certain point? 
      // For now, let's keep it simple: dimmed if it's the very start of prologue
      return isPrologue && state.t < 500 ? "tutorial-dimmed" : "";
    });

    this.binder.registerTransformer("rightPanelDimmed", (_, state) => {
      const isPrologue = state.missionType === "Prologue";
      // Dimmed until enemy sighted or similar?
      // Let's use hasContact for right panel too, as it contains Intel and Objectives
      const threatLevel = state.stats.threatLevel || 0;
      const aliensKilled = state.stats.aliensKilled || 0;
      const hasContact = threatLevel > 1 || aliensKilled > 0;
      return isPrologue && !hasContact ? "tutorial-dimmed" : "";
    });

    this.binder.registerTransformer("pauseText", (isPaused) => (isPaused as boolean) ? "▶ Play" : "|| Pause");

    const tutorial = this.tutorialManager;
    this.binder.registerTransformer("tutorialStepId", () => {
        if (!tutorial) return "";
        return tutorial.getCurrentStepId() || "";
    });

    this.binder.registerTransformer("minSpeedValue", (allowTacticalPause) => (allowTacticalPause as boolean) ? "0" : "50");

    this.binder.registerTransformer("speedSlider", (targetTimeScale) => {
      const active = document.activeElement as HTMLInputElement;
      if (active && (active.id === "game-speed" || active.classList.contains("mobile-speed-slider"))) {
        return active.value;
      }
      return TimeUtility.scaleToSlider(targetTimeScale as number).toString();
    });

    this.binder.registerTransformer("speedText", (settings) => {
      const s = settings as { isPaused: boolean; allowTacticalPause: boolean; timeScale: number; targetTimeScale: number };
      const displayScale = s.isPaused ? (s.allowTacticalPause ? 0.1 : 0) : s.timeScale;
      return TimeUtility.formatSpeed(displayScale, s.isPaused);
    });
  }

  public update(state: GameState, selectedUnitId: string | null) {
    this.currentState = state;
    this.selectedUnitId = selectedUnitId;
    
    const activeBefore = document.activeElement;
    FocusManager.saveFocus();
    
    if (!this.binder.hasBindings()) {
      this.binder.initialize(document.body);
    }

    this.binder.sync(state);
    this.updateTopBar(state);
    this.updateRightPanel(state);
    this.soldierListPanel.update(state, selectedUnitId);
    
    if (activeBefore !== document.body && document.activeElement === document.body) {
        FocusManager.restoreFocus(document.body);
    }
  }

  private updateTopBar(state: GameState) {
    const topThreatFill = document.getElementById("top-threat-fill");
    if (topThreatFill) {
      const isInitial = state.t < 1000;
      if (isInitial) {
        topThreatFill.classList.add("no-transition");
        void topThreatFill.offsetWidth;
        topThreatFill.classList.remove("no-transition");
      }
    }
  }

  private updateRightPanel(state: GameState) {
    const rightPanel = document.getElementById("right-panel");
    const mobileActionPanel = document.getElementById("mobile-action-panel");
    if (!rightPanel) return;

    const isMobile = window.innerWidth < 768;
    const actionContainer = isMobile && mobileActionPanel ? mobileActionPanel : rightPanel;
    const secondaryContainer = rightPanel; // Always visible on desktop, drawer on mobile

    // Clear action-related controls from the container they don't belong in to prevent a11y duplication
    if (isMobile && mobileActionPanel) {
      rightPanel.querySelector(".mission-controls")?.remove();
      rightPanel.querySelector(".command-menu")?.remove();
      rightPanel.querySelector(".deployment-summary")?.remove();
      rightPanel.querySelector(".game-over-summary")?.remove();
    } else if (mobileActionPanel) {
      mobileActionPanel.innerHTML = ""; // Clear mobile panel on desktop
    }

    // Sync ARIA state for right panel on mobile
    if (isMobile) {
      const isDrawerOpen = rightPanel.classList.contains("active");
      rightPanel.setAttribute("aria-hidden", (!isDrawerOpen).toString());
    } else {
      rightPanel.removeAttribute("aria-hidden");
    }

    if (state.status === "Deployment") {
      this.deploymentPanel.update(actionContainer, state);
      return;
    }

    // Explicitly clear deployment from desktop panel if transitioning to Play
    if (!isMobile) {
      rightPanel.querySelector(".deployment-summary")?.remove();
    }

    if (state.status !== "Playing") {
      this.gameOverPanel.update(actionContainer, state);
      return;
    }

    this.commandMenuPanel.update(actionContainer, state);

    this.objectivesPanel.update(secondaryContainer, state);

    this.updateDebugControls(secondaryContainer, state);
    this.enemyIntelPanel.update(secondaryContainer, state);
  }

  private updateDebugControls(container: HTMLElement, state: GameState) {
    let debugDiv = container.querySelector(".debug-controls") as HTMLElement;
    if (state.settings.debugOverlayEnabled) {
      if (!debugDiv) {
        debugDiv = document.createElement("div");
        debugDiv.className = "debug-controls";
        container.appendChild(debugDiv);
      }
      const generatorName = state.map?.generatorName || "Unknown";
      const genDisplay = generatorName.endsWith("Generator")
        ? generatorName
        : `${generatorName}Generator`;

      const debugKey = `${state.seed}-${state.map?.width}x${state.map?.height}-${state.missionType}`;
      if (debugDiv.dataset.renderedKey !== debugKey) {
        debugDiv.dataset.renderedKey = debugKey;
        debugDiv.innerHTML = `
          <h3>Debug Tools</h3>
          <div class="debug-info-grid">
            <span><strong>Map:</strong> ${genDisplay} (${state.seed})</span>
            <span><strong>Size:</strong> ${state.map ? `${state.map.width}x${state.map.height}` : "Unknown"}</span>
            <span><strong>Mission:</strong> ${state.missionType}</span>
          </div>
          <div class="debug-actions-row">
            <button id="btn-force-win" class="debug-btn-win">Force Win</button>
            <button id="btn-force-lose" class="debug-btn-lose">Force Lose</button>
          </div>
          <button id="btn-copy-world-state" class="debug-btn-copy">Copy World State</button>
        `;
        document.getElementById("btn-copy-world-state")?.addEventListener("click", () => this.onCopyWorldState());
        document.getElementById("btn-force-win")?.addEventListener("click", () => this.onForceWin());
        document.getElementById("btn-force-lose")?.addEventListener("click", () => this.onForceLose());
      }
    } else if (debugDiv) {
      debugDiv.remove();
    }
  }
}
