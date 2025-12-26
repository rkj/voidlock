import {
  GameState,
  Unit,
  UnitState,
  Vector2,
  Grid,
  CommandType,
  Command,
  Enemy,
} from "../../shared/types";
import { Pathfinder } from "../Pathfinder";
import { LineOfSight } from "../LineOfSight";

export class VipAI {
  constructor(
    private grid: Grid,
    private pathfinder: Pathfinder,
    private los: LineOfSight,
  ) {}

  public think(vip: Unit, state: GameState): Command | null {
    if (vip.hp <= 0 || vip.state === UnitState.Extracted || vip.state === UnitState.Dead) {
      return null;
    }

    const visibleEnemies = state.enemies.filter((e) => {
      const key = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
      return e.hp > 0 && state.visibleCells.includes(key);
    });

    // 1. Danger Avoidance: Flee from closest enemy if too close
    if (visibleEnemies.length > 0) {
      const closestEnemy = this.getClosest(vip.pos, visibleEnemies);
      const dist = this.getDistance(vip.pos, closestEnemy.pos);

      if (dist < 5) {
        const fleeTarget = this.findFleeTarget(vip.pos, closestEnemy.pos, state);
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
      const extKey = `${ext.x},${ext.y}`;
      if (state.discoveredCells.includes(extKey)) {
        if (Math.floor(vip.pos.x) !== ext.x || Math.floor(vip.pos.y) !== ext.y) {
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

    const isAtExtraction = state.map.extraction && 
      Math.floor(vip.pos.x) === state.map.extraction.x && 
      Math.floor(vip.pos.y) === state.map.extraction.y;

    if (allies.length > 0 && !isAtExtraction) {
      const closestAlly = this.getClosest(vip.pos, allies);
      const dist = this.getDistance(vip.pos, closestAlly.pos);

      if (dist > 2) {
        // Move towards ally but don't stack perfectly (Pathfinder handles grid cells)
        return {
          type: CommandType.MOVE_TO,
          unitIds: [vip.id],
          target: { x: Math.floor(closestAlly.pos.x), y: Math.floor(closestAlly.pos.y) },
          label: "Following",
        };
      }
    }

    return null;
  }

  private getDistance(p1: Vector2, p2: Vector2): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }

  private getClosest<T extends { pos: Vector2 }>(pos: Vector2, entities: T[]): T {
    return entities.reduce((prev, curr) => {
      const prevDist = this.getDistance(pos, prev.pos);
      const currDist = this.getDistance(pos, curr.pos);
      return currDist < prevDist ? curr : prev;
    });
  }

  private findFleeTarget(start: Vector2, threat: Vector2, state: GameState): Vector2 | null {
    const candidates: Vector2[] = [];
    const directions = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
      { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
    ];

    for (const dir of directions) {
      for (let dist = 2; dist <= 4; dist++) {
        const tx = Math.floor(start.x + dir.x * dist);
        const ty = Math.floor(start.y + dir.y * dist);

        if (tx >= 0 && tx < state.map.width && ty >= 0 && ty < state.map.height) {
          if (this.grid.isWalkable(tx, ty) && state.discoveredCells.includes(`${tx},${ty}`)) {
            candidates.push({ x: tx, y: ty });
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    return candidates
      .map(c => ({
        pos: c,
        score: this.getDistance({ x: c.x + 0.5, y: c.y + 0.5 }, threat)
      }))
      .sort((a, b) => b.score - a.score)[0].pos;
  }
}
