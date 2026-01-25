import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Vector2,
  Door,
} from "../../../shared/types";
import { AIContext } from "../../managers/UnitAI";
import { PRNG } from "../../../shared/PRNG";
import { Behavior } from "./Behavior";
import { isCellVisible } from "../../../shared/VisibilityUtils";
import { IDirector } from "../../interfaces/IDirector";
import { MathUtils } from "../../../shared/utils/MathUtils";

export class SafetyBehavior implements Behavior {
  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    _doors: Map<string, Door>,
    _prng: PRNG,
    context: AIContext,
    director?: IDirector,
  ): boolean {
    if (unit.archetypeId === "vip") return false;

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

    const isLowHP = unit.hp < unit.maxHp * 0.25;
    const nearbyAllies = state.units.filter(
      (u) =>
        u.id !== unit.id &&
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead &&
        MathUtils.getDistance(unit.pos, u.pos) <= 5,
    );
    const isIsolated = nearbyAllies.length === 0 && threats.length > 0;

    if (isLowHP && threats.length > 0) {
      const safeCells: Vector2[] = [];
      const width = state.map.width;

      if (state.gridState) {
        for (let i = 0; i < state.gridState.length; i++) {
          if (state.gridState[i] & 2) {
            const cx = i % width;
            const cy = Math.floor(i / width);
            const isThreatened = threats.some(
              (t) =>
                Math.floor(t.enemy.pos.x) === cx &&
                Math.floor(t.enemy.pos.y) === cy,
            );
            if (!isThreatened) {
              safeCells.push({ x: cx, y: cy });
            }
          }
        }
      } else {
        state.discoveredCells.forEach((cellKey) => {
          const [cx, cy] = cellKey.split(",").map(Number);
          const isThreatened = threats.some(
            (t) =>
              Math.floor(t.enemy.pos.x) === cx &&
              Math.floor(t.enemy.pos.y) === cy,
          );
          if (!isThreatened) {
            safeCells.push({ x: cx, y: cy });
          }
        });
      }

      if (safeCells.length > 0) {
        const closestSafe = safeCells
          .map((cell) => {
            return {
              ...cell,
              dist: MathUtils.getDistance(unit.pos, { x: cell.x + 0.5, y: cell.y + 0.5 }),
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
            director,
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
          u.state !== UnitState.Dead,
      );
      if (otherUnits.length > 0) {
        const closestAlly = otherUnits.sort(
          (a, b) => MathUtils.getDistance(unit.pos, a.pos) - MathUtils.getDistance(unit.pos, b.pos),
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
            director,
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
