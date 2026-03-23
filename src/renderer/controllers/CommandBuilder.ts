import type {
  Command,
  EngagementPolicy,
  Vector2} from "@src/shared/types";
import {
  CommandType
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
      case CommandType.OVERWATCH_POINT:
        if (!targetLocation) return null;
        return { ...base, type: action, target: targetLocation };

      case CommandType.EXPLORE:
      case CommandType.STOP:
      case CommandType.RESUME_AI:
      case CommandType.EXTRACT:
        return { ...base, type: action };

      case CommandType.SET_ENGAGEMENT:
        if (!mode) return null;
        return { ...base, type: action, mode };

      case CommandType.PICKUP:
        if (!targetId) return null;
        return { ...base, type: action, lootId: targetId };

      case CommandType.ESCORT_UNIT:
        if (!targetId) return null;
        return { ...base, type: action, targetId };

      case CommandType.USE_ITEM:
        if (!itemId) return null;
        return {
          ...base,
          type: action,
          itemId,
          target: targetLocation ?? undefined,
          targetUnitId: targetId ?? undefined,
        };

      default:
        return null;
    }
  }
}
