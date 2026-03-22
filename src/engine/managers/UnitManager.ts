import type {
  GameState,
  Unit,
  Vector2,
  Door} from "../../shared/types";
import {
  UnitState,
  CommandType
} from "../../shared/types";
import type { PRNG } from "../../shared/PRNG";
import type { GameGrid } from "../GameGrid";
import type { Pathfinder } from "../Pathfinder";
import type { LineOfSight } from "../LineOfSight";
import type { LootManager } from "./LootManager";
import { StatsManager } from "./StatsManager";
import type { MovementManager } from "./MovementManager";
import { CombatManager } from "./CombatManager";
import { UnitAI } from "./UnitAI";
import { CommandExecutor } from "./CommandExecutor";
import type { ExecuteCommandParams } from "./CommandExecutor";
import { FormationManager } from "./FormationManager";
import { ItemDistributionService } from "./ItemDistributionService";
import { UnitStateManager } from "./UnitStateManager";
import type { ItemEffectHandler } from "../interfaces/IDirector";
import type { AIContext } from "../interfaces/AIContext";
import { isCellVisible } from "../../shared/VisibilityUtils";
import { MathUtils } from "../../shared/utils/MathUtils";
import { MapUtils } from "../../shared/utils/MapUtils";
import { MOVEMENT } from "../config/GameConstants";

export interface UnitManagerConstructorParams {
  gameGrid: GameGrid;
  pathfinder: Pathfinder;
  movementManager: MovementManager;
  los: LineOfSight;
  agentControlEnabled: boolean;
}

export interface UnitUpdateParams {
  state: GameState;
  dt: number;
  doors: Map<string, Door>;
  prng: PRNG;
  lootManager: LootManager;
  director?: ItemEffectHandler;
  realDt?: number;
}

interface UpdateUnitMovementParams {
  unit: Unit;
  state: GameState;
  dt: number;
  doors: Map<string, Door>;
  isAttacking: boolean;
}

interface HandleMovingUnitParams {
  unit: Unit;
  dt: number;
  doors: Map<string, Door>;
  isAttacking: boolean;
  isLockedInMelee: boolean;
}

interface InvalidationContext {
  hasNewEnemy: boolean;
  allVisibleEnemiesGone: boolean;
  areaRevealed: boolean;
  objectiveChanged: Set<string>;
}

interface SingleUnitUpdateContext {
  state: GameState;
  dt: number;
  realDt: number;
  doors: Map<string, Door>;
  prng: PRNG;
  lootManager: LootManager;
  director: ItemEffectHandler | undefined;
  aiContext: AIContext;
  escortData: Map<string, { targetCell: Vector2; matchedSpeed?: number; stopEscorting?: boolean }>;
  invalidationCtx: InvalidationContext;
}

export class UnitManager {
  private gameGrid: GameGrid;
  private pathfinder: Pathfinder;
  private agentControlEnabled: boolean;
  private totalFloorCells: number;
  private statsManager: StatsManager;
  private movementManager: MovementManager;
  private combatManager: CombatManager;
  private formationManager: FormationManager;
  private unitAi: UnitAI;
  private commandExecutor: CommandExecutor;
  private itemDistributionService: ItemDistributionService;
  private unitStateManager: UnitStateManager;

  private lastDiscoveredCellsCount: number = 0;
  private lastObjectiveStates: Map<string, string> = new Map();
  private lastVisibleEnemyIds: Set<string> = new Set();

  constructor(params: UnitManagerConstructorParams) {
    const { gameGrid, pathfinder, movementManager, los, agentControlEnabled } = params;
    this.gameGrid = gameGrid;
    this.pathfinder = pathfinder;
    this.agentControlEnabled = agentControlEnabled;
    this.totalFloorCells = gameGrid
      .getGraph()
      .cells.flat()
      .filter((c) => c.type === "Floor").length;
    this.statsManager = new StatsManager();
    this.movementManager = movementManager;
    this.combatManager = new CombatManager(los, this.statsManager);
    this.formationManager = new FormationManager();
    this.unitAi = new UnitAI(gameGrid, los);
    this.commandExecutor = new CommandExecutor(pathfinder);
    this.itemDistributionService = new ItemDistributionService();
    this.unitStateManager = new UnitStateManager(
      this.commandExecutor,
      this.statsManager,
    );
  }

