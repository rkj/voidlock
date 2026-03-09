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
import { isCellVisible, isCellDiscovered } from "../../../shared/VisibilityUtils";
import { ItemEffectHandler } from "../../interfaces/IDirector";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { LineOfSight } from "../../LineOfSight";
import { GameGrid } from "../../GameGrid";
import { Logger } from "../../../shared/Logger";
import { calculateTravelTimeMs } from "./BehaviorUtils";

export class SafetyBehavior implements Behavior<BehaviorContext> {
  constructor(private gameGrid: GameGrid, private los: LineOfSight) {}

  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    doors: Map<string, Door>,
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
    const isAvoidMode = currentUnit.engagementPolicy === "AVOID" && threats.length > 0;
    Logger.debug(`SafetyBehavior: unit=${currentUnit.id}, threats=${threats.length}, isLowHP=${isLowHP}, isIsolated=${isIsolated}, isAvoidMode=${isAvoidMode}`);

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
        // Anti-backtracking: filter out recently visited cells
        let filteredSafe = safeCells.filter(cell => 
          !currentUnit.positionHistory.some(h => h.x === cell.x && h.y === cell.y)
        );
        
        // If everything is backtracked, use the full list (cornered)
        const candidates = filteredSafe.length > 0 ? filteredSafe : safeCells;

        const closestSafe = candidates
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

          if (currentUnit.state === UnitState.Moving) {
            const travelTimeMs = calculateTravelTimeMs(currentUnit, closestSafe.dist);
            currentUnit.activePlan = {
              behavior: "Retreating",
              goal: { x: closestSafe.x + 0.5, y: closestSafe.y + 0.5 },
              committedUntil: state.t + Math.max(500, travelTimeMs),
              priority: 0,
            };
          }

