import {
  Unit,
  Command,
  GameState,
  CommandType,
  UnitState,
  UseItemCommand,
  ItemLibrary,
  Vector2,
} from "@src/shared/types";
import { ItemEffectHandler } from "@src/engine/interfaces/IDirector";
import { IUnitCommandHandler } from "../IUnitCommandHandler";
import { UnitCommandRegistry } from "../UnitCommandRegistry";
import { MathUtils } from "@src/shared/utils/MathUtils";
import {
  MOVEMENT,
  ITEMS,
  SPEED_NORMALIZATION_CONST,
} from "@src/engine/config/GameConstants";

export class UseItemHandler implements IUnitCommandHandler {
  public type = CommandType.USE_ITEM;

  public execute(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean,
    registry: UnitCommandRegistry,
    director?: ItemEffectHandler,
  ): Unit {
    const useItemCmd = cmd as UseItemCommand;
    let currentUnit = { ...unit };

    if (
      currentUnit.state !== UnitState.Extracted &&
      currentUnit.state !== UnitState.Dead
    ) {
      const item = ItemLibrary[useItemCmd.itemId];
      if (item) {
        let targetLocation: Vector2 | undefined = useItemCmd.target;
        let targetUnitId: string | undefined = useItemCmd.targetUnitId;

        // Medkit is now strictly self-heal
        if (useItemCmd.itemId === "medkit") {
          targetUnitId = currentUnit.id;
          targetLocation = undefined;
        }

        if (targetUnitId) {
          const targetUnit =
            state.units.find((u) => u.id === targetUnitId) ||
            state.enemies.find((e) => e.id === targetUnitId);
          if (targetUnit) {
            targetLocation = MathUtils.toCellCoord(targetUnit.pos);
          }
        }

        // If item has a target, move there first?
        if (
          targetLocation &&
          (item.action === "Heal" ||
            item.action === "Mine" ||
            item.action === "Sentry")
        ) {
          const dist = MathUtils.getDistance(currentUnit.pos, {
            x: targetLocation.x + MOVEMENT.CENTER_OFFSET,
            y: targetLocation.y + MOVEMENT.CENTER_OFFSET,
          });
          if (dist > ITEMS.USE_ITEM_RANGE_THRESHOLD) {
            currentUnit = registry.execute(
              currentUnit,
              {
                type: CommandType.MOVE_TO,
                unitIds: [currentUnit.id],
                target: targetLocation,
                label: "Moving To Use Item",
              },
              state,
              isManual,
              director,
            );
            currentUnit.activeCommand = useItemCmd; // Re-set active command to USE_ITEM so it resumes after move
            return currentUnit;
          }
        }

        const isTimedAction =
          useItemCmd.itemId === "medkit" ||
          useItemCmd.itemId === "mine" ||
          item.action === "Sentry";
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
          const count = state.squadInventory[useItemCmd.itemId] || 0;
          if (count > 0) {
            state.squadInventory[useItemCmd.itemId] = count - 1;
            if (director) {
              director.handleUseItem(state, useItemCmd);
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

    return currentUnit;
  }
}
