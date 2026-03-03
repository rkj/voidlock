import { GameClient } from "@src/engine/GameClient";
import { GameState, MissionType } from "@src/shared/types";
import { Logger } from "@src/shared/Logger";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { Vector2 } from "@src/shared/types/geometry";
import { UIOrchestrator } from "../app/UIOrchestrator";

export interface AdvisorMessage {
  id: string;
  text: string;
  title?: string;
  illustration?: string;
  portrait?: string; // default 'mother'
  duration?: number; // ms, if 0 or undefined, requires dismissal
  blocking?: boolean; // pauses game
}

type TutorialCondition = (state: GameState, manager: TutorialManager) => boolean;

interface TutorialStep {
  id: string;
  condition: TutorialCondition;
  message: AdvisorMessage;
  triggerOnce: boolean;
  onTrigger?: (manager: TutorialManager) => void;
}

export class TutorialManager {
  private gameClient: GameClient;
  private onMessage: (msg: AdvisorMessage) => void;
  private uiOrchestrator?: UIOrchestrator;
  private isActive: boolean = false;
  private completedSteps: Set<string> = new Set();
  private isPrologueActive: boolean = false;

  private initialPositions: Map<string, Vector2> = new Map();

  // State tracking
  private hasMoved: boolean = false;
  
  private steps: TutorialStep[] = [
    {
      id: "start",
      condition: (state) => state.t > 100,
      message: {
        id: "start",
        title: "Project Voidlock: Operation First Light",
        text: "Commander, wake up. The Voidlock is failing. The station's core is unstable, and the swarms are breaching the lower decks. \n\nTo move your squad, select a unit with [1-4] or by clicking them, then click a destination on the map. \n\nYour first objective is to locate the secure terminal in the maintenance room ahead.",
        illustration: "bg_station",
        portrait: "logo_gemini",
        blocking: true,
      },
      triggerOnce: true,
    },
    {
      id: "first_move",
      condition: (state) => this.checkAnyUnitMoved(state),
      message: {
        id: "first_move",
        text: "Good. Movement systems nominal. Continue to the objective.",
        duration: 3000,
      },
      triggerOnce: true,
    },
    {
      id: "objective_sighted",
      condition: (state) => this.checkObjectiveVisible(state),
      message: {
        id: "objective_sighted",
        title: "Tactical Basics: Objectives",
        text: "The secure terminal is within sight. Move to the terminal to recover the data disk. \n\nObjectives and mission status are tracked in the right panel.",
        portrait: "logo_gemini",
        blocking: true,
      },
      triggerOnce: true,
      onTrigger: (manager) => {
        manager.uiOrchestrator?.setMissionHUDVisible(true);
      }
    },
    {
      id: "enemy_sighted",
      condition: (state) => this.checkEnemyVisible(state),
      message: {
        id: "enemy_sighted",
        title: "Tactical Basics: Combat",
        text: "Hostile contact! Your units will automatically engage enemies within their line of sight and weapon range. \n\nThe threat meter at the top indicates the current swarm activity level. Stay alert.",
        portrait: "logo_gemini",
        blocking: true,
      },
      triggerOnce: true,
    },
    {
      id: "objective_completed",
      condition: (state) => state.objectives.some(o => o.id === "obj-main" && o.state === "Completed"),
      message: {
        id: "objective_completed",
        title: "Tactical Basics: Extraction",
        text: "Data recovered. The swarm is closing in. Get your squad to the extraction point immediately! \n\nAll units must reach the extraction zone to complete the mission.",
        portrait: "logo_gemini",
        blocking: true,
      },
      triggerOnce: true,
    }
  ];

  constructor(
    gameClient: GameClient,
    onMessage: (msg: AdvisorMessage) => void,
    uiOrchestrator?: UIOrchestrator
  ) {
    this.gameClient = gameClient;
    this.onMessage = onMessage;
    this.uiOrchestrator = uiOrchestrator;
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
    this.clearState();
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

  private onGameStateUpdate = (state: GameState) => {
    if (!this.isActive) return;
    if (state.missionType !== MissionType.Prologue) {
        this.isPrologueActive = false;
        return;
    }

    if (!this.isPrologueActive && state.status === "Playing") {
        this.isPrologueActive = true;
        // Start of prologue: hide UI
        this.uiOrchestrator?.setMissionHUDVisible(false);
    }

    // Check steps
    for (const step of this.steps) {
      if (this.completedSteps.has(step.id) && step.triggerOnce) continue;

      if (step.condition(state, this)) {
        Logger.info(`Tutorial Step Triggered: ${step.id}`);
        
        if (step.onTrigger) {
            step.onTrigger(this);
        }

        this.onMessage(step.message);
        if (step.triggerOnce) {
            this.completedSteps.add(step.id);
            this.saveState();
        }
        
        if (step.message.blocking) {
            this.gameClient.pause();
        }
      }
    }
  };

  // Condition Helpers

  private checkAnyUnitMoved(state: GameState): boolean {
    if (this.hasMoved) return true;

    // Initialize initial positions if needed (on first update or if units added)
    for (const unit of state.units) {
        if (!this.initialPositions.has(unit.id)) {
            this.initialPositions.set(unit.id, { x: unit.pos.x, y: unit.pos.y });
        }
    }

    // Check if any unit moved significantly
    for (const unit of state.units) {
        const startPos = this.initialPositions.get(unit.id);
        if (startPos) {
            const dist = MathUtils.getDistance(startPos, unit.pos);
            if (dist > 0.5) { // Assuming 0.5 tile tolerance
                this.hasMoved = true;
                return true;
            }
        }
    }
    return false;
  }

  private checkEnemyVisible(state: GameState): boolean {
    // Check if any enemy is in a visible cell
    if (!state.enemies || state.enemies.length === 0) return false;
    
    // If debug overlay is enabled, all enemies might be sent. We check visibleCells.
    // If debug is disabled, only visible enemies are sent.
    // But to be safe, we check visibleCells.
    if (!state.visibleCells) return false;
    
    return state.enemies.some(e => {
        const key = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
        return state.visibleCells.includes(key);
    });
  }

  private checkObjectiveVisible(state: GameState): boolean {
    if (!state.objectives) return false;
    return state.objectives.some(o => !!o.visible);
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
