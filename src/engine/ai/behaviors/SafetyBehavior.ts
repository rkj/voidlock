import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Vector2,
  Door,
} from "../../../shared/types";
import { BehaviorContext } from "../../interfaces/AIContext";
import { PRNG } from "../../../shared/PRNG";
import { Behavior, BehaviorResult } from "./Behavior";
import { isCellVisible } from "../../../shared/VisibilityUtils";
import { ItemEffectHandler } from "../../interfaces/IDirector";
import { MathUtils } from "../../../shared/utils/MathUtils";

export class SafetyBehavior implements Behavior<BehaviorContext> {
  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    _doors: Map<string, Door>,
    _prng: PRNG,
    context: BehaviorContext,
    director?: ItemEffectHandler,
  ): BehaviorResult {
    let currentUnit = { ...unit };
    if (currentUnit.archetypeId === "vip")
      return { unit: currentUnit, handled: false };

    const visibleEnemies = state.enemies.filter((enemy) => {
      if (enemy.hp <= 0) return false;
      const cell = MathUtils.toCellCoord(enemy.pos);
      return isCellVisible(state, cell.x, cell.y);
    });

    const threats = visibleEnemies
      .map((enemy) => ({
        enemy,
        distance: MathUtils.getDistance(currentUnit.pos, enemy.pos),
      }))
      .sort((a, b) => 1 / (b.distance + 1) - 1 / (a.distance + 1));

    const isLowHP = currentUnit.hp < currentUnit.maxHp * 0.25;
    const nearbyAllies = state.units.filter(
      (u) =>
        u.id !== currentUnit.id &&
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead &&
        MathUtils.getDistance(currentUnit.pos, u.pos) <= 5,
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
            const cell = { x: cx, y: cy };
            const isThreatened = threats.some((t) =>
              MathUtils.sameCellPosition(t.enemy.pos, cell),
            );
            if (!isThreatened) {
              safeCells.push(cell);
            }
          }
        }
      } else {
        state.discoveredCells.forEach((cellKey) => {
          const [cx, cy] = cellKey.split(",").map(Number);
          const cell = { x: cx, y: cy };
          const isThreatened = threats.some((t) =>
            MathUtils.sameCellPosition(t.enemy.pos, cell),
          );
          if (!isThreatened) {
            safeCells.push(cell);
          }
        });
      }

      if (safeCells.length > 0) {
        const closestSafe = safeCells
          .map((cell) => {
            return {
              ...cell,
              dist: MathUtils.getDistance(currentUnit.pos, {
                x: cell.x + 0.5,
                y: cell.y + 0.5,
              }),
            };
          })
          .sort((a, b) => a.dist - b.dist)[0];

        if (
          currentUnit.state !== UnitState.Moving ||
          !currentUnit.targetPos ||
          !MathUtils.sameCellPosition(currentUnit.targetPos, closestSafe)
        ) {
          currentUnit = {
            ...currentUnit,
            engagementPolicy: "IGNORE",
            engagementPolicySource: "Autonomous",
          };
          currentUnit = context.executeCommand(
            currentUnit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [currentUnit.id],
              target: { x: closestSafe.x, y: closestSafe.y },
              label: "Retreating",
            },
            state,
            false,
            director,
          );
          return {
            unit: currentUnit,
            handled: currentUnit.state === UnitState.Moving,
          };
        }
        return {
          unit: currentUnit,
          handled: currentUnit.state === UnitState.Moving,
        };
      }
    } else if (isIsolated) {
      const otherUnits = state.units.filter(
        (u) =>
          u.id !== currentUnit.id &&
          u.hp > 0 &&
          u.state !== UnitState.Extracted &&
          u.state !== UnitState.Dead,
      );
      if (otherUnits.length > 0) {
        const closestAlly = otherUnits.sort(
          (a, b) =>
            MathUtils.getDistance(currentUnit.pos, a.pos) -
            MathUtils.getDistance(currentUnit.pos, b.pos),
        )[0];
        if (
          currentUnit.state !== UnitState.Moving ||
          !currentUnit.targetPos ||
          !MathUtils.sameCellPosition(currentUnit.targetPos, closestAlly.pos)
        ) {
          currentUnit = {
            ...currentUnit,
            engagementPolicy: "IGNORE",
            engagementPolicySource: "Autonomous",
          };
          currentUnit = context.executeCommand(
            currentUnit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [currentUnit.id],
              target: MathUtils.toCellCoord(closestAlly.pos),
              label: "Grouping Up",
            },
            state,
            false,
            director,
          );
          return { unit: currentUnit, handled: true };
        }
        return {
          unit: currentUnit,
          handled: currentUnit.state === UnitState.Moving,
        };
      }
    } else {
      if (
        currentUnit.engagementPolicy === "IGNORE" &&
        currentUnit.engagementPolicySource === "Autonomous" &&
        currentUnit.state === UnitState.Idle &&
        currentUnit.commandQueue.length === 0
      ) {
        currentUnit = {
          ...currentUnit,
          engagementPolicy: "ENGAGE",
          engagementPolicySource: undefined,
        };
      }
    }
    return { unit: currentUnit, handled: false };
  }
}
