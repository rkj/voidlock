import {
  UnitState,
  CommandType,
  MissionType
} from "../../../shared/types";
import type { Unit, GameState } from "../../../shared/types";
import type { BehaviorContext } from "../../interfaces/AIContext";
import { MathUtils } from "../../../shared/utils/MathUtils";
import type { Behavior, BehaviorEvalParams, BehaviorResult } from "./Behavior";
import { SPEED_NORMALIZATION_CONST, ITEMS } from "../../config/GameConstants";
import { Logger } from "../../../shared/Logger";

function calcChannelDuration(unit: Unit, baseTime: number): number {
  return baseTime * (SPEED_NORMALIZATION_CONST / unit.stats.speed);
}

function startChanneling(
  unit: Unit,
  action: "Pickup" | "Collect" | "Extract",
  duration: number,
  targetId?: string,
): Unit {
  return {
    ...unit,
    state: UnitState.Channeling,
    channeling: {
      action,
      remaining: duration,
      totalDuration: duration,
      targetId,
    },
    path: undefined,
    targetPos: undefined,
    activeCommand: undefined,
  };
}

function handleLootInteraction(unit: Unit, state: GameState): BehaviorResult | null {
  if (!state.loot) return null;

  const loot = state.loot.find(
    (l) =>
      Math.abs(unit.pos.x - l.pos.x) < ITEMS.INTERACTION_RADIUS &&
      Math.abs(unit.pos.y - l.pos.y) < ITEMS.INTERACTION_RADIUS,
  );

  if (
    !loot ||
    unit.activeCommand?.type !== CommandType.PICKUP ||
    (unit.activeCommand).lootId !== loot.id
  ) {
    return null;
  }

  const duration = calcChannelDuration(unit, ITEMS.BASE_PICKUP_TIME);
  const updated = startChanneling(unit, "Pickup", duration, loot.id);
  return { unit: updated, handled: true };
}

function isUnitAtObjectiveTarget(unit: Unit, obj: { targetCell?: { x: number; y: number } }): boolean {
  return !!(
    obj.targetCell &&
    Math.abs(unit.pos.x - (obj.targetCell.x + 0.5)) < ITEMS.INTERACTION_RADIUS &&
    Math.abs(unit.pos.y - (obj.targetCell.y + 0.5)) < ITEMS.INTERACTION_RADIUS
  );
}

function isObjectiveClaimable(
  unit: Unit,
  objId: string,
  hasExplicitPickup: boolean,
  context: BehaviorContext,
): boolean {
  const isClaimedByMe = hasExplicitPickup || context.claimedObjectives?.get(objId) === unit.id;
  return !context.claimedObjectives || !context.claimedObjectives.has(objId) || isClaimedByMe;
}

function handleObjectiveInteraction(
  unit: Unit,
  state: GameState,
  context: BehaviorContext,
): BehaviorResult | null {
  if (unit.archetypeId === "vip" || unit.carriedObjectiveId || !state.objectives) return null;

  for (const obj of state.objectives) {
    if (obj.state !== "Pending") continue;

    const hasExplicitPickup =
      unit.activeCommand?.type === CommandType.PICKUP &&
      (unit.activeCommand).lootId === obj.id;

    if (state.missionType === MissionType.Prologue && !hasExplicitPickup) continue;

    const isAtTarget = isUnitAtObjectiveTarget(unit, obj);
    const isUnclaimedOrMine = isObjectiveClaimable(unit, obj.id, hasExplicitPickup, context);

    if (!isAtTarget || !isUnclaimedOrMine) continue;

    Logger.info(`InteractionBehavior: Unit ${unit.id} at target for objective ${obj.id}. Starting Pickup/Collect.`);

    const needsCarrying = obj.id.includes("artifact") || obj.id.includes("prologue-disk");
    const baseTime = needsCarrying ? ITEMS.BASE_PICKUP_TIME : ITEMS.BASE_COLLECT_TIME;
    const duration = calcChannelDuration(unit, baseTime);
    const updated = startChanneling(unit, needsCarrying ? "Pickup" : "Collect", duration, obj.id);

    if (context.claimedObjectives) {
      context.claimedObjectives.set(obj.id, updated.id);
    }
    return { unit: updated, handled: true };
  }

  return null;
}

function handleExtractionInteraction(
  unit: Unit,
  state: GameState,
  context: BehaviorContext,
): BehaviorResult | null {
  if (!state.map.extraction) return null;

  const ext = state.map.extraction;
  const allObjectivesReady = state.objectives
    .filter((o) => o.kind !== "Escort")
    .every((o) => {
      if (o.state === "Completed") return true;
      if (o.kind === "Recover") return state.units.some((u) => u.carriedObjectiveId === o.id);
      return false;
    });

  const isAtExtraction = MathUtils.sameCellPosition(unit.pos, ext);
  const isVipAtExtraction = unit.archetypeId === "vip" && isAtExtraction;
  const isExplicitExtract =
    unit.activeCommand?.type === CommandType.EXTRACT ||
    unit.activeCommand?.label === "Extracting";
  const isLowHP = unit.hp < unit.maxHp * 0.25;
  const isMapFullyDiscovered = state.discoveredCells.length >= context.totalFloorCells;

  const shouldExtract =
    isAtExtraction &&
    ((allObjectivesReady && (isMapFullyDiscovered || !unit.aiEnabled)) ||
     isVipAtExtraction || isExplicitExtract || isLowHP);

  if (!shouldExtract) return null;

  const duration = calcChannelDuration(unit, ITEMS.BASE_EXTRACT_TIME);
  const updated = startChanneling(unit, "Extract", duration);
  return { unit: updated, handled: true };
}

export class InteractionBehavior implements Behavior<BehaviorContext> {
  constructor() {}

  public evaluate({
    unit,
    state,
    context,
    director,
  }: BehaviorEvalParams<BehaviorContext>): BehaviorResult {
    let currentUnit = { ...unit };
    if (currentUnit.state !== UnitState.Idle && currentUnit.state !== UnitState.Attacking) {
      return { unit: currentUnit, handled: false };
    }

    const lootResult = handleLootInteraction(currentUnit, state);
    if (lootResult) return lootResult;

    const objResult = handleObjectiveInteraction(currentUnit, state, context);
    if (objResult) return objResult;

    const extResult = handleExtractionInteraction(currentUnit, state, context);
    if (extResult) return extResult;

    if (currentUnit.activeCommand?.type === CommandType.USE_ITEM) {
      currentUnit = context.executeCommand({
        unit: currentUnit,
        cmd: currentUnit.activeCommand,
        state,
        isManual: true,
        director,
      });
      return { unit: currentUnit, handled: true };
    }

    return { unit: currentUnit, handled: false };
  }
}
