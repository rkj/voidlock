import type {
  Vector2,
  Unit,
  GameState,
  Door} from "../../../shared/types";
import {
  UnitState,
  CommandType
} from "../../../shared/types";
import type { BehaviorContext } from "../../interfaces/AIContext";
import type { Behavior, BehaviorEvalParams, BehaviorResult } from "./Behavior";
import type { ItemEffectHandler } from "../../interfaces/IDirector";
import { isCellVisible, isCellDiscovered } from "../../../shared/VisibilityUtils";
import { MathUtils } from "../../../shared/utils/MathUtils";
import type { LineOfSight } from "../../LineOfSight";
import type { GameGrid } from "../../GameGrid";
import { Logger } from "../../../shared/Logger";
import { calculateTravelTimeMs } from "./BehaviorUtils";

interface ThreatEntry {
  enemy: { pos: Vector2; hp: number };
  distance: number;
}

interface SafetyActionParams {
  unit: Unit;
  state: GameState;
  doors: Map<string, Door>;
  context: BehaviorContext;
  director: ItemEffectHandler | undefined;
  threats: ThreatEntry[];
  gameGrid: GameGrid;
  los: LineOfSight;
}

interface IssueMoveCommandParams {
  unit: Unit;
  target: Vector2;
  label: string;
  state: GameState;
  context: BehaviorContext;
  director: ItemEffectHandler | undefined;
}

function issueMoveCommand({ unit, target, label, state, context, director }: IssueMoveCommandParams): Unit {
  return context.executeCommand({
    unit,
    cmd: { type: CommandType.MOVE_TO, unitIds: [unit.id], target, label },
    state,
    isManual: false,
    director,
  });
}

interface SetMovingPlanParams {
  unit: Unit;
  goal: Vector2;
  behavior: string;
  dist: number;
  state: GameState;
}

function setMovingPlan({ unit, goal, behavior, dist, state }: SetMovingPlanParams): void {
  if (unit.state === UnitState.Moving) {
    const travelTimeMs = calculateTravelTimeMs(unit, dist);
    unit.activePlan = {
      behavior,
      goal,
      committedUntil: state.t + Math.max(500, travelTimeMs),
      priority: 0,
    };
  }
}

function refreshPlanCommitment(unit: Unit, dist: number, state: GameState): void {
  if (unit.activePlan) {
    const travelTimeMs = calculateTravelTimeMs(unit, dist);
    unit.activePlan = { ...unit.activePlan, committedUntil: state.t + Math.max(500, travelTimeMs) };
  }
}

function collectSafeCells(_unit: Unit, state: GameState, threats: ThreatEntry[]): Vector2[] {
  const safeCells: Vector2[] = [];
  const width = state.map.width;
  const isThreatened = (cx: number, cy: number) =>
    threats.some((t) => MathUtils.sameCellPosition(t.enemy.pos, { x: cx, y: cy }));

  if (state.gridState) {
    for (let i = 0; i < state.gridState.length; i++) {
      if (!(state.gridState[i] & 2)) continue;
      const cx = i % width;
      const cy = Math.floor(i / width);
      if (!isThreatened(cx, cy)) safeCells.push({ x: cx, y: cy });
    }
    return safeCells;
  }

  for (const cellKey of state.discoveredCells) {
    const [cx, cy] = cellKey.split(",").map(Number);
    if (!isThreatened(cx, cy)) safeCells.push({ x: cx, y: cy });
  }
  return safeCells;
}

function handleRetreat(params: SafetyActionParams): BehaviorResult | null {
  const { unit, state, context, director, threats } = params;
  const safeCells = collectSafeCells(unit, state, threats);
  if (safeCells.length === 0) return null;

  const filteredSafe = safeCells.filter(
    (cell) => !unit.positionHistory.some((h) => h.x === cell.x && h.y === cell.y),
  );
  const candidates = filteredSafe.length > 0 ? filteredSafe : safeCells;
  const closestSafe = candidates
    .map((cell) => ({
      ...cell,
      dist: MathUtils.getDistance(unit.pos, { x: cell.x + 0.5, y: cell.y + 0.5 }),
    }))
    .sort((a, b) => a.dist - b.dist)[0];

  const isSameTarget =
    unit.state === UnitState.Moving &&
    unit.targetPos &&
    MathUtils.sameCellPosition(unit.targetPos, closestSafe);

  if (!isSameTarget) {
    let updated: Unit = { ...unit, engagementPolicy: "IGNORE" as const, engagementPolicySource: "Autonomous" as const };
    updated = issueMoveCommand({ unit: updated, target: { x: closestSafe.x, y: closestSafe.y }, label: "Retreating", state, context, director });
    setMovingPlan({ unit: updated, goal: { x: closestSafe.x + 0.5, y: closestSafe.y + 0.5 }, behavior: "Retreating", dist: closestSafe.dist, state });
    return { unit: updated, handled: updated.state === UnitState.Moving };
  }

  refreshPlanCommitment(unit, closestSafe.dist, state);
  if (unit.activePlan) return { unit, handled: true };
  return { unit, handled: unit.state === UnitState.Moving };
}

