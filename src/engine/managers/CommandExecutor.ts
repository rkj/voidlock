import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  Vector2,
  Command,
  ItemLibrary,
  AIProfile,
} from "../../shared/types";
import { Pathfinder } from "../Pathfinder";
import { SPEED_NORMALIZATION_CONST } from "../Constants";

export class CommandExecutor {
  constructor(private pathfinder: Pathfinder) {}

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
      // If we are issuing a manual PICKUP or USE_ITEM command while AI is enabled,
      // we want to resume AI after the action is complete.
      if (
        unit.aiEnabled &&
        (cmd.type === CommandType.PICKUP || cmd.type === CommandType.USE_ITEM)
      ) {
        unit.commandQueue.push({
          type: CommandType.RESUME_AI,
          unitIds: [unit.id],
        });
      }
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
          let targetLocation: Vector2 | undefined = cmd.target;
          if (cmd.targetUnitId) {
            const targetUnit =
              state.units.find((u) => u.id === cmd.targetUnitId) ||
              state.enemies.find((e) => e.id === cmd.targetUnitId);
            if (targetUnit) {
              targetLocation = {
                x: Math.floor(targetUnit.pos.x),
                y: Math.floor(targetUnit.pos.y),
              };
            }
          }

          // If item has a target, move there first?
          // For now, assume unit must be at target or it's a global effect.
          // Medkit/Mine usually require being at the target cell.
          if (
            targetLocation &&
            (item.action === "Heal" || item.action === "Mine")
          ) {
            const dist = this.getDistance(unit.pos, {
              x: targetLocation.x + 0.5,
              y: targetLocation.y + 0.5,
            });
            if (dist > 1.0) {
              this.executeCommand(
                unit,
                {
                  type: CommandType.MOVE_TO,
                  unitIds: [unit.id],
                  target: targetLocation,
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
            // Scale duration by unit speed: Actual = Base * (30 / Speed)
            const scaledDuration =
              item.channelTime * (SPEED_NORMALIZATION_CONST / unit.stats.speed);

            unit.state = UnitState.Channeling;
            unit.channeling = {
              action: "UseItem",
              remaining: scaledDuration,
              totalDuration: scaledDuration,
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
}
