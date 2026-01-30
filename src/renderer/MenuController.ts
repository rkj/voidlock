import {
  Command,
  CommandType,
  EngagementPolicy,
  GameState,
  ItemLibrary,
  OverlayOption,
  UnitState,
  Vector2,
} from "@src/shared/types";
import {
  MENU_CONFIG,
  MenuOptionDefinition,
  MenuState,
} from "@src/renderer/MenuConfig";
import { MenuStateMachine } from "./controllers/MenuStateMachine";
import { SelectionManager } from "./controllers/SelectionManager";
import { RoomDiscoveryManager } from "./controllers/RoomDiscoveryManager";
import { CommandBuilder } from "./controllers/CommandBuilder";
import {
  TargetOverlayGenerator,
} from "./controllers/TargetOverlayGenerator";
import { isCellVisible } from "@src/shared/VisibilityUtils";

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
  breadcrumbs?: string[];
}

export class MenuController {
  private stateMachine = new MenuStateMachine();
  private selection = new SelectionManager();
  private discovery = new RoomDiscoveryManager();

  public get menuState(): MenuState {
    return this.stateMachine.state;
  }
  public set menuState(value: MenuState) {
    this.stateMachine.state = value;
  }

  public get pendingAction(): CommandType | null {
    return this.selection.pendingAction;
  }
  public set pendingAction(value: CommandType | null) {
    this.selection.pendingAction = value;
  }

  public get pendingItemId(): string | null {
    return this.selection.pendingItemId;
  }
  public set pendingItemId(value: string | null) {
    this.selection.pendingItemId = value;
  }

  public get pendingTargetId(): string | null {
    return this.selection.pendingTargetId;
  }
  public set pendingTargetId(value: string | null) {
    this.selection.pendingTargetId = value;
  }

  public get pendingMode(): EngagementPolicy | null {
    return this.selection.pendingMode;
  }
  public set pendingMode(value: EngagementPolicy | null) {
    this.selection.pendingMode = value;
  }

  public get pendingLabel(): string | null {
    return this.selection.pendingLabel;
  }
  public set pendingLabel(value: string | null) {
    this.selection.pendingLabel = value;
  }

  public get pendingTargetLocation(): Vector2 | null {
    return this.selection.pendingTargetLocation;
  }
  public set pendingTargetLocation(value: Vector2 | null) {
    this.selection.pendingTargetLocation = value;
  }

  public get pendingUnitIds(): string[] | null {
    return this.selection.pendingUnitIds;
  }
  public set pendingUnitIds(value: string[] | null) {
    this.selection.pendingUnitIds = value;
  }

  public get overlayOptions(): OverlayOption[] {
    return this.selection.overlayOptions;
  }
  public set overlayOptions(value: OverlayOption[]) {
    this.selection.overlayOptions = value;
  }

  public get isShiftHeld(): boolean {
    return this.selection.isShiftHeld;
  }
  public set isShiftHeld(value: boolean) {
    this.selection.isShiftHeld = value;
  }

  constructor(private client: { sendCommand: (cmd: Command) => void }) {}

  public reset() {
    this.stateMachine.reset();
    this.selection.reset();
  }

  private transitionTo(nextState: MenuState, label?: string) {
    this.stateMachine.push(nextState, label);
  }

  public clearDiscoveryOrder() {
    this.discovery.clear();
  }

  public selectUnit(unitId: string) {
    if (
      this.stateMachine.state === "UNIT_SELECT" &&
      this.selection.pendingAction
    ) {
      this.executePendingCommand([unitId]);
    }
  }