  /**
   * Recalculates unit stats based on archetypes, equipment, and carried objectives.
   * @param unit The unit to update
   * @returns a new unit reference with updated stats
   */
  public recalculateStats(unit: Unit): Unit {
    return this.statsManager.recalculateStats(unit);
  }

  /**
   * Returns the combat manager instance used by the unit manager.
   */
  public getCombatManager(): CombatManager {
    return this.combatManager;
  }

  private invalidatePlan(unit: Unit): Unit {
    if (unit.activePlan) {
      let updatedUnit = {
        ...unit,
        activePlan: undefined,
        explorationTarget: undefined,
      };

      // Reset movement state so behaviors can re-evaluate and take over immediately
      if (
        unit.state === UnitState.Moving ||
        unit.state === UnitState.WaitingForDoor
      ) {
        updatedUnit = {
          ...updatedUnit,
          state: UnitState.Idle,
          targetPos: undefined,
          path: undefined,
        };
      }

      return updatedUnit;
    }
    return unit;
  }

  /**
   * Main update loop for all units. Handles AI, movement, combat, and command execution.
   * Uses an immutable pattern to update the game state.
   */
  public update(params: UnitUpdateParams) {
    const { state, dt, doors, prng, lootManager, director } = params;
    const realDt = params.realDt ?? dt;

    // 0. Update global tracking for invalidation triggers (ADR 0056)
    const discoveredCount = state.discoveredCells?.length || 0;
    const areaRevealed = this.lastDiscoveredCellsCount > 0 && discoveredCount > this.lastDiscoveredCellsCount;
    this.lastDiscoveredCellsCount = discoveredCount;

    const objectiveChanged = new Set<string>();
    state.objectives?.forEach(obj => {
      const lastState = this.lastObjectiveStates.get(obj.id);
      if (lastState !== undefined && lastState !== obj.state) {
        objectiveChanged.add(obj.id);
      }
      this.lastObjectiveStates.set(obj.id, obj.state);
    });

    const visibleEnemies = state.enemies.filter((e) => {
      if (e.hp <= 0) return false;
      const cell = MathUtils.toCellCoord(e.pos);
      return isCellVisible(state, cell.x, cell.y);
    });
    const currentVisibleIds = new Set(visibleEnemies.map((e) => e.id));

    let hasNewEnemy = false;
    for (const id of currentVisibleIds) {
      if (!this.lastVisibleEnemyIds.has(id)) {
        hasNewEnemy = true;
        break;
      }
    }

    const allVisibleEnemiesGone = this.lastVisibleEnemyIds.size > 0 && currentVisibleIds.size === 0;

    // 1. Calculate currently claimed objectives (by units already pursuing them)
    const claimedObjectives = this.calculateClaimedObjectives(state);

    // 2. Identify opportunistic item assignments
    const itemAssignments = this.itemDistributionService.updateItemAssignments(
      state,
      claimedObjectives,
    );

    // 3. Process escort formations
    const escortData = this.processEscortFormations(state);

    // 4. Prepare AI context
    const explorationClaims = new Map<string, Vector2>();
    for (const u of state.units) {
      if (u.explorationTarget) {
        explorationClaims.set(u.id, u.explorationTarget);
      }
    }

    const aiContext: AIContext = {
      agentControlEnabled: this.agentControlEnabled,
      totalFloorCells: this.totalFloorCells,
      gridState: state.gridState,
      claimedObjectives,
      explorationClaims,
      itemAssignments,
      itemGrid: this.itemDistributionService.getItemGrid(),
      executeCommand: (execParams) =>
        this.commandExecutor.executeCommand(execParams),
    };

    // 5. Update each unit
    const unitUpdateCtx: SingleUnitUpdateContext = {
      state,
      dt,
      realDt,
      doors,
      prng,
      lootManager,
      director,
      aiContext,
      escortData,
      invalidationCtx: { hasNewEnemy, allVisibleEnemiesGone, areaRevealed, objectiveChanged },
    };
    const updatedUnits = state.units.map((unit) => this.updateSingleUnit(unit, unitUpdateCtx));

    state.units = updatedUnits;
    this.lastVisibleEnemyIds = currentVisibleIds;
  }

