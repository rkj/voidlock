import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Door,
} from "../../../shared/types";
import { AIContext } from "../../managers/UnitAI";
import { PRNG } from "../../../shared/PRNG";
import { Behavior } from "./Behavior";
import {
  getDistance,
  isMapFullyDiscovered,
  findClosestUndiscoveredCell,
} from "./BehaviorUtils";
import { GameGrid } from "../../GameGrid";

export class ExplorationBehavior implements Behavior {
  constructor(private gameGrid: GameGrid) {}

  public evaluate(
    unit: Unit,
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    _prng: PRNG,
    context: AIContext,
    director?: any,
  ): boolean {
    if (unit.state !== UnitState.Idle && !unit.explorationTarget) return false;
    if (unit.commandQueue.length > 0) return false;
    if (!context.agentControlEnabled || unit.aiEnabled === false) return false;

    if (!isMapFullyDiscovered(state, context.totalFloorCells, this.gameGrid)) {
      let shouldReevaluate = !unit.explorationTarget;

      if (unit.explorationTarget) {
        const key = `${Math.floor(unit.explorationTarget.x)},${Math.floor(unit.explorationTarget.y)}`;
        if (context.discoveredCellsSet.has(key)) {
          unit.explorationTarget = undefined;
          shouldReevaluate = true;
        } else {
          const checkInterval = 1000;
          const lastCheck = Math.floor((state.t - dt) / checkInterval);
          const currentCheck = Math.floor(state.t / checkInterval);
          if (currentCheck > lastCheck || unit.state === UnitState.Idle) {
            shouldReevaluate = true;
          }
        }
      }

      if (shouldReevaluate) {
        const targetCell = findClosestUndiscoveredCell(
          unit,
          state,
          context.discoveredCellsSet,
          doors,
          this.gameGrid,
        );
        if (targetCell) {
          const newTarget = { x: targetCell.x, y: targetCell.y };
          const isDifferent =
            !unit.explorationTarget ||
            unit.explorationTarget.x !== newTarget.x ||
            unit.explorationTarget.y !== newTarget.y;

          if (isDifferent) {
            let switchTarget = !unit.explorationTarget;
            if (unit.explorationTarget) {
              const oldDist = getDistance(unit.pos, {
                x: unit.explorationTarget.x + 0.5,
                y: unit.explorationTarget.y + 0.5,
              });
              const newDist = getDistance(unit.pos, {
                x: newTarget.x + 0.5,
                y: newTarget.y + 0.5,
              });
              if (newDist < oldDist * 0.7) {
                switchTarget = true;
              }
            }

            if (switchTarget) {
              unit.explorationTarget = newTarget;
              context.executeCommand(
                unit,
                {
                  type: CommandType.MOVE_TO,
                  unitIds: [unit.id],
                  target: targetCell,
                  label: "Exploring",
                },
                state,
                false,
                director,
              );
              return true;
            }
          } else if (unit.state === UnitState.Idle) {
            context.executeCommand(
              unit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [unit.id],
                target: unit.explorationTarget!,
                label: "Exploring",
              },
              state,
              false,
              director,
            );
            return true;
          }
        }
      }
    }

    return false;
  }
}
