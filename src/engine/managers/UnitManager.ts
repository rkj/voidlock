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
  Enemy,
  ItemLibrary,
  AIProfile,
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

const EPSILON = 0.05;

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
    private los: LineOfSight,
    private agentControlEnabled: boolean,
  ) {
    this.totalFloorCells = gameGrid
      .getGraph()
      .cells.flat()
      .filter((c) => c.type === "Floor").length;
    this.statsManager = new StatsManager();
    this.movementManager = new MovementManager(gameGrid);
    this.combatManager = new CombatManager(los, this.statsManager);
    this.unitAi = new UnitAI(gameGrid, pathfinder, los);
    this.commandExecutor = new CommandExecutor(pathfinder);
  }

  public recalculateStats(unit: Unit) {
    this.statsManager.recalculateStats(unit);
  }

  public update(
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    prng: PRNG,
    lootManager: LootManager,
    director?: any,
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
      { targetCell: Vector2; matchedSpeed?: number }
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
          e.activeCommand = undefined;
          e.state = UnitState.Idle;
        });
        continue;
      }

      // Sort escorts by ID for stable role assignment
      escorts.sort((a, b) => a.id.localeCompare(b.id));

      // Determine target's heading
      let heading = { x: 0, y: -1 }; // Default North
      if (targetUnit.targetPos) {
        const dx = targetUnit.targetPos.x - targetUnit.pos.x;
        const dy = targetUnit.targetPos.y - targetUnit.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.1) {
          heading = { x: dx / dist, y: dy / dist };
        }
      } else if (targetUnit.path && targetUnit.path.length > 0) {
        const dx = targetUnit.path[0].x + 0.5 - targetUnit.pos.x;
        const dy = targetUnit.path[0].y + 0.5 - targetUnit.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.1) {
          heading = { x: dx / dist, y: dy / dist };
        }
      }

      const perp = { x: -heading.y, y: heading.x };

      escorts.forEach((escort, index) => {
        this.statsManager.recalculateStats(escort);
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
        const distToSlot = this.getDistance(escort.pos, {
          x: targetCell.x + 0.5,
          y: targetCell.y + 0.5,
        });
        if (distToSlot <= 0.8) {
          matchedSpeed = Math.min(escort.stats.speed, targetUnit.stats.speed);
        }

        escortData.set(escort.id, { targetCell, matchedSpeed });
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

    const newVisibleCellsSet = new Set(state.visibleCells);
    const discoveredCellsSet = new Set(state.discoveredCells);

    const aiContext: AIContext = {
      agentControlEnabled: this.agentControlEnabled,
      totalFloorCells: this.totalFloorCells,
      newVisibleCellsSet,
      discoveredCellsSet,
      claimedObjectives,
      executeCommand: (u, cmd, s, isManual, dir) =>
        this.commandExecutor.executeCommand(u, cmd, s, isManual, dir),
    };

    state.units.forEach((unit) => {
      if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead)
        return;

      // Apply escort speed and target cell if applicable
      const eData = escortData.get(unit.id);
      if (eData) {
        if (eData.matchedSpeed !== undefined) {
          unit.stats.speed = eData.matchedSpeed;
        }

        const targetCell = eData.targetCell;
        const distToCenter = this.getDistance(unit.pos, {
          x: targetCell.x + 0.5,
          y: targetCell.y + 0.5,
        });

        // Update escort's movement if not at center of target cell
        if (distToCenter > 0.1) {
          if (
            !unit.targetPos ||
            Math.floor(unit.targetPos.x) !== targetCell.x ||
            Math.floor(unit.targetPos.y) !== targetCell.y
          ) {
            const path = this.pathfinder.findPath(
              { x: Math.floor(unit.pos.x), y: Math.floor(unit.pos.y) },
              targetCell,
              true,
            );
            if (path) {
              if (path.length > 0) {
                unit.path = path;
                unit.targetPos = {
                  x: path[0].x + 0.5 + (unit.visualJitter?.x || 0),
                  y: path[0].y + 0.5 + (unit.visualJitter?.y || 0),
                };
              } else {
                unit.path = undefined;
                unit.targetPos = {
                  x: targetCell.x + 0.5 + (unit.visualJitter?.x || 0),
                  y: targetCell.y + 0.5 + (unit.visualJitter?.y || 0),
                };
              }
              unit.state = UnitState.Moving;
            }
          }
        }
      }

      if (unit.state === UnitState.Channeling && unit.channeling) {
        unit.channeling.remaining -= realDt;
        if (unit.channeling.remaining <= 0) {
          if (unit.channeling.action === "Extract") {
            unit.state = UnitState.Extracted;
            unit.channeling = undefined;
            return;
          } else if (unit.channeling.action === "Collect") {
            if (unit.channeling.targetId) {
              const obj = state.objectives.find(
                (o) => o.id === unit.channeling!.targetId,
              );
              if (obj) {
                obj.state = "Completed";
                if (obj.id.startsWith("artifact")) {
                  unit.carriedObjectiveId = obj.id;
                  this.statsManager.recalculateStats(unit);
                }
              }
            }
            unit.state = UnitState.Idle;
            unit.channeling = undefined;
            return;
          } else if (unit.channeling.action === "Pickup") {
            if (unit.channeling.targetId) {
              const loot = state.loot?.find(
                (l) => l.id === unit.channeling!.targetId,
              );
              if (loot) {
                if (loot.objectiveId) {
                  unit.carriedObjectiveId = loot.objectiveId;
                  this.statsManager.recalculateStats(unit);
                } else {
                  // Regular item
                  const itemId = loot.itemId;
                  state.squadInventory[itemId] =
                    (state.squadInventory[itemId] || 0) + 1;
                }
                lootManager.removeLoot(state, loot.id);
              }
            }
            unit.state = UnitState.Idle;
            unit.channeling = undefined;
            return;
          } else if (unit.channeling.action === "UseItem") {
            if (unit.activeCommand && unit.activeCommand.type === CommandType.USE_ITEM) {
              const cmd = unit.activeCommand;
              const count = state.squadInventory[cmd.itemId] || 0;
              if (count > 0) {
                state.squadInventory[cmd.itemId] = count - 1;
                if (director) {
                  director.handleUseItem(state, cmd);
                }
              }
            }
            unit.state = UnitState.Idle;
            unit.channeling = undefined;
            unit.activeCommand = undefined;
            return;
          }
        } else {
          return;
        }
      }

      this.unitAi.process(unit, state, dt, doors, prng, aiContext, director);

      if (unit.state === UnitState.Channeling) {
        return;
      }

      if (unit.state === UnitState.Idle && unit.commandQueue.length > 0) {
        const nextCmd = unit.commandQueue.shift();
        if (nextCmd) {
          this.commandExecutor.executeCommand(unit, nextCmd, state, true, director);
        }
      }

      const isAttacking = this.combatManager.update(
        unit,
        state,
        dt,
        prng,
        newVisibleCellsSet,
      );

      const isMoving = (unit.path && unit.path.length > 0) || !!unit.targetPos;
      const enemiesInSameCell = state.enemies.filter(
        (enemy) =>
          enemy.hp > 0 &&
          Math.floor(enemy.pos.x) === Math.floor(unit.pos.x) &&
          Math.floor(enemy.pos.y) === Math.floor(unit.pos.y),
      );
      const isLockedInMelee = enemiesInSameCell.length > 0;

      if (isMoving && unit.targetPos && unit.path) {
        if (isLockedInMelee) {
          unit.state = UnitState.Attacking;
        } else if (!isAttacking) {
          this.movementManager.handleMovement(unit, dt, doors);
        } else {
          // If we are RUSHing or RETREATing, we SHOULD be allowed to move while attacking
          if (
            unit.aiProfile === "RUSH" ||
            unit.aiProfile === "RETREAT" ||
            unit.activeCommand?.type === CommandType.ESCORT_UNIT
          ) {
            this.movementManager.handleMovement(unit, dt, doors);
            // Ensure state reflects attacking if we moved while attacking
            if (unit.state === UnitState.Moving) {
              unit.state = UnitState.Attacking;
            }
          }
        }
      } else if (!isAttacking && !isMoving) {
        if (unit.state !== UnitState.WaitingForDoor) {
          unit.state = UnitState.Idle;
          if (
            unit.activeCommand?.type !== CommandType.PICKUP &&
            unit.activeCommand?.type !== CommandType.ESCORT_UNIT &&
            unit.activeCommand?.type !== CommandType.EXPLORE &&
            unit.activeCommand?.type !== CommandType.OVERWATCH_POINT &&
            unit.activeCommand?.type !== CommandType.EXTRACT
          ) {
            unit.activeCommand = undefined;
          }
        }
      }
    });
  }

  public executeCommand(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean = true,
    director?: any,
  ) {
    this.commandExecutor.executeCommand(unit, cmd, state, isManual, director);
  }

  private getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