  public handleCanvasClick(cell: Vector2, gameState: GameState): void {
    if (this.stateMachine.state === "UNIT_SELECT" && this.selection.pendingAction) {
      const unitAtCell = gameState.units.find(
        (u) =>
          Math.floor(u.pos.x) === cell.x &&
          Math.floor(u.pos.y) === cell.y &&
          u.state !== UnitState.Dead &&
          u.state !== UnitState.Extracted,
      );
      if (unitAtCell) {
        this.executePendingCommand([unitAtCell.id]);
        return;
      }
    }

    if (
      this.stateMachine.state === "TARGET_SELECT" &&
      (this.selection.pendingAction === CommandType.MOVE_TO ||
        this.selection.pendingAction === CommandType.USE_ITEM)
    ) {
      this.selection.pendingTargetLocation = cell;
      this.selection.overlayOptions = [];

      // If clicking on a unit, set pendingTargetId
      const unitAtCell = gameState.units.find(
        (u) =>
          Math.floor(u.pos.x) === cell.x &&
          Math.floor(u.pos.y) === cell.y &&
          u.state !== UnitState.Dead &&
          u.state !== UnitState.Extracted,
      );
      if (unitAtCell) {
        this.selection.pendingTargetId = unitAtCell.id;
      }

      // Special case: Global items bypass UNIT_SELECT
      const item = this.selection.pendingItemId
        ? ItemLibrary[this.selection.pendingItemId]
        : null;
      const isGlobal =
        item &&
        (item.action === "Grenade" ||
          item.action === "Scanner");

      if (isGlobal) {
        this.executePendingCommand([]);
      } else if (
        this.selection.pendingUnitIds &&
        this.selection.pendingUnitIds.length > 0
      ) {
        this.executePendingCommand(this.selection.pendingUnitIds);
      } else {
        this.transitionTo("UNIT_SELECT", "Target");
      }
    }
  }

  public handleMenuInput(key: string, gameState: GameState): void {
    if (key === "0" || key === "q") {
      this.goBack();
      return;
    }

    switch (this.stateMachine.state) {
      case "ACTION_SELECT":
        this.handleActionSelect(key, gameState);
        break;
      case "ORDERS_SELECT":
        this.handleOrdersSelect(key, gameState);
        break;
      case "ITEM_SELECT":
        this.handleItemSelect(key, gameState);
        break;
      case "MODE_SELECT":
        this.handleModeSelect(key, gameState);
        break;
      case "TARGET_SELECT":
        this.handleTargetSelect(key, gameState);
        break;
      case "UNIT_SELECT":
        this.handleUnitSelect(key, gameState);
        break;
    }
  }

  private handleActionSelect(key: string, gameState: GameState) {
    const config = MENU_CONFIG.ACTION_SELECT;
    const option = config.options.find((o) => o.key.toString() === key);
    if (!option || this.isOptionDisabled(option, gameState)) return;

    if (option.type === "TRANSITION") {
      this.transitionTo(option.nextState || "ACTION_SELECT", option.label);
      return;
    }

    this.selection.pendingAction = option.commandType || null;

    if (option.commandType === CommandType.PICKUP) {
      this.selection.pendingLabel = "Picking up";
      this.transitionTo("TARGET_SELECT", option.label);
      this.selection.overlayOptions = TargetOverlayGenerator.generate(
        "ITEM",
        gameState,
        this.discovery,
      );
    } else if (option.commandType === CommandType.EXTRACT) {
      this.selection.pendingLabel = "Extracting";
      this.transitionTo("UNIT_SELECT", option.label);
    } else if (option.commandType === CommandType.SET_ENGAGEMENT) {
      this.selection.pendingLabel = "Policy Change";
      this.transitionTo("MODE_SELECT", option.label);
    } else if (option.commandType === CommandType.USE_ITEM) {
      this.selection.pendingLabel = "Using Item";
      this.transitionTo("ITEM_SELECT", option.label);
    }
  }

