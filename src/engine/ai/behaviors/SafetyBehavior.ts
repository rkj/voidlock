import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Enemy,
  Vector2,
} from "../../../shared/types";
import { AIContext } from "../../managers/UnitAI";
import { PRNG } from "../../../shared/PRNG";
import { Behavior } from "./Behavior";
import { getDistance } from "./BehaviorUtils";

export class SafetyBehavior implements Behavior {
  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    _doors: Map<string, any>,
    _prng: PRNG,
    context: AIContext,
    director?: any
  ): boolean {
    if (unit.archetypeId === "vip") return false;

    const visibleEnemies = state.enemies.filter(
      (enemy) =>
        enemy.hp > 0 &&
        context.newVisibleCellsSet.has(
          `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`
        )
    );

    const threats = visibleEnemies
      .map((enemy) => ({
        enemy,
        distance: getDistance(unit.pos, enemy.pos),
      }))
      .sort(
        (a, b) =>
          1 / (b.distance + 1) - (1 / (a.distance + 1))
      );

    const isLowHP = unit.hp < unit.maxHp * 0.25;
    const nearbyAllies = state.units.filter(
      (u) =>
        u.id !== unit.id &&
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead &&
        getDistance(unit.pos, u.pos) <= 5
    );
    const isIsolated = nearbyAllies.length === 0 && threats.length > 0;

    if (isLowHP && threats.length > 0) {
      const safeCells = state.discoveredCells.filter((cellKey) => {
        const [cx, cy] = cellKey.split(",").map(Number);
        return !threats.some(
          (t) => Math.floor(t.enemy.pos.x) === cx && Math.floor(t.enemy.pos.y) === cy
        );
      });

      if (safeCells.length > 0) {
        const closestSafe = safeCells
          .map((cellKey) => {
            const [cx, cy] = cellKey.split(",").map(Number);
            return {
              x: cx,
              y: cy,
              dist: getDistance(unit.pos, { x: cx + 0.5, y: cy + 0.5 }),
            };
          })
          .sort((a, b) => a.dist - b.dist)[0];

        if (
          unit.state !== UnitState.Moving ||
          !unit.targetPos ||
          Math.floor(unit.targetPos.x) !== closestSafe.x ||
          Math.floor(unit.targetPos.y) !== closestSafe.y
        ) {
          unit.engagementPolicy = "IGNORE";
          unit.engagementPolicySource = "Autonomous";
          context.executeCommand(
            unit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [unit.id],
              target: { x: closestSafe.x, y: closestSafe.y },
              label: "Retreating",
            },
            state,
            false,
            director
          );
          return unit.state === UnitState.Moving;
        }
        return unit.state === UnitState.Moving;
      }
    } else if (isIsolated) {
      const otherUnits = state.units.filter(
        (u) =>
          u.id !== unit.id &&
          u.hp > 0 &&
          u.state !== UnitState.Extracted &&
          u.state !== UnitState.Dead
      );
      if (otherUnits.length > 0) {
        const closestAlly = otherUnits.sort(
          (a, b) =>
            getDistance(unit.pos, a.pos) -
            getDistance(unit.pos, b.pos)
        )[0];
        if (
          unit.state !== UnitState.Moving ||
          !unit.targetPos ||
          Math.floor(unit.targetPos.x) !== Math.floor(closestAlly.pos.x) ||
          Math.floor(unit.targetPos.y) !== Math.floor(closestAlly.pos.y)
        ) {
          unit.engagementPolicy = "IGNORE";
          unit.engagementPolicySource = "Autonomous";
          context.executeCommand(
            unit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [unit.id],
              target: {
                x: Math.floor(closestAlly.pos.x),
                y: Math.floor(closestAlly.pos.y),
              },
              label: "Grouping Up",
            },
            state,
            false,
            director
          );
          return true;
        }
        return unit.state === UnitState.Moving;
      }
    } else {
      if (
        unit.engagementPolicy === "IGNORE" &&
        unit.engagementPolicySource === "Autonomous" &&
        unit.state === UnitState.Idle &&
        unit.commandQueue.length === 0
      ) {
        unit.engagementPolicy = "ENGAGE";
        unit.engagementPolicySource = undefined;
      }
    }
    return false;
  }
}

