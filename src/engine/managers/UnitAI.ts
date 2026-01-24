import { GameState, Unit, UnitState, Door, Command } from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { LineOfSight } from "../LineOfSight";
import { VipAI } from "../ai/VipAI";
import { PRNG } from "../../shared/PRNG";
import { Behavior } from "../ai/behaviors/Behavior";
import { VipBehavior } from "../ai/behaviors/VipBehavior";
import { SafetyBehavior } from "../ai/behaviors/SafetyBehavior";
import { InteractionBehavior } from "../ai/behaviors/InteractionBehavior";
import { CombatBehavior } from "../ai/behaviors/CombatBehavior";
import { ObjectiveBehavior } from "../ai/behaviors/ObjectiveBehavior";
import { ExplorationBehavior } from "../ai/behaviors/ExplorationBehavior";
import { isCellDiscovered } from "../../shared/VisibilityUtils";
import { IDirector } from "../interfaces/IDirector";

export interface AIContext {
  agentControlEnabled: boolean;
  totalFloorCells: number;
  gridState?: Uint8Array;
  claimedObjectives: Set<string>;
  itemAssignments: Map<string, string>;
  executeCommand: (
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean,
    director?: IDirector,
  ) => void;
}

export class UnitAI {
  private behaviors: Behavior[] = [];
  private vipBehavior: VipBehavior;

  constructor(
    gameGrid: GameGrid,
    los: LineOfSight,
  ) {
    const vipAi = new VipAI(gameGrid);
    this.vipBehavior = new VipBehavior(vipAi, los);

    // Ordered by priority
    this.behaviors = [
      new SafetyBehavior(),
      new InteractionBehavior(),
      new CombatBehavior(gameGrid),
      new ObjectiveBehavior(),
      new ExplorationBehavior(gameGrid),
    ];
  }

  public process(
    unit: Unit,
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    prng: PRNG,
    context: AIContext,
    director?: IDirector,
  ) {
    if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead)
      return;

    // 1. VIP Specific AI
    const vipHandled = this.vipBehavior.evaluate(
      unit,
      state,
      dt,
      doors,
      prng,
      context,
      director,
    );
    if (vipHandled && !unit.aiEnabled) return;

    if (unit.state === UnitState.Channeling) return;

    // 2. Exploration target cleanup (Pre-processing)
    if (unit.explorationTarget) {
      if (
        isCellDiscovered(
          state,
          Math.floor(unit.explorationTarget.x),
          Math.floor(unit.explorationTarget.y),
        )
      ) {
        unit.explorationTarget = undefined;
        if (unit.state === UnitState.Moving) {
          unit.path = undefined;
          unit.targetPos = undefined;
          unit.state = UnitState.Idle;
          unit.activeCommand = undefined;
        }
      }
    }

    // 3. Sequential behavior evaluation
    for (const behavior of this.behaviors) {
      const handled = behavior.evaluate(
        unit,
        state,
        dt,
        doors,
        prng,
        context,
        director,
      );
      if (handled) break;
    }
  }
}
