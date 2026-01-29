import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Vector2,
  Command,
  EscortUnitCommand,
  PickupCommand,
  Door,
} from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { Pathfinder } from "../Pathfinder";
import { LineOfSight } from "../LineOfSight";
import { PRNG } from "../../shared/PRNG";
import { LootManager } from "./LootManager";
import { StatsManager } from "./StatsManager";
import { MovementManager } from "./MovementManager";
import { CombatManager } from "./CombatManager";
import { UnitAI, AIContext } from "./UnitAI";
import { CommandExecutor } from "./CommandExecutor";
import { FormationManager } from "./FormationManager";
import { IDirector } from "../interfaces/IDirector";
import { MathUtils } from "../../shared/utils/MathUtils";
import { SpatialGrid } from "../../shared/utils/SpatialGrid";
import { MOVEMENT } from "../config/GameConstants";

export class UnitManager {
  private totalFloorCells: number;
  private statsManager: StatsManager;
  private movementManager: MovementManager;
  private combatManager: CombatManager;
  private formationManager: FormationManager;
  private unitAi: UnitAI;
  private commandExecutor: CommandExecutor;
  private itemGrid: SpatialGrid<{
    id: string;
    pos: Vector2;
    mustBeInLOS: boolean;
    visible?: boolean;
    type: "loot" | "objective";
  }> = new SpatialGrid();
  private lastLootArray?: any[];
  private lastObjectivesArray?: any[];

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
    console.log(`UnitManager: totalFloorCells = ${this.totalFloorCells}`);
    this.statsManager = new StatsManager();
    this.movementManager = new MovementManager(gameGrid);
    this.combatManager = new CombatManager(los, this.statsManager);
    this.formationManager = new FormationManager();
    this.unitAi = new UnitAI(gameGrid, los);
    this.commandExecutor = new CommandExecutor(pathfinder);
  }

  /**
   * Recalculates unit stats based on archetypes, equipment, and carried objectives.
   * @param unit The unit to update
   * @returns A new unit reference with updated stats
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
    director?: IDirector,
    realDt: number = dt,
  ) {
    const claimedObjectives = new Map<string, string>();

    // 2. Group escorts
    const escortGroups = new Map<string, Unit[]>();
    for (const u of state.units) {
      if (
        u.hp > 0 &&
        u.state !== UnitState.Dead &&
        u.state !== UnitState.Extracted &&
        u.activeCommand?.type === CommandType.ESCORT_UNIT
      ) {
        const cmd = u.activeCommand as EscortUnitCommand;
        if (!escortGroups.has(cmd.targetId)) escortGroups.set(cmd.targetId, []);
        escortGroups.get(cmd.targetId)!.push(u);
      }
    }

    // 3. Process escort groups
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
        // Target is gone, stop escorting
        for (const e of escorts) {
          escortData.set(e.id, { targetCell: { x: 0, y: 0 }, stopEscorting: true });
        }
        continue;
      }

      const roles = this.formationManager.assignEscortRoles(escorts, targetUnit, this.gameGrid);
      for (const [unitId, slot] of roles) {
        escortData.set(unitId, slot);
      }
    }


    // Pre-populate claimed objectives from units already pursuing them
    for (const u of state.units) {
      if (u.state === UnitState.Dead || u.state === UnitState.Extracted) continue;
      if (u.channeling?.targetId) {
        claimedObjectives.set(u.channeling.targetId, u.id);
      }
      // If unit has a forced target that is an objective
      if (u.forcedTargetId) {
        const obj = state.objectives?.find(
          (o) => o.targetEnemyId === u.forcedTargetId,
        );
        if (obj) claimedObjectives.set(obj.id, u.id);
      }
      // If unit has an active command targeting an objective
      if (u.activeCommand?.type === CommandType.PICKUP) {
        const cmd = u.activeCommand as PickupCommand;
        claimedObjectives.set(cmd.lootId, u.id);
      }

      // If unit has an active command targeting an objective
      if (
        u.activeCommand?.type === CommandType.MOVE_TO &&
        u.activeCommand.target &&
        u.activeCommand.label !== "Exploring"
      ) {
        const target = u.activeCommand.target;
        const obj = state.objectives?.find((o) => {
          if ((o.kind === "Recover" || o.kind === "Escort") && o.targetCell) {
            return o.targetCell.x === target.x && o.targetCell.y === target.y;
          }
          if (o.kind === "Kill" && o.targetEnemyId) {
            const enemy = state.enemies.find((e) => e.id === o.targetEnemyId);
            return (
              enemy &&
              Math.floor(enemy.pos.x) === target.x &&
              Math.floor(enemy.pos.y) === target.y
            );
          }
          return false;
        });
        if (obj) claimedObjectives.set(obj.id, u.id);
      }
    }

    // Pre-pass for item competition (Opportunistic Pickups & General Objectives)
    const itemAssignments = new Map<string, string>(); // itemId -> unitId

    // Only rebuild the grid if the items have changed
    if (
      this.lastLootArray !== state.loot ||
      this.lastObjectivesArray !== state.objectives
    ) {
      this.itemGrid.clear();
      if (state.loot) {
        for (const l of state.loot) {
          this.itemGrid.insert(l.pos, {
            id: l.id,
            pos: l.pos,
            mustBeInLOS: true,
            type: "loot",
          });
        }
      }

      if (state.objectives) {
        for (const o of state.objectives) {
          if (
            o.state === "Pending" &&
            (o.kind === "Recover" || o.kind === "Escort" || o.kind === "Kill")
          ) {
            let pos: Vector2 = { x: MOVEMENT.CENTER_OFFSET, y: MOVEMENT.CENTER_OFFSET };
            if (o.targetCell) {
              pos = {
                x: o.targetCell.x + MOVEMENT.CENTER_OFFSET,
                y: o.targetCell.y + MOVEMENT.CENTER_OFFSET,
              };
            } else if (o.targetEnemyId) {
              const enemy = state.enemies.find((e) => e.id === o.targetEnemyId);
              if (enemy) pos = enemy.pos;
            }
            this.itemGrid.insert(pos, {
              id: o.id,
              pos,
              mustBeInLOS: o.kind === "Recover",
              visible: o.visible,
              type: "objective",
            });
          }
        }
      }
      this.lastLootArray = state.loot;
      this.lastObjectivesArray = state.objectives;
    }

    // Query items in visible cells
    const visibleItemsFromGrid = this.itemGrid.queryByKeys(
      state.visibleCells || [],
    );

    // Include objectives that are marked as visible even if not in a currently visible cell
    const alwaysVisibleObjectives = (state.objectives || [])
      .filter((o) => o.visible && o.state === "Pending" && (o.kind === "Recover" || o.kind === "Escort" || o.kind === "Kill"))
      .map((o) => {
        let pos: Vector2 = { x: MOVEMENT.CENTER_OFFSET, y: MOVEMENT.CENTER_OFFSET };
        if (o.targetCell) {
          pos = {
            x: o.targetCell.x + MOVEMENT.CENTER_OFFSET,
            y: o.targetCell.y + MOVEMENT.CENTER_OFFSET,
          };
        } else if (o.targetEnemyId) {
          const enemy = state.enemies.find((e) => e.id === o.targetEnemyId);
          if (enemy) pos = enemy.pos;
        }
        return {
          id: o.id,
          pos,
          mustBeInLOS: o.kind === "Recover",
          visible: o.visible,
        };
      });

    // Merge and deduplicate (though queryByKeys shouldn't overlap with alwaysVisible if they are in different cells)
    // Actually, simple way is to use a Map to deduplicate by ID
    const allVisibleItemsMap = new Map<string, any>();
    for (const item of visibleItemsFromGrid) {
      allVisibleItemsMap.set(item.id, item);
    }
    for (const item of alwaysVisibleObjectives) {
      allVisibleItemsMap.set(item.id, item);
    }

    const allVisibleItems = Array.from(allVisibleItemsMap.values());

    const capableUnits = state.units.filter((u) => {
      if (
        u.hp <= 0 ||
        u.state === UnitState.Dead ||
        u.state === UnitState.Extracted
      )
        return false;

      // Only consider units that can actually perform autonomous opportunistic pickups
      if (u.archetypeId === "vip") return false;
      if (u.aiEnabled === false) return false;
      if (u.commandQueue.length > 0) return false;

      return true;
    });

    if (capableUnits.length > 0) {
      for (const item of allVisibleItems) {
        // Find closest unit by Euclidean distance
        let closestUnit = capableUnits[0];
        let minDist = MathUtils.getDistance(closestUnit.pos, item.pos);
        for (let i = 1; i < capableUnits.length; i++) {
          const d = MathUtils.getDistance(capableUnits[i].pos, item.pos);
          if (d < minDist) {
            minDist = d;
            closestUnit = capableUnits[i];
          }
        }
        itemAssignments.set(item.id, closestUnit.id);
      }
    }

    const explorationClaims = new Map<string, Vector2>();
    for (const u of state.units) {
      if (u.explorationTarget) {
        explorationClaims.set(u.id, u.explorationTarget);
      }
    }

    const aiContext: AIContext = {
      agentControlEnabled: this.agentControlEnabled,
      totalFloorCells: this.totalFloorCells,
      gridState: state.gridState, // Pass gridState instead of sets
      claimedObjectives,
      explorationClaims,
      itemAssignments,
      itemGrid: this.itemGrid,
      executeCommand: (u, cmd, s, isManual, dir) =>
        this.commandExecutor.executeCommand(u, cmd, s, isManual, dir),
    };

    const updatedUnits = state.units.map((unit) => {
      if (unit.state === UnitState.Extracted || unit.hp <= 0) return unit;

      // Ensure stats are up to date
      let currentUnit = this.statsManager.recalculateStats(unit);

      // 1. COMMAND QUEUE (Execute next pending command)
      // We do this FIRST so that movement can react to it in the same tick
      // Only process if unit is truly idle (no active command, or just exploring)
      if (
        currentUnit.state === UnitState.Idle &&
        (!currentUnit.activeCommand ||
          currentUnit.activeCommand.type === CommandType.EXPLORE) &&
        currentUnit.commandQueue.length > 0
      ) {
        const nextCmd = currentUnit.commandQueue[0];
        const nextQueue = currentUnit.commandQueue.slice(1);
        currentUnit = { ...currentUnit, commandQueue: nextQueue };
        if (nextCmd) {
          currentUnit = this.commandExecutor.executeCommand(
            currentUnit,
            nextCmd,
            state,
            true,
            director,
          );
        }
      }

      // 2. ESCORT DATA (Apply formation offsets and speed sync)
      const eData = escortData.get(currentUnit.id);
      if (eData) {
        if (eData.stopEscorting) {
          currentUnit = {
            ...currentUnit,
            activeCommand: undefined,
            state: UnitState.Idle,
          };
        } else {
          if (eData.matchedSpeed !== undefined) {
            currentUnit = {
              ...currentUnit,
              stats: { ...currentUnit.stats, speed: eData.matchedSpeed },
            };
          }

          const targetCell = eData.targetCell;
          const distToCenter = MathUtils.getDistance(currentUnit.pos, {
            x: targetCell.x + MOVEMENT.CENTER_OFFSET,
            y: targetCell.y + MOVEMENT.CENTER_OFFSET,
          });

          // Update escort's movement if not at center of target cell
          if (distToCenter > MOVEMENT.ARRIVAL_THRESHOLD * 2) {
            if (
              !currentUnit.targetPos ||
              Math.floor(currentUnit.targetPos.x) !== targetCell.x ||
              Math.floor(currentUnit.targetPos.y) !== targetCell.y
            ) {
              const path = this.pathfinder.findPath(
                {
                  x: Math.floor(currentUnit.pos.x),
                  y: Math.floor(currentUnit.pos.y),
                },
                targetCell,
                true,
              );
              if (path) {
                if (path.length > 0) {
                  currentUnit = {
                    ...currentUnit,
                    path,
                    targetPos: {
                      x: path[0].x + MOVEMENT.CENTER_OFFSET + (currentUnit.visualJitter?.x || 0),
                      y: path[0].y + MOVEMENT.CENTER_OFFSET + (currentUnit.visualJitter?.y || 0),
                    },
                    state: UnitState.Moving,
                  };
                } else {
                  currentUnit = {
                    ...currentUnit,
                    path: undefined,
                    targetPos: {
                      x: targetCell.x + MOVEMENT.CENTER_OFFSET + (currentUnit.visualJitter?.x || 0),
                      y: targetCell.y + MOVEMENT.CENTER_OFFSET + (currentUnit.visualJitter?.y || 0),
                    },
                    state: UnitState.Moving,
                  };
                }
              }
            }
          }
        }
      }

      // 3. CHANNELING (Handle timed actions)
      if (currentUnit.state === UnitState.Channeling && currentUnit.channeling) {
        const channeling = { ...currentUnit.channeling };
        channeling.remaining -= realDt;
        if (channeling.remaining <= 0) {
          if (channeling.action === "Extract") {
            if (currentUnit.carriedObjectiveId) {
              const objectiveId = currentUnit.carriedObjectiveId;
              state.objectives = state.objectives.map((o) =>
                o.id === objectiveId ? { ...o, state: "Completed" as const } : o,
              );
            }
            return {
              ...currentUnit,
              state: UnitState.Extracted,
              channeling: undefined,
            };
          } else if (channeling.action === "Collect") {
            if (channeling.targetId) {
              const targetId = channeling.targetId;
              const obj = state.objectives.find((o) => o.id === targetId);
              if (obj) {
                if (obj.id.startsWith("artifact")) {
                  currentUnit = {
                    ...currentUnit,
                    carriedObjectiveId: obj.id,
                  };
                  currentUnit = this.statsManager.recalculateStats(currentUnit);
                } else {
                  state.objectives = state.objectives.map((o) =>
                    o.id === targetId ? { ...o, state: "Completed" as const } : o,
                  );
                }
              }
            }
            return {
              ...currentUnit,
              state: UnitState.Idle,
              channeling: undefined,
            };
          } else if (channeling.action === "Pickup") {
            if (channeling.targetId) {
              const loot = state.loot?.find((l) => l.id === channeling.targetId);
              if (loot) {
                if (loot.objectiveId) {
                  currentUnit = {
                    ...currentUnit,
                    carriedObjectiveId: loot.objectiveId,
                  };
                  currentUnit = this.statsManager.recalculateStats(currentUnit);
                } else {
                  // Regular item
                  const itemId = loot.itemId;
                  if (itemId !== "scrap_crate") {
                    state.squadInventory[itemId] =
                      (state.squadInventory[itemId] || 0) + 1;
                  }
                  lootManager.awardScrap(state, itemId);
                }
                lootManager.removeLoot(state, loot.id);
              }
            }
            return {
              ...currentUnit,
              state: UnitState.Idle,
              channeling: undefined,
            };
          } else if (channeling.action === "UseItem") {
            if (
              currentUnit.activeCommand &&
              currentUnit.activeCommand.type === CommandType.USE_ITEM
            ) {
              const cmd = currentUnit.activeCommand;
              const count = state.squadInventory[cmd.itemId] || 0;
              if (count > 0) {
                state.squadInventory[cmd.itemId] = count - 1;
                if (director) {
                  director.handleUseItem(state, cmd);
                  // Sync back hp in case of self-heal (director mutates state.units)
                  const mutated = state.units.find((u) => u.id === currentUnit.id);
                  if (mutated) {
                    currentUnit = { ...currentUnit, hp: mutated.hp };
                  }
                }
              }
            }
            return {
              ...currentUnit,
              state: UnitState.Idle,
              channeling: undefined,
              activeCommand: undefined,
            };
          }
        } else {
          return { ...currentUnit, channeling };
        }
      }

      // 4. COMBAT (Unit's own attacks)
      const combatResult = this.combatManager.update(currentUnit, state, prng);
      currentUnit = combatResult.unit;
      const isAttacking = combatResult.isAttacking;

      // 5. MOVEMENT (Execute current path)
      const isMoving = !!currentUnit.targetPos;
      const enemiesInSameCell = state.enemies.filter(
        (enemy) =>
          enemy.hp > 0 &&
          Math.floor(enemy.pos.x) === Math.floor(currentUnit.pos.x) &&
          Math.floor(enemy.pos.y) === Math.floor(currentUnit.pos.y),
      );
      const isLockedInMelee = enemiesInSameCell.length > 0;

      if (isMoving && currentUnit.targetPos) {
        if (isLockedInMelee) {
          currentUnit = { ...currentUnit, state: UnitState.Attacking };
        } else if (!isAttacking) {
          currentUnit = this.movementManager.handleMovement(
            currentUnit,
            dt,
            doors,
          );
        } else {
          // If we are RUSHing or RETREATing, we SHOULD be allowed to move while attacking
          if (
            currentUnit.aiProfile === "RUSH" ||
            currentUnit.aiProfile === "RETREAT" ||
            currentUnit.activeCommand?.type === CommandType.ESCORT_UNIT
          ) {
            currentUnit = this.movementManager.handleMovement(
              currentUnit,
              dt,
              doors,
            );
            // Ensure state reflects attacking if we moved while attacking
            if (currentUnit.state === UnitState.Moving) {
              currentUnit = { ...currentUnit, state: UnitState.Attacking };
            }
          }
        }
      } else if (!isAttacking && !isMoving) {
        currentUnit = { ...currentUnit, state: UnitState.Idle };
        // Clear non-persistent active commands if Idle
        if (
          currentUnit.activeCommand?.type !== CommandType.PICKUP &&
          currentUnit.activeCommand?.type !== CommandType.ESCORT_UNIT &&
          currentUnit.activeCommand?.type !== CommandType.EXPLORE &&
          currentUnit.activeCommand?.type !== CommandType.OVERWATCH_POINT &&
          currentUnit.activeCommand?.type !== CommandType.USE_ITEM &&
          currentUnit.activeCommand?.type !== CommandType.EXTRACT
        ) {
          currentUnit = { ...currentUnit, activeCommand: undefined };
        }
      }

      // 6. AI PROCESS (React to new position/state)
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
   * Executes a specific command for a unit, updating its state or path.
   * @param unit The unit receiving the command
   * @param cmd The command to execute
   * @param state The current game state
   * @param isManual Whether the command was issued by a player (disables AI)
   * @param director Optional director for global ability effects
   * @returns A new unit reference with the command applied
   */
  public executeCommand(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean = true,
    director?: IDirector,
  ): Unit {
    return this.commandExecutor.executeCommand(unit, cmd, state, isManual, director);
  }
}