          return {
            unit: currentUnit,
            handled: currentUnit.state === UnitState.Moving,
          };
        } else if (currentUnit.activePlan) {
          // Same target and already moving, refresh commitment
          const travelTimeMs = calculateTravelTimeMs(currentUnit, closestSafe.dist);
          currentUnit.activePlan = {
            ...currentUnit.activePlan,
            committedUntil: state.t + Math.max(500, travelTimeMs),
          };
          return { unit: currentUnit, handled: true };
        }
        return {
          unit: currentUnit,
          handled: currentUnit.state === UnitState.Moving,
        };
      }
    } else if (isAvoidMode) {
      const primaryThreat = threats[0].enemy;
      const N = 5;
      const width = state.map.width;

      const candidateWaypoints: {
        x: number;
        y: number;
        distToUnit: number;
        hasLOS: boolean;
      }[] = [];

      // Find all discovered, walkable cells that are >= N tiles from all threats
      if (state.gridState) {
        for (let i = 0; i < state.gridState.length; i++) {
          if (state.gridState[i] & 2) {
            const cx = i % width;
            const cy = Math.floor(i / width);
            if (this.gameGrid.isWalkable(cx, cy)) {
              const cellPos = { x: cx + 0.5, y: cy + 0.5 };
              const isFarEnough = threats.every(
                (t) => MathUtils.getDistance(cellPos, t.enemy.pos) >= N,
              );
              if (isFarEnough) {
                const hasLOS = this.los.hasLineOfSight(cellPos, primaryThreat.pos);
                const distToUnit = MathUtils.getDistance(currentUnit.pos, cellPos);
                candidateWaypoints.push({ x: cx, y: cy, distToUnit, hasLOS });
              }
            }
          }
        }
      } else {
        state.discoveredCells.forEach((key) => {
          const [cx, cy] = key.split(",").map(Number);
          if (this.gameGrid.isWalkable(cx, cy)) {
            const cellPos = { x: cx + 0.5, y: cy + 0.5 };
            const isFarEnough = threats.every(
              (t) => MathUtils.getDistance(cellPos, t.enemy.pos) >= N,
            );
            if (isFarEnough) {
              const hasLOS = this.los.hasLineOfSight(cellPos, primaryThreat.pos);
              const distToUnit = MathUtils.getDistance(currentUnit.pos, cellPos);
              candidateWaypoints.push({ x: cx, y: cy, distToUnit, hasLOS });
            }
          }
        });
      }

      let bestWaypoint: { x: number; y: number } | null = null;

      if (candidateWaypoints.length > 0) {
        // Anti-backtracking: filter recently visited cells
        let filteredWaypoints = candidateWaypoints.filter(cell => 
          !currentUnit.positionHistory.some(h => h.x === cell.x && h.y === cell.y)
        );

        const candidates = filteredWaypoints.length > 0 ? filteredWaypoints : candidateWaypoints;

        // Sort by LOS first, then distance to unit (nearest)
        const sorted = candidates.sort((a, b) => {
          if (a.hasLOS && !b.hasLOS) return -1;
          if (!a.hasLOS && b.hasLOS) return 1;
          return a.distToUnit - b.distToUnit;
        });
        bestWaypoint = { x: sorted[0].x, y: sorted[0].y };
      }

      if (bestWaypoint) {
        if (
          currentUnit.state !== UnitState.Moving ||
          !currentUnit.targetPos ||
          !MathUtils.sameCellPosition(currentUnit.targetPos, bestWaypoint)
        ) {
          currentUnit = context.executeCommand(
            currentUnit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [currentUnit.id],
              target: bestWaypoint,
              label: "Kiting",
            },
            state,
            false,
            director,
          );

          if (currentUnit.state === UnitState.Moving) {
            const goalPos = { x: bestWaypoint.x + 0.5, y: bestWaypoint.y + 0.5 };
            const dist = MathUtils.getDistance(currentUnit.pos, goalPos);
            const travelTimeMs = calculateTravelTimeMs(currentUnit, dist);
            currentUnit.activePlan = {
              behavior: "Kiting",
              goal: goalPos,
              committedUntil: state.t + Math.max(500, travelTimeMs),
              priority: 0,
            };
          }

          return { unit: currentUnit, handled: true };
        } else if (currentUnit.activePlan) {
          // Same target and already moving, refresh commitment
          const goalPos = { x: bestWaypoint.x + 0.5, y: bestWaypoint.y + 0.5 };
          const dist = MathUtils.getDistance(currentUnit.pos, goalPos);
          const travelTimeMs = calculateTravelTimeMs(currentUnit, dist);
          currentUnit.activePlan = {
            ...currentUnit.activePlan,
            committedUntil: state.t + Math.max(500, travelTimeMs),
          };
          return { unit: currentUnit, handled: true };
        }
        return { unit: currentUnit, handled: true };
      }

      // Fallback to greedy 1-cell neighbor scan if no waypoint >= N found
      const dist = threats[0].distance;
      const currentCell = MathUtils.toCellCoord(currentUnit.pos);
      
      const neighbors = [
        { x: currentCell.x + 1, y: currentCell.y },
        { x: currentCell.x - 1, y: currentCell.y },
        { x: currentCell.x, y: currentCell.y + 1 },
        { x: currentCell.x, y: currentCell.y - 1 },
        { x: currentCell.x + 1, y: currentCell.y + 1 },
        { x: currentCell.x + 1, y: currentCell.y - 1 },
        { x: currentCell.x - 1, y: currentCell.y + 1 },
        { x: currentCell.x - 1, y: currentCell.y - 1 },
      ].filter(n => 
        n.x >= 0 && n.x < state.map.width && n.y >= 0 && n.y < state.map.height &&
        isCellDiscovered(state, n.x, n.y) &&
        this.gameGrid.isWalkable(n.x, n.y) &&
        this.gameGrid.canMove(currentCell.x, currentCell.y, n.x, n.y, doors, false)
      );

      const scoredCandidates = neighbors.map(n => {
        const pos = { x: n.x + 0.5, y: n.y + 0.5 };
        const hasLOS = this.los.hasLineOfSight(pos, primaryThreat.pos);
        const newDist = MathUtils.getDistance(pos, primaryThreat.pos);
        return { pos: n, hasLOS, newDist };
      });

      const betterCandidates = scoredCandidates.filter(c => c.newDist > dist);

      // Anti-backtracking filter
      let filtered = betterCandidates.filter(c => 
        !currentUnit.positionHistory.some(h => h.x === c.pos.x && h.y === c.pos.y)
      );

      // If all better candidates are backtracked, use the full list (cornered/A* transitory allowed)
      const finalCandidates = filtered.length > 0 ? filtered : betterCandidates;

      const best = finalCandidates
        .sort((a, b) => {
          if (a.hasLOS && !b.hasLOS) return -1;
          if (!a.hasLOS && b.hasLOS) return 1;
          return b.newDist - a.newDist;
        })[0];

      if (best && (best.hasLOS || betterCandidates.every(c => !c.hasLOS))) {
        if (
          currentUnit.state !== UnitState.Moving ||
          !currentUnit.targetPos ||
          !MathUtils.sameCellPosition(currentUnit.targetPos, best.pos)
        ) {
          currentUnit = context.executeCommand(
            currentUnit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [currentUnit.id],
              target: best.pos,
              label: "Kiting",
            },
            state,
            false,
            director,
          );

          if (currentUnit.state === UnitState.Moving) {
            const goalPos = { x: best.pos.x + 0.5, y: best.pos.y + 0.5 };
            const dist = MathUtils.getDistance(currentUnit.pos, goalPos);
            const travelTimeMs = calculateTravelTimeMs(currentUnit, dist);
            currentUnit.activePlan = {
              behavior: "Kiting",
              goal: goalPos,
              committedUntil: state.t + Math.max(500, travelTimeMs),
              priority: 0,
            };
          }

          return { unit: currentUnit, handled: true };
        } else if (currentUnit.activePlan) {
          // Same target and already moving, refresh commitment
          const goalPos = { x: best.pos.x + 0.5, y: best.pos.y + 0.5 };
          const dist = MathUtils.getDistance(currentUnit.pos, goalPos);
          const travelTimeMs = calculateTravelTimeMs(currentUnit, dist);
          currentUnit.activePlan = {
            ...currentUnit.activePlan,
            committedUntil: state.t + Math.max(500, travelTimeMs),
          };
          return { unit: currentUnit, handled: true };
        }
        return { unit: currentUnit, handled: true };
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

          if (currentUnit.state === UnitState.Moving) {
            const dist = MathUtils.getDistance(currentUnit.pos, closestAlly.pos);
            const travelTimeMs = calculateTravelTimeMs(currentUnit, dist);
            currentUnit.activePlan = {
              behavior: "Grouping",
              goal: { ...closestAlly.pos },
              committedUntil: state.t + Math.max(500, travelTimeMs),
              priority: 0,
            };
          }
          return { unit: currentUnit, handled: true };
        } else if (currentUnit.activePlan) {
          // Same target and already moving, refresh commitment
          const dist = MathUtils.getDistance(currentUnit.pos, closestAlly.pos);
          const travelTimeMs = calculateTravelTimeMs(currentUnit, dist);
          currentUnit.activePlan = {
            ...currentUnit.activePlan,
            committedUntil: state.t + Math.max(500, travelTimeMs),
          };
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
