import {
  Command,
  CommandType,
  EngagementPolicy,
  Vector2,
} from "@src/shared/types";

export interface CommandContext {
  action: CommandType | null;
  itemId: string | null;
  targetId: string | null;
  mode: EngagementPolicy | null;
  label: string | null;
  targetLocation: Vector2 | null;
  isShiftHeld: boolean;
}

/**
 * Responsible for constructing the Command object from the current selection context.
 */
export class CommandBuilder {
  public static build(ctx: CommandContext, unitIds: string[]): Command | null {
    const {
      action,
      itemId,
      targetId,
      mode,
      label,
      targetLocation,
      isShiftHeld,
    } = ctx;

    if (!action) return null;

    const base = {
      unitIds,
      label: label || undefined,
      queue: isShiftHeld,
    };

    switch (action) {
      case CommandType.MOVE_TO:
        return { ...base, type: action, target: targetLocation! };
      case CommandType.OVERWATCH_POINT:
        return { ...base, type: action, target: targetLocation! };

      case CommandType.EXPLORE:
      case CommandType.STOP:
      case CommandType.RESUME_AI:
      case CommandType.EXTRACT:
        return { ...base, type: action };

      case CommandType.SET_ENGAGEMENT:
        return { ...base, type: action, mode: mode! };

      case CommandType.PICKUP:
        return { ...base, type: action, lootId: targetId! };

      case CommandType.ESCORT_UNIT:
        return { ...base, type: action, targetId: targetId! };

      case CommandType.USE_ITEM:
        return {
          ...base,
          type: action,
          itemId: itemId!,
          target: targetLocation || undefined,
          targetUnitId: targetId || undefined,
        };

      default:
        return null;
    }
  }
}
