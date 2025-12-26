import {
  CommandType,
  EngagementPolicy,
  GameState,
  OverlayOption,
  UnitState,
  Vector2,
} from "../shared/types";
import { MENU_CONFIG, MenuOptionDefinition, MenuState } from "./MenuConfig";

export interface RenderableMenuOption {
  key: string;
  label: string;
  isBack?: boolean;
  disabled?: boolean;
  dataAttributes?: Record<string, string>;
}

export interface RenderableMenuState {
  title: string;
  options: RenderableMenuOption[];
  error?: string;
  footer?: string;
}

export class MenuController {
  public menuState: MenuState = "ACTION_SELECT";
  public pendingAction: CommandType | null = null;
  public pendingMode: EngagementPolicy | null = null;
  public pendingLabel: string | null = null;
  public pendingTargetLocation: Vector2 | null = null;
  public overlayOptions: OverlayOption[] = [];

  constructor(private client: { sendCommand: (cmd: any) => void }) {}

  public reset() {
    this.menuState = "ACTION_SELECT";
    this.pendingAction = null;
    this.pendingMode = null;
    this.pendingLabel = null;
    this.pendingTargetLocation = null;
    this.overlayOptions = [];
  }

  public selectUnit(unitId: string) {
    if (this.menuState === "UNIT_SELECT" && this.pendingAction) {
      this.executePendingCommand([unitId]);
    }
  }

  public handleCanvasClick(cell: Vector2, gameState: GameState): void {
    if (
      this.menuState === "TARGET_SELECT" &&
      this.pendingAction === CommandType.MOVE_TO
    ) {
      this.pendingTargetLocation = cell;
      this.menuState = "UNIT_SELECT";
    }
  }

