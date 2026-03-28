import type {
  PickupCommand,
  Vector2,
  Objective,
  Unit,
  GameState} from "../../../shared/types";
import {
  UnitState,
  CommandType,
  MissionType
} from "../../../shared/types";
import type { BehaviorContext, ObjectiveContext, VisibleItem } from "../../interfaces/AIContext";
import type { Behavior, BehaviorEvalParams, BehaviorResult } from "./Behavior";
import type { IDirector } from "../../interfaces/IDirector";
import {
  isCellVisible,
  isCellDiscovered,
} from "../../../shared/VisibilityUtils";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { MapUtils } from "../../../shared/utils/MapUtils";
import { Logger } from "../../../shared/Logger";

type ObjContext = BehaviorContext & ObjectiveContext;

interface ActionContext {
  unit: Unit;
  state: GameState;
  context: ObjContext;
  director: IDirector | undefined;
}

function issuePickup(
  ctx: ActionContext,
  id: string,
  label: string,
): Unit {
  const { unit, state, context, director } = ctx;
  const updated = context.executeCommand({
    unit,
    cmd: {
      type: CommandType.PICKUP,
      unitIds: [unit.id],
      lootId: id,
      label,
    },
    state,
    isManual: false,
    director,
  });
  return updated;
}

function issueMoveTo(
  ctx: ActionContext,
  target: Vector2,
  label: string,
): Unit {
  const { unit, state, context, director } = ctx;
  return context.executeCommand({
    unit,
    cmd: {
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target,
      label,
    },
    state,
    isManual: false,
    director,
  });
}

function setActivePlanIfMoving(unit: Unit, goal: Vector2, label: string, state: GameState): void {
  if (unit.state === UnitState.Moving) {
    unit.activePlan = {
      behavior: label,
      goal,
      committedUntil: state.t + 1000,
      priority: 3,
    };
  }
}

function refreshPlan(unit: Unit, state: GameState): void {
  if (unit.activePlan) {
    unit.activePlan = { ...unit.activePlan, committedUntil: state.t + 1000 };
  }
}

function getVisibleItemsFromGrid(ctx: ActionContext): VisibleItem[] {
  const { unit: _unit, state, context } = ctx;
  if (context.itemGrid) {
    return context.itemGrid.queryByKeys(state.visibleCells || []);
  }

  const lootItems: VisibleItem[] = (state.loot || []).map((l) => ({
    id: l.id,
    pos: l.pos,
    mustBeInLOS: true,
    type: "loot" as const,
  }));

  const objectiveItems: VisibleItem[] = (state.objectives || [])
    .filter((o) => o.state === "Pending" && (o.kind === "Recover" || o.kind === "Escort" || o.kind === "Kill"))
    .map((o): VisibleItem | null => {
      const pos = MapUtils.resolveObjectivePosition(o, state.enemies);
      if (!pos) return null;
      return { id: o.id, pos, mustBeInLOS: o.kind === "Recover", visible: o.visible, type: "objective" };
    })
    .filter((o): o is VisibleItem => o !== null);

  return ([...lootItems, ...objectiveItems] as VisibleItem[]).filter((item) => {
    if ("visible" in item && item.visible) return true;
    const cell = MathUtils.toCellCoord(item.pos);
    return isCellVisible(state, cell.x, cell.y);
  });
}

