import {
  CommandType,
  EngagementPolicy,
  OverlayOption,
  Vector2,
} from "@src/shared/types";

/**
 * Tracks the current selection context, including pending actions, targets, and modes.
 */
export class SelectionManager {
  public pendingAction: CommandType | null = null;
  public pendingItemId: string | null = null;
  public pendingTargetId: string | null = null;
  public pendingMode: EngagementPolicy | null = null;
  public pendingLabel: string | null = null;
  public pendingTargetLocation: Vector2 | null = null;
  public pendingUnitIds: string[] | null = null;
  public overlayOptions: OverlayOption[] = [];
  public isShiftHeld: boolean = false;

  public reset() {
    this.pendingAction = null;
    this.pendingItemId = null;
    this.pendingTargetId = null;
    this.pendingMode = null;
    this.pendingLabel = null;
    this.pendingTargetLocation = null;
    this.pendingUnitIds = null;
    this.overlayOptions = [];
  }
}
