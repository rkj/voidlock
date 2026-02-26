import { GameClient } from "@src/engine/GameClient";
import { GameState, MissionType } from "@src/shared/types";
import { Logger } from "@src/shared/Logger";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { Vector2 } from "@src/shared/types/geometry";

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
}

export class TutorialManager {
  private gameClient: GameClient;
  private onMessage: (msg: AdvisorMessage) => void;
  private isActive: boolean = false;
  private completedSteps: Set<string> = new Set();

  private initialPositions: Map<string, Vector2> = new Map();

  // State tracking
  private hasMoved: boolean = false;
  // Actually, for "First Move", we need to know if they *just* moved.
  // But purely state-based: "If any unit is not at spawn" -> "Moved".
  
  // We can track "initial positions" or just check AP usage?
  // AP resets every turn, so checking AP < MaxAP means they did something *this turn*.
  
  private steps: TutorialStep[] = [
    {
      id: "start",
      condition: () => true, // Immediate
      message: {
        id: "start",
        text: "Commander, squad is online. Proceed to the airlock.",
        blocking: true,
      },
      triggerOnce: true,
    },
    {
      id: "first_move",
      condition: (state) => this.checkAnyUnitMoved(state),
      message: {
        id: "first_move",
        text: "Good. Movement systems nominal.",
        duration: 3000,
      },
      triggerOnce: true,
    },
    {
      id: "enemy_sighted",
      condition: (state) => this.checkEnemyVisible(state),
      message: {
        id: "enemy_sighted",
        text: "Hostile detected! Weapons free. Maintain effective range.",
        blocking: true, // Pause to let player read
      },
      triggerOnce: true,
    },
    {
      id: "taking_damage",
      condition: (state) => this.checkUnitDamaged(state),
      message: {
        id: "taking_damage",
        text: "Unit taking fire! Use a Medkit from Global Supplies.",
        blocking: false,
      },
      triggerOnce: true,
    },
    {
      id: "objective_sighted",
      condition: (state) => this.checkObjectiveVisible(state),
      message: {
        id: "objective_sighted",
        text: "Target located. Secure the package.",
        blocking: false,
      },
      triggerOnce: true,
    }
  ];

  constructor(gameClient: GameClient, onMessage: (msg: AdvisorMessage) => void) {
    this.gameClient = gameClient;
    this.onMessage = onMessage;
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
    if (state.missionType !== MissionType.Prologue) return;

    // Check steps
    for (const step of this.steps) {
      if (this.completedSteps.has(step.id) && step.triggerOnce) continue;

      if (step.condition(state, this)) {
        Logger.info(`Tutorial Step Triggered: ${step.id}`);
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

  private checkUnitDamaged(state: GameState): boolean {
    return state.units.some(u => u.hp < u.maxHp);
  }

  private checkObjectiveVisible(state: GameState): boolean {
    if (!state.objectives) return false;
    return state.objectives.some(o => !!o.visible);
  }
}
