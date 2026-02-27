import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  PickupCommand,
  Vector2,
  Door,
  Objective,
} from "../../../shared/types";
import { BehaviorContext, ObjectiveContext, VisibleItem } from "../../interfaces/AIContext";
import { PRNG } from "../../../shared/PRNG";
import { Behavior, BehaviorResult } from "./Behavior";
import {
  isCellVisible,
  isCellDiscovered,
} from "../../../shared/VisibilityUtils";
import { ItemEffectHandler } from "../../interfaces/IDirector";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { MOVEMENT } from "../../config/GameConstants";
import { Logger } from "../../../shared/Logger";

export class ObjectiveBehavior implements Behavior<BehaviorContext & ObjectiveContext> {
  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    _doors: Map<string, Door>,
    _prng: PRNG,
    context: BehaviorContext & ObjectiveContext,
    director?: ItemEffectHandler,
  ): BehaviorResult {
    let currentUnit = { ...unit };
    if (currentUnit.archetypeId === "vip")
      return { unit: currentUnit, handled: false };
    if (currentUnit.state !== UnitState.Idle && !currentUnit.explorationTarget)
      return { unit: currentUnit, handled: false };
    if (currentUnit.commandQueue.length > 0)
      return { unit: currentUnit, handled: false };
    if (!context.agentControlEnabled || currentUnit.aiEnabled === false)
      return { unit: currentUnit, handled: false };

    if (
      currentUnit.activeCommand?.type === CommandType.EXTRACT ||
      currentUnit.activeCommand?.label === "Extracting"
    ) {
      return { unit: currentUnit, handled: false };
    }

    let actionTaken = false;

    // 1. Opportunistic Loot & Objectives (In current LOS)
    let visibleItemsFromGrid: VisibleItem[] = [];

    if (context.itemGrid) {
      visibleItemsFromGrid = context.itemGrid.queryByKeys(
        state.visibleCells || [],
      ) as VisibleItem[];
    } else {
      // Fallback if grid not available (shouldn't happen in production)
      visibleItemsFromGrid = (
        [
          ...(state.loot || []).map((l) => ({
            id: l.id,
            pos: l.pos,
            mustBeInLOS: true,
            type: "loot" as const,
          })),
          ...(state.objectives || [])
            .filter(
              (o) =>
                o.state === "Pending" &&
                (o.kind === "Recover" ||
                  o.kind === "Escort" ||
                  o.kind === "Kill"),
            )
            .map((o) => {
              let pos: Vector2 = {
                x: MOVEMENT.CENTER_OFFSET,
                y: MOVEMENT.CENTER_OFFSET,
              };
              if (o.targetCell) {
                pos = {
                  x: o.targetCell.x + MOVEMENT.CENTER_OFFSET,
                  y: o.targetCell.y + MOVEMENT.CENTER_OFFSET,
                };
              } else if (o.targetEnemyId) {
                const enemy = state.enemies.find(
                  (e) => e.id === o.targetEnemyId,
                );
                if (enemy) pos = enemy.pos;
              }
              return {
                id: o.id,
                pos,
                mustBeInLOS: o.kind === "Recover",
                visible: o.visible,
                type: "objective" as const,
              };
            }),
        ] as VisibleItem[]
      ).filter((item) => {
        if ("visible" in item && item.visible) return true;
        const cell = MathUtils.toCellCoord(item.pos);
        return isCellVisible(state, cell.x, cell.y);
      });
    }

    const visibleLoot = visibleItemsFromGrid.filter((item) => {
      if (item.type !== "loot") return false;
      const claimer = context.claimedObjectives.get(item.id);
      return !claimer || claimer === currentUnit.id;
    });
    const visibleObjectives = visibleItemsFromGrid.filter((item) => {
      if (item.type !== "objective") return false;
      // The grid query already filtered by visibility/cell
      // But we need to check if it's already claimed
      const claimer = context.claimedObjectives.get(item.id);
      return !claimer || claimer === currentUnit.id;
    });

    if (visibleLoot.length > 0 || visibleObjectives.length > 0) {
      const targetedIds = state.units
        .filter(
          (u) =>
            u.id !== currentUnit.id &&
            u.activeCommand?.type === CommandType.PICKUP,
        )
        .map((u) => (u.activeCommand as PickupCommand).lootId);

      const availableLoot = visibleLoot.filter((l) => {
        if (targetedIds.includes(l.id)) return false;
        const assignedUnitId = context.itemAssignments.get(l.id);
        return !assignedUnitId || assignedUnitId === currentUnit.id;
      });
      const availableObjectives = visibleObjectives.filter((o) => {
        if (targetedIds.includes(o.id)) return false;
        const assignedUnitId = context.itemAssignments.get(o.id);
        return !assignedUnitId || assignedUnitId === currentUnit.id;
      });

      const items = [
        ...availableLoot.map((l) => ({
          id: l.id,
          pos: l.pos,
          type: "loot" as const,
        })),
        ...availableObjectives.map((o) => ({
          id: o.id,
          pos: o.pos,
          type: "objective" as const,
        })),
      ];

      if (items.length > 0) {
        const closest = items.sort(
          (a, b) =>
            MathUtils.getDistance(currentUnit.pos, a.pos) -
            MathUtils.getDistance(currentUnit.pos, b.pos),
        )[0];

        if (closest.type === "objective") {
          context.claimedObjectives.set(closest.id, currentUnit.id);
        }

        currentUnit = context.executeCommand(
          currentUnit,
          {
            type: CommandType.PICKUP,
            unitIds: [currentUnit.id],
            lootId: closest.id,
            label: closest.type === "objective" ? "Recovering" : "Picking up",
          },
          state,
          false,
          director,
        );
        actionTaken = true;
      }
    }

    if (!actionTaken && state.objectives) {
      const pendingObjectives = state.objectives.filter((o) => {
        const assignedUnitId = context.itemAssignments.get(o.id);
        const claimer = context.claimedObjectives.get(o.id);
        const isClaimedByOther = claimer && claimer !== currentUnit.id;

        if (
          o.state !== "Pending" ||
          isClaimedByOther ||
          !o.visible ||
          (!assignedUnitId || assignedUnitId === currentUnit.id) === false
        )
          return false;

        return true;
      });
      if (pendingObjectives.length > 0) {
        Logger.debug(
          `ObjectiveBehavior: found ${pendingObjectives.length} pending objectives`,
        );
        let bestObj: { obj: Objective; dist: number } | null = null;
        // ...

        for (const obj of pendingObjectives) {
          let targetPos: Vector2 | null = null;
          if (
            (obj.kind === "Recover" || obj.kind === "Escort") &&
            obj.targetCell
          ) {
            targetPos = {
              x: obj.targetCell.x + 0.5,
              y: obj.targetCell.y + 0.5,
            };
          } else if (obj.kind === "Kill" && obj.targetEnemyId) {
            const enemy = state.enemies.find((e) => e.id === obj.targetEnemyId);
            if (enemy) {
              const enemyCell = MathUtils.toCellCoord(enemy.pos);
              if (isCellVisible(state, enemyCell.x, enemyCell.y)) {
                targetPos = enemy.pos;
              }
            }
          }

          if (targetPos) {
            const dist = MathUtils.getDistance(currentUnit.pos, targetPos);
            if (!bestObj || dist < bestObj.dist) {
              bestObj = { obj, dist };
            }
          }
        }

        if (bestObj) {
          context.claimedObjectives.set(bestObj.obj.id, currentUnit.id);
          let target = { x: 0, y: 0 };
          if (
            (bestObj.obj.kind === "Recover" || bestObj.obj.kind === "Escort") &&
            bestObj.obj.targetCell
          )
            target = bestObj.obj.targetCell;
          else if (bestObj.obj.kind === "Kill" && bestObj.obj.targetEnemyId) {
            const e = state.enemies.find(
              (en) => en.id === bestObj.obj.targetEnemyId,
            );
            if (e) target = MathUtils.toCellCoord(e.pos);
          }

          if (!MathUtils.sameCellPosition(currentUnit.pos, target)) {
            const label =
              bestObj.obj.kind === "Recover"
                ? "Recovering"
                : bestObj.obj.kind === "Escort"
                  ? "Escorting"
                  : "Hunting";
            currentUnit = context.executeCommand(
              currentUnit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [currentUnit.id],
                target,
                label,
              },
              state,
              false,
              director,
            );
            actionTaken = true;
          } else {
            // At target, issue pickup if it's a recovery objective
            if (bestObj.obj.kind === "Recover") {
              currentUnit = context.executeCommand(
                currentUnit,
                {
                  type: CommandType.PICKUP,
                  unitIds: [currentUnit.id],
                  lootId: bestObj.obj.id,
                  label: "Recovering",
                },
                state,
                false,
                director,
              );
              actionTaken = true;
            }
          }
        }
      }
    }

    // 3. Extraction
    const objectivesComplete =
      !state.objectives || state.objectives.every((o) => o.state !== "Pending");

    if (!actionTaken && objectivesComplete && state.map.extraction) {
      const ext = state.map.extraction;
      const isExtDiscovered = isCellDiscovered(state, ext.x, ext.y);

      if (isExtDiscovered) {
        // Issue extraction command if not already extracting or if not at extraction cell
        if (
          currentUnit.activeCommand?.label !== "Extracting" ||
          !MathUtils.sameCellPosition(currentUnit.pos, ext)
        ) {
          currentUnit = { ...currentUnit, explorationTarget: undefined };
          currentUnit = context.executeCommand(
            currentUnit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [currentUnit.id],
              target: ext,
              label: "Extracting",
            },
            state,
            false,
            director,
          );
        }
        actionTaken = true;
      }
    }

    return { unit: currentUnit, handled: actionTaken };
  }
}