interface CollectAvoidWaypointsParams {
  unit: Unit;
  state: GameState;
  threats: ThreatEntry[];
  primaryThreat: { pos: Vector2 };
  gameGrid: GameGrid;
  los: LineOfSight;
  N: number;
}

function collectAvoidWaypoints({
  unit,
  state,
  threats,
  primaryThreat,
  gameGrid,
  los,
  N,
}: CollectAvoidWaypointsParams): { x: number; y: number; distToUnit: number; hasLOS: boolean }[] {
  const width = state.map.width;
  const waypoints: { x: number; y: number; distToUnit: number; hasLOS: boolean }[] = [];

  const addWaypoint = (cx: number, cy: number) => {
    if (!gameGrid.isWalkable(cx, cy)) return;
    const cellPos = { x: cx + 0.5, y: cy + 0.5 };
    const isFarEnough = threats.every((t) => MathUtils.getDistance(cellPos, t.enemy.pos) >= N);
    if (!isFarEnough) return;
    waypoints.push({ x: cx, y: cy, distToUnit: MathUtils.getDistance(unit.pos, cellPos), hasLOS: los.hasLineOfSight(cellPos, primaryThreat.pos) });
  };

  if (state.gridState) {
    for (let i = 0; i < state.gridState.length; i++) {
      if (!(state.gridState[i] & 2)) continue;
      addWaypoint(i % width, Math.floor(i / width));
    }
    return waypoints;
  }

  for (const key of state.discoveredCells) {
    const [cx, cy] = key.split(",").map(Number);
    addWaypoint(cx, cy);
  }
  return waypoints;
}

interface HandleKiteWithWaypointParams {
  unit: Unit;
  waypoint: { x: number; y: number };
  state: GameState;
  context: BehaviorContext;
  director: ItemEffectHandler | undefined;
}

function handleKiteWithWaypoint({ unit, waypoint, state, context, director }: HandleKiteWithWaypointParams): BehaviorResult {
  const isSameTarget =
    unit.state === UnitState.Moving &&
    unit.targetPos &&
    MathUtils.sameCellPosition(unit.targetPos, waypoint);

  if (!isSameTarget) {
    const updated = issueMoveCommand({ unit, target: waypoint, label: "Kiting", state, context, director });
    const goalPos = { x: waypoint.x + 0.5, y: waypoint.y + 0.5 };
    const dist = MathUtils.getDistance(unit.pos, goalPos);
    setMovingPlan({ unit: updated, goal: goalPos, behavior: "Kiting", dist, state });
    return { unit: updated, handled: true };
  }

  const goalPos = { x: waypoint.x + 0.5, y: waypoint.y + 0.5 };
  refreshPlanCommitment(unit, MathUtils.getDistance(unit.pos, goalPos), state);
  return { unit, handled: true };
}

interface GetKiteNeighborCandidatesParams {
  unit: Unit;
  state: GameState;
  doors: Map<string, Door>;
  primaryThreat: { pos: Vector2 };
  currentDist: number;
  gameGrid: GameGrid;
  los: LineOfSight;
}

function getKiteNeighborCandidates({
  unit,
  state,
  doors,
  primaryThreat,
  currentDist,
  gameGrid,
  los,
}: GetKiteNeighborCandidatesParams): { pos: { x: number; y: number }; hasLOS: boolean; newDist: number }[] {
  const currentCell = MathUtils.toCellCoord(unit.pos);
  const neighborOffsets = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
  ];

  const neighbors = neighborOffsets
    .map((o) => ({ x: currentCell.x + o.dx, y: currentCell.y + o.dy }))
    .filter((n) =>
      n.x >= 0 && n.x < state.map.width && n.y >= 0 && n.y < state.map.height &&
      isCellDiscovered(state, n.x, n.y) &&
      gameGrid.isWalkable(n.x, n.y) &&
      gameGrid.canMove({ fromX: currentCell.x, fromY: currentCell.y, toX: n.x, toY: n.y, doors, allowClosedDoors: false }),
    );

  const scored = neighbors.map((n) => {
    const pos = { x: n.x + 0.5, y: n.y + 0.5 };
    return { pos: n, hasLOS: los.hasLineOfSight(pos, primaryThreat.pos), newDist: MathUtils.getDistance(pos, primaryThreat.pos) };
  });

  const better = scored.filter((c) => c.newDist > currentDist);
  const filtered = better.filter(
    (c) => !unit.positionHistory.some((h) => h.x === c.pos.x && h.y === c.pos.y),
  );
  return filtered.length > 0 ? filtered : better;
}

