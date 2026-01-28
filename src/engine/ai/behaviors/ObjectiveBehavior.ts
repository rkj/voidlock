import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  PickupCommand,
  Vector2,
  Door,
  Objective,
} from "../../../shared/types";
import { AIContext } from "../../managers/UnitAI";
import { PRNG } from "../../../shared/PRNG";
import { Behavior } from "./Behavior";
import { isCellVisible, isCellDiscovered } from "../../../shared/VisibilityUtils";
import { IDirector } from "../../interfaces/IDirector";
import { MathUtils } from "../../../shared/utils/MathUtils";

export class ObjectiveBehavior implements Behavior {
  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    _doors: Map<string, Door>,
    _prng: PRNG,
    context: AIContext,
    director?: IDirector,
  ): boolean {
    if (unit.archetypeId === "vip") return false;
    if (unit.state !== UnitState.Idle && !unit.explorationTarget) return false;
    if (unit.commandQueue.length > 0) return false;
    if (!context.agentControlEnabled || unit.aiEnabled === false) return false;

    let actionTaken = false;

    // 1. Opportunistic Loot & Objectives (In current LOS)
    const visibleLoot = (state.loot || []).filter((l) =>
      isCellVisible(state, Math.floor(l.pos.x), Math.floor(l.pos.y)),
    );

    const visibleObjectives = (state.objectives || []).filter((o) => {
      if (o.state !== "Pending" || context.claimedObjectives.has(o.id))
        return false;
      if (o.kind !== "Recover") return false;
      if (o.targetCell) {
        return isCellVisible(state, o.targetCell.x, o.targetCell.y);
      }
      return false;
    });

    if (visibleLoot.length > 0 || visibleObjectives.length > 0) {
      const targetedIds = state.units
        .filter(
          (u) =>
            u.id !== unit.id && u.activeCommand?.type === CommandType.PICKUP,
        )
        .map((u) => (u.activeCommand as PickupCommand).lootId);

      const availableLoot = visibleLoot.filter((l) => {
        if (targetedIds.includes(l.id)) return false;
        const assignedUnitId = context.itemAssignments.get(l.id);
        return !assignedUnitId || assignedUnitId === unit.id;
      });
      const availableObjectives = visibleObjectives.filter((o) => {
        if (targetedIds.includes(o.id)) return false;
        const assignedUnitId = context.itemAssignments.get(o.id);
        return !assignedUnitId || assignedUnitId === unit.id;
      });

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
          (a, b) => MathUtils.getDistance(unit.pos, a.pos) - MathUtils.getDistance(unit.pos, b.pos),
        )[0];

        if (closest.type === "objective") {
          context.claimedObjectives.set(closest.id, unit.id);
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
          director,
        );
        actionTaken = true;
      }
    }

    // 2. Objectives
    if (!actionTaken && state.objectives) {
      const pendingObjectives = state.objectives.filter((o) => {
        if (
          o.state !== "Pending" ||
          context.claimedObjectives.has(o.id) ||
          !o.visible
        )
          return false;

        const assignedUnitId = context.itemAssignments.get(o.id);
        return !assignedUnitId || assignedUnitId === unit.id;
      });
      if (pendingObjectives.length > 0) {
        let bestObj: { obj: Objective; dist: number } | null = null;

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
              isCellVisible(
                state,
                Math.floor(enemy.pos.x),
                Math.floor(enemy.pos.y),
              )
            ) {
              targetPos = enemy.pos;
            }
          }

          if (targetPos) {
            const dist = MathUtils.getDistance(unit.pos, targetPos);
            if (!bestObj || dist < bestObj.dist) {
              bestObj = { obj, dist };
            }
          }
        }

        if (bestObj) {
          context.claimedObjectives.set(bestObj.obj.id, unit.id);
          let target = { x: 0, y: 0 };
          if (
            (bestObj.obj.kind === "Recover" || bestObj.obj.kind === "Escort") &&
            bestObj.obj.targetCell
          )
            target = bestObj.obj.targetCell;
          else if (bestObj.obj.kind === "Kill" && bestObj.obj.targetEnemyId) {
            const e = state.enemies.find(
              (en) => en.id === bestObj.obj.targetEnemyId,
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
              director,
            );
            actionTaken = true;
          }
        }
      }
    }

    // 3. Extraction
    const objectivesComplete =
      !state.objectives || state.objectives.every((o) => o.state !== "Pending");

    if (!actionTaken && objectivesComplete && state.map.extraction) {
      const ext = state.map.extraction;
      const isExtDiscovered = isCellDiscovered(state, ext.x, ext.y);

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
            director,
          );
          actionTaken = true;
        }
      }
    }

    return actionTaken;
  }
}
