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
import { VipAI } from "../ai/VipAI";
import { PRNG } from "../../shared/PRNG";
import { LootManager } from "./LootManager";
import { StatsManager } from "./StatsManager";
import { MovementManager } from "./MovementManager";
import { CombatManager } from "./CombatManager";

const EPSILON = 0.05;

export class UnitManager {
  private vipAi: VipAI;
  private totalFloorCells: number;
  private statsManager: StatsManager;
  private movementManager: MovementManager;
  private combatManager: CombatManager;

  constructor(
    private gameGrid: GameGrid,
    private pathfinder: Pathfinder,
    private los: LineOfSight,
    private agentControlEnabled: boolean,
  ) {
    this.vipAi = new VipAI(gameGrid, pathfinder, los);
    this.totalFloorCells = gameGrid
      .getGraph()
      .cells.flat()
      .filter((c) => c.type === "Floor").length;
    this.statsManager = new StatsManager();
    this.movementManager = new MovementManager(gameGrid);
    this.combatManager = new CombatManager(los, this.statsManager);
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
    const mapFullyDiscovered = this.isMapFullyDiscovered(state);

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

      if (unit.archetypeId === "vip" && !unit.aiEnabled) {
        const rescueSoldier = state.units.find(
          (u) =>
            u.id !== unit.id &&
            u.archetypeId !== "vip" &&
            u.hp > 0 &&
            (this.getDistance(unit.pos, u.pos) <= 1.5 ||
              this.los.hasLineOfSight(u.pos, unit.pos)),
        );
        if (rescueSoldier) {
          unit.aiEnabled = true;
        } else {
          // Locked VIPs don't do anything
          return;
        }
      }

      if (
        unit.archetypeId === "vip" &&
        unit.aiEnabled &&
        unit.state === UnitState.Idle &&
        unit.commandQueue.length === 0
      ) {
        const vipCommand = this.vipAi.think(unit, state);
        if (vipCommand) {
          this.executeCommand(unit, vipCommand, state, false, director);
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

      if (unit.explorationTarget) {
        const key = `${Math.floor(unit.explorationTarget.x)},${Math.floor(unit.explorationTarget.y)}`;
        if (discoveredCellsSet.has(key)) {
          unit.explorationTarget = undefined;
          if (unit.state === UnitState.Moving) {
            unit.path = undefined;
            unit.targetPos = undefined;
            unit.state = UnitState.Idle;
            unit.activeCommand = undefined;
          }
        }
      }

      const visibleEnemies = state.enemies.filter(
        (enemy) =>
          enemy.hp > 0 &&
          newVisibleCellsSet.has(
            `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`,
          ),
      );

      const threats = visibleEnemies
        .map((enemy) => ({
          enemy,
          distance: this.getDistance(unit.pos, enemy.pos),
          priority: 1 / (this.getDistance(unit.pos, enemy.pos) + 1),
        }))
        .sort((a, b) => b.priority - a.priority);

      const isLowHP = unit.hp < unit.maxHp * 0.25;
      const nearbyAllies = state.units.filter(
        (u) =>
          u.id !== unit.id &&
          u.hp > 0 &&
          u.state !== UnitState.Extracted &&
          u.state !== UnitState.Dead &&
          this.getDistance(unit.pos, u.pos) <= 5,
      );
      const isIsolated = nearbyAllies.length === 0 && threats.length > 0;

      if (unit.archetypeId !== "vip" && isLowHP && threats.length > 0) {
        const safeCells = state.discoveredCells.filter((cellKey) => {
          const [cx, cy] = cellKey.split(",").map(Number);
          return !visibleEnemies.some(
            (e) => Math.floor(e.pos.x) === cx && Math.floor(e.pos.y) === cy,
          );
        });

        if (safeCells.length > 0) {
          const closestSafe = safeCells
            .map((cellKey) => {
              const [cx, cy] = cellKey.split(",").map(Number);
              return {
                x: cx,
                y: cy,
                dist: this.getDistance(unit.pos, { x: cx + 0.5, y: cy + 0.5 }),
              };
            })
            .sort((a, b) => a.dist - b.dist)[0];

          if (
            unit.state !== UnitState.Moving ||
            !unit.targetPos ||
            Math.floor(unit.targetPos.x) !== closestSafe.x ||
            Math.floor(unit.targetPos.y) !== closestSafe.y
          ) {
            unit.engagementPolicy = "IGNORE";
            unit.engagementPolicySource = "Autonomous";
            this.executeCommand(
              unit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [unit.id],
                target: { x: closestSafe.x, y: closestSafe.y },
                label: "Retreating",
              },
              state,
              false,
              director,
            );
          }
        }
      } else if (unit.archetypeId !== "vip" && isIsolated) {
        const otherUnits = state.units.filter(
          (u) =>
            u.id !== unit.id &&
            u.hp > 0 &&
            u.state !== UnitState.Extracted &&
            u.state !== UnitState.Dead,
        );
        if (otherUnits.length > 0) {
          const closestAlly = otherUnits.sort(
            (a, b) =>
              this.getDistance(unit.pos, a.pos) -
              this.getDistance(unit.pos, b.pos),
          )[0];
          if (
            unit.state !== UnitState.Moving ||
            !unit.targetPos ||
            Math.floor(unit.targetPos.x) !== Math.floor(closestAlly.pos.x) ||
            Math.floor(unit.targetPos.y) !== Math.floor(closestAlly.pos.y)
          ) {
            unit.engagementPolicy = "IGNORE";
            unit.engagementPolicySource = "Autonomous";
            this.executeCommand(
              unit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [unit.id],
                target: {
                  x: Math.floor(closestAlly.pos.x),
                  y: Math.floor(closestAlly.pos.y),
                },
                label: "Grouping Up",
              },
              state,
              false,
              director,
            );
          }
        }
      } else {
        if (
          unit.engagementPolicy === "IGNORE" &&
          unit.engagementPolicySource === "Autonomous" &&
          unit.state === UnitState.Idle &&
          unit.commandQueue.length === 0
        ) {
          unit.engagementPolicy = "ENGAGE";
          unit.engagementPolicySource = undefined;
        }
      }

      if (state.loot) {
        const loot = state.loot.find(
          (l) =>
            Math.abs(unit.pos.x - l.pos.x) < 0.6 &&
            Math.abs(unit.pos.y - l.pos.y) < 0.6,
        );

        if (
          loot &&
          unit.activeCommand?.type === CommandType.PICKUP &&
          (unit.activeCommand as PickupCommand).lootId === loot.id
        ) {
          if (unit.state === UnitState.Idle) {
            const duration = 1000; // 1s as per spec
            unit.state = UnitState.Channeling;
            unit.channeling = {
              action: "Pickup",
              remaining: duration,
              totalDuration: duration,
              targetId: loot.id,
            };
            unit.path = undefined;
            unit.targetPos = undefined;
            unit.activeCommand = undefined;
          }
        }
      }

      if (unit.state === UnitState.Channeling) {
        return;
      }

      if (unit.archetypeId !== "vip" && state.objectives) {
        state.objectives.forEach((obj) => {
          if (obj.state === "Pending" && !claimedObjectives.has(obj.id)) {
            if (obj.kind === "Recover" && obj.targetCell) {
              if (
                Math.floor(unit.pos.x) === obj.targetCell.x &&
                Math.floor(unit.pos.y) === obj.targetCell.y
              ) {
                if (unit.state === UnitState.Idle) {
                  const duration = 5000 * (10 / unit.stats.speed);
                  unit.state = UnitState.Channeling;
                  unit.channeling = {
                    action: "Collect",
                    remaining: duration,
                    totalDuration: duration,
                    targetId: obj.id,
                  };

                  claimedObjectives.add(obj.id);
                  unit.path = undefined;
                  unit.targetPos = undefined;
                  unit.activeCommand = undefined;
                }
              }
            } else if (obj.kind === "Kill" && obj.targetEnemyId) {
              const target = state.enemies.find(
                (e) => e.id === obj.targetEnemyId,
              );
              if (!target || target.hp <= 0) {
                obj.state = "Completed";
              }
            }
          }
        });
      }

      if (state.map.extraction) {
        const ext = state.map.extraction;
        const allOtherObjectivesComplete = state.objectives
          .filter((o) => o.kind !== "Escort")
          .every((o) => o.state === "Completed");

        const isVipAtExtraction =
          unit.archetypeId === "vip" &&
          Math.floor(unit.pos.x) === ext.x &&
          Math.floor(unit.pos.y) === ext.y;

        const isExplicitExtract =
          unit.activeCommand?.type === CommandType.EXTRACT;

        if (
          (allOtherObjectivesComplete || isVipAtExtraction || isExplicitExtract) &&
          Math.floor(unit.pos.x) === ext.x &&
          Math.floor(unit.pos.y) === ext.y
        ) {
          if (unit.state === UnitState.Idle) {
            const duration = 5000 * (10 / unit.stats.speed);
            unit.state = UnitState.Channeling;
            unit.channeling = {
              action: "Extract",
              remaining: duration,
              totalDuration: duration,
            };
            unit.path = undefined;
            unit.targetPos = undefined;
            unit.activeCommand = undefined;
          }
        }
      }

      if (unit.state === UnitState.Channeling) {
        return;
      }

      if (unit.state === UnitState.Idle && unit.commandQueue.length > 0) {
        const nextCmd = unit.commandQueue.shift();
        if (nextCmd) {
          this.executeCommand(unit, nextCmd, state, true, director);
        }
      } else if (
        unit.archetypeId !== "vip" &&
        (unit.state === UnitState.Idle || unit.explorationTarget) &&
        unit.commandQueue.length === 0 &&
        this.agentControlEnabled &&
        unit.aiEnabled !== false
      ) {
        let actionTaken = false;

        if (threats.length > 0 && unit.engagementPolicy !== "IGNORE") {
          const primaryThreat = threats[0].enemy;
          const dist = this.getDistance(unit.pos, primaryThreat.pos);

          if (unit.aiProfile === "STAND_GROUND") {
            // Do not move to engage. Just hold position.
            // Attack logic elsewhere handles shooting if in range.
          } else if (unit.aiProfile === "RUSH") {
            // Move towards enemy to minimize distance, even if in range
            // Stop if very close (e.g. melee range)
            if (dist > 1.5) {
              this.executeCommand(
                unit,
                {
                  type: CommandType.MOVE_TO,
                  unitIds: [unit.id],
                  target: {
                    x: Math.floor(primaryThreat.pos.x),
                    y: Math.floor(primaryThreat.pos.y),
                  },
                  label: "Rushing",
                },
                state,
                false,
                director,
              );
              actionTaken = true;
            }
          } else if (unit.aiProfile === "RETREAT") {
            // Maximize distance while maintaining LOF
            // Simple implementation: Move away from enemy if close
            // But try to stay within attackRange
            if (dist < unit.stats.attackRange * 0.8) {
              // Too close, back off
              // Find a cell further away but still in range/LOF?
              // For now, just simplistic "run away" to a safe cell if possible, or just away from enemy vector

              // Find neighbors that increase distance
              const currentCell = {
                x: Math.floor(unit.pos.x),
                y: Math.floor(unit.pos.y),
              };
              const neighbors = [
                { x: currentCell.x + 1, y: currentCell.y },
                { x: currentCell.x - 1, y: currentCell.y },
                { x: currentCell.x, y: currentCell.y + 1 },
                { x: currentCell.x, y: currentCell.y - 1 },
              ].filter(
                (n) =>
                  this.gameGrid.isWalkable(n.x, n.y) &&
                  this.gameGrid.canMove(
                    currentCell.x,
                    currentCell.y,
                    n.x,
                    n.y,
                    doors,
                    false,
                  ),
              );

              const bestRetreat = neighbors
                .map((n) => ({
                  ...n,
                  dist: this.getDistance(
                    { x: n.x + 0.5, y: n.y + 0.5 },
                    primaryThreat.pos,
                  ),
                }))
                .sort((a, b) => b.dist - a.dist)[0]; // Maximize distance

              if (bestRetreat && bestRetreat.dist > dist) {
                this.executeCommand(
                  unit,
                  {
                    type: CommandType.MOVE_TO,
                    unitIds: [unit.id],
                    target: { x: bestRetreat.x, y: bestRetreat.y },
                    label: "Retreating",
                  },
                  state,
                  false,
                  director,
                );
                actionTaken = true;
              }
            }
          } else {
            // Default behavior (maintain optimal range / move to engage if out of range)
            if (dist > unit.stats.attackRange) {
              this.executeCommand(
                unit,
                {
                  type: CommandType.MOVE_TO,
                  unitIds: [unit.id],
                  target: {
                    x: Math.floor(primaryThreat.pos.x),
                    y: Math.floor(primaryThreat.pos.y),
                  },
                  label: "Engaging",
                },
                state,
                false,
                director,
              );
              actionTaken = true;
            }
          }
        }

        if (!actionTaken && state.objectives) {
          const pendingObjectives = state.objectives.filter(
            (o) =>
              o.state === "Pending" &&
              !claimedObjectives.has(o.id) &&
              o.visible,
          );
          if (pendingObjectives.length > 0) {
            let bestObj: { obj: any; dist: number } | null = null;

            for (const obj of pendingObjectives) {
              let targetPos: Vector2 | null = null;
              if (
                (obj.kind === "Recover" || obj.kind === "Escort") &&
                obj.targetCell
              ) {
                targetPos = {
                  x: obj.targetCell.x + 0.5,
                  y: obj.targetCell.y + 0.5,
                };
              } else if (obj.kind === "Kill" && obj.targetEnemyId) {
                const enemy = state.enemies.find(
                  (e) => e.id === obj.targetEnemyId,
                );
                if (
                  enemy &&
                  newVisibleCellsSet.has(
                    `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`,
                  )
                ) {
                  targetPos = enemy.pos;
                }
              }

              if (targetPos) {
                const dist = this.getDistance(unit.pos, targetPos);
                if (!bestObj || dist < bestObj.dist) {
                  bestObj = { obj, dist };
                }
              }
            }

            if (bestObj) {
              claimedObjectives.add(bestObj.obj.id);
              let target = { x: 0, y: 0 };
              if (
                (bestObj.obj.kind === "Recover" ||
                  bestObj.obj.kind === "Escort") &&
                bestObj.obj.targetCell
              )
                target = bestObj.obj.targetCell;
              else if (
                bestObj.obj.kind === "Kill" &&
                bestObj.obj.targetEnemyId
              ) {
                const e = state.enemies.find(
                  (en) => en.id === bestObj.obj.targetEnemyId,
                );
                if (e)
                  target = { x: Math.floor(e.pos.x), y: Math.floor(e.pos.y) };
              }

              if (
                Math.floor(unit.pos.x) !== target.x ||
                Math.floor(unit.pos.y) !== target.y
              ) {
                const label =
                  bestObj.obj.kind === "Recover"
                    ? "Recovering"
                    : bestObj.obj.kind === "Escort"
                      ? "Escorting"
                      : "Hunting";
                this.executeCommand(
                  unit,
                  {
                    type: CommandType.MOVE_TO,
                    unitIds: [unit.id],
                    target,
                    label,
                  },
                  state,
                  false,
                  director,
                );
                actionTaken = true;
              }
            }
          }
        }

        const objectivesComplete =
          !state.objectives ||
          state.objectives.every((o) => o.state !== "Pending");

        let canExtract = false;

        if (!actionTaken && objectivesComplete && state.map.extraction) {
          const ext = state.map.extraction;

          const extKey = `${ext.x},${ext.y}`;

          const isExtDiscovered = state.discoveredCells.includes(extKey);

          if (isExtDiscovered) {
            const unitCurrentCell = {
              x: Math.floor(unit.pos.x),

              y: Math.floor(unit.pos.y),
            };

            if (unitCurrentCell.x !== ext.x || unitCurrentCell.y !== ext.y) {
              unit.explorationTarget = undefined;

              this.executeCommand(
                unit,

                {
                  type: CommandType.MOVE_TO,

                  unitIds: [unit.id],

                  target: ext,

                  label: "Extracting",
                },

                state,
                false,
                director,
              );

              actionTaken = true;

              canExtract = true;
            }
          }
        }

        if (!actionTaken && !mapFullyDiscovered) {
          let shouldReevaluate = !unit.explorationTarget;

          if (unit.explorationTarget) {
            const key = `${Math.floor(unit.explorationTarget.x)},${Math.floor(unit.explorationTarget.y)}`;
            if (discoveredCellsSet.has(key)) {
              unit.explorationTarget = undefined;
              shouldReevaluate = true;
            } else {
              const checkInterval = 1000;
              const lastCheck = Math.floor((state.t - dt) / checkInterval);
              const currentCheck = Math.floor(state.t / checkInterval);
              if (currentCheck > lastCheck || unit.state === UnitState.Idle) {
                shouldReevaluate = true;
              }
            }
          }

          if (shouldReevaluate) {
            const targetCell = this.findClosestUndiscoveredCell(
              unit,
              state,
              discoveredCellsSet,
              doors,
            );
            if (targetCell) {
              const newTarget = { x: targetCell.x, y: targetCell.y };
              const isDifferent =
                !unit.explorationTarget ||
                unit.explorationTarget.x !== newTarget.x ||
                unit.explorationTarget.y !== newTarget.y;

              if (isDifferent) {
                let switchTarget = !unit.explorationTarget;
                if (unit.explorationTarget) {
                  const oldDist = this.getDistance(unit.pos, {
                    x: unit.explorationTarget.x + 0.5,
                    y: unit.explorationTarget.y + 0.5,
                  });
                  const newDist = this.getDistance(unit.pos, {
                    x: newTarget.x + 0.5,
                    y: newTarget.y + 0.5,
                  });
                  if (newDist < oldDist * 0.7) {
                    switchTarget = true;
                  }
                }

                if (switchTarget) {
                  unit.explorationTarget = newTarget;
                  this.executeCommand(
                    unit,
                    {
                      type: CommandType.MOVE_TO,
                      unitIds: [unit.id],
                      target: targetCell,
                      label: "Exploring",
                    },
                    state,
                    false,
                    director,
                  );
                }
              } else if (unit.state === UnitState.Idle) {
                this.executeCommand(
                  unit,
                  {
                    type: CommandType.MOVE_TO,
                    unitIds: [unit.id],
                    target: unit.explorationTarget!,
                    label: "Exploring",
                  },
                  state,
                  false,
                  director,
                );
              }
            }
          }
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
    unit.activeCommand = cmd;

    if (
      isManual &&
      cmd.type !== CommandType.EXPLORE &&
      cmd.type !== CommandType.RESUME_AI
    ) {
      unit.aiEnabled = false;
    }

    if (cmd.type === CommandType.MOVE_TO) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        unit.forcedTargetId = undefined;
        // Clear exploration target if this is a manual command OR an autonomous command that isn't exploration
        if (isManual || cmd.label !== "Exploring") {
          unit.explorationTarget = undefined;
        }

        if (unit.state === UnitState.Channeling) {
          unit.channeling = undefined;
          unit.state = UnitState.Idle;
        }

        const path = this.pathfinder.findPath(
          { x: Math.floor(unit.pos.x), y: Math.floor(unit.pos.y) },
          cmd.target,
          true,
        );
        if (path && path.length > 0) {
          unit.path = path;
          unit.targetPos = {
            x: path[0].x + 0.5 + (unit.visualJitter?.x || 0),
            y: path[0].y + 0.5 + (unit.visualJitter?.y || 0),
          };
          unit.state = UnitState.Moving;
        } else if (
          path &&
          path.length === 0 &&
          Math.floor(unit.pos.x) === cmd.target.x &&
          Math.floor(unit.pos.y) === cmd.target.y
        ) {
          unit.pos = {
            x: cmd.target.x + 0.5 + (unit.visualJitter?.x || 0),
            y: cmd.target.y + 0.5 + (unit.visualJitter?.y || 0),
          };
          unit.path = undefined;
          unit.targetPos = undefined;
          unit.state = UnitState.Idle;
          unit.activeCommand = undefined;
        } else {
          unit.path = undefined;
          unit.targetPos = undefined;
          unit.state = UnitState.Idle;
          unit.activeCommand = undefined;
        }
      }
    } else if (cmd.type === CommandType.ESCORT_UNIT) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        unit.forcedTargetId = undefined;
        unit.explorationTarget = undefined;
        if (unit.state === UnitState.Channeling) {
          unit.channeling = undefined;
          unit.state = UnitState.Idle;
        }
        unit.path = undefined;
        unit.targetPos = undefined;
        unit.aiEnabled = false;
        unit.activeCommand = cmd;
      }
    } else if (cmd.type === CommandType.OVERWATCH_POINT) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        unit.aiEnabled = false;
        unit.aiProfile = AIProfile.STAND_GROUND;
        this.executeCommand(
          unit,
          {
            type: CommandType.MOVE_TO,
            unitIds: [unit.id],
            target: cmd.target,
            label: "Overwatching",
          },
          state,
          isManual,
          director,
        );
        unit.activeCommand = cmd;
      }
    } else if (cmd.type === CommandType.EXPLORE) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        unit.aiEnabled = true;
        // Default exploration behavior will take over in update()
      }
    } else if (cmd.type === CommandType.SET_ENGAGEMENT) {
      unit.engagementPolicy = cmd.mode;
      unit.engagementPolicySource = "Manual";
      unit.activeCommand = undefined;
    } else if (cmd.type === CommandType.STOP) {
      unit.commandQueue = [];
      unit.path = undefined;
      unit.targetPos = undefined;
      unit.forcedTargetId = undefined;
      unit.explorationTarget = undefined;
      unit.aiEnabled = false;
      unit.activeCommand = undefined;

      if (unit.state === UnitState.Channeling) {
        unit.channeling = undefined;
      }
      unit.state = UnitState.Idle;
    } else if (cmd.type === CommandType.RESUME_AI) {
      unit.aiEnabled = true;
      unit.activeCommand = undefined;
    } else if (cmd.type === CommandType.PICKUP) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        const loot = state.loot?.find((l) => l.id === cmd.lootId);
        const objective = state.objectives?.find((o) => o.id === cmd.lootId);
        if (loot) {
          this.executeCommand(
            unit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [unit.id],
              target: { x: Math.floor(loot.pos.x), y: Math.floor(loot.pos.y) },
              label: "Picking up",
            },
            state,
            isManual,
            director,
          );
          unit.activeCommand = cmd;
        } else if (objective && objective.targetCell) {
          this.executeCommand(
            unit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [unit.id],
              target: objective.targetCell,
              label: "Picking up",
            },
            state,
            isManual,
            director,
          );
          unit.activeCommand = cmd;
        }
      }
    } else if (cmd.type === CommandType.EXTRACT) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        if (state.map.extraction) {
          this.executeCommand(
            unit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [unit.id],
              target: state.map.extraction,
              label: "Extracting",
            },
            state,
            isManual,
            director,
          );
          unit.activeCommand = cmd;
        }
      }
    } else if (cmd.type === CommandType.USE_ITEM) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        const item = ItemLibrary[cmd.itemId];
        if (item) {
          // If item has a target, move there first?
          // For now, assume unit must be at target or it's a global effect.
          // Medkit/Mine usually require being at the target cell.
          if (cmd.target && (item.action === "Heal" || item.action === "Mine")) {
            const dist = this.getDistance(unit.pos, {
              x: cmd.target.x + 0.5,
              y: cmd.target.y + 0.5,
            });
            if (dist > 1.0) {
              this.executeCommand(
                unit,
                {
                  type: CommandType.MOVE_TO,
                  unitIds: [unit.id],
                  target: cmd.target,
                  label: "Moving to use item",
                },
                state,
                isManual,
                director,
              );
              unit.activeCommand = cmd; // Re-set active command to USE_ITEM so it resumes after move
              return;
            }
          }

          if (item.channelTime && item.channelTime > 0) {
            unit.state = UnitState.Channeling;
            unit.channeling = {
              action: "UseItem",
              remaining: item.channelTime,
              totalDuration: item.channelTime,
            };
            unit.path = undefined;
            unit.targetPos = undefined;
          } else {
            // Instant use
            const count = state.squadInventory[cmd.itemId] || 0;
            if (count > 0) {
              state.squadInventory[cmd.itemId] = count - 1;
              if (director) {
                director.handleUseItem(state, cmd);
              }
            }
            unit.activeCommand = undefined;
          }
        }
      }
    }
  }

  private getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private isMapFullyDiscovered(state: GameState): boolean {
    const discoveredFloors = state.discoveredCells.filter((key) => {
      const [x, y] = key.split(",").map(Number);
      return this.gameGrid.isWalkable(x, y);
    }).length;
    return discoveredFloors >= this.totalFloorCells;
  }

  private findClosestUndiscoveredCell(
    unit: Unit,
    state: GameState,
    discoveredCellsSet: Set<string>,
    doors: Map<string, Door>,
  ): Vector2 | null {
    const startX = Math.floor(unit.pos.x);
    const startY = Math.floor(unit.pos.y);

    const claimedTargets = state.units
      .filter((u) => u.id !== unit.id && u.explorationTarget)
      .map((u) => u.explorationTarget!);

    const otherUnitPositions = state.units
      .filter(
        (u) =>
          u.id !== unit.id &&
          u.hp > 0 &&
          u.state !== UnitState.Extracted &&
          u.state !== UnitState.Dead,
      )
      .map((u) => u.pos);

    const mapDim = Math.max(state.map.width, state.map.height);
    const avoidRadius = Math.max(3.0, Math.min(5, mapDim / 4));
    const unitAvoidRadius = Math.max(1.5, Math.min(3, mapDim / 6));

    const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    let fallbackCell: Vector2 | null = null;
    let head = 0;

    while (head < queue.length) {
      const curr = queue[head++];

      const cellKey = `${curr.x},${curr.y}`;
      if (!discoveredCellsSet.has(cellKey)) {
        const target = { x: curr.x + 0.5, y: curr.y + 0.5 };
        const isClaimed = claimedTargets.some(
          (claimed) => this.getDistance(target, claimed) < avoidRadius,
        );
        const tooCloseToUnit = otherUnitPositions.some(
          (pos) => this.getDistance(target, pos) < unitAvoidRadius,
        );

        if (!isClaimed && !tooCloseToUnit) {
          return { x: curr.x, y: curr.y };
        }

        if (!fallbackCell) {
          fallbackCell = { x: curr.x, y: curr.y };
        }
      }

      const neighbors = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 },
      ];

      for (const n of neighbors) {
        if (
          n.x >= 0 &&
          n.x < state.map.width &&
          n.y >= 0 &&
          n.y < state.map.height
        ) {
          const nKey = `${n.x},${n.y}`;
          if (!visited.has(nKey) && this.gameGrid.isWalkable(n.x, n.y)) {
            if (this.gameGrid.canMove(curr.x, curr.y, n.x, n.y, doors, true)) {
              visited.add(nKey);
              queue.push({ x: n.x, y: n.y });
            }
          }
        }
      }
    }

    return fallbackCell;
  }
}
