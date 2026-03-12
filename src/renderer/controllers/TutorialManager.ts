import { GameClient } from "@src/engine/GameClient";
import { GameState, MissionType } from "@src/shared/types";
import { ScreenId } from "@src/renderer/ScreenManager";
import { Logger } from "@src/shared/Logger";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { Vector2 } from "@src/shared/types/geometry";
import { UIOrchestrator } from "../app/UIOrchestrator";
import { CampaignManager } from "../campaign/CampaignManager";
import { Renderer } from "../Renderer";

export interface AdvisorMessage {
  id: string;
  text: string;
  title?: string;
  illustration?: string;
  portrait?: string; // default 'mother'
  duration?: number; // ms, if 0 or undefined, requires dismissal
  blocking?: boolean; // pauses game
}

export type TutorialCondition = (state: GameState, manager: TutorialManager) => boolean;

export interface TutorialStep {
  id: string;
  directive: string;
  directiveMobile?: string;
  condition: TutorialCondition;
  message?: AdvisorMessage;
  highlightTarget?: {
    selector?: string;
    cell?: Vector2;
  };
  inputGate?: {
    allowedActions: string[];
  };
  onEnter?: (manager: TutorialManager, state: GameState) => void;
  onComplete?: (manager: TutorialManager, state: GameState) => void;
}

export class TutorialManager {
  private gameClient: GameClient;
  private campaignManager: CampaignManager;
  private onMessage: (msg: AdvisorMessage) => void;
  private getRenderer: () => Renderer | null;
  private isActive: boolean = false;
  private completedSteps: Set<string> = new Set();
  private isPrologueActive: boolean = false;
  private currentStepIndex: number = -1;

  private highlightedElement: HTMLElement | null = null;
  private highlightedElementSelector: string | null = null;
  private highlightedCell: Vector2 | null = null;
  private cellHighlightEl: HTMLElement | null = null;

  private initialPositions: Map<string, Vector2> = new Map();

  // State tracking
  private hasMoved: boolean = false;
  private lastRescueCount: number = 0;
  private uiTourStartTick: number = -1;
  
