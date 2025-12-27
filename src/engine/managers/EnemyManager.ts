import {
  GameState,
  Enemy,
  EnemyType,
  EnemyArchetypeLibrary,
} from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { Pathfinder } from "../Pathfinder";
import { LineOfSight } from "../LineOfSight";
import { PRNG } from "../../shared/PRNG";
import { IEnemyAI, SwarmMeleeAI } from "../ai/EnemyAI";
import { RangedKiteAI } from "../ai/RangedKiteAI";

const EPSILON = 0.05;

export class EnemyManager {
  private meleeAI: IEnemyAI;
  private rangedAI: IEnemyAI;

  constructor() {
    this.meleeAI = new SwarmMeleeAI();
    this.rangedAI = new RangedKiteAI();
  }

  public addEnemy(state: GameState, enemy: Enemy) {
    state.enemies.push(enemy);
  }

  public update(
    state: GameState,
    dt: number,
    gameGrid: GameGrid,
    pathfinder: Pathfinder,
    los: LineOfSight,
    prng: PRNG,
  ) {
    state.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;

      const arch =
        EnemyArchetypeLibrary[enemy.type] ||
        EnemyArchetypeLibrary[EnemyType.SwarmMelee];
      const ai = arch.ai === "Ranged" ? this.rangedAI : this.meleeAI;

      ai.think(enemy, state, gameGrid, pathfinder, los, prng);

      const unitsInRange = state.units.filter(
        (unit) =>
          unit.hp > 0 &&
          unit.state !== "Extracted" &&
          unit.state !== "Dead" &&
          this.getDistance(enemy.pos, unit.pos) <= enemy.attackRange + 0.5,
      );

      const unitsInSameCell = state.units.filter(
        (unit) =>
          unit.hp > 0 &&
          unit.state !== "Extracted" &&
          unit.state !== "Dead" &&
          Math.floor(unit.pos.x) === Math.floor(enemy.pos.x) &&
          Math.floor(unit.pos.y) === Math.floor(enemy.pos.y),
      );
      const isLockedInMelee = unitsInSameCell.length > 0;

      let isAttacking = false;
      if (
        unitsInRange.length > 0 &&
        (!enemy.path || enemy.path.length === 0 || isLockedInMelee)
      ) {
        let targetUnit = unitsInRange[0];

        if (isLockedInMelee && unitsInSameCell.length > 0) {
          const lockingTarget = unitsInSameCell.find((u) =>
            unitsInRange.includes(u),
          );
          if (lockingTarget) targetUnit = lockingTarget;
        }

        if (los.hasLineOfSight(enemy.pos, targetUnit.pos)) {
          if (
            !enemy.lastAttackTime ||
            state.t - enemy.lastAttackTime >= enemy.fireRate
          ) {
            const distance = this.getDistance(enemy.pos, targetUnit.pos);
            const dispersionRad = (enemy.accuracy * Math.PI) / 180;
            const hitChance =
              enemy.accuracy > 0
                ? Math.min(1.0, 0.5 / (distance * Math.tan(dispersionRad)))
                : 1.0;

            if (prng.next() <= hitChance) {
              targetUnit.hp -= enemy.damage;
            }

            enemy.lastAttackTime = state.t;
            enemy.lastAttackTarget = { ...targetUnit.pos };
          }
          isAttacking = true;
        }
      }

      if (
        !isAttacking &&
        enemy.targetPos &&
        enemy.path &&
        enemy.path.length > 0
      ) {
        if (isLockedInMelee) {
          enemy.targetPos = undefined;
          enemy.path = [];
        } else {
          const dx = enemy.targetPos.x - enemy.pos.x;
          const dy = enemy.targetPos.y - enemy.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const moveDist = (enemy.speed / 10 * dt) / 1000;

          if (dist <= moveDist + EPSILON) {
            enemy.pos = { ...enemy.targetPos };
            enemy.path.shift();
            if (enemy.path.length > 0) {
              enemy.targetPos = {
                x: enemy.path[0].x + 0.5,
                y: enemy.path[0].y + 0.5,
              };
            } else {
              enemy.targetPos = undefined;
            }
          } else {
            enemy.pos.x += (dx / dist) * moveDist;
            enemy.pos.y += (dy / dist) * moveDist;
          }
        }
      }
    });

    const deadEnemies = state.enemies.filter((enemy) => enemy.hp <= 0);
    state.aliensKilled += deadEnemies.length;
    state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  }

  private getDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number },
  ): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