  private handleOrdersSelect(key: string, gameState: GameState) {
    const config = MENU_CONFIG.ORDERS_SELECT;
    const option = config.options.find((o) => o.key.toString() === key);
    if (!option) return;

    this.selection.pendingAction = option.commandType || null;

    if (option.commandType === CommandType.MOVE_TO) {
      this.selection.pendingLabel = "Moving";
      this.transitionTo("TARGET_SELECT", option.label);
      this.selection.overlayOptions = TargetOverlayGenerator.generate(
        "CELL",
        gameState,
        this.discovery,
      );
    } else if (option.commandType === CommandType.OVERWATCH_POINT) {
      this.selection.pendingLabel = "Overwatching";
      this.transitionTo("TARGET_SELECT", option.label);
      this.selection.overlayOptions = TargetOverlayGenerator.generate(
        "INTERSECTION",
        gameState,
        this.discovery,
      );
    } else if (option.commandType === CommandType.EXPLORE) {
      this.selection.pendingLabel = "Exploring";
      this.transitionTo("UNIT_SELECT", option.label);
    } else if (option.commandType === CommandType.STOP) {
      this.selection.pendingLabel = "Holding";
      this.transitionTo("UNIT_SELECT", option.label);
    } else if (option.commandType === CommandType.ESCORT_UNIT) {
      this.selection.pendingLabel = "Escorting";
      this.transitionTo("TARGET_SELECT", option.label);
      this.selection.overlayOptions = TargetOverlayGenerator.generate(
        "FRIENDLY_UNIT",
        gameState,
        this.discovery,
      );
    }
  }

  private handleItemSelect(key: string, gameState: GameState) {
    const items = Object.entries(gameState.squadInventory).filter(
      ([_, count]) => count > 0,
    );
    const num = parseInt(key);
    if (!isNaN(num) && num > 0 && num <= items.length) {
      const [itemId] = items[num - 1];

      // Check if disabled
      const item = ItemLibrary[itemId];
      if (item?.action === "Grenade") {
        const hasVisibleEnemies = gameState.enemies.some((e) => {
          return isCellVisible(
            gameState,
            Math.floor(e.pos.x),
            Math.floor(e.pos.y),
          );
        });
        if (!hasVisibleEnemies) return;
      }

      this.selection.pendingItemId = itemId;
      const label = item?.name || itemId;
      if (item?.action === "Mine" || item?.action === "Heal") {
        this.transitionTo("UNIT_SELECT", label);
      } else {
        this.transitionTo("TARGET_SELECT", label);
        if (item?.action === "Scanner") {
          this.selection.overlayOptions = TargetOverlayGenerator.generate(
            "FRIENDLY_UNIT",
            gameState,
            this.discovery,
          );
        } else {
          this.selection.overlayOptions = TargetOverlayGenerator.generate(
            "CELL",
            gameState,
            this.discovery,
          );
        }
      }
    }
  }

  private handleModeSelect(key: string, _gameState: GameState) {
    const config = MENU_CONFIG.MODE_SELECT;
    const option = config.options.find((o) => o.key.toString() === key);
    if (option && option.type === "MODE") {
      this.selection.pendingMode = option.modeValue || null;
      this.transitionTo(option.nextState || "UNIT_SELECT", option.label);
    }
  }

  private handleTargetSelect(key: string, _gameState: GameState) {
    const option = this.selection.overlayOptions.find((o) => o.key === key);
    if (option && option.pos) {
      this.selection.pendingTargetLocation = option.pos;
      this.selection.pendingTargetId = option.id || null;
      this.selection.overlayOptions = [];

      const item = this.selection.pendingItemId
        ? ItemLibrary[this.selection.pendingItemId]
        : null;
      const isGlobal =
        item &&
        (item.action === "Grenade" ||
          item.action === "Scanner");

      if (isGlobal) {
        this.executePendingCommand([]);
      } else if (
        this.selection.pendingUnitIds &&
        this.selection.pendingUnitIds.length > 0
      ) {
        this.executePendingCommand(this.selection.pendingUnitIds);
      } else {
        this.transitionTo("UNIT_SELECT", option.label);
      }
    }
  }

  private handleUnitSelect(key: string, gameState: GameState) {
    const activeUnits = gameState.units.filter(
      (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
    );
    let selectedIds: string[] = [];

    const num = parseInt(key);
    const isPickup = this.selection.pendingAction === CommandType.PICKUP;

    if (!isNaN(num) && num > 0 && num <= activeUnits.length) {
      selectedIds = [activeUnits[num - 1].id];
    } else if (!isNaN(num) && num === activeUnits.length + 1 && !isPickup) {
      selectedIds = activeUnits.map((u) => u.id);
    }

    if (selectedIds.length > 0 && this.selection.pendingAction) {
      const item = this.selection.pendingItemId
        ? ItemLibrary[this.selection.pendingItemId]
        : null;
      if (
        this.selection.pendingAction === CommandType.USE_ITEM &&
        item?.action === "Mine" &&
        !this.selection.pendingTargetLocation
      ) {
        this.selection.pendingUnitIds = selectedIds;
        const label = selectedIds.length === 1 ? selectedIds[0] : "Selected Units";
        this.transitionTo("TARGET_SELECT", label);
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "PLACEMENT_POINT",
          gameState,
          this.discovery,
        );
      } else {
        this.executePendingCommand(selectedIds);
      }
    }
  }

