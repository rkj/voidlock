import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Door,
} from "../../../shared/types";
import { BehaviorContext, ExplorationContext } from "../../interfaces/AIContext";
import { PRNG } from "../../../shared/PRNG";
import { Behavior, BehaviorResult } from "./Behavior";
import {
  isMapFullyDiscovered,
  findClosestUndiscoveredCell,
} from "./BehaviorUtils";
import { GameGrid } from "../../GameGrid";
import { isCellDiscovered } from "../../../shared/VisibilityUtils";
import { ItemEffectHandler } from "../../interfaces/IDirector";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { Logger } from "../../../shared/Logger";

export class ExplorationBehavior implements Behavior<BehaviorContext & ExplorationContext> {
  constructor(private gameGrid: GameGrid) {}

  public evaluate(
    unit: Unit,
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    _prng: PRNG,
    context: BehaviorContext & ExplorationContext,
    director?: ItemEffectHandler,
  ): BehaviorResult {
    let currentUnit = { ...unit };
    if (currentUnit.state !== UnitState.Idle && !currentUnit.explorationTarget)
      return { unit: currentUnit, handled: false };
    if (currentUnit.commandQueue.length > 0)
      return { unit: currentUnit, handled: false };
    if (!context.agentControlEnabled || currentUnit.aiEnabled === false)
      return { unit: currentUnit, handled: false };

    if (!isMapFullyDiscovered(state, context.totalFloorCells, this.gameGrid)) {
      let shouldReevaluate = !currentUnit.explorationTarget;

      if (currentUnit.explorationTarget) {
        if (
          isCellDiscovered(
            state,
            Math.floor(currentUnit.explorationTarget.x),
            Math.floor(currentUnit.explorationTarget.y),
          )
        ) {
          Logger.debug(
            `ExplorationBehavior: target ${currentUnit.explorationTarget.x},${currentUnit.explorationTarget.y} discovered, clearing`,
          );
          currentUnit = { ...currentUnit, explorationTarget: undefined };
          shouldReevaluate = true;
        } else {
          const checkInterval = 1000;
          const lastCheck = Math.floor((state.t - dt) / checkInterval);
          const currentCheck = Math.floor(state.t / checkInterval);
          if (
            currentCheck > lastCheck ||
            currentUnit.state === UnitState.Idle
          ) {
            Logger.debug(
              `ExplorationBehavior: reevaluating target due to timer or idle (state=${currentUnit.state})`,
            );
            shouldReevaluate = true;
          }
        }
      }

      if (shouldReevaluate) {
        const targetCell = findClosestUndiscoveredCell(
          currentUnit,
          state,
          context.gridState,
          doors,
          this.gameGrid,
          context.explorationClaims,
        );
        if (targetCell) {
          Logger.debug(
            `ExplorationBehavior: found new target ${targetCell.x},${targetCell.y}`,
          );
          const newTarget = { x: targetCell.x, y: targetCell.y };
          const isDifferent =
            !currentUnit.explorationTarget ||
            currentUnit.explorationTarget.x !== newTarget.x ||
            currentUnit.explorationTarget.y !== newTarget.y;

          if (isDifferent) {
            let switchTarget = !currentUnit.explorationTarget;
            if (currentUnit.explorationTarget) {
              const oldDist = MathUtils.getDistance(currentUnit.pos, {
                x: currentUnit.explorationTarget.x + 0.5,
                y: currentUnit.explorationTarget.y + 0.5,
              });
              const newDist = MathUtils.getDistance(currentUnit.pos, {
                x: newTarget.x + 0.5,
                y: newTarget.y + 0.5,
              });
              if (newDist < oldDist * 0.7) {
                switchTarget = true;
              }
            }

            if (switchTarget) {
              Logger.debug(
                `ExplorationBehavior: switching target to ${newTarget.x},${newTarget.y}`,
              );
              currentUnit = { ...currentUnit, explorationTarget: newTarget };
              context.explorationClaims.set(currentUnit.id, newTarget);
              currentUnit = context.executeCommand(
                currentUnit,
                {
                  type: CommandType.MOVE_TO,
                  unitIds: [currentUnit.id],
                  target: targetCell,
                  label: "Exploring",
                },
                state,
                false,
                director,
              );
              return { unit: currentUnit, handled: true };
            }
          } else if (currentUnit.state === UnitState.Idle) {
            Logger.debug(
              `ExplorationBehavior: same target ${newTarget.x},${newTarget.y} but unit is idle, re-executing move`,
            );
            context.explorationClaims.set(
              currentUnit.id,
              currentUnit.explorationTarget!,
            );
            currentUnit = context.executeCommand(
              currentUnit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [currentUnit.id],
                target: currentUnit.explorationTarget!,
                label: "Exploring",
              },
              state,
              false,
              director,
            );
            return { unit: currentUnit, handled: true };
          }
        } else {
          Logger.debug("ExplorationBehavior: no target found");
        }
      }
    }

    return { unit: currentUnit, handled: false };
  }
}