function handleLootCollection(ctx: ActionContext): boolean {
  const { unit, state, context } = ctx;

  const visibleItemsFromGrid = getVisibleItemsFromGrid(ctx);

  const visibleLoot = visibleItemsFromGrid.filter((item) => {
    if (item.type !== "loot") return false;
    const claimer = context.claimedObjectives.get(item.id);
    return !claimer || claimer === unit.id;
  });
  const visibleObjectives = visibleItemsFromGrid.filter((item) => {
    if (item.type !== "objective") return false;
    const claimer = context.claimedObjectives.get(item.id);
    return !claimer || claimer === unit.id;
  });

  if (visibleLoot.length === 0 && visibleObjectives.length === 0) return false;

  const targetedIds = state.units
    .filter((u) => u.id !== unit.id && u.activeCommand?.type === CommandType.PICKUP)
    .map((u) => (u.activeCommand as PickupCommand).lootId);

  const availableLoot = visibleLoot.filter((l) => {
    if (targetedIds.includes(l.id)) return false;
    const assignedUnitId = context.itemAssignments.get(l.id);
    return !assignedUnitId || assignedUnitId === unit.id;
  });
  const availableObjectives = visibleObjectives.filter((o) => {
    if (targetedIds.includes(o.id)) return false;
    const assignedUnitId = context.itemAssignments.get(o.id);
    return !assignedUnitId || assignedUnitId === unit.id;
  });

  const items = [
    ...availableLoot.map((l) => ({ id: l.id, pos: l.pos, type: "loot" as const })),
    ...availableObjectives.map((o) => ({ id: o.id, pos: o.pos, type: "objective" as const })),
  ];

  if (items.length === 0) return false;

  const closest = items.sort(
    (a, b) =>
      MathUtils.getDistance(unit.pos, a.pos) - MathUtils.getDistance(unit.pos, b.pos),
  )[0];

  if (closest.type === "objective") {
    context.claimedObjectives.set(closest.id, unit.id);
  }

  const label = closest.type === "objective" ? "Recovering" : "Picking up";

  const isAlreadyTargeting =
    unit.activeCommand?.type === CommandType.PICKUP &&
    (unit.activeCommand).lootId === closest.id;

  if (!isAlreadyTargeting) {
    Logger.debug(`ObjectiveBehavior: unit ${unit.id} picking up ${closest.id} (${label})`);
    const updated = issuePickup({ ...ctx, unit }, closest.id, label);
    ctx.unit = updated;
    if (updated.state === UnitState.Moving && label === "Recovering") {
      setActivePlanIfMoving(updated, closest.pos, label, state);
    }
  } else if (label === "Recovering") {
    refreshPlan(ctx.unit, state);
  }

  return true;
}

function handleObjectivePursuit(ctx: ActionContext): boolean {
  const { unit, state, context } = ctx;
  if (!state.objectives) return false;

  const pendingObjectives = state.objectives.filter((o) => {
    const assignedUnitId = context.itemAssignments.get(o.id);
    const claimer = context.claimedObjectives.get(o.id);
    if (o.state !== "Pending") return false;
    if (claimer && claimer !== unit.id) return false;
    if (!o.visible) return false;
    if (assignedUnitId && assignedUnitId !== unit.id) return false;
    return true;
  });

  if (pendingObjectives.length === 0) return false;

  let bestObj: { obj: Objective; dist: number; targetPos: Vector2 } | null = null;

  for (const obj of pendingObjectives) {
    const targetPos = MapUtils.resolveObjectivePosition(obj, state.enemies);
    if (!targetPos) continue;

    if (obj.kind === "Kill" && obj.targetEnemyId) {
      const enemyCell = MathUtils.toCellCoord(targetPos);
      if (!isCellVisible(state, enemyCell.x, enemyCell.y)) continue;
    }

    const dist = MathUtils.getDistance(unit.pos, targetPos);
    if (!bestObj || dist < bestObj.dist) {
      bestObj = { obj, dist, targetPos };
    }
  }

  if (!bestObj) return false;

  context.claimedObjectives.set(bestObj.obj.id, unit.id);
  const target = MathUtils.toCellCoord(bestObj.targetPos);

  if (MathUtils.sameCellPosition(unit.pos, target)) {
    if (bestObj.obj.kind !== "Recover") return false;
    return handleObjectivePickupAtTarget(ctx, bestObj.obj);
  }

  return handleObjectiveMoveToTarget(ctx, bestObj.obj, target);
}