  public goBack() {
    const leavingState = this.stateMachine.state;
    const targetState = this.stateMachine.pop();

    if (leavingState === "TARGET_SELECT" || leavingState === "UNIT_SELECT") {
      this.selection.overlayOptions = [];
    }

    if (
      this.stateMachine.state === "UNIT_SELECT" &&
      this.selection.pendingUnitIds
    ) {
      this.selection.pendingUnitIds = null;
    }

    if (!targetState || this.stateMachine.state === "ACTION_SELECT") {
      this.reset();
    }
  }

  public getRenderableState(gameState: GameState): RenderableMenuState {
    const config = MENU_CONFIG[this.stateMachine.state];
    const result: RenderableMenuState = {
      title: config.title,
      options: [],
      breadcrumbs: [...this.stateMachine.breadcrumbs],
    };

    // Live-update overlays if in Target Select
    if (this.stateMachine.state === "TARGET_SELECT") {
      if (this.selection.pendingAction === CommandType.MOVE_TO) {
        if (this.selection.pendingLabel === "Collecting") {
          this.selection.overlayOptions = TargetOverlayGenerator.generate(
            "ITEM",
            gameState,
            this.discovery,
          );
        } else {
          this.selection.overlayOptions = TargetOverlayGenerator.generate(
            "CELL",
            gameState,
            this.discovery,
          );
        }
      } else if (this.selection.pendingAction === CommandType.OVERWATCH_POINT) {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "INTERSECTION",
          gameState,
          this.discovery,
        );
      } else if (this.selection.pendingAction === CommandType.USE_ITEM) {
        const item = this.selection.pendingItemId
          ? ItemLibrary[this.selection.pendingItemId]
          : null;
        if (item?.action === "Grenade") {
          this.selection.overlayOptions = TargetOverlayGenerator.generate(
            "CELL",
            gameState,
            this.discovery,
          );
        } else if (item?.action === "Scanner") {
          this.selection.overlayOptions = TargetOverlayGenerator.generate(
            "FRIENDLY_UNIT",
            gameState,
            this.discovery,
          );
        } else if (item?.action === "Mine") {
          this.selection.overlayOptions = TargetOverlayGenerator.generate(
            "PLACEMENT_POINT",
            gameState,
            this.discovery,
          );
        } else {
          this.selection.overlayOptions = TargetOverlayGenerator.generate(
            "CELL",
            gameState,
            this.discovery,
          );
        }
      } else if (this.selection.pendingAction === CommandType.PICKUP) {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "ITEM",
          gameState,
          this.discovery,
        );
      } else if (this.selection.pendingAction === CommandType.ESCORT_UNIT) {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "FRIENDLY_UNIT",
          gameState,
          this.discovery,
        );
      }
    }

    if (
      this.stateMachine.state === "ACTION_SELECT" ||
      this.stateMachine.state === "ORDERS_SELECT" ||
      this.stateMachine.state === "MODE_SELECT"
    ) {
      result.options = config.options.map((opt) => ({
        key: opt.key.toString(),
        label: opt.key === 0 ? "Back" : `${opt.key}. ${opt.label}`,
        isBack: opt.key === 0,
        disabled: this.isOptionDisabled(opt, gameState),
        dataAttributes: { index: opt.key.toString() },
      }));

      if (this.stateMachine.state === "ACTION_SELECT") {
        result.footer = "(Select Action)";
      } else if (this.stateMachine.state === "ORDERS_SELECT") {
        result.footer = "(Select Order)";
      } else {
        result.footer = "(Q/ESC to Go Back)";
      }
    } else if (this.stateMachine.state === "ITEM_SELECT") {
      const items = Object.entries(gameState.squadInventory).filter(
        ([_, count]) => count > 0,
      );
      result.options = items.map(([itemId, count], idx) => {
        const item = ItemLibrary[itemId];
        let disabled = false;
        if (item?.action === "Grenade") {
          const hasVisibleEnemies = gameState.enemies.some((e) => {
            return isCellVisible(
              gameState,
              Math.floor(e.pos.x),
              Math.floor(e.pos.y),
            );
          });
          disabled = !hasVisibleEnemies;
        }

        return {
          key: (idx + 1).toString(),
          label: `${idx + 1}. ${item?.name || itemId} (${count})`,
          disabled,
          dataAttributes: { index: (idx + 1).toString(), "item-id": itemId },
        };
      });
      result.options.push({
        key: "0",
        label: "0. Back",
        isBack: true,
        dataAttributes: { index: "0" },
      });
      result.footer = "(Select Item, Q/ESC to Back)";
    } else if (this.stateMachine.state === "TARGET_SELECT") {
      if (
        this.selection.overlayOptions.length === 0 &&
        this.selection.pendingAction !== CommandType.MOVE_TO &&
        this.selection.pendingAction !== CommandType.USE_ITEM
      ) {
        result.error = "No POIs available.";
      } else {
        result.options = this.selection.overlayOptions.map((opt) => ({
          key: opt.key,
          label: `${opt.key}. ${opt.label}`,
          dataAttributes: { index: opt.key, key: opt.key },
        }));
      }
      result.options.push({
        key: "0",
        label: "0. Back",
        isBack: true,
        dataAttributes: { index: "0" },
      });
      result.footer = "(Click map or press 1-9, Q/ESC to Back)";
    } else if (this.stateMachine.state === "UNIT_SELECT") {
      const activeUnits = gameState.units.filter(
        (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
      );

      result.options = [];
      activeUnits.forEach((u) => {
        // Find the unit's tactical number (index in the original units array + 1)
        const tacticalNumber = gameState.units.findIndex((origU) => origU.id === u.id) + 1;
        const key = result.options.length + 1;

        result.options.push({
          key: key.toString(),
          label: `${key}. ${u.id} (${tacticalNumber})`,
          dataAttributes: { index: key.toString(), "unit-id": u.id },
        });
      });

      const allUnitsKey = result.options.length + 1;
      const isPickup = this.selection.pendingAction === CommandType.PICKUP;
      
      if (!isPickup) {
        result.options.push({
          key: allUnitsKey.toString(),
          label: `${allUnitsKey}. All Units`,
          dataAttributes: { index: allUnitsKey.toString(), "unit-id": "ALL" },
        });
      }

      result.options.push({
        key: "0",
        label: "0. Back",
        isBack: true,
        dataAttributes: { index: "0" },
      });
      result.footer = "(Press 1-9 or Q/ESC)";
    }

    return result;
  }

  private isOptionDisabled(
    option: MenuOptionDefinition,
    gameState: GameState,
  ): boolean {
    if (option.commandType === CommandType.USE_ITEM) {
      const availableItems = Object.entries(gameState.squadInventory).filter(
        ([itemId, count]) => {
          if (count <= 0) return false;
          const item = ItemLibrary[itemId];
          if (item?.action === "Grenade") {
            return gameState.enemies.some((e) => {
              return isCellVisible(
                gameState,
                Math.floor(e.pos.x),
                Math.floor(e.pos.y),
              );
            });
          }
          return true;
        },
      );
      return availableItems.length === 0;
    }
    return false;
  }

  private executePendingCommand(unitIds: string[]) {
    const command = CommandBuilder.build(
      {
        action: this.selection.pendingAction,
        itemId: this.selection.pendingItemId,
        targetId: this.selection.pendingTargetId,
        mode: this.selection.pendingMode,
        label: this.selection.pendingLabel,
        targetLocation: this.selection.pendingTargetLocation,
        isShiftHeld: this.selection.isShiftHeld,
      },
      unitIds,
    );

    if (command) {
      this.client.sendCommand(command);
    }

    this.reset();
  }
}