function handleKite(params: SafetyActionParams): BehaviorResult | null {
  const { unit, state, doors, context, director, threats, gameGrid, los } = params;
  const primaryThreat = threats[0].enemy;
  const N = 5;

  const candidateWaypoints = collectAvoidWaypoints({ unit, state, threats, primaryThreat, gameGrid, los, N });

  if (candidateWaypoints.length > 0) {
    const filtered = candidateWaypoints.filter(
      (c) => !unit.positionHistory.some((h) => h.x === c.x && h.y === c.y),
    );
    const candidates = filtered.length > 0 ? filtered : candidateWaypoints;
    const sorted = candidates.sort((a, b) => {
      if (a.hasLOS && !b.hasLOS) return -1;
      if (!a.hasLOS && b.hasLOS) return 1;
      return a.distToUnit - b.distToUnit;
    });
    return handleKiteWithWaypoint({ unit, waypoint: { x: sorted[0].x, y: sorted[0].y }, state, context, director });
  }

  const dist = threats[0].distance;
  const finalCandidates = getKiteNeighborCandidates({ unit, state, doors, primaryThreat, currentDist: dist, gameGrid, los });
  const best = finalCandidates.sort((a, b) => {
    if (a.hasLOS && !b.hasLOS) return -1;
    if (!a.hasLOS && b.hasLOS) return 1;
    return b.newDist - a.newDist;
  })[0];

  if (!best || (!best.hasLOS && finalCandidates.some((c) => c.hasLOS))) return null;
  return handleKiteWithWaypoint({ unit, waypoint: best.pos, state, context, director });
}

function handleGroupUp(params: SafetyActionParams): BehaviorResult | null {
  const { unit, state, context, director } = params;

  const otherUnits = state.units.filter(
    (u) =>
      u.id !== unit.id &&
      u.hp > 0 &&
      u.state !== UnitState.Extracted &&
      u.state !== UnitState.Dead,
  );

  if (otherUnits.length === 0) return null;

  const closestAlly = otherUnits.sort(
    (a, b) => MathUtils.getDistance(unit.pos, a.pos) - MathUtils.getDistance(unit.pos, b.pos),
  )[0];

  const isSameTarget =
    unit.state === UnitState.Moving &&
    unit.targetPos &&
    MathUtils.sameCellPosition(unit.targetPos, closestAlly.pos);

  if (!isSameTarget) {
    let updated: Unit = { ...unit, engagementPolicy: "IGNORE" as const, engagementPolicySource: "Autonomous" as const };
    updated = issueMoveCommand({ unit: updated, target: MathUtils.toCellCoord(closestAlly.pos), label: "Grouping Up", state, context, director });
    const dist = MathUtils.getDistance(unit.pos, closestAlly.pos);
    setMovingPlan({ unit: updated, goal: { ...closestAlly.pos }, behavior: "Grouping", dist, state });
    return { unit: updated, handled: true };
  }

  const dist = MathUtils.getDistance(unit.pos, closestAlly.pos);
  refreshPlanCommitment(unit, dist, state);
  if (unit.activePlan) return { unit, handled: true };
  return { unit, handled: unit.state === UnitState.Moving };
}

export class SafetyBehavior implements Behavior<BehaviorContext> {
  constructor(private gameGrid: GameGrid, private los: LineOfSight) {}

  public evaluate({
    unit,
    state,
    doors,
    context,
    director,
  }: BehaviorEvalParams<BehaviorContext>): BehaviorResult {
    let currentUnit = { ...unit };
    if (currentUnit.archetypeId === "vip")
      return { unit: currentUnit, handled: false };

    const visibleEnemies = state.enemies.filter((enemy) => {
      if (enemy.hp <= 0) return false;
      const cell = MathUtils.toCellCoord(enemy.pos);
      return isCellVisible(state, cell.x, cell.y);
    });

    const threats = visibleEnemies
      .map((enemy) => ({ enemy, distance: MathUtils.getDistance(currentUnit.pos, enemy.pos) }))
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
    const isAvoidMode = currentUnit.engagementPolicy === "AVOID" && threats.length > 0;

    Logger.debug(`SafetyBehavior: unit=${currentUnit.id}, threats=${threats.length}, isLowHP=${isLowHP}, isIsolated=${isIsolated}, isAvoidMode=${isAvoidMode}`);

    const actionParams: SafetyActionParams = {
      unit: currentUnit,
      state,
      doors,
      context,
      director,
      threats,
      gameGrid: this.gameGrid,
      los: this.los,
    };

    if (isLowHP && threats.length > 0) {
      const result = handleRetreat(actionParams);
      if (result) return result;
    } else if (isAvoidMode) {
      const result = handleKite(actionParams);
      if (result) return result;
    } else if (isIsolated) {
      const result = handleGroupUp(actionParams);
      if (result) return result;
    } else if (
      currentUnit.engagementPolicy === "IGNORE" &&
      currentUnit.engagementPolicySource === "Autonomous" &&
      currentUnit.state === UnitState.Idle &&
      currentUnit.commandQueue.length === 0
    ) {
      currentUnit = { ...currentUnit, engagementPolicy: "ENGAGE", engagementPolicySource: undefined };
    }

    return { unit: currentUnit, handled: false };
  }
}
