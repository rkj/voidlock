import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Vector2,
  Command,
  Door,
  Enemy,
  AIProfile,
  PickupCommand,
} from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { Pathfinder } from "../Pathfinder";
import { LineOfSight } from "../LineOfSight";
import { VipAI } from "../ai/VipAI";
import { PRNG } from "../../shared/PRNG";
import { SPEED_NORMALIZATION_CONST } from "../Constants";

export interface AIContext {
  agentControlEnabled: boolean;
  totalFloorCells: number;
  newVisibleCellsSet: Set<string>;
  discoveredCellsSet: Set<string>;
  claimedObjectives: Set<string>;
  executeCommand: (
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean,
    director?: any
  ) => void;
}

export class UnitAI {
  private vipAi: VipAI;

  constructor(
    private gameGrid: GameGrid,
    private pathfinder: Pathfinder,
    private los: LineOfSight
  ) {
    this.vipAi = new VipAI(gameGrid, pathfinder, los);
  }

  public process(
    unit: Unit,
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    prng: PRNG,
    context: AIContext,
    director?: any
  ) {
    if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead)
      return;

    // 1. VIP Specific AI
    if (unit.archetypeId === "vip") {
      this.processVipAI(unit, state, context, director);
      if (!unit.aiEnabled) return;
    }

    if (unit.state === UnitState.Channeling) return;

    // 2. Exploration target cleanup
    if (unit.explorationTarget) {
      const key = `${Math.floor(unit.explorationTarget.x)},${Math.floor(unit.explorationTarget.y)}`;
      if (context.discoveredCellsSet.has(key)) {
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
        context.newVisibleCellsSet.has(
          `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`
        )
    );

    const threats = visibleEnemies
      .map((enemy) => ({
        enemy,
        distance: this.getDistance(unit.pos, enemy.pos),
        priority: 1 / (this.getDistance(unit.pos, enemy.pos) + 1),
      }))
      .sort((a, b) => b.priority - a.priority);

    // 3. Autonomous Retreat / Grouping
    if (unit.archetypeId !== "vip") {
      const handled = this.processAutonomousSafety(unit, state, threats, context, director);
      if (handled) return;
    }

    // 4. Interaction Logic (Loot, Objectives, Extraction)
    if (unit.state === UnitState.Idle) {
      this.processInteractions(unit, state, context);
    }

    if ((unit.state as UnitState) === UnitState.Channeling) return;

    // 5. Main AI Action Loop
    if (
      unit.archetypeId !== "vip" &&
      (unit.state === UnitState.Idle || unit.explorationTarget) &&
      unit.commandQueue.length === 0 &&
      context.agentControlEnabled &&
      unit.aiEnabled !== false
    ) {
      this.processAutonomousActions(unit, state, dt, doors, threats, context, director);
    }
  }

  private processVipAI(unit: Unit, state: GameState, context: AIContext, director?: any) {
    if (!unit.aiEnabled) {
      const rescueSoldier = state.units.find(
        (u) =>
          u.id !== unit.id &&
          u.archetypeId !== "vip" &&
          u.hp > 0 &&
          (this.getDistance(unit.pos, u.pos) <= 1.5 ||
            this.los.hasLineOfSight(u.pos, unit.pos))
      );
      if (rescueSoldier) {
        unit.aiEnabled = true;
      }
    }

    if (
      unit.aiEnabled &&
      unit.state === UnitState.Idle &&
      unit.commandQueue.length === 0
    ) {
      const vipCommand = this.vipAi.think(unit, state);
      if (vipCommand) {
        context.executeCommand(unit, vipCommand, state, false, director);
      }
    }
  }