function handleObjectiveMoveToTarget(
  ctx: ActionContext,
  obj: Objective,
  target: Vector2,
): boolean {
  const { unit, state } = ctx;

  const label =
    obj.kind === "Recover" ? "Recovering" :
    obj.kind === "Escort" ? "Escorting" : "Hunting";

  const isAlreadyMovingToTarget =
    unit.state === UnitState.Moving &&
    unit.targetPos &&
    MathUtils.sameCellPosition(unit.targetPos, target);

  if (!isAlreadyMovingToTarget) {
    Logger.debug(`ObjectiveBehavior: unit ${unit.id} moving to ${target.x},${target.y} (${label})`);
    const updated = issueMoveTo(ctx, target, label);
    ctx.unit = updated;
    if (label === "Recovering" || label === "Hunting") {
      setActivePlanIfMoving(updated, { x: target.x + 0.5, y: target.y + 0.5 }, label, state);
    }
  } else if (label === "Recovering" || label === "Hunting") {
    refreshPlan(ctx.unit, state);
  }

  return true;
}

function handleObjectivePickupAtTarget(ctx: ActionContext, obj: Objective): boolean {
  const { unit, state } = ctx;

  const isAlreadyRecovering =
    unit.activeCommand?.type === CommandType.PICKUP &&
    (unit.activeCommand).lootId === obj.id;

  if (!isAlreadyRecovering) {
    Logger.debug(`ObjectiveBehavior: unit ${unit.id} at target, picking up ${obj.id}`);
    const updated = issuePickup(ctx, obj.id, "Recovering");
    ctx.unit = updated;
    if (updated.state === UnitState.Moving || updated.state === UnitState.Channeling) {
      updated.activePlan = {
        behavior: "Recovering",
        goal: updated.pos,
        committedUntil: state.t + 1000,
        priority: 3,
      };
    }
  } else {
    refreshPlan(ctx.unit, state);
  }

  return true;
}

function handleExtraction(ctx: ActionContext): boolean {
  const { unit, state, context } = ctx;

  const objectivesComplete =
    state.objectives && state.objectives.length > 0 &&
    state.objectives.every((o) => o.state !== "Pending");
  const isMapFullyDiscovered = state.discoveredCells.length >= context.totalFloorCells;

  if (!objectivesComplete && !isMapFullyDiscovered) return false;
  if (!state.map.extraction) return false;

  const ext = state.map.extraction;
  if (!isCellDiscovered(state, ext.x, ext.y)) return false;

  if (
    unit.activeCommand?.type === CommandType.EXTRACT &&
    MathUtils.sameCellPosition(unit.pos, ext)
  ) {
    return true;
  }

  const shouldAutoExtract = isMapFullyDiscovered || objectivesComplete;
  if (!shouldAutoExtract && unit.aiEnabled) return false;

  const updated = { ...unit, explorationTarget: undefined };
  Logger.debug(`ObjectiveBehavior: unit ${unit.id} extracting`);
  const finalUnit = context.executeCommand({
    unit: updated,
    cmd: {
      type: CommandType.EXTRACT,
      unitIds: [unit.id],
      label: "Extracting",
    },
    state,
    isManual: false,
    director: ctx.director,
  });
  ctx.unit = finalUnit;
  return true;
}

export class ObjectiveBehavior implements Behavior<ObjContext> {
  public evaluate({
    unit,
    state,
    context,
    director,
  }: BehaviorEvalParams<ObjContext>): BehaviorResult {
    const currentUnit = { ...unit };
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

    if (state.missionType === MissionType.Prologue) {
      return { unit: currentUnit, handled: false };
    }

    // Use a mutable ctx object so sub-functions can update unit
    const ctx: ActionContext = { unit: currentUnit, state, context, director };

    if (handleLootCollection(ctx)) {
      return { unit: ctx.unit, handled: true };
    }

    if (handleObjectivePursuit(ctx)) {
      return { unit: ctx.unit, handled: true };
    }

    if (handleExtraction(ctx)) {
      return { unit: ctx.unit, handled: true };
    }

    return { unit: ctx.unit, handled: false };
  }
}
