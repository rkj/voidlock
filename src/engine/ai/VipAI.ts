import {
  GameState,
  Unit,
  UnitState,
  Vector2,
  Grid,
  CommandType,
  Command,
} from "../../shared/types";
import { isCellVisible, isCellDiscovered } from "../../shared/VisibilityUtils";
import { MathUtils } from "../../shared/utils/MathUtils";

export class VipAI {
  constructor(private grid: Grid) {}

  public think(vip: Unit, state: GameState): Command | null {
    if (
      vip.hp <= 0 ||
      vip.state === UnitState.Extracted ||
      vip.state === UnitState.Dead
    ) {
      return null;
    }

    const visibleEnemies = state.enemies.filter((e) => {
      if (e.hp <= 0) return false;
      const cell = MathUtils.toCellCoord(e.pos);
      return isCellVisible(state, cell.x, cell.y);
    });

    // 1. Danger Avoidance: Flee from closest enemy if too close
    if (visibleEnemies.length > 0) {
      const closestEnemy = this.getClosest(vip.pos, visibleEnemies);
      const dist = MathUtils.getDistance(vip.pos, closestEnemy.pos);

      if (dist < 5) {
        const fleeTarget = this.findFleeTarget(
          vip.pos,
          closestEnemy.pos,
          state,
        );
        if (fleeTarget) {
          return {
            type: CommandType.MOVE_TO,
            unitIds: [vip.id],
            target: fleeTarget,
            label: "Fleeing",
          };
        }
      }
    }

    // 2. Extraction Priority: Move to extraction if available and no immediate danger
    if (state.map.extraction) {
      const ext = state.map.extraction;
      if (isCellDiscovered(state, ext.x, ext.y)) {
        if (!MathUtils.sameCellPosition(vip.pos, ext)) {
          return {
            type: CommandType.MOVE_TO,
            unitIds: [vip.id],
            target: ext,
            label: "Extracting",
          };
        }
      }
    }

    // 3. Safety: Stay near armed squad members
    const allies = state.units.filter(
      (u) =>
        u.id !== vip.id &&
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead &&
        u.archetypeId !== "vip",
    );

    const isAtExtraction =
      state.map.extraction &&
      MathUtils.sameCellPosition(vip.pos, state.map.extraction);

    if (allies.length > 0 && !isAtExtraction) {
      const closestAlly = this.getClosest(vip.pos, allies);
      const dist = MathUtils.getDistance(vip.pos, closestAlly.pos);

      if (dist > 2) {
        // Move towards ally but don't stack perfectly (Pathfinder handles grid cells)
        return {
          type: CommandType.MOVE_TO,
          unitIds: [vip.id],
          target: MathUtils.toCellCoord(closestAlly.pos),
          label: "Following",
        };
      }
    }

    return null;
  }

  private getClosest<T extends { pos: Vector2 }>(
    pos: Vector2,
    entities: T[],
  ): T {
    return entities.reduce((prev, curr) => {
      const prevDistSq = MathUtils.getDistanceSquared(pos, prev.pos);
      const currDistSq = MathUtils.getDistanceSquared(pos, curr.pos);
      return currDistSq < prevDistSq ? curr : prev;
    });
  }

  private findFleeTarget(
    start: Vector2,
    threat: Vector2,
    state: GameState,
  ): Vector2 | null {
    const candidates: Vector2[] = [];
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: -1, y: -1 },
    ];

    for (const dir of directions) {
      for (let dist = 1; dist <= 4; dist++) {
        const tx = Math.floor(start.x + dir.x * dist);
        const ty = Math.floor(start.y + dir.y * dist);

        if (
          tx >= 0 &&
          tx < state.map.width &&
          ty >= 0 &&
          ty < state.map.height
        ) {
          const discovered = isCellDiscovered(state, tx, ty);
          const walkable = this.grid.isWalkable(tx, ty);
          if (walkable && discovered) {
            candidates.push({ x: tx, y: ty });
          }
        }
      }
    }

    if (candidates.length === 0) {
        return null;
    }

    const extraction = state.map.extraction;

    const result = candidates
      .map((c) => {
        const pos = { x: c.x + 0.5, y: c.y + 0.5 };
        const distFromThreat = MathUtils.getDistance(pos, threat);
        let score = distFromThreat;
        
        // Prioritize distance to extraction if it exists and is discovered
        if (extraction && isCellDiscovered(state, extraction.x, extraction.y)) {
          const distToExtraction = MathUtils.getDistance(pos, extraction);
          // We want higher score for lower distToExtraction.
          // Weight extraction heavily to ensure we flee TOWARDS it.
          score -= distToExtraction * 10; 
        }
        
        return { pos: c, score };
      })
      .sort((a, b) => b.score - a.score)[0];
    
    if (result) {
        return result.pos;
    }
    return null;
  }
}