  public handleMenuInput(num: number, gameState: GameState): void {
    if (num === 0) {
      this.goBack();
      return;
    }

    const config = MENU_CONFIG[this.menuState];

    if (this.menuState === "ACTION_SELECT") {
      const option = config.options.find((o) => o.key === num);
      if (option) {
        if (this.isOptionDisabled(option, gameState)) return;

        this.pendingAction = option.commandType || null;

        // Special Case Handling based on Label or custom logic
        // Ideally we'd have a specific ID in config, but Label/Key works for now
        if (option.label === "MOVE") {
          this.pendingLabel = "Moving";
          this.menuState = "TARGET_SELECT"; // Default next state
          this.generateTargetOverlay("CELL", gameState);
        } else if (option.label === "STOP") {
          this.pendingLabel = "Stopping";
          this.menuState = "UNIT_SELECT";
        } else if (option.label === "ENGAGEMENT") {
          this.pendingLabel = "Policy Change";
          this.menuState = "MODE_SELECT";
        } else if (option.label === "COLLECT") {
          this.pendingLabel = "Collecting";
          this.menuState = "TARGET_SELECT";
          this.generateTargetOverlay("ITEM", gameState);
        } else if (option.label === "EXTRACT") {
          this.pendingLabel = "Extracting";
          if (gameState.map.extraction) {
            this.pendingTargetLocation = gameState.map.extraction;
            this.menuState = "UNIT_SELECT";
          } else {
            // If no extraction point, maybe stay or show error?
            // For now, let's just go to UNIT_SELECT but it might fail or we handle it in execute
            this.menuState = "UNIT_SELECT";
          }
        } else if (option.label === "RESUME AI") {
          this.pendingLabel = "Resuming AI";
          this.menuState = "UNIT_SELECT";
        }
      }
    } else if (this.menuState === "MODE_SELECT") {
      const option = config.options.find((o) => o.key === num);
      if (option && option.type === "MODE") {
        this.pendingMode = option.modeValue || null;
        this.menuState = option.nextState || "UNIT_SELECT";
      }
    } else if (this.menuState === "TARGET_SELECT") {
      const option = this.overlayOptions.find((o) => o.key === num.toString());
      if (option && option.pos) {
        this.pendingTargetLocation = option.pos;
        this.menuState = "UNIT_SELECT";
      }
    } else if (this.menuState === "UNIT_SELECT") {
      const activeUnits = gameState.units.filter(
        (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
      );
      let selectedIds: string[] = [];

      if (num > 0 && num <= activeUnits.length) {
        selectedIds = [activeUnits[num - 1].id];
      } else if (num === activeUnits.length + 1) {
        selectedIds = activeUnits.map((u) => u.id);
      }

      if (selectedIds.length > 0 && this.pendingAction) {
        this.executePendingCommand(selectedIds);
      }
    }
  }

  public goBack() {
    if (this.menuState === "UNIT_SELECT") {
      if (this.pendingAction === CommandType.SET_ENGAGEMENT)
        this.menuState = "MODE_SELECT";
      else if (this.pendingAction === CommandType.MOVE_TO)
        this.menuState = "TARGET_SELECT";
      else this.menuState = "ACTION_SELECT";
    } else if (
      this.menuState === "MODE_SELECT" ||
      this.menuState === "TARGET_SELECT"
    ) {
      this.menuState = "ACTION_SELECT";
    }

    if (this.menuState === "ACTION_SELECT") {
      this.reset();
    }
  }

  public getRenderableState(gameState: GameState): RenderableMenuState {
    const config = MENU_CONFIG[this.menuState];
    const result: RenderableMenuState = {
      title: config.title,
      options: [],
    };

    if (
      this.menuState === "ACTION_SELECT" ||
      this.menuState === "MODE_SELECT"
    ) {
      result.options = config.options.map((opt) => ({
        key: opt.key.toString(),
        label: opt.key === 0 ? "BACK" : `${opt.key}. ${opt.label}`,
        isBack: opt.key === 0,
        disabled: this.isOptionDisabled(opt, gameState),
        dataAttributes: { index: opt.key.toString() },
      }));

      if (this.menuState === "ACTION_SELECT") {
        result.footer = "(Select Action)";
      } else {
        result.footer = "(ESC to Go Back)";
      }
    } else if (this.menuState === "TARGET_SELECT") {
      if (
        this.overlayOptions.length === 0 &&
        this.pendingAction !== CommandType.MOVE_TO
      ) {
        result.error = "No POIs available.";
      } else {
        result.options = this.overlayOptions.map((opt) => ({
          key: opt.key,
          label: `${opt.key}. ${opt.label}`,
          dataAttributes: { index: opt.key, key: opt.key },
        }));
      }
      result.options.push({
        key: "0",
        label: "0. BACK",
        isBack: true,
        dataAttributes: { index: "0" },
      });
      result.footer = "(Click map or press 1-9)";
    } else if (this.menuState === "UNIT_SELECT") {
      let counter = 1;
      const activeUnits = gameState.units.filter(
        (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
      );

      result.options = activeUnits.map((u) => ({
        key: counter.toString(),
        label: `${counter}. Unit ${u.id}`,
        dataAttributes: { index: counter.toString(), "unit-id": u.id },
      }));
      counter = activeUnits.length + 1; // Correct counter for ALL UNITS

      // Add options based on counter, but we need to increment correctly
      // map used previously, so let's just push to options array
      // Fix: result.options is already populated by map.
      // Need to update counter after map.

      // Re-do mapping to be cleaner
      result.options = [];
      counter = 1;
      activeUnits.forEach((u) => {
        result.options.push({
          key: counter.toString(),
          label: `${counter}. Unit ${u.id}`,
          dataAttributes: { index: counter.toString(), "unit-id": u.id },
        });
        counter++;
      });

      result.options.push({
        key: counter.toString(),
        label: `${counter}. ALL UNITS`,
        dataAttributes: { index: counter.toString(), "unit-id": "ALL" },
      });

      result.options.push({
        key: "0",
        label: "0. BACK",
        isBack: true,
        dataAttributes: { index: "0" },
      });
      result.footer = "(Press 1-9 or ESC)";
    }

    return result;
  }

  private isOptionDisabled(
    option: MenuOptionDefinition,
    gameState: GameState,
  ): boolean {
    if (option.label === "COLLECT") {
      // Check for any visible pending items
      const hasVisibleItems = gameState.objectives.some(
        (obj) => obj.state === "Pending" && obj.visible && obj.targetCell,
      );
      return !hasVisibleItems;
    } else if (option.label === "EXTRACT") {
      return !gameState.map.extraction;
    }
    return false;
  }

  private executePendingCommand(unitIds: string[]) {
    if (!this.pendingAction) return;

    if (
      this.pendingAction === CommandType.MOVE_TO &&
      this.pendingTargetLocation
    ) {
      this.client.sendCommand({
        type: CommandType.MOVE_TO,
        unitIds,
        target: this.pendingTargetLocation,
        label: this.pendingLabel || undefined,
      });
    } else if (this.pendingAction === CommandType.STOP) {
      this.client.sendCommand({
        type: CommandType.STOP,
        unitIds,
        label: this.pendingLabel || undefined,
      });
    } else if (
      this.pendingAction === CommandType.SET_ENGAGEMENT &&
      this.pendingMode
    ) {
      this.client.sendCommand({
        type: CommandType.SET_ENGAGEMENT,
        unitIds,
        mode: this.pendingMode,
        label: this.pendingLabel || undefined,
      });
    } else if (this.pendingAction === CommandType.RESUME_AI) {
      this.client.sendCommand({
        type: CommandType.RESUME_AI,
        unitIds,
        label: this.pendingLabel || undefined,
      });
    }

    this.reset();
  }

  private generateTargetOverlay(type: "CELL" | "ITEM", gameState: GameState) {
    this.overlayOptions = [];
    let counter = 1;

    if (type === "ITEM") {
      gameState.objectives.forEach((obj) => {
        if (obj.state === "Pending" && obj.visible && obj.targetCell) {
          this.overlayOptions.push({
            key: counter.toString(),
            label: `Collect ${obj.kind}`,
            pos: obj.targetCell,
          });
          counter++;
        }
      });
    } else if (type === "CELL") {
      if (gameState.map.extraction) {
        this.overlayOptions.push({
          key: counter.toString(),
          label: "Extraction",
          pos: gameState.map.extraction,
        });
        counter++;
      }
      gameState.objectives.forEach((obj) => {
        if (obj.state === "Pending" && obj.visible && obj.targetCell) {
          this.overlayOptions.push({
            key: counter.toString(),
            label: `Obj ${obj.id}`,
            pos: obj.targetCell,
          });
          counter++;
        }
      });
    }
  }
}
