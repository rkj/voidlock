import {
  Unit,
  Command,
  CommandType,
  UnitState,
  GameState,
  ItemLibrary,
  AIProfile,
  Vector2,
} from "../../shared/types";
import { Pathfinder } from "../Pathfinder";
import { SPEED_NORMALIZATION_CONST, MOVEMENT, ITEMS } from "../config/GameConstants";
import { IDirector } from "../interfaces/IDirector";
import { MathUtils } from "../../shared/utils/MathUtils";

export class CommandExecutor {
  constructor(private pathfinder: Pathfinder) {}

  public executeCommand(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean = true,
    director?: IDirector,
  ): Unit {
    let currentUnit: Unit = { ...unit, activeCommand: cmd };

    if (
      isManual &&
      cmd.type !== CommandType.EXPLORE &&
      cmd.type !== CommandType.RESUME_AI
    ) {
      // If we are issuing a manual PICKUP or USE_ITEM command while AI is enabled,
      // we want to resume AI after the action is complete.
      if (
        currentUnit.aiEnabled &&
        (cmd.type === CommandType.PICKUP || cmd.type === CommandType.USE_ITEM)
      ) {
        currentUnit.commandQueue = currentUnit.commandQueue.concat({
          type: CommandType.RESUME_AI,
          unitIds: [currentUnit.id],
        });
      }
      currentUnit.aiEnabled = false;
    }

    if (cmd.type === CommandType.MOVE_TO) {
      if (currentUnit.state !== UnitState.Extracted && currentUnit.state !== UnitState.Dead) {
        currentUnit.forcedTargetId = undefined;
        // Clear exploration target if this is a manual command OR an autonomous command that isn't exploration
        if (isManual || cmd.label !== "Exploring") {
          currentUnit.explorationTarget = undefined;
        }

        if (currentUnit.state === UnitState.Channeling) {
          currentUnit.channeling = undefined;
          currentUnit.state = UnitState.Idle;
        }

        const path = this.pathfinder.findPath(
          { x: Math.floor(currentUnit.pos.x), y: Math.floor(currentUnit.pos.y) },
          cmd.target,
          true,
        );
        if (path && path.length > 0) {
          currentUnit.path = path;
          currentUnit.targetPos = {
            x: path[0].x + MOVEMENT.CENTER_OFFSET + (currentUnit.visualJitter?.x || 0),
            y: path[0].y + MOVEMENT.CENTER_OFFSET + (currentUnit.visualJitter?.y || 0),
          };
          currentUnit.state = UnitState.Moving;
        } else if (
          path &&
          path.length === 0 &&
          Math.floor(currentUnit.pos.x) === cmd.target.x &&
          Math.floor(currentUnit.pos.y) === cmd.target.y
        ) {
          currentUnit.pos = {
            x: cmd.target.x + MOVEMENT.CENTER_OFFSET + (currentUnit.visualJitter?.x || 0),
            y: cmd.target.y + MOVEMENT.CENTER_OFFSET + (currentUnit.visualJitter?.y || 0),
          };
          currentUnit.path = undefined;
          currentUnit.targetPos = undefined;
          currentUnit.state = UnitState.Idle;
          currentUnit.activeCommand = undefined;
        } else {
          currentUnit.path = undefined;
          currentUnit.targetPos = undefined;
          currentUnit.state = UnitState.Idle;
          currentUnit.activeCommand = undefined;
        }
      }
    } else if (cmd.type === CommandType.ESCORT_UNIT) {
      if (currentUnit.state !== UnitState.Extracted && currentUnit.state !== UnitState.Dead) {
        currentUnit.forcedTargetId = undefined;
        currentUnit.explorationTarget = undefined;
        if (currentUnit.state === UnitState.Channeling) {
          currentUnit.channeling = undefined;
          currentUnit.state = UnitState.Idle;
        }
        currentUnit.path = undefined;
        currentUnit.targetPos = undefined;
        currentUnit.aiEnabled = false;
        currentUnit.activeCommand = cmd;
      }
    } else if (cmd.type === CommandType.OVERWATCH_POINT) {
      if (currentUnit.state !== UnitState.Extracted && currentUnit.state !== UnitState.Dead) {
        currentUnit.aiEnabled = false;
        currentUnit.aiProfile = AIProfile.STAND_GROUND;
        currentUnit = this.executeCommand(
          currentUnit,
          {
            type: CommandType.MOVE_TO,
            unitIds: [currentUnit.id],
            target: cmd.target,
            label: "Overwatching",
          },
          state,
          isManual,
          director,
        );
        currentUnit.activeCommand = cmd;
      }
    } else if (cmd.type === CommandType.EXPLORE) {
      if (currentUnit.state !== UnitState.Extracted && currentUnit.state !== UnitState.Dead) {
        currentUnit.aiEnabled = true;
        // Default exploration behavior will take over in update()
      }
    } else if (cmd.type === CommandType.SET_ENGAGEMENT) {
      currentUnit.engagementPolicy = cmd.mode;
      currentUnit.engagementPolicySource = "Manual";
      currentUnit.activeCommand = undefined;
    } else if (cmd.type === CommandType.STOP) {
      currentUnit.commandQueue = [];
      currentUnit.path = undefined;
      currentUnit.targetPos = undefined;
      currentUnit.forcedTargetId = undefined;
      currentUnit.explorationTarget = undefined;
      currentUnit.aiEnabled = false;
      currentUnit.activeCommand = undefined;

      if (currentUnit.state === UnitState.Channeling) {
        currentUnit.channeling = undefined;
      }
      currentUnit.state = UnitState.Idle;
    } else if (cmd.type === CommandType.RESUME_AI) {
      currentUnit.aiEnabled = true;
      currentUnit.activeCommand = undefined;
    } else if (cmd.type === CommandType.PICKUP) {
      if (currentUnit.state !== UnitState.Extracted && currentUnit.state !== UnitState.Dead) {
        const loot = state.loot?.find((l) => l.id === cmd.lootId);
        const objective = state.objectives?.find((o) => o.id === cmd.lootId);
        if (loot) {
          currentUnit = this.executeCommand(
            currentUnit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [currentUnit.id],
              target: { x: Math.floor(loot.pos.x), y: Math.floor(loot.pos.y) },
              label: "Picking up",
            },
            state,
            isManual,
            director,
          );
          currentUnit.activeCommand = cmd;
        } else if (objective && objective.targetCell) {
          currentUnit = this.executeCommand(
            currentUnit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [currentUnit.id],
              target: objective.targetCell,
              label: "Picking up",
            },
            state,
            isManual,
            director,
          );
          currentUnit.activeCommand = cmd;
        }
      }
    } else if (cmd.type === CommandType.EXTRACT) {
      if (currentUnit.state !== UnitState.Extracted && currentUnit.state !== UnitState.Dead) {
        if (state.map.extraction) {
          currentUnit = this.executeCommand(
            currentUnit,
            {
              type: CommandType.MOVE_TO,
              unitIds: [currentUnit.id],
              target: state.map.extraction,
              label: "Extracting",
            },
            state,
            isManual,
            director,
          );
          currentUnit.activeCommand = cmd;
        }
      }
    } else if (cmd.type === CommandType.USE_ITEM) {
      if (currentUnit.state !== UnitState.Extracted && currentUnit.state !== UnitState.Dead) {
        const item = ItemLibrary[cmd.itemId];
        if (item) {
          let targetLocation: Vector2 | undefined = cmd.target;
          let targetUnitId: string | undefined = cmd.targetUnitId;

          // Medkit is now strictly self-heal
          if (cmd.itemId === "medkit") {
            targetUnitId = currentUnit.id;
            targetLocation = undefined;
          }

          if (targetUnitId) {
            const targetUnit =
              state.units.find((u) => u.id === targetUnitId) ||
              state.enemies.find((e) => e.id === targetUnitId);
            if (targetUnit) {
              targetLocation = {
                x: Math.floor(targetUnit.pos.x),
                y: Math.floor(targetUnit.pos.y),
              };
            }
          }

          // If item has a target, move there first?
          if (
            targetLocation &&
            (item.action === "Heal" || item.action === "Mine" || item.action === "Sentry")
          ) {
            const dist = MathUtils.getDistance(currentUnit.pos, {
              x: targetLocation.x + MOVEMENT.CENTER_OFFSET,
              y: targetLocation.y + MOVEMENT.CENTER_OFFSET,
            });
            if (dist > ITEMS.USE_ITEM_RANGE_THRESHOLD) {
              currentUnit = this.executeCommand(
                currentUnit,
                {
                  type: CommandType.MOVE_TO,
                  unitIds: [currentUnit.id],
                  target: targetLocation,
                  label: "Moving to use item",
                },
                state,
                isManual,
                director,
              );
              currentUnit.activeCommand = cmd; // Re-set active command to USE_ITEM so it resumes after move
              return currentUnit;
            }
          }

          const isTimedAction =
            cmd.itemId === "medkit" || cmd.itemId === "mine" || item.action === "Sentry";
          if (isTimedAction) {
            const baseTime = ITEMS.BASE_USE_ITEM_TIME;
            const scaledDuration =
              baseTime * (SPEED_NORMALIZATION_CONST / currentUnit.stats.speed);

            currentUnit.state = UnitState.Channeling;
            currentUnit.channeling = {
              action: "UseItem",
              remaining: scaledDuration,
              totalDuration: scaledDuration,
            };
            currentUnit.path = undefined;
            currentUnit.targetPos = undefined;
          } else {
            // Instant use
            const count = state.squadInventory[cmd.itemId] || 0;
            if (count > 0) {
              state.squadInventory[cmd.itemId] = count - 1;
              if (director) {
                director.handleUseItem(state, cmd);
                // Sync back hp in case of self-heal (director mutates state.units)
                const mutated = state.units.find((u) => u.id === currentUnit.id);
                if (mutated) {
                  currentUnit.hp = mutated.hp;
                }
              }
            }
            currentUnit.activeCommand = undefined;
          }
        }
      }
    }
    return currentUnit;
  }
}
