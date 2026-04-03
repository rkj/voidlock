import type { GameClient } from "@src/engine/GameClient";
import type { GameState} from "@src/shared/types";
import { MissionType } from "@src/shared/types";
import { t } from "../i18n";
import { I18nKeys } from "../i18n/keys";
import type { ScreenId } from "@src/renderer/ScreenManager";
import { Logger } from "@src/shared/Logger";
import { MathUtils } from "@src/shared/utils/MathUtils";
import type { Vector2 } from "@src/shared/types/geometry";
import type { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import type { Renderer } from "../Renderer";

interface TutorialMenuController {
  menuState: string;
  pendingAction: unknown;
  pendingItemId: unknown;
  pendingTargetId: unknown;
  pendingMode: unknown;
}

export interface AdvisorMessage {
  id: string;
  text: string;
  title?: string;
  illustration?: string;
  portrait?: string;
  duration?: number;
  blocking?: boolean;
}

export interface TutorialStep {
  id: string;
  directive: string;
  directiveMobile?: string;
  highlightTarget?: { selector?: string; cell?: { x: number; y: number } };
  dynamicHighlight?: (state: GameState, menuState: string, selection: any) => { selector?: string; cell?: { x: number; y: number } } | null;
  condition: (state: GameState, manager: TutorialManager) => boolean;
  message?: AdvisorMessage;
  onEnter?: (manager: TutorialManager, state: GameState) => void;
  onComplete?: (manager: TutorialManager, state: GameState) => void;
  inputGate?: {
    allowedActions: string[];
  };
}

export interface TutorialManagerConfig {
  gameClient: GameClient;
  campaignManager: CampaignManager;
  menuController: TutorialMenuController;
  onMessage: (msg: AdvisorMessage, onDismiss?: () => void) => void;
  getRenderer: () => Renderer | null;
}

export class TutorialManager {
  private gameClient: GameClient;
  private campaignManager: CampaignManager;
  private menuController: TutorialMenuController;
  private onMessage: (msg: AdvisorMessage, onDismiss?: () => void) => void;
  private getRenderer: () => Renderer | null;

  private isActive: boolean = false;
  private isPrologueActive: boolean = false;
  private currentStepIndex: number = -1;
  private completedSteps: Set<string> = new Set();
  private isBlockingMessageActive: boolean = false;

  private highlightedElementSelector: string | null = null;
  private highlightedElement: HTMLElement | null = null;
  private highlightedCell: { x: number; y: number } | null = null;
  private cellHighlightEl: HTMLElement | null = null;

  private initialPositions: Map<string, Vector2> = new Map();
  private hasMoved: boolean = false;
  private lastRescueCount: number = 0;
  private uiTourStartTick: number = -1;
  private lastMenuState: string | null = null;
  private lastSelectionHash: string | null = null;

  
  private get prologueSteps(): TutorialStep[] {
    return [
      {
        id: "observe",
        directive: t(I18nKeys.tutorial.prologue.step_observe_directive),
        highlightTarget: { selector: ".soldier-card" },
        condition: (state, manager) => manager.checkUnitMovedFromStart(state),
        message: {
          id: "start",
          title: t(I18nKeys.tutorial.prologue.step_observe_title),
          text: t(I18nKeys.tutorial.prologue.step_observe_text),
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
        directive: t(I18nKeys.tutorial.prologue.step_ui_tour_directive),
        directiveMobile: t(I18nKeys.tutorial.prologue.step_ui_tour_directive_mobile),
        condition: (state, manager) => manager.checkUITourComplete(state),
        onEnter: (manager, state) => {
            manager.startUITourTimer(state);
        },
        inputGate: { allowedActions: [] }
      },
      {
        id: "pause",
        directive: t(I18nKeys.tutorial.prologue.step_pause_directive),
        directiveMobile: t(I18nKeys.tutorial.prologue.step_pause_directive_mobile),
        condition: (state, manager) => manager.checkPauseToggled(state),
        inputGate: { allowedActions: ["TOGGLE_PAUSE"] }
      },
      {
        id: "doors",
        directive: t(I18nKeys.tutorial.prologue.step_doors_directive),
        condition: (state, manager) => manager.checkDoorOpened(state),
        inputGate: { allowedActions: [] }
      },
      {
        id: "combat",
        directive: t(I18nKeys.tutorial.prologue.step_combat_directive),
        condition: (state, manager) => manager.checkEnemyTookDamage(state),
        message: {
          id: "enemy_sighted",
          title: t(I18nKeys.tutorial.prologue.step_combat_title),
          text: t(I18nKeys.tutorial.prologue.step_combat_text),
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
        directive: t(I18nKeys.tutorial.prologue.step_engagement_ignore_directive),
        directiveMobile: t(I18nKeys.tutorial.prologue.step_engagement_ignore_directive_mobile),
        highlightTarget: { selector: "#command-menu" },
        condition: (state, manager) => manager.checkEngagementIgnore(state),
        message: {
          id: "first_command",
          title: t(I18nKeys.tutorial.prologue.step_engagement_ignore_title),
          text: t(I18nKeys.tutorial.prologue.step_engagement_ignore_text),
          portrait: "logo_gemini",
          blocking: true,
        },
        inputGate: { allowedActions: ["SET_ENGAGEMENT", "SELECT_UNIT"] }
      },
      {
        id: "engagement_engage",
        directive: t(I18nKeys.tutorial.prologue.step_engagement_engage_directive),
        directiveMobile: t(I18nKeys.tutorial.prologue.step_engagement_engage_directive_mobile),
        highlightTarget: { selector: "#command-menu" },
        condition: (state, manager) => manager.checkEngagementEngage(state) && manager.checkEnemyDied(state),
        inputGate: { allowedActions: ["SET_ENGAGEMENT", "SELECT_UNIT"] }
      },
      {
        id: "move",
        directive: t(I18nKeys.tutorial.prologue.step_move_directive),
        directiveMobile: t(I18nKeys.tutorial.prologue.step_move_directive_mobile),
        condition: (state, manager) => manager.checkReachedObjectiveRoom(state),
        message: {
          id: "objective_sighted",
          title: t(I18nKeys.tutorial.prologue.step_move_title),
          text: t(I18nKeys.tutorial.prologue.step_move_text),
          portrait: "logo_gemini",
          blocking: true,
        },
        dynamicHighlight: (_state, menuState, selection) => {
            if (menuState === "ACTION_SELECT") return { selector: ".command-item[data-index='1']" };
            if (menuState === "ORDERS_SELECT") return { selector: ".command-item[data-index='1']" };
            if (menuState === "TARGET_SELECT") {
                // Highlight the objective room (the cell coordinate from the spec)
                return { cell: { x: 3, y: 2 } };
            }
            if (menuState === "UNIT_SELECT" && selection.pendingAction === "MOVE_TO") {
                return { selector: ".soldier-card" };
            }
            return null;
        },
        inputGate: { allowedActions: ["MOVE_TO", "SELECT_UNIT"] }
      },
      {
        id: "pickup",
        directive: t(I18nKeys.tutorial.prologue.step_pickup_directive),
        directiveMobile: t(I18nKeys.tutorial.prologue.step_pickup_directive_mobile),
        highlightTarget: { cell: { x: 3, y: 2 } },
        condition: (state, manager) => manager.checkObjectiveCollected(state),
        dynamicHighlight: (state, menuState) => {
            if (menuState === "ACTION_SELECT") return { selector: ".command-item[data-index='4']" };
            if (menuState === "TARGET_SELECT") {
                const disk = state.objectives.find(o => o.id === "prologue-disk" || o.kind === "Recover");
                if (disk) return { cell: { x: 3, y: 2 } };
            }
            if (menuState === "UNIT_SELECT") return { selector: ".soldier-card" };
            return null;
        },
        inputGate: { allowedActions: ["PICKUP", "SELECT_UNIT"] }
      },
      {
        id: "extract",
        directive: t(I18nKeys.tutorial.prologue.step_extract_directive),
        directiveMobile: t(I18nKeys.tutorial.prologue.step_extract_directive_mobile),
        highlightTarget: { cell: { x: 5, y: 1 } },
        condition: (state) => state.status === "Won",
        message: {
          id: "objective_completed",
          title: t(I18nKeys.tutorial.prologue.step_extract_title),
          text: t(I18nKeys.tutorial.prologue.step_extract_text),
          portrait: "logo_gemini",
          blocking: true,
        },
        inputGate: { allowedActions: ["EXTRACT", "SELECT_UNIT"] }
      }
    ];
  }

  constructor(config: TutorialManagerConfig) {
    this.gameClient = config.gameClient;
    this.campaignManager = config.campaignManager;
    this.menuController = config.menuController;
    this.onMessage = config.onMessage;
    this.getRenderer = config.getRenderer;
  }
  public highlightElement(selector: string) {
    if (this.highlightedElementSelector === selector && (this.highlightedElement || document.querySelector(".tutorial-highlight"))) {
        return;
    }

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

  public getCurrentStepId(): string | null {
    if (!this.isActive || this.currentStepIndex < 0 || this.currentStepIndex >= this.prologueSteps.length) {
        return null;
    }
    return this.prologueSteps[this.currentStepIndex].id;
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
            const data = JSON.parse(stored);
            if (Array.isArray(data)) {
                // Migration for old format
                this.completedSteps = new Set(data);
            } else {
                this.completedSteps = new Set(data.completedSteps || []);
                this.currentStepIndex = typeof data.currentStepIndex === "number" ? data.currentStepIndex : -1;
            }
        }
    } catch (e) {
        Logger.error("Failed to load tutorial state", e);
    }
  }

  private saveState() {
    try {
        localStorage.setItem("voidlock_tutorial_state", JSON.stringify({
            completedSteps: Array.from(this.completedSteps),
            currentStepIndex: this.currentStepIndex
        }));
    } catch (e) {
        Logger.error("Failed to save tutorial state", e);
    }
  }

  private clearState() {
      localStorage.removeItem("voidlock_tutorial_state");
  }

  public onScreenShow(id: ScreenId) {
    try {
        if (!this.isActive) return;
        Logger.info(`Tutorial: onScreenShow(${id}), isMission2=${this.isMission2Tutorial()}, isMission3=${this.isMission3Tutorial()}`);

        if (id === "equipment" && this.isMission2Tutorial()) {
          this.triggerEvent("ready_room_intro");
        }
        if (id === "campaign" && this.isMission3Tutorial()) {
          this.triggerEvent("sector_map_intro");
        }
        if (id === "equipment" && this.isMission3Tutorial()) {
          this.triggerEvent("squad_selection_intro");
        }
    } catch (e) {
        Logger.error(`Tutorial: Error in onScreenShow(${id})`, e);
    }
  }

  private isMission2Tutorial(): boolean {
    try {
        const state = this.campaignManager.getState();
        const isM2 = state?.history?.length === 1 && !state?.rules?.skipPrologue;
        return !!isM2;
    } catch (_e) {
        return false;
    }
  }

  private isMission3Tutorial(): boolean {
    try {
        const state = this.campaignManager.getState();
        return !!(state && state.history?.length === 2);
    } catch (_e) {
        return false;
    }
  }

  private onGameStateUpdate = (state: GameState) => {
    try {
        if (!this.isActive || this.isBlockingMessageActive) return;

        if (state.t % 160 === 0) {
            Logger.info(`Tutorial: onGameStateUpdate tick=${state.t}, step=${this.currentStepIndex}, active=${this.isActive}, blocking=${this.isBlockingMessageActive}`);
        }

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
            
            // Resume if we have a valid index, otherwise start at 0
            if (this.currentStepIndex < 0) {
                this.startPrologue(state);
            } else {
                this.enterStep(this.currentStepIndex, state);
            }
        }

        if (!this.isPrologueActive) return;

        // Handle Scripted Rescue Message
        const currentRescues = state.stats.prologueRescues || 0;
        if (currentRescues > this.lastRescueCount) {
            this.lastRescueCount = currentRescues;
            this.onMessage({
                id: `prologue_rescue_${currentRescues}`,
                text: t(I18nKeys.tutorial.prologue.rescue_text),
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
        if (currentStep) {
            this.updateDynamicHighlight(state, currentStep);
            if (currentStep.condition(state, this)) {
                this.advanceStep(state);
            }
        }
    } catch (e) {
        Logger.error("Tutorial: Error in onGameStateUpdate", e);
    }
  };

  private updateDynamicHighlight(state: GameState, step: TutorialStep) {
      if (!step.dynamicHighlight) return;

      const menuState = this.menuController.menuState;
      const selection = {
          pendingAction: this.menuController.pendingAction,
          pendingItemId: this.menuController.pendingItemId,
          pendingTargetId: this.menuController.pendingTargetId,
          pendingMode: this.menuController.pendingMode,
      };

      const selectionHash = JSON.stringify(selection);

      if (menuState === this.lastMenuState && selectionHash === this.lastSelectionHash) {
          return;
      }

      this.lastMenuState = menuState;
      this.lastSelectionHash = selectionHash;

      const target = step.dynamicHighlight(state, menuState, selection);
      if (target) {
          if (target.selector) {
              this.highlightElement(target.selector);
          } else if (target.cell) {
              this.highlightCell(target.cell.x, target.cell.y);
          }
      } else if (step.highlightTarget) {
          // Fallback to static highlight if dynamic returns null
          if (step.highlightTarget.selector) {
              this.highlightElement(step.highlightTarget.selector);
          } else if (step.highlightTarget.cell) {
              this.highlightCell(step.highlightTarget.cell.x, step.highlightTarget.cell.y);
          }
      }
  }

  private startPrologue(state: GameState) {
      this.currentStepIndex = 0;
      this.saveState();
      this.enterStep(0, state);
  }

  private advanceStep(state: GameState) {
      const currentStep = this.prologueSteps[this.currentStepIndex];
      if (currentStep?.onComplete) {
          currentStep.onComplete(this, state);
      }
      
      this.currentStepIndex++;
      this.saveState();
      
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
      
      const isMobile = this.isMobile();
      const directiveText = (isMobile && step.directiveMobile) ? step.directiveMobile : step.directive;
      this.showDirective(directiveText);
      
      if (step.message) {
          if (step.message.blocking) {
              this.isBlockingMessageActive = true;
          }
          this.onMessage(step.message, () => {
              this.isBlockingMessageActive = false;
          });
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

  private isMobile(): boolean {
    return !!(
      window.innerWidth < 768 ||
      document.documentElement.classList.contains("mobile-touch") ||
      window.matchMedia?.("(pointer: coarse)").matches
    );
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
    
    // Always allow basic UI interactions and time control
    if (action === "TOGGLE_PAUSE" || action === "SELECT_UNIT") return true;

    if (this.isProloguePassiveStep()) return false;
    const currentStep = this.prologueSteps[this.currentStepIndex];
    if (!currentStep?.inputGate) return true;
    return currentStep.inputGate.allowedActions.includes(action);
  }

  public isProloguePassiveStep(): boolean {
    if (!this.isActive || !this.isPrologueActive) return false;
    const currentStep = this.prologueSteps[this.currentStepIndex];
    // A step is passive if it has an empty allowedActions list
    return !!(currentStep?.inputGate?.allowedActions.length === 0);
  }

  // Condition Helpers

  public checkUnitMovedFromStart(state: GameState): boolean {
    if (this.hasMoved) return true;

    for (const unit of state.units) {
        if (!this.initialPositions.has(unit.id)) {
            this.initialPositions.set(unit.id, { x: unit.pos.x, y: unit.pos.y });
            Logger.info(`Tutorial: Captured initial position for ${unit.id}: ${unit.pos.x.toFixed(2)},${unit.pos.y.toFixed(2)}`);
        }
    }

    for (const unit of state.units) {
        const startPos = this.initialPositions.get(unit.id);
        if (startPos) {
            const dist = MathUtils.getDistance(startPos, unit.pos);
            if (state.t % 1000 === 0) {
                Logger.info(`Tutorial: Unit ${unit.id} at ${unit.pos.x.toFixed(2)},${unit.pos.y.toFixed(2)}, dist: ${dist.toFixed(2)}`);
            }
            if (dist >= 2) {
                this.hasMoved = true;
                Logger.info(`Tutorial: Unit ${unit.id} moved 2 units. Advancing.`);
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

  public checkPauseToggled(state: GameState): boolean {
      return state.settings.isPaused;
  }

  public checkDoorOpened(state: GameState): boolean {
      return (state.map.doors ?? []).some(d => d.state === "Open" || d.state === "Destroyed");
  }

  public checkEnemyTookDamage(state: GameState): boolean {
      return state.enemies.some(e => e.hp < e.maxHp || e.state === "Dead") || (state.stats.aliensKilled > 0);
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
      const obj = state.objectives.find(o => o.id === "prologue-disk" || o.kind === "Recover");
      const targetCell = obj?.targetCell;
      if (!targetCell) return false;
      return state.units.some(u => MathUtils.getDistance(u.pos, targetCell) < 1.5);
  }

  public checkObjectiveCollected(state: GameState): boolean {
      // In prologue, unit needs to be carrying the disk to advance to Step 9 (Extract)
      const obj = state.objectives.find(o => o.id === "prologue-disk" || o.kind === "Recover");
      return !!(obj && state.units.some(u => u.carriedObjectiveId === obj.id));
  }

  public triggerEvent(eventId: string) {
    if (!this.isActive) return;

    if (eventId === "ready_room_intro") {
      if (this.completedSteps.has("ready_room_intro")) return;
      
      this.onMessage({
        id: "ready_room_intro",
        title: t(I18nKeys.tutorial.events.ready_room_title),
        text: t(I18nKeys.tutorial.events.ready_room_text),
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
        title: t(I18nKeys.tutorial.events.sector_map_title),
        text: t(I18nKeys.tutorial.events.sector_map_text),
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
        title: t(I18nKeys.tutorial.events.squad_selection_title),
        text: t(I18nKeys.tutorial.events.squad_selection_text),
        portrait: "logo_gemini",
        blocking: true,
      });

      this.completedSteps.add("squad_selection_intro");
      this.saveState();
    }
  }
}
