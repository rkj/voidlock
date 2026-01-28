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
import { isCellVisible } from "../../shared/VisibilityUtils";
import { IDirector } from "../interfaces/IDirector";
import { MathUtils } from "../../shared/utils/MathUtils";

export class UnitManager {
  private totalFloorCells: number;
  private statsManager: StatsManager;
  private movementManager: MovementManager;
  private combatManager: CombatManager;
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
    const claimedObjectives = new Set<string>();

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

      // Sort escorts by ID for stable role assignment
      escorts.sort((a, b) => a.id.localeCompare(b.id));

      // Determine target's heading
      let heading = { x: 0, y: -1 }; // Default North
      if (targetUnit.targetPos) {
        const dist = MathUtils.getDistance(targetUnit.pos, targetUnit.targetPos);
        if (dist > 0.1) {
          heading = {
            x: (targetUnit.targetPos.x - targetUnit.pos.x) / dist,
            y: (targetUnit.targetPos.y - targetUnit.pos.y) / dist,
          };
        }
      } else if (targetUnit.path && targetUnit.path.length > 0) {
        const targetPoint = {
          x: targetUnit.path[0].x + 0.5,
          y: targetUnit.path[0].y + 0.5,
        };
        const dist = MathUtils.getDistance(targetUnit.pos, targetPoint);
        if (dist > 0.1) {
          heading = {
            x: (targetPoint.x - targetUnit.pos.x) / dist,
            y: (targetPoint.y - targetUnit.pos.y) / dist,
          };
        }
      }

      const perp = { x: -heading.y, y: heading.x };

      escorts.forEach((escort, index) => {
        const updatedEscort = this.statsManager.recalculateStats(escort);
        let formationOffset = { x: 0, y: 0 };
        if (index === 0) {
          // Vanguard
          formationOffset = {
            x: Math.round(heading.x),
            y: Math.round(heading.y),
          };
        } else if (index === 1) {
          // Rearguard
          formationOffset = {
            x: -Math.round(heading.x),
            y: -Math.round(heading.y),
          };
        } else {
          // Bodyguard
          const side = (index - 2) % 2 === 0 ? 1 : -1;
          const depth = Math.floor((index - 2) / 2);
          // Stay adjacent (left or right)
          formationOffset = {
            x: Math.round(perp.x * side),
            y: Math.round(perp.y * side),
          };
          if (depth > 0) {
            // If many bodyguards, push them back slightly to spread out
            formationOffset.x -= Math.round(heading.x * depth);
            formationOffset.y -= Math.round(heading.y * depth);
          }
        }

        const targetCell = {
          x: Math.floor(targetUnit.pos.x) + formationOffset.x,
          y: Math.floor(targetUnit.pos.y) + formationOffset.y,
        };

        // Validate target cell
        if (!this.gameGrid.isWalkable(targetCell.x, targetCell.y)) {
          // Fallback to target's cell if formation slot is blocked
          targetCell.x = Math.floor(targetUnit.pos.x);
          targetCell.y = Math.floor(targetUnit.pos.y);
        }

        let matchedSpeed: number | undefined = undefined;
        const distToSlot = MathUtils.getDistance(updatedEscort.pos, {
          x: targetCell.x + 0.5,
          y: targetCell.y + 0.5,
        });
        if (distToSlot <= 0.8) {
          matchedSpeed = Math.min(updatedEscort.stats.speed, targetUnit.stats.speed);
        }

        escortData.set(updatedEscort.id, { targetCell, matchedSpeed });
      });
    }

    // Pre-populate claimed objectives from units already pursuing them
    state.units.forEach((u) => {
      if (u.state === UnitState.Dead || u.state === UnitState.Extracted) return;
      if (u.channeling?.targetId) {
        claimedObjectives.add(u.channeling.targetId);
      }
      // If unit has a forced target that is an objective
      if (u.forcedTargetId) {
        const obj = state.objectives?.find(
          (o) => o.targetEnemyId === u.forcedTargetId,
        );
        if (obj) claimedObjectives.add(obj.id);
      }
      // If unit has an active command targeting an objective
      if (u.activeCommand?.type === CommandType.PICKUP) {
        const cmd = u.activeCommand as PickupCommand;
        claimedObjectives.add(cmd.lootId);
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
        if (obj) claimedObjectives.add(obj.id);
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

    state.units = state.units.map((unit) => {
      if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead)
        return unit;

      let currentUnit = unit;

      // Apply escort speed and target cell if applicable
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
              }
            }
          }
        }
      }

      if (currentUnit.state === UnitState.Channeling && currentUnit.channeling) {
        const channeling = { ...currentUnit.channeling };
        channeling.remaining -= realDt;
        if (channeling.remaining <= 0) {
          if (channeling.action === "Extract") {
            return {
              ...currentUnit,
              state: UnitState.Extracted,
              channeling: undefined,
            };
          } else if (channeling.action === "Collect") {
            if (channeling.targetId) {
              const obj = state.objectives.find(
                (o) => o.id === channeling.targetId,
              );
              if (obj) {
                obj.state = "Completed";
                if (obj.id.startsWith("artifact")) {
                  currentUnit = {
                    ...currentUnit,
                    carriedObjectiveId: obj.id,
                  };
                  currentUnit = this.statsManager.recalculateStats(currentUnit);
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

      // Ensure we are working on a copy before passing to AI, which mutates
      if (currentUnit === unit) {
        currentUnit = { ...unit };
      }

      this.unitAi.process(
        currentUnit,
        state,
        dt,
        doors,
        prng,
        aiContext,
        director,
      );

      if (currentUnit.state === UnitState.Channeling) {
        return currentUnit;
      }

      if (
        currentUnit.state === UnitState.Idle &&
        currentUnit.commandQueue.length > 0
      ) {
        const nextCmd = currentUnit.commandQueue[0];
        const nextQueue = currentUnit.commandQueue.slice(1);
        currentUnit = { ...currentUnit, commandQueue: nextQueue };
        if (nextCmd) {
          this.commandExecutor.executeCommand(
            currentUnit,
            nextCmd,
            state,
            true,
            director,
          );
          if (currentUnit.state === UnitState.Channeling) {
            return currentUnit;
          }
        }
      }

      const combatResult = this.combatManager.update(currentUnit, state, prng);
      currentUnit = combatResult.unit;
      const isAttacking = combatResult.isAttacking;

      const isMoving =
        (currentUnit.path && currentUnit.path.length > 0) ||
        !!currentUnit.targetPos;
      const enemiesInSameCell = state.enemies.filter(
        (enemy) =>
          enemy.hp > 0 &&
          Math.floor(enemy.pos.x) === Math.floor(currentUnit.pos.x) &&
          Math.floor(enemy.pos.y) === Math.floor(currentUnit.pos.y),
      );
      const isLockedInMelee = enemiesInSameCell.length > 0;

      if (isMoving && currentUnit.targetPos && currentUnit.path) {
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

      return currentUnit;
    });
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
