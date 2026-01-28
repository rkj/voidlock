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
import { isCellVisible } from "../../shared/VisibilityUtils";
import { IDirector } from "../interfaces/IDirector";
import { MathUtils } from "../../shared/utils/MathUtils";

export class UnitManager {
  private totalFloorCells: number;
  private statsManager: StatsManager;
  private movementManager: MovementManager;
  private combatManager: CombatManager;
  private formationManager: FormationManager;
  private unitAi: UnitAI;
  private commandExecutor: CommandExecutor;

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
  }

  public recalculateStats(unit: Unit): Unit {
    return this.statsManager.recalculateStats(unit);
  }

  public getCombatManager(): CombatManager {
    return this.combatManager;
  }

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
    state.units.forEach((u) => {
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
    });

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
        escorts.forEach((e) => {
          escortData.set(e.id, { targetCell: { x: 0, y: 0 }, stopEscorting: true });
        });
        continue;
      }

      const roles = this.formationManager.assignEscortRoles(escorts, targetUnit, this.gameGrid);
      for (const [unitId, slot] of roles) {
        escortData.set(unitId, slot);
      }
    }


    // Pre-populate claimed objectives from units already pursuing them
    state.units.forEach((u) => {
      if (u.state === UnitState.Dead || u.state === UnitState.Extracted) return;
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
    });

    // Pre-pass for item competition (Opportunistic Pickups & General Objectives)
    const itemAssignments = new Map<string, string>(); // itemId -> unitId
    const allVisibleItems = [
      ...(state.loot || []).map((l) => ({
        id: l.id,
        pos: l.pos,
        mustBeInLOS: true,
      })),
      ...(state.objectives || [])
        .filter(
          (o) =>
            o.state === "Pending" &&
            (o.kind === "Recover" || o.kind === "Escort" || o.kind === "Kill"),
        )
        .map((o) => {
          let pos = { x: 0.5, y: 0.5 };
          if (o.targetCell) {
            pos = { x: o.targetCell.x + 0.5, y: o.targetCell.y + 0.5 };
          } else if (o.targetEnemyId) {
            const enemy = state.enemies.find((e) => e.id === o.targetEnemyId);
            if (enemy) pos = enemy.pos;
          }
          return {
            id: o.id,
            pos,
            mustBeInLOS: o.kind === "Recover", // Recoveries are usually opportunistic if not known
            visible: o.visible,
          };
        }),
    ].filter((item) => {
      if ("visible" in item && item.visible) return true;
      return isCellVisible(
        state,
        Math.floor(item.pos.x),
        Math.floor(item.pos.y),
      );
    });

    allVisibleItems.forEach((item) => {
      const unitsSeeingItem = state.units.filter((u) => {
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

      if (unitsSeeingItem.length > 0) {
        // Find closest unit by Euclidean distance
        const closestUnit = unitsSeeingItem.sort(
          (a, b) =>
            MathUtils.getDistance(a.pos, item.pos) -
            MathUtils.getDistance(b.pos, item.pos),
        )[0];
        itemAssignments.set(item.id, closestUnit.id);
      }
    });

    const aiContext: AIContext = {
      agentControlEnabled: this.agentControlEnabled,
      totalFloorCells: this.totalFloorCells,
      gridState: state.gridState, // Pass gridState instead of sets
      claimedObjectives,
      itemAssignments,
      executeCommand: (u, cmd, s, isManual, dir) =>
        this.commandExecutor.executeCommand(u, cmd, s, isManual, dir),
    };

    for (let i = 0; i < state.units.length; i++) {
      const unit = state.units[i];
      if (unit.state === UnitState.Extracted || unit.hp <= 0) continue;

      // Ensure stats are up to date and array is synchronized early
      state.units[i] = this.statsManager.recalculateStats(unit);
      let currentUnit = state.units[i];

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
        state.units[i] = currentUnit; // Keep array in sync
        if (nextCmd) {
          this.commandExecutor.executeCommand(
            currentUnit,
            nextCmd,
            state,
            true,
            director,
          );
          // executeCommand mutates currentUnit in-place (usually), 
          // but we re-fetch just in case it was replaced
          currentUnit = state.units[i];
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
          state.units[i] = currentUnit;
        } else {
          if (eData.matchedSpeed !== undefined) {
            currentUnit = {
              ...currentUnit,
              stats: { ...currentUnit.stats, speed: eData.matchedSpeed },
            };
            state.units[i] = currentUnit;
          }

          const targetCell = eData.targetCell;
          const distToCenter = MathUtils.getDistance(currentUnit.pos, {
            x: targetCell.x + 0.5,
            y: targetCell.y + 0.5,
          });

          // Update escort's movement if not at center of target cell
          if (distToCenter > 0.1) {
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
                      x: path[0].x + 0.5 + (currentUnit.visualJitter?.x || 0),
                      y: path[0].y + 0.5 + (currentUnit.visualJitter?.y || 0),
                    },
                    state: UnitState.Moving,
                  };
                } else {
                  currentUnit = {
                    ...currentUnit,
                    path: undefined,
                    targetPos: {
                      x: targetCell.x + 0.5 + (currentUnit.visualJitter?.x || 0),
                      y: targetCell.y + 0.5 + (currentUnit.visualJitter?.y || 0),
                    },
                    state: UnitState.Moving,
                  };
                }
                state.units[i] = currentUnit;
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
              const obj = state.objectives.find(
                (o) => o.id === currentUnit.carriedObjectiveId,
              );
              if (obj) {
                obj.state = "Completed";
              }
            }
            state.units[i] = {
              ...currentUnit,
              state: UnitState.Extracted,
              channeling: undefined,
            };
            continue;
          } else if (channeling.action === "Collect") {
            if (channeling.targetId) {
              const obj = state.objectives.find(
                (o) => o.id === channeling.targetId,
              );
              if (obj) {
                if (obj.id.startsWith("artifact")) {
                  currentUnit = {
                    ...currentUnit,
                    carriedObjectiveId: obj.id,
                  };
                  currentUnit = this.statsManager.recalculateStats(currentUnit);
                } else {
                  obj.state = "Completed";
                }
              }
            }
            state.units[i] = {
              ...currentUnit,
              state: UnitState.Idle,
              channeling: undefined,
            };
            continue;
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
            state.units[i] = {
              ...currentUnit,
              state: UnitState.Idle,
              channeling: undefined,
            };
            continue;
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
                  // CRITICAL: Ensure state.units[i] is currentUnit so director can find and mutate it
                  state.units[i] = currentUnit;
                  director.handleUseItem(state, cmd);
                  // Refresh currentUnit from state in case of mutations
                  currentUnit = state.units[i];
                }
              }
            }
            state.units[i] = {
              ...currentUnit,
              state: UnitState.Idle,
              channeling: undefined,
              activeCommand: undefined,
            };
            continue;
          }
        } else {
          state.units[i] = { ...currentUnit, channeling };
          continue; // Still channeling, so we skip movement/AI
        }
      }

      // 4. COMBAT (Unit's own attacks)
      const combatResult = this.combatManager.update(currentUnit, state, prng);
      currentUnit = combatResult.unit;
      state.units[i] = currentUnit;
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
          state.units[i] = currentUnit;
        } else if (!isAttacking) {
          currentUnit = this.movementManager.handleMovement(
            currentUnit,
            dt,
            doors,
          );
          state.units[i] = currentUnit;
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
            state.units[i] = currentUnit;
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
        state.units[i] = currentUnit;
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

      // Save final updated unit back to state
      state.units[i] = currentUnit;
    }
  }

  public executeCommand(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean = true,
    director?: IDirector,
  ) {
    this.commandExecutor.executeCommand(unit, cmd, state, isManual, director);
  }
}