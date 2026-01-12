import { CommandType, EngagementPolicy, Vector2 } from "@src/shared/types";

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
  public static build(ctx: CommandContext, unitIds: string[]): any {
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

    const base: any = {
      type: action,
      unitIds,
      label: label || undefined,
      queue: isShiftHeld,
    };

    switch (action) {
      case CommandType.MOVE_TO:
      case CommandType.OVERWATCH_POINT:
        return { ...base, target: targetLocation };

      case CommandType.EXPLORE:
      case CommandType.STOP:
      case CommandType.RESUME_AI:
      case CommandType.EXTRACT:
        return base;

      case CommandType.SET_ENGAGEMENT:
        return { ...base, mode };

      case CommandType.PICKUP:
        return { ...base, lootId: targetId };

      case CommandType.ESCORT_UNIT:
        return { ...base, targetId };

      case CommandType.USE_ITEM:
        return {
          ...base,
          itemId,
          target: targetLocation || undefined,
          targetUnitId: targetId || undefined,
        };

      default:
        return null;
    }
  }
}