  private prologueSteps: TutorialStep[] = [
    {
      id: "observe",
      directive: "Your soldier explores autonomously. Watch them move.",
      highlightTarget: { selector: ".soldier-card" },
      condition: (state, manager) => manager.checkUnitMovedFromStart(state),
      message: {
        id: "start",
        title: "Project Voidlock: Operation First Light",
        text: "Commander, the Voidlock is failing. Your squad has been deployed with standing orders to explore and secure the area. Watch your soldier's progress on the tactical display.",
        illustration: "bg_station",
        portrait: "logo_gemini",
        blocking: true,
      },
      onEnter: (manager, state) => {
          manager.captureInitialPositions(state);
      },
      inputGate: { allowedActions: [] }
    },
    {
      id: "ui_tour",
      directive: "This is your squad. Commands are issued from the right panel. Objectives are tracked below.",
      directiveMobile: "Tap 'Squad' to see your soldiers. Tap 'Objectives' for mission goals.",
      condition: (state, manager) => manager.checkUITourComplete(state),
      onEnter: (manager, state) => {
          manager.startUITourTimer(state);
      },
      inputGate: { allowedActions: [] }
    },
    {
      id: "doors",
      directive: "Doors open automatically when your soldier approaches.",
      condition: (state, manager) => manager.checkDoorOpened(state),
      inputGate: { allowedActions: [] }
    },
    {
      id: "combat",
      directive: "Hostile contact! Your soldier engages automatically.",
      condition: (state, manager) => manager.checkEnemyTookDamage(state),
      message: {
        id: "enemy_sighted",
        title: "Tactical Basics: Combat",
        text: "Hostile contact! Your soldiers engage automatically when enemies enter their weapon range. The threat meter shows current swarm activity.",
        portrait: "logo_gemini",
        blocking: true,
      },
      onEnter: (manager) => {
          manager.highlightElement("#top-threat-container");
      },
      inputGate: { allowedActions: [] }
    },
    {
      id: "engagement_ignore",
      directive: "Try changing fire policy. Press [2] Engagement, then [2] Ignore.",
      directiveMobile: "Tap 'Engagement' in the command panel, then tap 'Ignore'.",
      highlightTarget: { selector: "#command-menu" },
      condition: (state, manager) => manager.checkEngagementIgnore(state),
      message: {
        id: "first_command",
        title: "Tactical Basics: Intervention",
        text: "Time to take command. The right panel shows available actions. Each command is issued through the menu -- select an action, choose a target, then assign soldiers.",
        portrait: "logo_gemini",
        blocking: true,
      },
      inputGate: { allowedActions: ["SET_ENGAGEMENT"] }
    },
    {
      id: "engagement_engage",
      directive: "Your soldier stopped firing. Press [2] then [1] to re-engage.",
      directiveMobile: "Tap 'Engagement' then 'Engage' to resume firing.",
      highlightTarget: { selector: "#command-menu" },
      condition: (state, manager) => manager.checkEngagementEngage(state) && manager.checkEnemyDied(state),
      inputGate: { allowedActions: ["SET_ENGAGEMENT"] }
    },
    {
      id: "move",
      directive: "Direct your soldier to the objective. Press [1] Orders, [1] Move To Room, select the Objective room, confirm.",
      directiveMobile: "Tap 'Orders', then 'Move To Room', select the Objective room, confirm.",
      highlightTarget: { cell: { x: 3, y: 2 } }, // Assuming the objective is here for now
      condition: (state, manager) => manager.checkReachedObjectiveRoom(state),
      message: {
        id: "objective_sighted",
        title: "Tactical Basics: Navigation",
        text: "Good. The objective terminal is in a room ahead. Use the Orders menu to direct your soldier there. The map shows room labels when you enter Move To Room.",
        portrait: "logo_gemini",
        blocking: true,
      },
      inputGate: { allowedActions: ["MOVE_TO"] }
    },
    {
      id: "pickup",
      directive: "Recover the data disk. Press [4] Pickup, select the objective.",
      directiveMobile: "Tap 'Pickup', select the objective.",
      highlightTarget: { cell: { x: 3, y: 2 } },
      condition: (state, manager) => manager.checkObjectiveCollected(state),
      inputGate: { allowedActions: ["PICKUP"] }
    },
    {
      id: "extract",
      directive: "Mission complete. Press [5] Extract, confirm.",
      directiveMobile: "Tap 'Extract', confirm.",
      highlightTarget: { cell: { x: 5, y: 1 } }, // Assuming extraction zone is here
      condition: (state) => state.status === "Won",
      message: {
        id: "objective_completed",
        title: "Tactical Basics: Extraction",
        text: "Data secured. All units must reach the extraction zone to complete the mission. The extraction point is marked on the map.",
        portrait: "logo_gemini",
        blocking: true,
      },
      inputGate: { allowedActions: ["EXTRACT"] }
    }
  ];

  constructor(
    gameClient: GameClient,
    campaignManager: CampaignManager,
    onMessage: (msg: AdvisorMessage) => void,
    _getSelectedUnitId: () => string | null,
    _uiOrchestrator?: UIOrchestrator,
    getRenderer: () => Renderer | null = () => null
  ) {
    this.gameClient = gameClient;
    this.campaignManager = campaignManager;
    this.onMessage = onMessage;
    this.getRenderer = getRenderer;
  }

  public highlightElement(selector: string) {
    this.clearHighlight();
    this.highlightedElementSelector = selector;
    
    const apply = (attempts = 0) => {
        if (this.highlightedElementSelector !== selector) return;
        const el = document.querySelector(selector) as HTMLElement;
        if (el) {
          el.classList.add("tutorial-highlight");
          this.highlightedElement = el;
          Logger.debug(`Tutorial: Highlighting element ${selector}`);
        } else if (attempts < 20) {
            // Retry if not found (e.g. during render)
            setTimeout(() => apply(attempts + 1), 100);
        }
    };
    
    apply();
  }

