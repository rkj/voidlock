import {
  UnitState,
  CommandType
} from "../../../shared/types";
import type { Unit, GameState, Door, Enemy } from "../../../shared/types";
import type { BehaviorContext } from "../../interfaces/AIContext";
import type { Behavior, BehaviorEvalParams, BehaviorResult } from "./Behavior";
import type { GameGrid } from "../../GameGrid";
import type { ItemEffectHandler } from "../../interfaces/IDirector";
import { isCellVisible } from "../../../shared/VisibilityUtils";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { calculateTravelTimeMs } from "./BehaviorUtils";

interface ProfileHandlerParams {
  currentUnit: Unit;
  state: GameState;
  doors: Map<string, Door>;
  director: ItemEffectHandler | undefined;
  primaryThreat: Enemy;
  dist: number;
  context: BehaviorContext;
  gameGrid: GameGrid;
}

function moveTowardsTargetCell(
  params: ProfileHandlerParams,
  targetCell: { x: number; y: number },
  label: string,
): BehaviorResult {
  const { context, state, director } = params;
  let unit = params.currentUnit;

  if (
    unit.state !== UnitState.Moving ||
    !unit.targetPos ||
    !MathUtils.sameCellPosition(unit.targetPos, targetCell)
  ) {
    unit = context.executeCommand({
      unit,
      cmd: {
        type: CommandType.MOVE_TO,
        unitIds: [unit.id],
        target: targetCell,
        label,
      },
      state,
      isManual: false,
      director,
    });

    if (unit.state === UnitState.Moving) {
      const goalPos = { x: targetCell.x + 0.5, y: targetCell.y + 0.5 };
      const distToGoal = MathUtils.getDistance(unit.pos, goalPos);
      const travelTimeMs = calculateTravelTimeMs(unit, distToGoal);
      unit.activePlan = {
        behavior: label,
        goal: goalPos,
        committedUntil: state.t + Math.max(500, travelTimeMs),
        priority: 2,
      };
    }
    return { unit, handled: true };
  }

  if (unit.activePlan) {
    const goalPos = { x: targetCell.x + 0.5, y: targetCell.y + 0.5 };
    const distToGoal = MathUtils.getDistance(unit.pos, goalPos);
    const travelTimeMs = calculateTravelTimeMs(unit, distToGoal);
    unit.activePlan = {
      ...unit.activePlan,
      committedUntil: state.t + Math.max(500, travelTimeMs),
    };
    return { unit, handled: true };
  }

  return { unit, handled: false };
}

function handleRushProfile(params: ProfileHandlerParams): BehaviorResult | null {
  const { primaryThreat, dist } = params;
  if (dist <= 1.5) return null;

  const targetCell = {
    x: Math.floor(primaryThreat.pos.x),
    y: Math.floor(primaryThreat.pos.y),
  };
  return moveTowardsTargetCell(params, targetCell, "Rushing");
}

function handleRetreatProfile(params: ProfileHandlerParams): BehaviorResult | null {
  const { currentUnit, primaryThreat, dist, doors, gameGrid } = params;
  if (currentUnit.engagementPolicy === "AVOID") return null;
  if (dist >= currentUnit.stats.attackRange * 0.8) return null;

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
      gameGrid.isWalkable(n.x, n.y) &&
      gameGrid.canMove({
        fromX: currentCell.x,
        fromY: currentCell.y,
        toX: n.x,
        toY: n.y,
        doors,
        allowClosedDoors: false,
      }),
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

  if (!bestRetreat || bestRetreat.dist <= dist) return null;

  const targetCell = { x: bestRetreat.x, y: bestRetreat.y };
  return moveTowardsTargetCell(params, targetCell, "Retreating");
}

function handleDefaultEngageProfile(params: ProfileHandlerParams): BehaviorResult | null {
  const { currentUnit, primaryThreat, dist } = params;
  if (dist <= currentUnit.stats.attackRange) return null;

  const targetCell = {
    x: Math.floor(primaryThreat.pos.x),
    y: Math.floor(primaryThreat.pos.y),
  };
  return moveTowardsTargetCell(params, targetCell, "Engaging");
}

export class CombatBehavior implements Behavior<BehaviorContext> {
  constructor(private gameGrid: GameGrid) {}

  public evaluate({
    unit,
    state,
    doors,
    context,
    director,
  }: BehaviorEvalParams<BehaviorContext>): BehaviorResult {
    const currentUnit = { ...unit };
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

    if (threats.length === 0 || currentUnit.engagementPolicy === "IGNORE") {
      return { unit: currentUnit, handled: false };
    }

    const primaryThreat = threats[0].enemy;
    const dist = threats[0].distance;

    if (currentUnit.aiProfile === "STAND_GROUND") {
      return { unit: currentUnit, handled: false };
    }

    const handlerParams: ProfileHandlerParams = {
      currentUnit,
      state,
      doors,
      director,
      primaryThreat,
      dist,
      context,
      gameGrid: this.gameGrid,
    };

    let result: BehaviorResult | null = null;

    if (currentUnit.aiProfile === "RUSH") {
      result = handleRushProfile(handlerParams);
    } else if (currentUnit.aiProfile === "RETREAT") {
      result = handleRetreatProfile(handlerParams);
    } else {
      result = handleDefaultEngageProfile(handlerParams);
    }

    if (result) {
      return result;
    }

    return { unit: currentUnit, handled: false };
  }
}
