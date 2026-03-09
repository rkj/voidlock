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
import { MapUtils } from "../../../shared/utils/MapUtils";
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
      return { unit: currentUnit, handled: true };
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
            .map((o): VisibleItem | null => {
              const pos = MapUtils.resolveObjectivePosition(o, state.enemies);
              if (!pos) return null;
              return {
                id: o.id,
                pos,
                mustBeInLOS: o.kind === "Recover",
                visible: o.visible,
                type: "objective",
              };
            })
            .filter((o): o is VisibleItem => o !== null),
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

        const label = closest.type === "objective" ? "Recovering" : "Picking up";
        
        const isAlreadyTargeting = 
          currentUnit.activeCommand?.type === CommandType.PICKUP &&
          (currentUnit.activeCommand as PickupCommand).lootId === closest.id;

        if (!isAlreadyTargeting) {
          Logger.debug(`ObjectiveBehavior: unit ${currentUnit.id} picking up ${closest.id} (${label})`);
          currentUnit = context.executeCommand(
            currentUnit,
            {
              type: CommandType.PICKUP,
              unitIds: [currentUnit.id],
              lootId: closest.id,
              label,
            },
            state,
            false,
            director,
          );
          if (currentUnit.state === UnitState.Moving && label === "Recovering") {
            currentUnit.activePlan = {
              behavior: label,
              goal: closest.pos,
              committedUntil: state.t + 1000,
              priority: 3,
            };
          }
        } else if (currentUnit.activePlan && label === "Recovering") {
          // Refresh commitment
          currentUnit.activePlan = {
            ...currentUnit.activePlan,
            committedUntil: state.t + 1000,
          };
        }
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
        let bestObj: { obj: Objective; dist: number; targetPos: Vector2 } | null = null;

        for (const obj of pendingObjectives) {
          const targetPos = MapUtils.resolveObjectivePosition(obj, state.enemies);
          
          if (targetPos) {
            // Filter target enemy visibility if kind is 'Kill'
            if (obj.kind === "Kill" && obj.targetEnemyId) {
              const enemyCell = MathUtils.toCellCoord(targetPos);
              if (!isCellVisible(state, enemyCell.x, enemyCell.y)) {
                continue;
              }
            }

            const dist = MathUtils.getDistance(currentUnit.pos, targetPos);
            if (!bestObj || dist < bestObj.dist) {
              bestObj = { obj, dist, targetPos };
            }
          }
        }

        if (bestObj) {
          context.claimedObjectives.set(bestObj.obj.id, currentUnit.id);
          const target = MathUtils.toCellCoord(bestObj.targetPos);

          if (!MathUtils.sameCellPosition(currentUnit.pos, target)) {
            const label =
              bestObj.obj.kind === "Recover"
                ? "Recovering"
                : bestObj.obj.kind === "Escort"
                  ? "Escorting"
                  : "Hunting";
            
            const isAlreadyMovingToTarget = 
              currentUnit.state === UnitState.Moving &&
              currentUnit.targetPos &&
              MathUtils.sameCellPosition(currentUnit.targetPos, target);

            if (!isAlreadyMovingToTarget) {
              Logger.debug(`ObjectiveBehavior: unit ${currentUnit.id} moving to ${target.x},${target.y} (${label})`);
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
              if (currentUnit.state === UnitState.Moving && (label === "Recovering" || label === "Hunting")) {
                currentUnit.activePlan = {
                  behavior: label,
                  goal: { x: target.x + 0.5, y: target.y + 0.5 },
                  committedUntil: state.t + 1000,
                  priority: 3,
                };
              }
            } else if (currentUnit.activePlan && (label === "Recovering" || label === "Hunting")) {
              // Refresh commitment
              currentUnit.activePlan = {
                ...currentUnit.activePlan,
                committedUntil: state.t + 1000,
              };
            }
            actionTaken = true;
          } else {
            // At target, issue pickup if it's a recovery objective
            if (bestObj.obj.kind === "Recover") {
              const isAlreadyRecovering = 
                currentUnit.activeCommand?.type === CommandType.PICKUP &&
                (currentUnit.activeCommand as PickupCommand).lootId === bestObj.obj.id;

              if (!isAlreadyRecovering) {
                Logger.debug(`ObjectiveBehavior: unit ${currentUnit.id} at target, picking up ${bestObj.obj.id}`);
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
                if (currentUnit.state === UnitState.Moving || currentUnit.state === UnitState.Channeling) {
                  currentUnit.activePlan = {
                    behavior: "Recovering",
                    goal: currentUnit.pos,
                    committedUntil: state.t + 1000,
                    priority: 3,
                  };
                }
              } else if (currentUnit.activePlan) {
                // Refresh commitment
                currentUnit.activePlan = {
                  ...currentUnit.activePlan,
                  committedUntil: state.t + 1000,
                };
              }
              actionTaken = true;
            }
          }
        }
      }
    }

    // 3. Extraction
    const objectivesComplete =
      state.objectives && state.objectives.length > 0 && state.objectives.every((o) => o.state !== "Pending");
    const isMapFullyDiscovered = state.discoveredCells.length >= context.totalFloorCells;

    if (!actionTaken && (objectivesComplete || isMapFullyDiscovered) && state.map.extraction) {
      const ext = state.map.extraction;
      const isExtDiscovered = isCellDiscovered(state, ext.x, ext.y);

      if (isExtDiscovered) {
        // Issue extraction command if not already extracting or if not at extraction cell
        if (
          currentUnit.activeCommand?.type !== CommandType.EXTRACT ||
          !MathUtils.sameCellPosition(currentUnit.pos, ext)
        ) {
          // Autonomous units auto-extract if map is fully discovered OR objectives are done
          const shouldAutoExtract = isMapFullyDiscovered || objectivesComplete;
          
          if (shouldAutoExtract || !currentUnit.aiEnabled) {
            currentUnit = { ...currentUnit, explorationTarget: undefined };
            Logger.debug(`ObjectiveBehavior: unit ${currentUnit.id} extracting`);
            currentUnit = context.executeCommand(
              currentUnit,
              {
                type: CommandType.EXTRACT,
                unitIds: [currentUnit.id],
                label: "Extracting",
              },
              state,
              false,
              director,
            );
            // We deliberately don't set activePlan for auto-extraction here
            // to avoid interfering with tactical overrides in existing tests.
            actionTaken = true;
          }
        } else {
          actionTaken = true;
        }
      }
    }

    return { unit: currentUnit, handled: actionTaken };
  }
}