  private updateSingleUnit(unit: Unit, ctx: SingleUnitUpdateContext): Unit {
    const { state, dt, realDt, doors, prng, lootManager, director, aiContext, escortData, invalidationCtx } = ctx;

    if (unit.state === UnitState.Extracted || unit.hp <= 0) return unit;

    let currentUnit = this.statsManager.recalculateStats(unit);

    // A. COMMAND QUEUE (Execute next pending command)
    currentUnit = this.unitStateManager.processCommandQueue(currentUnit, state, director);

    // B. ESCORT DATA (Apply formation offsets and speed sync)
    currentUnit = this.applyEscortLogic(currentUnit, escortData);

    // C. CHANNELING (Handle timed actions)
    currentUnit = this.unitStateManager.processChanneling({ unit: currentUnit, state, realDt, lootManager, director });

    // Early exit if unit extracted or still channeling
    if (currentUnit.state === UnitState.Extracted || currentUnit.state === UnitState.Channeling) {
      return currentUnit;
    }

    // D. COMBAT (Unit's own attacks)
    const combatResult = this.combatManager.update(currentUnit, state, prng);
    currentUnit = combatResult.unit;
    const isAttacking = combatResult.isAttacking;

    // E. MOVEMENT (Execute current path)
    const prevMovingState = currentUnit.state;
    currentUnit = this.updateUnitMovement({ unit: currentUnit, state, dt, doors, isAttacking });

    // F. INVALIDATION TRIGGERS (ADR 0056)
    if (currentUnit.activePlan) {
      const shouldInvalidate = this.checkInvalidationTriggers(currentUnit, prevMovingState, invalidationCtx);
      if (shouldInvalidate) {
        currentUnit = this.invalidatePlan(currentUnit);
      }
    }

    // G. AI PROCESS (React to new position/state)
    currentUnit = this.unitAi.process({
      unit: currentUnit,
      state,
      dt,
      doors,
      prng,
      context: aiContext,
      director,
    });

    return currentUnit;
  }

  private checkInvalidationTriggers(
    unit: Unit,
    prevMovingState: string,
    ctx: InvalidationContext,
  ): boolean {
    if (!unit.activePlan) return false;
    const priority = unit.activePlan.priority;

    // 1. New enemy enters LOS -> Triggered for: Exploration (4) and Objective (3) plans
    if (ctx.hasNewEnemy && priority >= 3) return true;

    // 2. All visible enemies die/flee -> Triggered for: Combat (2), Safety (0)
    if (ctx.allVisibleEnemiesGone && (priority === 0 || priority === 2)) return true;

    // 3. Unit HP drops below 25% -> Triggered for: Everything except Safety (priority > 0)
    if (unit.hp < unit.maxHp * 0.25 && priority > 0) return true;

    // 4. New area revealed -> Triggered for: Exploration (4)
    if (ctx.areaRevealed && priority === 4) return true;

    // 5. Objective state changes -> Triggered for: Objective (3)
    if (ctx.objectiveChanged.size > 0 && priority === 3) return true;

    // 6. Path blocked -> Triggered for: Everything
    if (prevMovingState !== UnitState.WaitingForDoor && unit.state === UnitState.WaitingForDoor) return true;

    // 7. Unit reaches plan goal (Natural completion)
    if (!unit.targetPos && unit.state !== UnitState.Moving && unit.state !== UnitState.WaitingForDoor) return true;

    return false;
  }

