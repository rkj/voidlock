import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Vector2,
  Command,
  PickupCommand,
  Door,
  WeaponLibrary,
  ItemLibrary,
  ArchetypeLibrary,
  AIProfile,
} from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { Pathfinder } from "../Pathfinder";
import { LineOfSight } from "../LineOfSight";
import { VipAI } from "../ai/VipAI";
import { PRNG } from "../../shared/PRNG";
import { LootManager } from "./LootManager";

const EPSILON = 0.05;

export class UnitManager {
  private vipAi: VipAI;
  private totalFloorCells: number;

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
  }

  public update(
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    prng: PRNG,
    lootManager: LootManager,
    realDt: number = dt,
  ) {
    const claimedObjectives = new Set<string>();

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

      this.updateActiveWeapon(unit, state, newVisibleCellsSet);

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
          this.executeCommand(unit, vipCommand, state, false);
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
                  this.recalculateStats(unit);
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
                  this.recalculateStats(unit);
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

        if (
          (allOtherObjectivesComplete || isVipAtExtraction) &&
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
          this.executeCommand(unit, nextCmd, state);
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
                );
              }
            }
          }
        }
      }

      let enemiesInRange = state.enemies.filter(
        (enemy) =>
          enemy.hp > 0 &&
          this.getDistance(unit.pos, enemy.pos) <=
            unit.stats.attackRange + 0.5 &&
          newVisibleCellsSet.has(
            `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`,
          ),
      );

      const enemiesInSameCell = state.enemies.filter(
        (enemy) =>
          enemy.hp > 0 &&
          Math.floor(enemy.pos.x) === Math.floor(unit.pos.x) &&
          Math.floor(enemy.pos.y) === Math.floor(unit.pos.y),
      );
      const isLockedInMelee = enemiesInSameCell.length > 0;

      if (unit.forcedTargetId) {
        const forced = enemiesInRange.find((e) => e.id === unit.forcedTargetId);
        if (forced) {
          enemiesInRange = [forced];
        } else {
          const isTargetAlive = state.enemies.some(
            (e) => e.id === unit.forcedTargetId && e.hp > 0,
          );
          if (!isTargetAlive) {
            unit.forcedTargetId = undefined;
          } else {
            enemiesInRange = [];
          }
        }
      }

      let isAttacking = false;
      const canAttack = enemiesInRange.length > 0;
      const isMoving = (unit.path && unit.path.length > 0) || !!unit.targetPos;
      const policy = unit.engagementPolicy || "ENGAGE";

      if (
        unit.archetypeId !== "vip" &&
        canAttack &&
        (policy === "ENGAGE" || !!unit.forcedTargetId || isLockedInMelee)
      ) {
        let targetEnemy = enemiesInRange[0];
        if (isLockedInMelee && enemiesInSameCell.length > 0) {
          const lockingTarget = enemiesInSameCell.find((e) =>
            enemiesInRange.includes(e),
          );
          if (lockingTarget) targetEnemy = lockingTarget;
        }

        if (this.los.hasLineOfFire(unit.pos, targetEnemy.pos)) {
          if (
            !unit.lastAttackTime ||
            state.t - unit.lastAttackTime >= unit.stats.fireRate
          ) {
            const distance = this.getDistance(unit.pos, targetEnemy.pos);
            const S = unit.stats.accuracy;
            const R = unit.stats.attackRange;
            let hitChance = (S / 100) * (R / Math.max(0.1, distance));
            hitChance = Math.max(0, Math.min(1.0, hitChance));

            if (prng.next() <= hitChance) {
              targetEnemy.hp -= unit.stats.damage;
              if (targetEnemy.hp <= 0) {
                unit.kills++;
              }
            }

            unit.lastAttackTime = state.t;
            unit.lastAttackTarget = { ...targetEnemy.pos };
          }

          unit.state = UnitState.Attacking;
          isAttacking = true;
          // console.log(`[UnitManager] Unit ${unit.id} is attacking enemy at ${targetEnemy.pos.x}, ${targetEnemy.pos.y}`);
        }
      }

      if (isMoving && unit.targetPos && unit.path) {
        if (isLockedInMelee) {
          unit.state = UnitState.Attacking;
        } else if (!isAttacking) {
          this.handleMovement(unit, dt, doors);
        } else {
          // If we are RUSHing or RETREATing, we SHOULD be allowed to move while attacking
          if (unit.aiProfile === "RUSH" || unit.aiProfile === "RETREAT") {
            this.handleMovement(unit, dt, doors);
            // Ensure state reflects attacking if we moved while attacking
            if (unit.state === UnitState.Moving) {
              unit.state = UnitState.Attacking;
            }
          }
        }
      } else if (!isAttacking && !isMoving) {
        if (unit.state !== UnitState.WaitingForDoor) {
          unit.state = UnitState.Idle;
          if (unit.activeCommand?.type !== CommandType.PICKUP) {
            unit.activeCommand = undefined;
          }
        }
      }
    });
  }

  private handleMovement(unit: Unit, dt: number, doors: Map<string, Door>) {
    if (!unit.targetPos || !unit.path) return;

    const dx = unit.targetPos.x - unit.pos.x;
    const dy = unit.targetPos.y - unit.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const moveDist = ((unit.stats.speed / 10) * dt) / 1000;

    const currentCell = {
      x: Math.floor(unit.pos.x),
      y: Math.floor(unit.pos.y),
    };
    const nextCell = {
      x: Math.floor(unit.targetPos.x),
      y: Math.floor(unit.targetPos.y),
    };

    if (
      (currentCell.x !== nextCell.x || currentCell.y !== nextCell.y) &&
      !this.gameGrid.canMove(
        currentCell.x,
        currentCell.y,
        nextCell.x,
        nextCell.y,
        doors,
        false,
      )
    ) {
      unit.state = UnitState.WaitingForDoor;
    } else if (dist <= moveDist + EPSILON) {
      unit.pos = { ...unit.targetPos };
      unit.path.shift();

      if (unit.path.length === 0) {
        unit.path = undefined;
        unit.targetPos = undefined;
        unit.state = UnitState.Idle;
        if (unit.activeCommand?.type === CommandType.MOVE_TO) {
          unit.activeCommand = undefined;
        }
      } else {
        unit.targetPos = {
          x: unit.path[0].x + 0.5 + (unit.visualJitter?.x || 0),
          y: unit.path[0].y + 0.5 + (unit.visualJitter?.y || 0),
        };
      }
    } else {
      unit.pos.x += (dx / dist) * moveDist;
      unit.pos.y += (dy / dist) * moveDist;
      unit.state = UnitState.Moving;
    }
  }

  public executeCommand(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean = true,
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
        );
        unit.activeCommand = cmd;
      }
    } else if (cmd.type === CommandType.EXPLORE) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        unit.aiEnabled = true;
        // Default exploration behavior will take over in update()
      }
    } else if (cmd.type === CommandType.ATTACK_TARGET) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        unit.forcedTargetId = cmd.targetId;
        unit.path = undefined;
        unit.targetPos = undefined;

        if (unit.state === UnitState.Channeling) {
          unit.channeling = undefined;
          unit.state = UnitState.Idle;
        }
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
          );
          unit.activeCommand = cmd;
        }
      }
    }
  }

  public recalculateStats(unit: Unit) {
    const arch = ArchetypeLibrary[unit.archetypeId];
    if (!arch) return;

    let hpBonus = 0;
    let speedBonus = 0;
    let equipmentAccuracyBonus = 0;

    const slots = [unit.body, unit.feet, unit.rightHand, unit.leftHand];
    slots.forEach((itemId) => {
      if (itemId) {
        const item = ItemLibrary[itemId];
        if (item) {
          hpBonus += item.hpBonus || 0;
          speedBonus += item.speedBonus || 0;
          equipmentAccuracyBonus += item.accuracyBonus || 0;
        }
      }
    });

    // Apply carried objective (artifact) burden
    if (unit.carriedObjectiveId) {
      // For now all carried objectives are assumed to be "artifact_heavy"
      const item = ItemLibrary["artifact_heavy"];
      if (item) {
        speedBonus += item.speedBonus || 0;
        equipmentAccuracyBonus += item.accuracyBonus || 0;
      }
    }

    unit.maxHp = arch.baseHp + hpBonus;
    unit.stats.speed = arch.speed + speedBonus;
    unit.stats.equipmentAccuracyBonus = equipmentAccuracyBonus;

    // Update weapon-dependent stats
    const weaponId = unit.activeWeaponId || unit.rightHand || "";
    const weapon = WeaponLibrary[weaponId];
    if (weapon) {
      unit.stats.damage = weapon.damage;
      unit.stats.attackRange = weapon.range;
      unit.stats.accuracy =
        unit.stats.soldierAim +
        (weapon.accuracy || 0) +
        unit.stats.equipmentAccuracyBonus;
      unit.stats.fireRate =
        weapon.fireRate * (unit.stats.speed > 0 ? 10 / unit.stats.speed : 1);
    } else {
      unit.stats.damage = arch.damage;
      unit.stats.attackRange = arch.attackRange;
      unit.stats.accuracy = unit.stats.soldierAim + equipmentAccuracyBonus;
      unit.stats.fireRate = arch.fireRate;
    }
  }

  private updateActiveWeapon(
    unit: Unit,
    state: GameState,
    visibleCells: Set<string>,
  ) {
    if (!unit.rightHand && !unit.leftHand) return;

    const visibleEnemies = state.enemies.filter(
      (enemy) =>
        enemy.hp > 0 &&
        visibleCells.has(
          `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`,
        ),
    );

    const rightWeapon = unit.rightHand
      ? WeaponLibrary[unit.rightHand]
      : undefined;
    const leftWeapon = unit.leftHand ? WeaponLibrary[unit.leftHand] : undefined;

    if (!rightWeapon && !leftWeapon) return;

    let targetWeaponId = unit.activeWeaponId || unit.rightHand || unit.leftHand;

    const enemiesInMelee = visibleEnemies.filter((e) => {
      const meleeRange =
        (leftWeapon?.type === "Melee" ? leftWeapon.range : 1) + 0.05;
      return this.getDistance(unit.pos, e.pos) <= meleeRange;
    });

    if (enemiesInMelee.length > 0 && leftWeapon?.type === "Melee") {
      targetWeaponId = unit.leftHand;
    } else if (rightWeapon) {
      const enemiesInRanged = visibleEnemies.filter(
        (e) => this.getDistance(unit.pos, e.pos) <= rightWeapon.range + 0.5,
      );
      if (enemiesInRanged.length > 0) {
        targetWeaponId = unit.rightHand;
      }
    }

    if (targetWeaponId && unit.activeWeaponId !== targetWeaponId) {
      unit.activeWeaponId = targetWeaponId;
      this.recalculateStats(unit);
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
