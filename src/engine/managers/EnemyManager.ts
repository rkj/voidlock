import {
  GameState,
  Enemy,
  EnemyType,
  EnemyArchetypeLibrary,
  UnitState,
  Door,
} from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { Pathfinder } from "../Pathfinder";
import { LineOfSight } from "../LineOfSight";
import { PRNG } from "../../shared/PRNG";
import { IEnemyAI, SwarmMeleeAI } from "../ai/EnemyAI";
import { RangedKiteAI } from "../ai/RangedKiteAI";
import { CombatManager } from "./CombatManager";
import { MovementManager } from "./MovementManager";
import {
  SCRAP_REWARDS,
} from "../config/GameConstants";
import { MathUtils } from "../../shared/utils/MathUtils";

export class EnemyManager {
  private meleeAI: IEnemyAI;
  private rangedAI: IEnemyAI;
  private movementManager: MovementManager;

  constructor(gameGrid: GameGrid) {
    this.meleeAI = new SwarmMeleeAI();
    this.rangedAI = new RangedKiteAI();
    this.movementManager = new MovementManager(gameGrid);
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
    doors: Map<string, Door>,
  ) {
    // 1. Mine Explosions (Can affect health of units/enemies)
    // ... rest of the mine logic ...
    const triggeredMineIds = new Set<string>();
    state.mines.forEach((mine) => {
      const triggeringEnemy = state.enemies.find(
        (e) => e.hp > 0 && MathUtils.sameCellPosition(e.pos, mine.pos),
      );

      if (triggeringEnemy) {
        triggeredMineIds.add(mine.id);

        // Mutate in-place for this pass as it's a global effect,
        // but we'll capture changes in the map() below.
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
          MathUtils.sameCellPosition(unit.pos, currentEnemy.pos),
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
          currentEnemy.state = UnitState.Idle;
        } else {
          currentEnemy = this.movementManager.handleMovement(
            currentEnemy,
            currentEnemy.speed,
            dt,
            doors
          );
        }
      } else if (!isAttacking && !currentEnemy.targetPos) {
        currentEnemy.state = UnitState.Idle;
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
