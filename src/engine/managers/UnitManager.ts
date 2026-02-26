import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Vector2,
  Command,
  Door,
} from "../../shared/types";
import { PRNG } from "../../shared/PRNG";
import { GameGrid } from "../GameGrid";
import { Pathfinder } from "../Pathfinder";
import { LineOfSight } from "../LineOfSight";
import { LootManager } from "./LootManager";
import { StatsManager } from "./StatsManager";
import { MovementManager } from "./MovementManager";
import { CombatManager } from "./CombatManager";
import { UnitAI } from "./UnitAI";
import { CommandExecutor } from "./CommandExecutor";
import { FormationManager } from "./FormationManager";
import { ItemDistributionService } from "./ItemDistributionService";
import { UnitStateManager } from "./UnitStateManager";
import { ItemEffectHandler } from "../interfaces/IDirector";
import { AIContext } from "../interfaces/AIContext";
import { MathUtils } from "../../shared/utils/MathUtils";
import { MOVEMENT } from "../config/GameConstants";

export class UnitManager {
  private totalFloorCells: number;
  private statsManager: StatsManager;
  private movementManager: MovementManager;
  private combatManager: CombatManager;
  private formationManager: FormationManager;
  private unitAi: UnitAI;
  private commandExecutor: CommandExecutor;
  private itemDistributionService: ItemDistributionService;
  private unitStateManager: UnitStateManager;

  constructor(
    private gameGrid: GameGrid,
    private pathfinder: Pathfinder,
    los: LineOfSight,
    private agentControlEnabled: boolean,
  ) {
    this.totalFloorCells = gameGrid
      .getGraph()
      .cells.flat()
      .filter((c) => c.type === "Floor").length;
    this.statsManager = new StatsManager();
    this.movementManager = new MovementManager(gameGrid);
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

  /**
   * Main update loop for all units. Handles AI, movement, combat, and command execution.
   * Uses an immutable pattern to update the game state.
   */
  public update(
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    prng: PRNG,
    lootManager: LootManager,
    director?: ItemEffectHandler,
    realDt: number = dt,
  ) {
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
      executeCommand: (u, cmd, s, isManual, dir) =>
        this.commandExecutor.executeCommand(u, cmd, s, isManual, dir),
    };

    // 5. Update each unit
    const updatedUnits = state.units.map((unit) => {
      if (unit.state === UnitState.Extracted || unit.hp <= 0) return unit;

      // Ensure stats are up to date
      let currentUnit = this.statsManager.recalculateStats(unit);

      // A. COMMAND QUEUE (Execute next pending command)
      currentUnit = this.unitStateManager.processCommandQueue(
        currentUnit,
        state,
        director,
      );

      // B. ESCORT DATA (Apply formation offsets and speed sync)
      currentUnit = this.applyEscortLogic(currentUnit, escortData);

      // C. CHANNELING (Handle timed actions)
      currentUnit = this.unitStateManager.processChanneling(
        currentUnit,
        state,
        realDt,
        lootManager,
        director,
      );

      // Early exit if unit extracted or still channeling
      if (
        currentUnit.state === UnitState.Extracted ||
        currentUnit.state === UnitState.Channeling
      ) {
        return currentUnit;
      }

      // D. COMBAT (Unit's own attacks)
      const combatResult = this.combatManager.update(currentUnit, state, prng);
      currentUnit = combatResult.unit;
      const isAttacking = combatResult.isAttacking;

      // E. MOVEMENT (Execute current path)
      currentUnit = this.updateUnitMovement(
        currentUnit,
        state,
        dt,
        doors,
        isAttacking,
      );

      // F. AI PROCESS (React to new position/state)
      currentUnit = this.unitAi.process(
        currentUnit,
        state,
        dt,
        doors,
        prng,
        aiContext,
        director,
      );

      return currentUnit;
    });

    state.units = updatedUnits;
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
          if ((o.kind === "Recover" || o.kind === "Escort") && o.targetCell) {
            return MathUtils.sameCellPosition(o.targetCell, target);
          }
          if (o.kind === "Kill" && o.targetEnemyId) {
            const enemy = state.enemies.find((e) => e.id === o.targetEnemyId);
            return enemy && MathUtils.sameCellPosition(enemy.pos, target);
          }
          return false;
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
        if (!escortGroups.has(targetId)) escortGroups.set(targetId, []);
        escortGroups.get(targetId)!.push(u);
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
  private updateUnitMovement(
    unit: Unit,
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    isAttacking: boolean,
  ): Unit {
    const isMoving = !!unit.targetPos;
    const enemiesInSameCell = state.enemies.filter(
      (enemy) =>
        enemy.hp > 0 && MathUtils.sameCellPosition(enemy.pos, unit.pos),
    );
    const isLockedInMelee = enemiesInSameCell.length > 0;

    if (isMoving && unit.targetPos) {
      if (isLockedInMelee) {
        return { ...unit, state: UnitState.Attacking };
      }

      if (!isAttacking) {
        return this.movementManager.handleMovement(unit, dt, doors);
      }

      // If we are RUSHing, RETREATing, EXTRACTing, or in IGNORE mode, we SHOULD be allowed to move while attacking
      if (
        unit.aiProfile === "RUSH" ||
        unit.aiProfile === "RETREAT" ||
        unit.engagementPolicy === "IGNORE" ||
        unit.engagementPolicy === "AVOID" ||
        unit.activeCommand?.type === CommandType.ESCORT_UNIT ||
        unit.activeCommand?.type === CommandType.EXTRACT ||
        unit.activeCommand?.label === "Extracting"
      ) {
        let movedUnit = this.movementManager.handleMovement(unit, dt, doors);
        if (movedUnit.state === UnitState.Moving) {
          movedUnit = { ...movedUnit, state: UnitState.Attacking };
        }
        return movedUnit;
      }
      return unit;
    }

    if (!isAttacking && !isMoving) {
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

    return unit;
  }

  /**
   * Executes a specific command for a unit, updating its state or path.
   * @param unit The unit receiving the command
   * @param cmd The command to execute
   * @param state The current game state
   * @param isManual Whether the command was issued by a player (disables AI)
   * @param director Optional director for global ability effects
   * @returns a new unit reference with the command applied
   */
  public executeCommand(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean = true,
    director?: ItemEffectHandler,
  ): Unit {
    return this.commandExecutor.executeCommand(
      unit,
      cmd,
      state,
      isManual,
      director,
    );
  }
}
