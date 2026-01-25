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
import { GameGrid } from "../../GameGrid";
import { isCellVisible } from "../../../shared/VisibilityUtils";
import { IDirector } from "../../interfaces/IDirector";
import { MathUtils } from "../../../shared/utils/MathUtils";

export class CombatBehavior implements Behavior {
  constructor(private gameGrid: GameGrid) {}

  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    doors: Map<string, Door>,
    _prng: PRNG,
    context: AIContext,
    director?: IDirector,
  ): boolean {
    if (unit.archetypeId === "vip") return false;
    if (unit.state !== UnitState.Idle && !unit.explorationTarget) return false;
    if (unit.commandQueue.length > 0) return false;
    if (!context.agentControlEnabled || unit.aiEnabled === false) return false;

    const visibleEnemies = state.enemies.filter(
      (enemy) =>
        enemy.hp > 0 &&
        isCellVisible(
          state,
          Math.floor(enemy.pos.x),
          Math.floor(enemy.pos.y),
        ),
    );

    const threats = visibleEnemies
      .map((enemy) => ({
        enemy,
        distance: MathUtils.getDistance(unit.pos, enemy.pos),
      }))
      .sort((a, b) => 1 / (b.distance + 1) - 1 / (a.distance + 1));

    if (threats.length > 0 && unit.engagementPolicy !== "IGNORE") {
      const primaryThreat = threats[0].enemy;
      const dist = threats[0].distance;

      if (unit.aiProfile === "STAND_GROUND") {
        // Hold position
        return false;
      } else if (unit.aiProfile === "RUSH") {
        if (dist > 1.5) {
          context.executeCommand(
            unit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [unit.id],
              target: {
                x: Math.floor(primaryThreat.pos.x),
                y: Math.floor(primaryThreat.pos.y),
              },
              label: "Rushing",
            },
            state,
            false,
            director,
          );
          return true;
        }
      } else if (unit.aiProfile === "RETREAT") {
        if (dist < unit.stats.attackRange * 0.8) {
          const currentCell = {
            x: Math.floor(unit.pos.x),
            y: Math.floor(unit.pos.y),
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
            context.executeCommand(
              unit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [unit.id],
                target: { x: bestRetreat.x, y: bestRetreat.y },
                label: "Retreating",
              },
              state,
              false,
              director,
            );
            return true;
          }
        }
      } else {
        // Default behavior
        if (dist > unit.stats.attackRange) {
          context.executeCommand(
            unit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [unit.id],
              target: {
                x: Math.floor(primaryThreat.pos.x),
                y: Math.floor(primaryThreat.pos.y),
              },
              label: "Engaging",
            },
            state,
            false,
            director,
          );
          return true;
        }
      }
    }

    return false;
  }
}
