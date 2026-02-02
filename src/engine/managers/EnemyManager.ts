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
import { CombatManager } from "./CombatManager";
import {
  SPEED_NORMALIZATION_CONST,
  SCRAP_REWARDS,
} from "../config/GameConstants";
import { MathUtils } from "../../shared/utils/MathUtils";

const EPSILON = 0.05;

export class EnemyManager {
  private meleeAI: IEnemyAI;
  private rangedAI: IEnemyAI;

  constructor() {
    this.meleeAI = new SwarmMeleeAI();
    this.rangedAI = new RangedKiteAI();
  }

  /**
   * Adds a new enemy to the game state.
   */
  public addEnemy(state: GameState, enemy: Enemy) {
    state.enemies.push(enemy);
  }

  /**
   * Main update loop for all enemies. Handles AI, movement, combat, and mine explosions.
   */
  public update(
    state: GameState,
    dt: number,
    gameGrid: GameGrid,
    pathfinder: Pathfinder,
    los: LineOfSight,
    prng: PRNG,
    combatManager: CombatManager,
  ) {
    // 1. Mine Explosions (Can affect health of units/enemies)
    const triggeredMineIds = new Set<string>();
    state.mines.forEach((mine) => {
      const triggeringEnemy = state.enemies.find(
        (e) =>
          e.hp > 0 &&
          Math.floor(e.pos.x) === Math.floor(mine.pos.x) &&
          Math.floor(e.pos.y) === Math.floor(mine.pos.y),
      );

      if (triggeringEnemy) {
        triggeredMineIds.add(mine.id);

        const targetX = Math.floor(mine.pos.x);
        const targetY = Math.floor(mine.pos.y);

        // Mutate in-place for this pass as it's a global effect,
        // but we'll capture changes in the map() below.
        state.enemies.forEach((e) => {
          if (
            Math.floor(e.pos.x) === targetX &&
            Math.floor(e.pos.y) === targetY
          ) {
            e.hp -= mine.damage;
          }
        });

        state.units.forEach((u) => {
          if (
            Math.floor(u.pos.x) === targetX &&
            Math.floor(u.pos.y) === targetY
          ) {
            u.hp -= mine.damage;
          }
        });
      }
    });

    state.mines = state.mines.filter((m) => !triggeredMineIds.has(m.id));

    // 2. Enemy AI & Movement
    state.enemies = state.enemies.map((enemy) => {
      if (enemy.hp <= 0) return enemy;

      let currentEnemy = { ...enemy };

      const arch =
        EnemyArchetypeLibrary[currentEnemy.type] ||
        EnemyArchetypeLibrary[EnemyType.SwarmMelee];
      const ai = arch.ai === "Ranged" ? this.rangedAI : this.meleeAI;

      // AI think might still mutate, but we passed a clone
      ai.think(currentEnemy, state, gameGrid, pathfinder, los, prng);

      const unitsInRange = state.units.filter(
        (unit) =>
          unit.hp > 0 &&
          unit.state !== "Extracted" &&
          unit.state !== "Dead" &&
          MathUtils.getDistance(currentEnemy.pos, unit.pos) <=
            currentEnemy.attackRange + 0.5,
      );

      const unitsInSameCell = state.units.filter(
        (unit) =>
          unit.hp > 0 &&
          unit.state !== "Extracted" &&
          unit.state !== "Dead" &&
          Math.floor(unit.pos.x) === Math.floor(currentEnemy.pos.x) &&
          Math.floor(unit.pos.y) === Math.floor(currentEnemy.pos.y),
      );
      const isLockedInMelee = unitsInSameCell.length > 0;

      let isAttacking = false;
      if (
        unitsInRange.length > 0 &&
        (!currentEnemy.path ||
          currentEnemy.path.length === 0 ||
          isLockedInMelee)
      ) {
        let targetUnit = unitsInRange[0];

        if (isLockedInMelee && unitsInSameCell.length > 0) {
          const lockingTarget = unitsInSameCell.find((u) =>
            unitsInRange.includes(u),
          );
          if (lockingTarget) targetUnit = lockingTarget;
        }

        isAttacking = combatManager.handleAttack(
          currentEnemy,
          targetUnit,
          {
            damage: currentEnemy.damage,
            fireRate: currentEnemy.fireRate,
            accuracy: currentEnemy.accuracy,
            attackRange: currentEnemy.attackRange,
          },
          state,
          prng,
        );
      }

      if (
        !isAttacking &&
        currentEnemy.targetPos &&
        currentEnemy.path &&
        currentEnemy.path.length > 0
      ) {
        if (isLockedInMelee) {
          currentEnemy.targetPos = undefined;
          currentEnemy.path = [];
        } else {
          const dist = MathUtils.getDistance(
            currentEnemy.pos,
            currentEnemy.targetPos,
          );

          const moveDist =
            ((currentEnemy.speed / SPEED_NORMALIZATION_CONST) * dt) / 1000;

          if (dist <= moveDist + EPSILON) {
            currentEnemy.pos = { ...currentEnemy.targetPos };
            currentEnemy.path = currentEnemy.path.slice(1);
            if (currentEnemy.path.length > 0) {
              currentEnemy.targetPos = {
                x: currentEnemy.path[0].x + 0.5,
                y: currentEnemy.path[0].y + 0.5,
              };
            } else {
              currentEnemy.targetPos = undefined;
            }
          } else {
            currentEnemy.pos = {
              x:
                currentEnemy.pos.x +
                ((currentEnemy.targetPos.x - currentEnemy.pos.x) / dist) *
                  moveDist,
              y:
                currentEnemy.pos.y +
                ((currentEnemy.targetPos.y - currentEnemy.pos.y) / dist) *
                  moveDist,
            };
          }
        }
      }

      return currentEnemy;
    });

    const deadEnemies = state.enemies.filter((enemy) => enemy.hp <= 0);
    if (deadEnemies.length > 0) {
      // Stats mutation is okay for now, we clone stats in getState
      deadEnemies.forEach((enemy) => {
        state.stats.aliensKilled++;
        if (enemy.difficulty === 2) {
          state.stats.elitesKilled++;
          state.stats.scrapGained += SCRAP_REWARDS.ELITE_KILL;
        } else if (enemy.difficulty >= 3) {
          state.stats.elitesKilled++;
          state.stats.scrapGained += SCRAP_REWARDS.BOSS_KILL;
        }
      });
      state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
    }
  }
}
