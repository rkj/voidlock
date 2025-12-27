import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Vector2,
  Command,
  Door,
} from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { Pathfinder } from "../Pathfinder";
import { LineOfSight } from "../LineOfSight";
import { VipAI } from "../ai/VipAI";

const EPSILON = 0.05;

export class UnitManager {
  private vipAi: VipAI;

  constructor(
    private gameGrid: GameGrid,
    private pathfinder: Pathfinder,
    private los: LineOfSight,
    private agentControlEnabled: boolean,
  ) {
    this.vipAi = new VipAI(gameGrid, pathfinder, los);
  }

  public update(state: GameState, dt: number, doors: Map<string, Door>, realDt: number = dt) {
    const claimedObjectives = new Set<string>();

    // Pre-populate claimed objectives from units already pursuing them
    state.units.forEach((u) => {
      if (u.state === UnitState.Dead || u.state === UnitState.Extracted) return;
      if (u.channeling?.targetId) {
        claimedObjectives.add(u.channeling.targetId);
      }
      // If unit has a forced target that is an objective
      if (u.forcedTargetId) {
        const obj = state.objectives?.find((o) => o.targetEnemyId === u.forcedTargetId);
        if (obj) claimedObjectives.add(obj.id);
      }
      // If unit has an active command targeting an objective
      if (u.activeCommand?.type === CommandType.MOVE_TO && u.activeCommand.target) {
        const target = u.activeCommand.target;
        const obj = state.objectives?.find((o) => {
          if (o.kind === "Recover" && o.targetCell) {
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

    state.units.forEach((unit) => {
      if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead)
        return;

      if (unit.archetypeId === "vip" && !unit.aiEnabled) {
        const rescueSoldier = state.units.find(u => 
          u.id !== unit.id && 
          u.archetypeId !== "vip" && 
          u.hp > 0 && 
          (this.getDistance(unit.pos, u.pos) <= 1.5 || this.los.hasLineOfSight(u.pos, unit.pos))
        );
        if (rescueSoldier) {
          unit.aiEnabled = true;
        } else {
          // Locked VIPs don't do anything
          return;
        }
      }

      if (unit.archetypeId === "vip" && unit.aiEnabled && unit.state === UnitState.Idle && unit.commandQueue.length === 0) {
        const vipCommand = this.vipAi.think(unit, state);
        if (vipCommand) {
          this.executeCommand(unit, vipCommand, false);
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
              if (obj) obj.state = "Completed";
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
        if (state.discoveredCells.includes(key)) {
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

      if (unit.archetypeId !== "vip" && state.objectives) {
        state.objectives.forEach((obj) => {
          if (obj.state === "Pending" && !claimedObjectives.has(obj.id)) {
            if (obj.kind === "Recover" && obj.targetCell) {
              if (
                Math.floor(unit.pos.x) === obj.targetCell.x &&
                Math.floor(unit.pos.y) === obj.targetCell.y
              ) {
                if (unit.state === UnitState.Idle) {
                  const duration = 5000 * (10 / unit.speed);
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
          .filter(o => o.kind !== "Escort")
          .every(o => o.state === "Completed");
        
        const isVipAtExtraction = unit.archetypeId === "vip" && 
          Math.floor(unit.pos.x) === ext.x && 
          Math.floor(unit.pos.y) === ext.y;

        if (
          (allOtherObjectivesComplete || isVipAtExtraction) &&
          Math.floor(unit.pos.x) === ext.x &&
          Math.floor(unit.pos.y) === ext.y
        ) {
          if (unit.state === UnitState.Idle) {
            const duration = 5000 * (10 / unit.speed);
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
          this.executeCommand(unit, nextCmd);
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
          if (
            this.getDistance(unit.pos, primaryThreat.pos) > unit.attackRange
          ) {
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
              false,
            );
            actionTaken = true;
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
              if (obj.kind === "Recover" && obj.targetCell) {
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
              if (bestObj.obj.kind === "Recover" && bestObj.obj.targetCell)
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
                  bestObj.obj.kind === "Recover" ? "Recovering" : "Hunting";
                this.executeCommand(
                  unit,
                  {
                    type: CommandType.MOVE_TO,
                    unitIds: [unit.id],
                    target,
                    label,
                  },
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

        if (!actionTaken && objectivesComplete) {
          unit.explorationTarget = undefined;
          if (state.map.extraction) {
            const unitCurrentCell = {
              x: Math.floor(unit.pos.x),
              y: Math.floor(unit.pos.y),
            };
            if (
              unitCurrentCell.x !== state.map.extraction.x ||
              unitCurrentCell.y !== state.map.extraction.y
            ) {
              this.executeCommand(
                unit,
                {
                  type: CommandType.MOVE_TO,
                  unitIds: [unit.id],
                  target: state.map.extraction,
                  label: "Extracting",
                },
                false,
              );
            }
          }
        } else if (!actionTaken && !this.isMapFullyDiscovered(state)) {
          let shouldReevaluate = !unit.explorationTarget;

          if (unit.explorationTarget) {
            const key = `${Math.floor(unit.explorationTarget.x)},${Math.floor(unit.explorationTarget.y)}`;
            if (state.discoveredCells.includes(key)) {
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
            const targetCell = this.findClosestUndiscoveredCell(unit, state);
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
          this.getDistance(unit.pos, enemy.pos) <= unit.attackRange + 0.5 &&
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

        if (this.los.hasLineOfSight(unit.pos, targetEnemy.pos)) {
          if (
            !unit.lastAttackTime ||
            state.t - unit.lastAttackTime >= unit.fireRate
          ) {
            targetEnemy.hp -= unit.damage;
            unit.lastAttackTime = state.t;
            unit.lastAttackTarget = { ...targetEnemy.pos };
          }

          unit.state = UnitState.Attacking;
          isAttacking = true;
        }
      }

      if (!isAttacking && isMoving && unit.targetPos && unit.path) {
        if (isLockedInMelee) {
          unit.state = UnitState.Attacking;
        } else {
          const dx = unit.targetPos.x - unit.pos.x;
          const dy = unit.targetPos.y - unit.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const moveDist = (unit.speed / 10 * dt) / 1000;

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
              unit.activeCommand = undefined;
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
      } else if (!isAttacking && !isMoving) {
        if (unit.state !== UnitState.WaitingForDoor) {
          unit.state = UnitState.Idle;
          unit.activeCommand = undefined;
        }
      }
    });
  }

  public executeCommand(unit: Unit, cmd: Command, isManual: boolean = true) {
    unit.activeCommand = cmd;
    if (cmd.type === CommandType.MOVE_TO) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        unit.forcedTargetId = undefined;
        // Clear exploration target if this is a manual command OR an autonomous command that isn't exploration
        if (isManual || cmd.label !== "Exploring") {
          unit.explorationTarget = undefined;
        }
        if (isManual) {
          unit.aiEnabled = true;
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
    } else if (cmd.type === CommandType.ATTACK_TARGET) {
      if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        unit.forcedTargetId = cmd.targetId;
        if (isManual) unit.aiEnabled = true;
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
      if (isManual) unit.aiEnabled = true;
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
    }
  }

  private getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private isMapFullyDiscovered(state: GameState): boolean {
    const totalFloorCells = state.map.cells.filter(
      (c) => c.type === "Floor",
    ).length;
    const discoveredFloors = state.discoveredCells.filter((key) => {
      const [x, y] = key.split(",").map(Number);
      return this.gameGrid.isWalkable(x, y);
    }).length;
    return discoveredFloors >= totalFloorCells;
  }

  private findClosestUndiscoveredCell(
    unit: Unit,
    state: GameState,
  ): Vector2 | null {
    let closestCell: Vector2 | null = null;
    let minDistance = Infinity;

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
    const avoidRadius = Math.min(6, Math.max(2, Math.floor(mapDim / 2.5)));
    const unitAvoidRadius = Math.min(4, Math.max(1, Math.floor(mapDim / 4)));

    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        const cellKey = `${x},${y}`;
        if (
          this.gameGrid.isWalkable(x, y) &&
          !state.discoveredCells.includes(cellKey)
        ) {
          const target = { x: x + 0.5, y: y + 0.5 };
          const isClaimed = claimedTargets.some(
            (claimed) => this.getDistance(target, claimed) < avoidRadius,
          );
          if (isClaimed) continue;
          const tooCloseToUnit = otherUnitPositions.some(
            (pos) => this.getDistance(target, pos) < unitAvoidRadius,
          );
          if (tooCloseToUnit) continue;

          const dist = this.getDistance(unit.pos, target);
          if (dist < minDistance) {
            minDistance = dist;
            closestCell = { x, y };
          }
        }
      }
    }

    if (!closestCell) {
      for (let y = 0; y < state.map.height; y++) {
        for (let x = 0; x < state.map.width; x++) {
          const cellKey = `${x},${y}`;
          if (
            this.gameGrid.isWalkable(x, y) &&
            !state.discoveredCells.includes(cellKey)
          ) {
            const dist = this.getDistance(unit.pos, { x: x + 0.5, y: y + 0.5 });
            if (dist < minDistance) {
              minDistance = dist;
              closestCell = { x, y };
            }
          }
        }
      }
    }

    return closestCell;
  }
}