  /**
   * Identifies which objectives are currently being pursued by units.
   */
  private calculateClaimedObjectives(state: GameState): Map<string, string> {
    const claimedObjectives = new Map<string, string>();
    for (const u of state.units) {
      if (u.state === UnitState.Dead || u.state === UnitState.Extracted)
        continue;

      if (u.channeling?.targetId) {
        claimedObjectives.set(u.channeling.targetId, u.id);
      }

      if (u.forcedTargetId) {
        const obj = state.objectives?.find(
          (o) => o.targetEnemyId === u.forcedTargetId,
        );
        if (obj) claimedObjectives.set(obj.id, u.id);
      }

      const activeCommand = u.activeCommand;
      if (activeCommand?.type === CommandType.PICKUP) {
        claimedObjectives.set(activeCommand.lootId, u.id);
      }

      if (
        activeCommand?.type === CommandType.MOVE_TO &&
        activeCommand.target &&
        activeCommand.label !== "Exploring"
      ) {
        const target = activeCommand.target;
        const obj = state.objectives?.find((o) => {
          const pos = MapUtils.resolveObjectivePosition(o, state.enemies);
          return pos && MathUtils.sameCellPosition(pos, target);
        });
        if (obj) claimedObjectives.set(obj.id, u.id);
      }
    }
    return claimedObjectives;
  }

  /**
   * Processes escort formation logic for all units currently in an ESCORT_UNIT state.
   */
  private processEscortFormations(state: GameState) {
    const escortGroups = new Map<string, Unit[]>();
    for (const u of state.units) {
      if (
        u.hp > 0 &&
        u.state !== UnitState.Dead &&
        u.state !== UnitState.Extracted &&
        u.activeCommand?.type === CommandType.ESCORT_UNIT
      ) {
        const targetId = u.activeCommand.targetId;
        let group = escortGroups.get(targetId);
        if (!group) {
          group = [];
          escortGroups.set(targetId, group);
        }
        group.push(u);
      }
    }

    const escortData = new Map<
      string,
      { targetCell: Vector2; matchedSpeed?: number; stopEscorting?: boolean }
    >();
    for (const [targetId, escorts] of escortGroups) {
      const targetUnit = state.units.find((u) => u.id === targetId);
      if (
        !targetUnit ||
        targetUnit.hp <= 0 ||
        targetUnit.state === UnitState.Dead ||
        targetUnit.state === UnitState.Extracted
      ) {
        for (const e of escorts) {
          escortData.set(e.id, {
            targetCell: { x: 0, y: 0 },
            stopEscorting: true,
          });
        }
        continue;
      }

      const roles = this.formationManager.assignEscortRoles(
        escorts,
        targetUnit,
        this.gameGrid,
      );
      for (const [unitId, slot] of roles) {
        escortData.set(unitId, slot);
      }
    }
    return escortData;
  }

  /**
   * Applies escort formation offsets and speed synchronization to a unit.
   */
  private applyEscortLogic(
    unit: Unit,
    escortData: Map<
      string,
      { targetCell: Vector2; matchedSpeed?: number; stopEscorting?: boolean }
    >,
  ): Unit {
    const eData = escortData.get(unit.id);
    if (!eData) return unit;

    if (eData.stopEscorting) {
      return {
        ...unit,
        activeCommand: undefined,
        state: UnitState.Idle,
      };
    }

    let updatedUnit = unit;
    if (eData.matchedSpeed !== undefined) {
      updatedUnit = {
        ...updatedUnit,
        stats: { ...updatedUnit.stats, speed: eData.matchedSpeed },
      };
    }

    const targetCell = eData.targetCell;
    const distToCenter = MathUtils.getDistance(
      updatedUnit.pos,
      MathUtils.getCellCenter(targetCell, updatedUnit.visualJitter),
    );

    if (distToCenter > MOVEMENT.ARRIVAL_THRESHOLD * 2) {
      if (
        !updatedUnit.targetPos ||
        !MathUtils.sameCellPosition(updatedUnit.targetPos, targetCell)
      ) {
        const path = this.pathfinder.findPath(
          {
            x: Math.floor(updatedUnit.pos.x),
            y: Math.floor(updatedUnit.pos.y),
          },
          targetCell,
          true,
        );
        if (path) {
          if (path.length > 0) {
            updatedUnit = {
              ...updatedUnit,
              path,
              targetPos: MathUtils.getCellCenter(path[0], updatedUnit.visualJitter),
              state: UnitState.Moving,
            };
          } else {
            updatedUnit = {
              ...updatedUnit,
              path: undefined,
              targetPos: MathUtils.getCellCenter(targetCell, updatedUnit.visualJitter),
              state: UnitState.Moving,
            };
          }
        }
      }
    }
    return updatedUnit;
  }

