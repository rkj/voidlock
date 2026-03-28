import type {
  GameState,
  Unit,
  Door} from "../../shared/types";
import {
  UnitState
} from "../../shared/types";
import type { GameGrid } from "../GameGrid";
import type { LineOfSight } from "../LineOfSight";
import { VipAI } from "../ai/VipAI";
import type { PRNG } from "../../shared/PRNG";
import type { Behavior } from "../ai/behaviors/Behavior";
import { VipBehavior } from "../ai/behaviors/VipBehavior";
import { SafetyBehavior } from "../ai/behaviors/SafetyBehavior";
import { InteractionBehavior } from "../ai/behaviors/InteractionBehavior";
import { CombatBehavior } from "../ai/behaviors/CombatBehavior";
import { ObjectiveBehavior } from "../ai/behaviors/ObjectiveBehavior";
import { ExplorationBehavior } from "../ai/behaviors/ExplorationBehavior";
import { isCellDiscovered } from "../../shared/VisibilityUtils";
import type { IDirector } from "../interfaces/IDirector";
import type { AIContext } from "../interfaces/AIContext";
import { Logger } from "../../shared/Logger";

export interface UnitAIProcessParams {
  unit: Unit;
  state: GameState;
  dt: number;
  doors: Map<string, Door>;
  prng: PRNG;
  context: AIContext;
  director?: IDirector;
}

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

  public process(params: UnitAIProcessParams): Unit {
    const { unit, state, dt, doors, prng, context, director } = params;

    if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead)
      return unit;

    let currentUnit = { ...unit };

    // 1. VIP Specific AI
    const vipResult = this.vipBehavior.evaluate({
      unit: currentUnit,
      state,
      dt,
      doors,
      prng,
      context,
      director,
    });
    currentUnit = vipResult.unit;
    if (vipResult.handled && !currentUnit.aiEnabled) return currentUnit;

    if (currentUnit.state === UnitState.Channeling) return currentUnit;

    // 2. Exploration target cleanup (Pre-processing)
    currentUnit = this.cleanupExplorationTarget(currentUnit, state);

    // 3. Sequential behavior evaluation
    for (let i = 0; i < this.behaviors.length; i++) {
      const behavior = this.behaviors[i];
      const behaviorName = (behavior as unknown as { constructor: { name: string } }).constructor.name;
      const priority = i; // Priorities are 0 to 4 based on index

      // Plan Commitment Guard (ADR 0056)
      if (
        currentUnit.activePlan &&
        state.t < currentUnit.activePlan.committedUntil &&
        priority >= currentUnit.activePlan.priority
      ) {
        continue;
      }

      const result = behavior.evaluate({
        unit: currentUnit,
        state,
        dt,
        doors,
        prng,
        context,
        director,
      });
      if (result.handled) {
        Logger.debug(
          `UnitAI: unit ${currentUnit.id} handled by ${behaviorName}`,
        );
      }
      currentUnit = result.unit;
      if (result.handled) break;
    }

    return currentUnit;
  }

  private cleanupExplorationTarget(unit: Unit, state: GameState): Unit {
    if (!unit.explorationTarget) return unit;

    if (
      !isCellDiscovered(
        state,
        Math.floor(unit.explorationTarget.x),
        Math.floor(unit.explorationTarget.y),
      )
    ) {
      return unit;
    }

    let updated = { ...unit, explorationTarget: undefined };
    if (updated.state === UnitState.Moving || updated.state === UnitState.WaitingForDoor) {
      updated = {
        ...updated,
        path: undefined,
        targetPos: undefined,
        state: UnitState.Idle,
        activeCommand: undefined,
      };
    }
    return updated;
  }
}
