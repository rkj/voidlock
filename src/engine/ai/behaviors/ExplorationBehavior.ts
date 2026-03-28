import {
  UnitState,
  CommandType
} from "../../../shared/types";
import type { Unit, GameState, Door, Vector2 } from "../../../shared/types";
import type { BehaviorContext, ExplorationContext } from "../../interfaces/AIContext";
import type { Behavior, BehaviorEvalParams, BehaviorResult } from "./Behavior";
import type { IDirector } from "../../interfaces/IDirector";
import {
  isMapFullyDiscovered,
  findClosestUndiscoveredCell,
} from "./BehaviorUtils";
import type { GameGrid } from "../../GameGrid";
import { isCellDiscovered } from "../../../shared/VisibilityUtils";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { Logger } from "../../../shared/Logger";

type ExplContext = BehaviorContext & ExplorationContext;

interface ExploreParams {
  currentUnit: Unit;
  state: GameState;
  context: ExplContext;
  director: IDirector | undefined;
}

interface IssueMoveParams {
  unit: Unit;
  targetCell: Vector2;
  state: GameState;
  context: ExplContext;
  director: IDirector | undefined;
}

function issueExploreMove({
  unit,
  targetCell,
  state,
  context,
  director,
}: IssueMoveParams): Unit {
  context.explorationClaims.set(unit.id, { x: targetCell.x, y: targetCell.y });
  const updated = context.executeCommand({
    unit,
    cmd: {
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: targetCell,
      label: "Exploring",
    },
    state,
    isManual: false,
    director,
  });
  if (updated.state === UnitState.Moving) {
    updated.activePlan = {
      behavior: "Exploring",
      goal: { x: targetCell.x + 0.5, y: targetCell.y + 0.5 },
      committedUntil: state.t + 1000,
      priority: 4,
    };
  }
  return updated;
}

function shouldSwitchToNewTarget(
  unit: Unit,
  newTarget: Vector2,
): boolean {
  if (!unit.explorationTarget) return true;
  const oldDist = MathUtils.getDistance(unit.pos, {
    x: unit.explorationTarget.x + 0.5,
    y: unit.explorationTarget.y + 0.5,
  });
  const newDist = MathUtils.getDistance(unit.pos, {
    x: newTarget.x + 0.5,
    y: newTarget.y + 0.5,
  });
  return newDist < oldDist * 0.7 || unit.state === UnitState.Idle;
}

function handleDifferentTarget(
  params: ExploreParams,
  newTarget: Vector2,
  targetCell: Vector2,
): BehaviorResult | null {
  const { currentUnit, state, context, director } = params;

  const switchTarget = shouldSwitchToNewTarget(currentUnit, newTarget);

  if (switchTarget) {
    Logger.debug(
      `ExplorationBehavior: unit ${currentUnit.id} switching target to ${newTarget.x},${newTarget.y}`,
    );
    let unit: Unit = { ...currentUnit, explorationTarget: newTarget };
    unit = issueExploreMove({ unit, targetCell, state, context, director });
    return { unit, handled: true };
  }

  if (currentUnit.activePlan) {
    const plan = currentUnit.activePlan;
    const unit: Unit = { ...currentUnit, activePlan: { ...plan, committedUntil: state.t + 1000 } };
    return { unit, handled: true };
  }

  return null;
}

function handleSameTargetIdle(
  params: ExploreParams,
): BehaviorResult | null {
  const { currentUnit, state, context, director } = params;
  if (currentUnit.state !== UnitState.Idle || !currentUnit.explorationTarget) return null;

  const explTarget = currentUnit.explorationTarget;
  Logger.debug(
    `ExplorationBehavior: unit ${currentUnit.id} same target but idle, re-executing move`,
  );
  context.explorationClaims.set(currentUnit.id, explTarget);
  const unit = issueExploreMove({ unit: currentUnit, targetCell: explTarget, state, context, director });
  return { unit, handled: true };
}

function handleTargetReevaluation(
  params: ExploreParams,
  doors: Map<string, Door>,
  gameGrid: GameGrid,
): BehaviorResult | null {
  const { currentUnit, state, context, director } = params;

  const targetCell = findClosestUndiscoveredCell({
    unit: currentUnit,
    state,
    _gridState: context.gridState,
    doors,
    gameGrid,
    explorationClaims: context.explorationClaims,
  });

  if (!targetCell) {
    Logger.debug(`ExplorationBehavior: unit ${currentUnit.id} no target found`);
    return null;
  }

  Logger.debug(
    `ExplorationBehavior: unit ${currentUnit.id} found new target ${targetCell.x},${targetCell.y}`,
  );
  const newTarget = { x: targetCell.x, y: targetCell.y };
  const isDifferent =
    currentUnit.explorationTarget?.x !== newTarget.x ||
    currentUnit.explorationTarget?.y !== newTarget.y;

  if (isDifferent) {
    return handleDifferentTarget(
      { ...params, currentUnit },
      newTarget,
      targetCell,
    );
  }

  const idleResult = handleSameTargetIdle({ ...params, director });
  if (idleResult) return idleResult;

  if (currentUnit.activePlan) {
    const plan = currentUnit.activePlan;
    const unit: Unit = { ...currentUnit, activePlan: { ...plan, committedUntil: state.t + 1000 } };
    return { unit, handled: true };
  }

  return null;
}

function shouldReevaluateTarget(
  unit: Unit,
  state: GameState,
  dt: number,
): { reevaluate: boolean; unit: Unit } {
  if (!unit.explorationTarget) return { reevaluate: true, unit };

  if (
    isCellDiscovered(
      state,
      Math.floor(unit.explorationTarget.x),
      Math.floor(unit.explorationTarget.y),
    )
  ) {
    Logger.debug(
      `ExplorationBehavior: target ${unit.explorationTarget.x},${unit.explorationTarget.y} discovered, clearing`,
    );
    return { reevaluate: true, unit: { ...unit, explorationTarget: undefined } };
  }

  const checkInterval = 1000;
  const lastCheck = Math.floor((state.t - dt) / checkInterval);
  const currentCheck = Math.floor(state.t / checkInterval);
  if (
    currentCheck > lastCheck ||
    unit.state === UnitState.Idle ||
    unit.activePlan?.behavior === "Exploring"
  ) {
    Logger.debug(
      `ExplorationBehavior: reevaluating target due to timer, idle, or expired plan (state=${unit.state})`,
    );
    return { reevaluate: true, unit };
  }

  return { reevaluate: false, unit };
}

export class ExplorationBehavior implements Behavior<ExplContext> {
  constructor(private gameGrid: GameGrid) {}

  public evaluate({
    unit,
    state,
    dt,
    doors,
    context,
    director,
  }: BehaviorEvalParams<ExplContext>): BehaviorResult {
    let currentUnit = { ...unit };
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

    if (isMapFullyDiscovered(state, context.totalFloorCells, this.gameGrid)) {
      return { unit: currentUnit, handled: false };
    }

    const { reevaluate, unit: updatedUnit } = shouldReevaluateTarget(currentUnit, state, dt);
    currentUnit = updatedUnit;

    if (!reevaluate) {
      return { unit: currentUnit, handled: false };
    }

    const result = handleTargetReevaluation(
      { currentUnit, state, context, director },
      doors,
      this.gameGrid,
    );

    return result ?? { unit: currentUnit, handled: false };
  }
}