  private processAutonomousSafety(
    unit: Unit,
    state: GameState,
    threats: { enemy: Enemy; distance: number }[],
    context: AIContext,
    director?: any
  ): boolean {
    const isLowHP = unit.hp < unit.maxHp * 0.25;
    const nearbyAllies = state.units.filter(
      (u) =>
        u.id !== unit.id &&
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead &&
        this.getDistance(unit.pos, u.pos) <= 5
    );
    const isIsolated = nearbyAllies.length === 0 && threats.length > 0;

    if (isLowHP && threats.length > 0) {
      const safeCells = state.discoveredCells.filter((cellKey) => {
        const [cx, cy] = cellKey.split(",").map(Number);
        return !threats.some(
          (t) => Math.floor(t.enemy.pos.x) === cx && Math.floor(t.enemy.pos.y) === cy
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
          context.executeCommand(
            unit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [unit.id],
              target: { x: closestSafe.x, y: closestSafe.y },
              label: "Retreating",
            },
            state,
            false,
            director
          );
          return unit.state === UnitState.Moving;
        }
      }
    } else if (isIsolated) {
      const otherUnits = state.units.filter(
        (u) =>
          u.id !== unit.id &&
          u.hp > 0 &&
          u.state !== UnitState.Extracted &&
          u.state !== UnitState.Dead
      );
      if (otherUnits.length > 0) {
        const closestAlly = otherUnits.sort(
          (a, b) =>
            this.getDistance(unit.pos, a.pos) -
            this.getDistance(unit.pos, b.pos)
        )[0];
        if (
          unit.state !== UnitState.Moving ||
          !unit.targetPos ||
          Math.floor(unit.targetPos.x) !== Math.floor(closestAlly.pos.x) ||
          Math.floor(unit.targetPos.y) !== Math.floor(closestAlly.pos.y)
        ) {
          unit.engagementPolicy = "IGNORE";
          unit.engagementPolicySource = "Autonomous";
          context.executeCommand(
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
            director
          );
          return unit.state === UnitState.Moving;
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
    return false;
  }

  private processInteractions(unit: Unit, state: GameState, context: AIContext) {
    // 1. Loot Interaction
    if (state.loot) {
      const loot = state.loot.find(
        (l) =>
          Math.abs(unit.pos.x - l.pos.x) < 0.6 &&
          Math.abs(unit.pos.y - l.pos.y) < 0.6
      );

      if (
        loot &&
        unit.activeCommand?.type === CommandType.PICKUP &&
        (unit.activeCommand as PickupCommand).lootId === loot.id
      ) {
        const duration = 1000;
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
        return;
      }
    }

    // 2. Objective Interaction
    if (unit.archetypeId !== "vip" && state.objectives) {
      for (const obj of state.objectives) {
        if (obj.state === "Pending") {
          const isAtTarget =
            obj.targetCell &&
            Math.floor(unit.pos.x) === obj.targetCell.x &&
            Math.floor(unit.pos.y) === obj.targetCell.y;

          const isClaimedByMe =
            unit.activeCommand?.type === CommandType.PICKUP &&
            (unit.activeCommand as PickupCommand).lootId === obj.id;

          if (
            isAtTarget &&
            (!context.claimedObjectives.has(obj.id) || isClaimedByMe)
          ) {
            const duration =
              5000 * (SPEED_NORMALIZATION_CONST / unit.stats.speed);
            unit.state = UnitState.Channeling;
            unit.channeling = {
              action: "Collect",
              remaining: duration,
              totalDuration: duration,
              targetId: obj.id,
            };
            context.claimedObjectives.add(obj.id);
            unit.path = undefined;
            unit.targetPos = undefined;
            unit.activeCommand = undefined;
            return;
          }
        }
      }
    }

    // 3. Extraction Interaction
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
        const duration = 5000 * (SPEED_NORMALIZATION_CONST / unit.stats.speed);
        unit.state = UnitState.Channeling;
        unit.channeling = {
          action: "Extract",
          remaining: duration,
          totalDuration: duration,
        };
        unit.path = undefined;
        unit.targetPos = undefined;
        unit.activeCommand = undefined;
        return;
      }
    }
  }

  private processAutonomousActions(
    unit: Unit,
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    threats: { enemy: Enemy; distance: number }[],
    context: AIContext,
    director?: any
  ) {
    let actionTaken = false;

    // 1. Combat Engagement
    if (threats.length > 0 && unit.engagementPolicy !== "IGNORE") {
      const primaryThreat = threats[0].enemy;
      const dist = threats[0].distance;

      if (unit.aiProfile === "STAND_GROUND") {
        // Hold position
      } else if (unit.aiProfile === "RUSH") {
        if (dist > 1.5) {
          context.executeCommand(
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
            director
          );
          actionTaken = true;
        }
      } else if (unit.aiProfile === "RETREAT") {
        if (dist < unit.stats.attackRange * 0.8) {
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
                false
              )
          );

          const bestRetreat = neighbors
            .map((n) => ({
              ...n,
              dist: this.getDistance(
                { x: n.x + 0.5, y: n.y + 0.5 },
                primaryThreat.pos
              ),
            }))
            .sort((a, b) => b.dist - a.dist)[0];

          if (bestRetreat && bestRetreat.dist > dist) {
            context.executeCommand(
              unit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [unit.id],
                target: { x: bestRetreat.x, y: bestRetreat.y },
                label: "Retreating",
              },
              state,
              false,
              director
            );
            actionTaken = true;
          }
        }
      } else {
        // Default behavior
        if (dist > unit.stats.attackRange) {
          context.executeCommand(
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
            director
          );
          actionTaken = true;
        }
      }
    }

    // 2. Opportunistic Loot & Objectives (In current LOS)
    if (!actionTaken) {
      const visibleLoot = (state.loot || []).filter((l) =>
        context.newVisibleCellsSet.has(
          `${Math.floor(l.pos.x)},${Math.floor(l.pos.y)}`
        )
      );

      const visibleObjectives = (state.objectives || []).filter((o) => {
        if (o.state !== "Pending" || context.claimedObjectives.has(o.id))
          return false;
        if (o.kind !== "Recover") return false;
        if (o.targetCell) {
          return context.newVisibleCellsSet.has(
            `${o.targetCell.x},${o.targetCell.y}`
          );
        }
        return false;
      });

      if (visibleLoot.length > 0 || visibleObjectives.length > 0) {
        const targetedIds = state.units
          .filter(
            (u) =>
              u.id !== unit.id && u.activeCommand?.type === CommandType.PICKUP
          )
          .map((u) => (u.activeCommand as PickupCommand).lootId);

        const availableLoot = visibleLoot.filter(
          (l) => !targetedIds.includes(l.id)
        );
        const availableObjectives = visibleObjectives.filter(
          (o) => !targetedIds.includes(o.id)
        );

        const items = [
          ...availableLoot.map((l) => ({
            id: l.id,
            pos: l.pos,
            type: "loot" as const,
          })),
          ...availableObjectives.map((o) => ({
            id: o.id,
            pos: { x: o.targetCell!.x + 0.5, y: o.targetCell!.y + 0.5 },
            type: "objective" as const,
          })),
        ];

        if (items.length > 0) {
          const closest = items.sort(
            (a, b) =>
              this.getDistance(unit.pos, a.pos) -
              this.getDistance(unit.pos, b.pos)
          )[0];

          if (closest.type === "objective") {
            context.claimedObjectives.add(closest.id);
          }

          context.executeCommand(
            unit,
            {
              type: CommandType.PICKUP,
              unitIds: [unit.id],
              lootId: closest.id,
              label: closest.type === "objective" ? "Recovering" : "Picking up",
            },
            state,
            false,
            director
          );
          actionTaken = true;
        }
      }
    }

    // 3. Objectives
    if (!actionTaken && state.objectives) {
      const pendingObjectives = state.objectives.filter(
        (o) =>
          o.state === "Pending" &&
          !context.claimedObjectives.has(o.id) &&
          o.visible
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
            const enemy = state.enemies.find((e) => e.id === obj.targetEnemyId);
            if (
              enemy &&
              context.newVisibleCellsSet.has(
                `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`
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
          context.claimedObjectives.add(bestObj.obj.id);
          let target = { x: 0, y: 0 };
          if (
            (bestObj.obj.kind === "Recover" ||
              bestObj.obj.kind === "Escort") &&
            bestObj.obj.targetCell
          )
            target = bestObj.obj.targetCell;
          else if (bestObj.obj.kind === "Kill" && bestObj.obj.targetEnemyId) {
            const e = state.enemies.find(
              (en) => en.id === bestObj.obj.targetEnemyId
            );
            if (e) target = { x: Math.floor(e.pos.x), y: Math.floor(e.pos.y) };
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
            context.executeCommand(
              unit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [unit.id],
                target,
                label,
              },
              state,
              false,
              director
            );
            actionTaken = true;
          }
        }
      }
    }

    // 4. Extraction
    const objectivesComplete =
      !state.objectives || state.objectives.every((o) => o.state !== "Pending");

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
          context.executeCommand(
            unit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [unit.id],
              target: ext,
              label: "Extracting",
            },
            state,
            false,
            director
          );
          actionTaken = true;
        }
      }
    }

    // 5. Exploration
    if (!actionTaken && !this.isMapFullyDiscovered(state, context.totalFloorCells)) {
      let shouldReevaluate = !unit.explorationTarget;

      if (unit.explorationTarget) {
        const key = `${Math.floor(unit.explorationTarget.x)},${Math.floor(unit.explorationTarget.y)}`;
        if (context.discoveredCellsSet.has(key)) {
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
          context.discoveredCellsSet,
          doors
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
              context.executeCommand(
                unit,
                {
                  type: CommandType.MOVE_TO,
                  unitIds: [unit.id],
                  target: targetCell,
                  label: "Exploring",
                },
                state,
                false,
                director
              );
            }
          } else if (unit.state === UnitState.Idle) {
            context.executeCommand(
              unit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [unit.id],
                target: unit.explorationTarget!,
                label: "Exploring",
              },
              state,
              false,
              director
            );
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

  private isMapFullyDiscovered(state: GameState, totalFloorCells: number): boolean {
    const discoveredFloors = state.discoveredCells.filter((key) => {
      const [x, y] = key.split(",").map(Number);
      return this.gameGrid.isWalkable(x, y);
    }).length;
    return discoveredFloors >= totalFloorCells;
  }

  private findClosestUndiscoveredCell(
    unit: Unit,
    state: GameState,
    discoveredCellsSet: Set<string>,
    doors: Map<string, Door>
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
          u.state !== UnitState.Dead
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
          (claimed) => this.getDistance(target, claimed) < avoidRadius
        );
        const tooCloseToUnit = otherUnitPositions.some(
          (pos) => this.getDistance(target, pos) < unitAvoidRadius
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
