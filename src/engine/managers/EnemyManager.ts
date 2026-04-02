import type {
  GameState,
  Enemy,
  Door} from "../../shared/types";
import {
  EnemyType,
  EnemyArchetypeLibrary,
  UnitState
} from "../../shared/types";
import type { GameGrid } from "../GameGrid";
import type { Pathfinder } from "../Pathfinder";
import type { LineOfSight } from "../LineOfSight";
import type { PRNG } from "../../shared/PRNG";
import type { IEnemyAI} from "../ai/EnemyAI";
import { SwarmMeleeAI } from "../ai/EnemyAI";
import { RangedKiteAI } from "../ai/RangedKiteAI";
import type { CombatManager } from "./CombatManager";
import type { MovementManager } from "./MovementManager";
import {
  SCRAP_REWARDS,
} from "../config/GameConstants";
import { MathUtils } from "../../shared/utils/MathUtils";

export interface EnemyUpdateParams {
  state: GameState;
  dt: number;
  gameGrid: GameGrid;
  pathfinder: Pathfinder;
  los: LineOfSight;
  prng: PRNG;
  combatManager: CombatManager;
  doors: Map<string, Door>;
}

export class EnemyManager {
  private meleeAI: IEnemyAI;
  private rangedAI: IEnemyAI;
  private movementManager: MovementManager;

  constructor(movementManager: MovementManager) {
    this.meleeAI = new SwarmMeleeAI();
    this.rangedAI = new RangedKiteAI();
    this.movementManager = movementManager;
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
  public update(params: EnemyUpdateParams) {
    const { state } = params;

    // 1. Mine Explosions (Can affect health of units/enemies)
    this.processMineExplosions(state);

    // 2. Enemy AI & Movement
    state.enemies = state.enemies.map((enemy) => {
      if (enemy.hp <= 0) return enemy;
      return this.updateEnemy(enemy, params);
    });

    this.processDeadEnemies(state);
  }

  private processMineExplosions(state: GameState): void {
    const triggeredMineIds = new Set<string>();
    state.mines.forEach((mine) => {
      const triggeringEnemy = state.enemies.find(
        (e) => e.hp > 0 && MathUtils.sameCellPosition(e.pos, mine.pos),
      );

      if (triggeringEnemy) {
        triggeredMineIds.add(mine.id);

        state.enemies.forEach((e) => {
          if (MathUtils.sameCellPosition(e.pos, mine.pos)) {
            e.hp -= mine.damage;
          }
        });

        state.units.forEach((u) => {
          if (MathUtils.sameCellPosition(u.pos, mine.pos)) {
            u.hp -= mine.damage;
          }
        });
      }
    });

    state.mines = state.mines.filter((m) => !triggeredMineIds.has(m.id));
  }

  private updateEnemy(enemy: Enemy, params: EnemyUpdateParams): Enemy {
    const { state, dt, gameGrid, pathfinder, los, prng, combatManager, doors } = params;
    const currentEnemy = { ...enemy };

    const arch =
      EnemyArchetypeLibrary[currentEnemy.type] ||
      EnemyArchetypeLibrary[EnemyType.SwarmMelee];
    const ai = arch.ai === "Ranged" ? this.rangedAI : this.meleeAI;

    ai.think({ enemy: currentEnemy, state, grid: gameGrid, pathfinder, los, prng });

    const unitsInRange = state.units.filter(
      (unit) =>
        unit.hp > 0 &&
        unit.state !== UnitState.Extracted &&
        unit.state !== UnitState.Dead &&
        MathUtils.getDistance(currentEnemy.pos, unit.pos) <=
          currentEnemy.attackRange + 0.5,
    );

    const unitsInSameCell = state.units.filter(
      (unit) =>
        unit.hp > 0 &&
        unit.state !== UnitState.Extracted &&
        unit.state !== UnitState.Dead &&
        MathUtils.sameCellPosition(unit.pos, currentEnemy.pos),
    );
    const isLockedInMelee = unitsInSameCell.length > 0;

    const isAttacking = this.tryEnemyAttack({
      enemy: currentEnemy,
      unitsInRange,
      unitsInSameCell,
      isLockedInMelee,
      combatManager,
      state,
      prng,
    });

    return this.handleEnemyMovement({ enemy: currentEnemy, isAttacking, isLockedInMelee, dt, doors });
  }

  private tryEnemyAttack(params: {
    enemy: Enemy;
    unitsInRange: GameState["units"];
    unitsInSameCell: GameState["units"];
    isLockedInMelee: boolean;
    combatManager: CombatManager;
    state: GameState;
    prng: PRNG;
  }): boolean {
    const { enemy, unitsInRange, unitsInSameCell, isLockedInMelee, combatManager, state, prng } = params;
    if (unitsInRange.length === 0) return false;
    if (enemy.path && enemy.path.length > 0 && !isLockedInMelee) return false;

    let targetUnit = unitsInRange[0];

    if (isLockedInMelee && unitsInSameCell.length > 0) {
      const lockingTarget = unitsInSameCell.find((u) => unitsInRange.includes(u));
      if (lockingTarget) targetUnit = lockingTarget;
    }

    return combatManager.handleAttack({
      attacker: enemy,
      target: targetUnit,
      stats: {
        damage: enemy.damage,
        fireRate: enemy.fireRate,
        accuracy: enemy.accuracy,
        attackRange: enemy.attackRange,
      },
      state,
      prng,
    });
  }

  private handleEnemyMovement(params: {
    enemy: Enemy;
    isAttacking: boolean;
    isLockedInMelee: boolean;
    dt: number;
    doors: Map<string, Door>;
  }): Enemy {
    const { enemy, isAttacking, isLockedInMelee, dt, doors } = params;
    if (
      !isAttacking &&
      enemy.targetPos &&
      enemy.path &&
      enemy.path.length > 0
    ) {
      if (isLockedInMelee) {
        return { ...enemy, targetPos: undefined, path: [], state: UnitState.Idle };
      }
      return this.movementManager.handleMovement(enemy, enemy.speed, dt, doors);
    }

    if (!isAttacking && !enemy.targetPos) {
      return { ...enemy, state: UnitState.Idle };
    }

    return enemy;
  }

  private processDeadEnemies(state: GameState): void {
    const deadEnemies = state.enemies.filter((enemy) => enemy.hp <= 0);
    if (deadEnemies.length === 0) return;

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
