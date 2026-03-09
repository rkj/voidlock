import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Door,
} from "../../../shared/types";
import { BehaviorContext } from "../../interfaces/AIContext";
import { PRNG } from "../../../shared/PRNG";
import { Behavior, BehaviorResult } from "./Behavior";
import { GameGrid } from "../../GameGrid";
import { isCellVisible } from "../../../shared/VisibilityUtils";
import { ItemEffectHandler } from "../../interfaces/IDirector";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { calculateTravelTimeMs } from "./BehaviorUtils";

export class CombatBehavior implements Behavior<BehaviorContext> {
  constructor(private gameGrid: GameGrid) {}

  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    doors: Map<string, Door>,
    _prng: PRNG,
    context: BehaviorContext,
    director?: ItemEffectHandler,
  ): BehaviorResult {
    let currentUnit = { ...unit };
    if (currentUnit.archetypeId === "vip")
      return { unit: currentUnit, handled: false };
    if (
      currentUnit.state !== UnitState.Idle &&
      currentUnit.state !== UnitState.Attacking &&
      !currentUnit.explorationTarget
    )
      return { unit: currentUnit, handled: false };
    if (currentUnit.commandQueue.length > 0)
      return { unit: currentUnit, handled: false };
    if (!context.agentControlEnabled || currentUnit.aiEnabled === false)
      return { unit: currentUnit, handled: false };

    if (currentUnit.activeCommand?.type === CommandType.EXTRACT || 
        currentUnit.activeCommand?.label === "Extracting") {
      return { unit: currentUnit, handled: false };
    }

    const visibleEnemies = state.enemies.filter(
      (enemy) =>
        enemy.hp > 0 &&
        isCellVisible(state, Math.floor(enemy.pos.x), Math.floor(enemy.pos.y)),
    );

    const threats = visibleEnemies
      .map((enemy) => ({
        enemy,
        distance: MathUtils.getDistance(currentUnit.pos, enemy.pos),
      }))
      .sort((a, b) => 1 / (b.distance + 1) - 1 / (a.distance + 1));

    if (threats.length > 0 && currentUnit.engagementPolicy !== "IGNORE") {
      const primaryThreat = threats[0].enemy;
      const dist = threats[0].distance;

      if (currentUnit.aiProfile === "STAND_GROUND") {
        // Hold position
        return { unit: currentUnit, handled: false };
      } else if (currentUnit.aiProfile === "RUSH") {
        if (dist > 1.5) {
          const targetCell = {
            x: Math.floor(primaryThreat.pos.x),
            y: Math.floor(primaryThreat.pos.y),
          };
          if (
            currentUnit.state !== UnitState.Moving ||
            !currentUnit.targetPos ||
            !MathUtils.sameCellPosition(currentUnit.targetPos, targetCell)
          ) {
            currentUnit = context.executeCommand(
              currentUnit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [currentUnit.id],
                target: targetCell,
                label: "Rushing",
              },
              state,
              false,
              director,
            );

            if (currentUnit.state === UnitState.Moving) {
              const goalPos = { x: targetCell.x + 0.5, y: targetCell.y + 0.5 };
              const distToGoal = MathUtils.getDistance(currentUnit.pos, goalPos);
              const travelTimeMs = calculateTravelTimeMs(currentUnit, distToGoal);
              currentUnit.activePlan = {
                behavior: "Rushing",
                goal: goalPos,
                committedUntil: state.t + Math.max(500, travelTimeMs),
                priority: 2,
              };
            }
            return { unit: currentUnit, handled: true };
          } else if (currentUnit.activePlan) {
            // Same target and already moving, refresh commitment
            const goalPos = { x: targetCell.x + 0.5, y: targetCell.y + 0.5 };
            const distToGoal = MathUtils.getDistance(currentUnit.pos, goalPos);
            const travelTimeMs = calculateTravelTimeMs(currentUnit, distToGoal);
            currentUnit.activePlan = {
              ...currentUnit.activePlan,
              committedUntil: state.t + Math.max(500, travelTimeMs),
            };
            return { unit: currentUnit, handled: true };
          }
        }
      } else if (currentUnit.aiProfile === "RETREAT" && currentUnit.engagementPolicy !== "AVOID") {
        if (dist < currentUnit.stats.attackRange * 0.8) {
          const currentCell = {
            x: Math.floor(currentUnit.pos.x),
            y: Math.floor(currentUnit.pos.y),
          };
          const neighbors = [
            { x: currentCell.x + 1, y: currentCell.y },
            { x: currentCell.x - 1, y: currentCell.y },
            { x: currentCell.x, y: currentCell.y + 1 },
            { x: currentCell.x, y: currentCell.y - 1 },
          ].filter(
            (n) =>
              this.gameGrid.isWalkable(n.x, n.y) &&
              this.gameGrid.canMove(
                currentCell.x,
                currentCell.y,
                n.x,
                n.y,
                doors,
                false,
              ),
          );

          const bestRetreat = neighbors
            .map((n) => ({
              ...n,
              dist: MathUtils.getDistance(
                { x: n.x + 0.5, y: n.y + 0.5 },
                primaryThreat.pos,
              ),
            }))
            .sort((a, b) => b.dist - a.dist)[0];

          if (bestRetreat && bestRetreat.dist > dist) {
            const targetCell = { x: bestRetreat.x, y: bestRetreat.y };
            if (
              currentUnit.state !== UnitState.Moving ||
              !currentUnit.targetPos ||
              !MathUtils.sameCellPosition(currentUnit.targetPos, targetCell)
            ) {
              currentUnit = context.executeCommand(
                currentUnit,
                {
                  type: CommandType.MOVE_TO,
                  unitIds: [currentUnit.id],
                  target: targetCell,
                  label: "Retreating",
                },
                state,
                false,
                director,
              );

              if (currentUnit.state === UnitState.Moving) {
                const goalPos = { x: targetCell.x + 0.5, y: targetCell.y + 0.5 };
                const distToGoal = MathUtils.getDistance(currentUnit.pos, goalPos);
                const travelTimeMs = calculateTravelTimeMs(currentUnit, distToGoal);
                currentUnit.activePlan = {
                  behavior: "Retreating",
                  goal: goalPos,
                  committedUntil: state.t + Math.max(500, travelTimeMs),
                  priority: 2,
                };
              }
              return { unit: currentUnit, handled: true };
            } else if (currentUnit.activePlan) {
              // Same target and already moving, refresh commitment
              const goalPos = { x: targetCell.x + 0.5, y: targetCell.y + 0.5 };
              const distToGoal = MathUtils.getDistance(currentUnit.pos, goalPos);
              const travelTimeMs = calculateTravelTimeMs(currentUnit, distToGoal);
              currentUnit.activePlan = {
                ...currentUnit.activePlan,
                committedUntil: state.t + Math.max(500, travelTimeMs),
              };
              return { unit: currentUnit, handled: true };
            }
          }
        }
      } else {
        // Default behavior
        if (dist > currentUnit.stats.attackRange) {
          const targetCell = {
            x: Math.floor(primaryThreat.pos.x),
            y: Math.floor(primaryThreat.pos.y),
          };
          if (
            currentUnit.state !== UnitState.Moving ||
            !currentUnit.targetPos ||
            !MathUtils.sameCellPosition(currentUnit.targetPos, targetCell)
          ) {
            currentUnit = context.executeCommand(
              currentUnit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [currentUnit.id],
                target: targetCell,
                label: "Engaging",
              },
              state,
              false,
              director,
            );

            if (currentUnit.state === UnitState.Moving) {
              const goalPos = { x: targetCell.x + 0.5, y: targetCell.y + 0.5 };
              const distToGoal = MathUtils.getDistance(currentUnit.pos, goalPos);
              const travelTimeMs = calculateTravelTimeMs(currentUnit, distToGoal);
              currentUnit.activePlan = {
                behavior: "Engaging",
                goal: goalPos,
                committedUntil: state.t + Math.max(500, travelTimeMs),
                priority: 2,
              };
            }
            return { unit: currentUnit, handled: true };
          } else if (currentUnit.activePlan) {
            // Same target and already moving, refresh commitment
            const goalPos = { x: targetCell.x + 0.5, y: targetCell.y + 0.5 };
            const distToGoal = MathUtils.getDistance(currentUnit.pos, goalPos);
            const travelTimeMs = calculateTravelTimeMs(currentUnit, distToGoal);
            currentUnit.activePlan = {
              ...currentUnit.activePlan,
              committedUntil: state.t + Math.max(500, travelTimeMs),
            };
            return { unit: currentUnit, handled: true };
          }
        }
      }
    }

    return { unit: currentUnit, handled: false };
  }
}