  public highlightCell(x: number, y: number) {
    this.clearHighlight();
    this.highlightedCell = { x, y };

    if (!this.cellHighlightEl) {
      this.cellHighlightEl = document.createElement("div");
      this.cellHighlightEl.className = "tutorial-cell-highlight";
      document.body.appendChild(this.cellHighlightEl);
    }

    this.updateCellHighlightPosition();
    Logger.debug(`Tutorial: Highlighting cell ${x},${y}`);
  }

  public clearHighlight() {
    if (this.highlightedElement) {
      this.highlightedElement.classList.remove("tutorial-highlight");
      this.highlightedElement = null;
    }
    this.highlightedElementSelector = null;
    this.highlightedCell = null;
    if (this.cellHighlightEl) {
      this.cellHighlightEl.style.display = "none";
    }
  }

  private updateCellHighlightPosition() {
    if (!this.highlightedCell || !this.cellHighlightEl) return;

    const renderer = this.getRenderer();
    if (!renderer) return;

    const pixelPos = renderer.getPixelCoordinates(this.highlightedCell.x, this.highlightedCell.y);
    const cellSize = renderer.cellSize;

    this.cellHighlightEl.style.display = "block";
    this.cellHighlightEl.style.left = `${pixelPos.x}px`;
    this.cellHighlightEl.style.top = `${pixelPos.y}px`;

    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / canvas.width;
      const scaleY = rect.height / canvas.height;
      this.cellHighlightEl.style.width = `${cellSize * scaleX}px`;
      this.cellHighlightEl.style.height = `${cellSize * scaleY}px`;
    }
  }

  public enable() {
    if (this.isActive) return;
    this.isActive = true;
    this.loadState();
    this.gameClient.addStateUpdateListener(this.onGameStateUpdate);
    Logger.info("TutorialManager enabled");
  }

  public disable() {
    if (!this.isActive) return;
    this.isActive = false;
    this.gameClient.removeStateUpdateListener(this.onGameStateUpdate);
    Logger.info("TutorialManager disabled");
  }

  public reset() {
    this.completedSteps.clear();
    this.hasMoved = false;
    this.initialPositions.clear();
    this.isPrologueActive = false;
    this.currentStepIndex = -1;
    this.uiTourStartTick = -1;
    this.clearState();
    this.clearDirective();
    this.clearHighlight();
  }

  private loadState() {
    try {
        const stored = localStorage.getItem("voidlock_tutorial_state");
        if (stored) {
            this.completedSteps = new Set(JSON.parse(stored));
        }
    } catch (e) {
        Logger.error("Failed to load tutorial state", e);
    }
  }

  private saveState() {
    try {
        localStorage.setItem("voidlock_tutorial_state", JSON.stringify(Array.from(this.completedSteps)));
    } catch (e) {
        Logger.error("Failed to save tutorial state", e);
    }
  }

  private clearState() {
      localStorage.removeItem("voidlock_tutorial_state");
  }

  public onScreenShow(id: ScreenId) {
    if (!this.isActive) return;

    if (id === "equipment" && this.isMission2Tutorial()) {
      this.triggerEvent("ready_room_intro");
    }
    if (id === "campaign" && this.isMission3Tutorial()) {
      this.triggerEvent("sector_map_intro");
    }
    if (id === "equipment" && this.isMission3Tutorial()) {
      this.triggerEvent("squad_selection_intro");
    }
  }

  private isMission2Tutorial(): boolean {
    const state = this.campaignManager.getState();
    return !!(state && state.history.length === 1);
  }

  private isMission3Tutorial(): boolean {
    const state = this.campaignManager.getState();
    return !!(state && state.history.length === 2);
  }

  private onGameStateUpdate = (state: GameState) => {
    if (!this.isActive) return;

    if (state.missionType !== MissionType.Prologue) {
        if (this.isPrologueActive) {
            this.isPrologueActive = false;
            this.clearDirective();
            this.clearHighlight();
        }
        return;
    }

    if (!this.isPrologueActive && state.status === "Playing") {
        this.isPrologueActive = true;
        this.lastRescueCount = state.stats.prologueRescues || 0;
        this.startPrologue(state);
    }

    if (!this.isPrologueActive) return;

    // Handle Scripted Rescue Message
    const currentRescues = state.stats.prologueRescues || 0;
    if (currentRescues > this.lastRescueCount) {
        this.lastRescueCount = currentRescues;
        this.onMessage({
            id: `prologue_rescue_${currentRescues}`,
            text: "Emergency medical protocol engaged. Soldier vital signs stabilized.",
            portrait: "logo_gemini",
            duration: 4000,
        });
    }

    // Update cell highlight position if map panned/zoomed
    if (this.highlightedCell) {
      this.updateCellHighlightPosition();
    }

    // Re-apply element highlight if it was lost (e.g. after re-render)
    if (this.highlightedElementSelector && !document.querySelector(".tutorial-highlight")) {
        this.highlightElement(this.highlightedElementSelector);
    }

    // Check current step completion
    const currentStep = this.prologueSteps[this.currentStepIndex];
    if (currentStep && currentStep.condition(state, this)) {
        this.advanceStep(state);
    }
  };

  private startPrologue(state: GameState) {
      this.currentStepIndex = 0;
      this.enterStep(0, state);
  }

  private advanceStep(state: GameState) {
      const currentStep = this.prologueSteps[this.currentStepIndex];
      if (currentStep && currentStep.onComplete) {
          currentStep.onComplete(this, state);
      }
      
      this.currentStepIndex++;
      if (this.currentStepIndex < this.prologueSteps.length) {
          this.enterStep(this.currentStepIndex, state);
      } else {
          this.clearDirective();
          this.clearHighlight();
      }
  }

  private enterStep(index: number, state: GameState) {
      const step = this.prologueSteps[index];
      if (!step) return;

      Logger.info(`Entering Tutorial Step: ${step.id}`);
      
      const isMobile = window.innerWidth < 768;
      const directiveText = (isMobile && step.directiveMobile) ? step.directiveMobile : step.directive;
      this.showDirective(directiveText);
      
      if (step.message) {
          this.onMessage(step.message);
          if (step.message.blocking) {
              this.gameClient.pause();
          }
      }

      if (step.highlightTarget) {
          if (step.highlightTarget.selector) {
              this.highlightElement(step.highlightTarget.selector);
          } else if (step.highlightTarget.cell) {
              this.highlightCell(step.highlightTarget.cell.x, step.highlightTarget.cell.y);
          }
      } else {
          this.clearHighlight();
      }

      if (step.onEnter) {
          step.onEnter(this, state);
      }
  }

  public captureInitialPositions(state: GameState) {
    this.initialPositions.clear();
    for (const unit of state.units) {
        this.initialPositions.set(unit.id, { x: unit.pos.x, y: unit.pos.y });
    }
    this.hasMoved = false;
  }

  public startUITourTimer(state: GameState) {
      this.uiTourStartTick = state.t;
  }

  private showDirective(text: string) {
      const el = document.getElementById("tutorial-directive");
      const textEl = document.getElementById("tutorial-directive-text");
      if (el && textEl) {
          textEl.textContent = text;
          el.classList.add("active");
      }
  }

  private clearDirective() {
      const el = document.getElementById("tutorial-directive");
      if (el) {
          el.classList.remove("active");
      }
  }

  public isActionAllowed(action: string): boolean {
    if (!this.isActive || !this.isPrologueActive) return true;
    const currentStep = this.prologueSteps[this.currentStepIndex];
    if (!currentStep || !currentStep.inputGate) return true;
    return currentStep.inputGate.allowedActions.includes(action);
  }

  // Condition Helpers

  public checkUnitMovedFromStart(state: GameState): boolean {
    if (this.hasMoved) return true;

    for (const unit of state.units) {
        if (!this.initialPositions.has(unit.id)) {
            this.initialPositions.set(unit.id, { x: unit.pos.x, y: unit.pos.y });
        }
    }

    for (const unit of state.units) {
        const startPos = this.initialPositions.get(unit.id);
        if (startPos) {
            const dist = MathUtils.getDistance(startPos, unit.pos);
            if (dist >= 2) {
                this.hasMoved = true;
                return true;
            }
        }
    }
    return false;
  }

  public checkUITourComplete(state: GameState): boolean {
      if (this.uiTourStartTick === -1) {
          this.uiTourStartTick = state.t;
      }
      return (state.t - this.uiTourStartTick) > 100; // 100 ticks = 5 seconds at 20tps
  }

  public checkDoorOpened(state: GameState): boolean {
      return (state.map.doors || []).some(d => d.state === "Open" || d.state === "Destroyed");
  }

  public checkEnemyTookDamage(state: GameState): boolean {
      return state.enemies.some(e => e.hp < e.maxHp);
  }

  public checkEngagementIgnore(state: GameState): boolean {
      return state.units.some(u => u.engagementPolicy === "IGNORE");
  }

  public checkEngagementEngage(state: GameState): boolean {
      return state.units.some(u => u.engagementPolicy === "ENGAGE");
  }

  public checkEnemyDied(state: GameState): boolean {
      return state.stats.aliensKilled > 0;
  }

  public checkReachedObjectiveRoom(state: GameState): boolean {
      const obj = state.objectives.find(o => o.id === "obj-main" || o.kind === "Recover");
      if (!obj || !obj.targetCell) return false;
      return state.units.some(u => MathUtils.getDistance(u.pos, obj.targetCell!) < 2.5);
  }

  public checkObjectiveCollected(state: GameState): boolean {
      return state.objectives.some(o => (o.id === "obj-main" || o.kind === "Recover") && o.state === "Completed");
  }

  public triggerEvent(eventId: string) {
    if (!this.isActive) return;

    if (eventId === "ready_room_intro") {
      if (this.completedSteps.has("ready_room_intro")) return;
      
      this.onMessage({
        id: "ready_room_intro",
        title: "The Ready Room",
        text: "You made it back. Welcome to the Ready Room.\n\nHere you can review your roster's status and manage their equipment. For this next mission, the Armory is locked down while diagnostics run. Your squad has been pre-filled with surviving personnel.\n\nReview your soldier's stats, then initiate the launch sequence when ready.",
        portrait: "logo_gemini",
        blocking: true,
      });

      this.completedSteps.add("ready_room_intro");
      this.saveState();
    }

    if (eventId === "sector_map_intro") {
      if (this.completedSteps.has("sector_map_intro")) return;
      
      this.onMessage({
        id: "sector_map_intro",
        title: "Strategic Overview: Sector Map",
        text: "The station is divided into sectors. You must navigate through the nodes to reach the core. \n\nCombat nodes [Crossed Swords] contain swarms and resources. Supply Depots [Shop] allow you to restock and recruit. Event nodes [?] present unique opportunities or risks. \n\nWhite lines indicate confirmed paths. Select an accessible node to plan your next move.",
        portrait: "logo_gemini",
        blocking: true,
      });

      this.completedSteps.add("sector_map_intro");
      this.saveState();
    }

    if (eventId === "squad_selection_intro") {
      if (this.completedSteps.has("squad_selection_intro")) return;
      
      this.onMessage({
        id: "squad_selection_intro",
        title: "Squad Management",
        text: "Basic Squad Selection is now online. You can now customize your squad by adding or removing members from the roster. \n\nClick an empty slot to see available personnel, or use the 'X' on a soldier's card to return them to the roster. Choose your team wisely based on the upcoming mission's requirements.",
        portrait: "logo_gemini",
        blocking: true,
      });

      this.completedSteps.add("squad_selection_intro");
      this.saveState();
    }
  }
}