  /**
   * Updates unit position and state based on its current movement path.
   */
  private updateUnitMovement(params: UpdateUnitMovementParams): Unit {
    const { unit, state, dt, doors, isAttacking } = params;
    const isMoving = !!unit.targetPos;
    const isLockedInMelee = this.isUnitLockedInMelee(unit, state);

    if (isMoving) {
      return this.handleMovingUnit({ unit, dt, doors, isAttacking, isLockedInMelee });
    }

    if (!isAttacking) {
      return this.handleIdleUnit(unit);
    }

    return unit;
  }

  private isUnitLockedInMelee(unit: Unit, state: GameState): boolean {
    return state.enemies.some(
      (enemy) => enemy.hp > 0 && MathUtils.sameCellPosition(enemy.pos, unit.pos),
    );
  }

  private handleMovingUnit({
    unit,
    dt,
    doors,
    isAttacking,
    isLockedInMelee,
  }: HandleMovingUnitParams): Unit {
    if (isLockedInMelee) {
      return { ...unit, state: UnitState.Attacking };
    }

    if (!isAttacking) {
      return this.movementManager.handleMovement(unit, unit.stats.speed, dt, doors);
    }

    // If we are RUSHing, RETREATing, EXTRACTing, or in IGNORE mode, we SHOULD be allowed to move while attacking
    const canMoveWhileAttacking =
      unit.aiProfile === "RUSH" ||
      unit.aiProfile === "RETREAT" ||
      unit.engagementPolicy === "IGNORE" ||
      unit.engagementPolicy === "AVOID" ||
      unit.activeCommand?.type === CommandType.ESCORT_UNIT ||
      unit.activeCommand?.type === CommandType.EXTRACT ||
      unit.activeCommand?.label === "Extracting";

    if (canMoveWhileAttacking) {
      let movedUnit = this.movementManager.handleMovement(unit, unit.stats.speed, dt, doors);
      if (movedUnit.state === UnitState.Moving) {
        movedUnit = { ...movedUnit, state: UnitState.Attacking };
      }
      return movedUnit;
    }

    return unit;
  }

  private handleIdleUnit(unit: Unit): Unit {
    let updatedUnit = { ...unit, state: UnitState.Idle };
    // Clear non-persistent active commands if Idle
    const activeCmdType = updatedUnit.activeCommand?.type;
    const persistentTypes = [
      CommandType.PICKUP,
      CommandType.ESCORT_UNIT,
      CommandType.EXPLORE,
      CommandType.OVERWATCH_POINT,
      CommandType.USE_ITEM,
      CommandType.EXTRACT,
    ];

    if (activeCmdType && !persistentTypes.includes(activeCmdType)) {
      updatedUnit = { ...updatedUnit, activeCommand: undefined };
    }
    return updatedUnit;
  }

  /**
   * Executes a specific command for a unit, updating its state or path.
   * @returns a new unit reference with the command applied
   */
  public executeCommand(params: ExecuteCommandParams): Unit {
    return this.commandExecutor.executeCommand(params);
  }
}
