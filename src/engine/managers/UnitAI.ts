import {
  GameState,
  Unit,
  UnitState,
  Door,
} from "../../shared/types";
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
import { ItemEffectHandler } from "../interfaces/IDirector";
import { AIContext } from "../interfaces/AIContext";
import { Logger } from "../../shared/Logger";

export class UnitAI {
  private behaviors: Behavior<AIContext>[] = [];
  private vipBehavior: VipBehavior;

  constructor(gameGrid: GameGrid, los: LineOfSight) {
    const vipAi = new VipAI(gameGrid);
    this.vipBehavior = new VipBehavior(vipAi, los);

    // Ordered by priority
    this.behaviors = [
      new SafetyBehavior(gameGrid, los),
      new InteractionBehavior(),
      new CombatBehavior(gameGrid),
      new ObjectiveBehavior(),
      new ExplorationBehavior(gameGrid),
    ] as Behavior<AIContext>[];
  }

  public process(
    unit: Unit,
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    prng: PRNG,
    context: AIContext,
    director?: ItemEffectHandler,
  ): Unit {
    if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead)
      return unit;

    let currentUnit = { ...unit };

    // 1. VIP Specific AI
    const vipResult = this.vipBehavior.evaluate(
      currentUnit,
      state,
      dt,
      doors,
      prng,
      context,
      director,
    );
    currentUnit = vipResult.unit;
    if (vipResult.handled && !currentUnit.aiEnabled) return currentUnit;

    if (currentUnit.state === UnitState.Channeling) return currentUnit;

    // 2. Exploration target cleanup (Pre-processing)
    if (currentUnit.explorationTarget) {
      if (
        isCellDiscovered(
          state,
          Math.floor(currentUnit.explorationTarget.x),
          Math.floor(currentUnit.explorationTarget.y),
        )
      ) {
        currentUnit = {
          ...currentUnit,
          explorationTarget: undefined,
        };
        if (currentUnit.state === UnitState.Moving) {
          currentUnit = {
            ...currentUnit,
            path: undefined,
            targetPos: undefined,
            state: UnitState.Idle,
            activeCommand: undefined,
          };
        }
      }
    }

    // 3. Sequential behavior evaluation
    for (const behavior of this.behaviors) {
      const behaviorName = (behavior as any).constructor.name;
      const result = behavior.evaluate(
        currentUnit,
        state,
        dt,
        doors,
        prng,
        context,
        director,
      );
      if (result.handled) {
        Logger.debug(`UnitAI: unit ${currentUnit.id} handled by ${behaviorName}`);
      }
      currentUnit = result.unit;
      if (result.handled) break;
    }

    return currentUnit;
  }
}
