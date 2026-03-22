import type {
  EngagementPolicy,
  GameState,
  MapDefinition,
  OverlayOption,
  Vector2} from "@src/shared/types";
import {
  CommandType,
  ItemLibrary,
  UnitState
} from "@src/shared/types";
import type {
  MenuOptionDefinition,
  MenuState} from "./MenuConfig";
import {
  MENU_CONFIG
} from "./MenuConfig";
import { MenuStateMachine } from "./controllers/MenuStateMachine";
import { SelectionManager } from "./controllers/SelectionManager";
import { RoomDiscoveryManager } from "./controllers/RoomDiscoveryManager";
import { TargetOverlayGenerator } from "./controllers/TargetOverlayGenerator";
import { CommandBuilder } from "./controllers/CommandBuilder";
import type { GameClient } from "@src/engine/GameClient";
import { isCellVisible, isCellDiscovered } from "@src/shared/VisibilityUtils";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { Logger } from "@src/shared/Logger";
import type { TutorialManager } from "./controllers/TutorialManager";

export interface RenderableMenuState {
  title: string;
  options: {
    key: string;
    label: string;
    disabled?: boolean;
    isBack?: boolean;
    dataAttributes?: Record<string, string>;
  }[];
  breadcrumbs: string[];
  footer?: string;
  error?: string;
}

export class MenuController {
  private stateMachine: MenuStateMachine;
  private selection: SelectionManager;
  private discovery: RoomDiscoveryManager;
  private lastFullMap: MapDefinition | null = null;
  private tutorialManager: TutorialManager | null = null;
  private lastState: GameState | null = null;

  constructor(private client: GameClient) {
    this.stateMachine = new MenuStateMachine();
    this.selection = new SelectionManager();
    this.discovery = new RoomDiscoveryManager();
  }

  public setTutorialManager(manager: TutorialManager) {
    this.tutorialManager = manager;
  }

  get menuState(): MenuState {
    return this.stateMachine.state;
  }

  get pendingAction(): CommandType | null {
    return this.selection.pendingAction;
  }

  get pendingItemId(): string | null {
    return this.selection.pendingItemId;
  }

  get pendingTargetId(): string | null {
    return this.selection.pendingTargetId;
  }

  get pendingMode(): EngagementPolicy | null {
    return this.selection.pendingMode;
  }

  get pendingTargetLocation(): Vector2 | null {
    return this.selection.pendingTargetLocation;
  }

  get pendingUnitIds(): string[] | null {
    return this.selection.pendingUnitIds;
  }

  get overlayOptions(): OverlayOption[] {
    if (
      this.stateMachine.state === "TARGET_SELECT" &&
      this.selection.overlayOptions.length === 0 &&
      this.lastState
    ) {
      this.populateOverlays(this.rehydrateState(this.lastState));
    }
    return this.selection.overlayOptions;
  }

  get isShiftHeld(): boolean {
    return this.selection.isShiftHeld;
  }

  set isShiftHeld(value: boolean) {
    this.selection.isShiftHeld = value;
  }

  public isActionAllowed(action: CommandType | string): boolean {
    if (!this.tutorialManager) return true;
    return this.tutorialManager.isActionAllowed(action.toString());
  }

  public reset() {
    this.stateMachine.reset();
    this.selection.reset();
  }

  public clearDiscoveryOrder() {
    this.discovery.clear();
  }

  public update(state: GameState) {
    this.lastState = state;
    this.discovery.update(state);
    if (state.map && state.map.cells && state.map.cells.length > 0) {
      this.lastFullMap = state.map;
    }
  }

  public handleMenuInput(key: string, gameState: GameState, shiftHeld: boolean = false): void {
    this.lastState = gameState;
    if (shiftHeld) {
      this.selection.isShiftHeld = true;
    }

    const config = MENU_CONFIG[this.stateMachine.state];
    let option: MenuOptionDefinition | undefined;

    // Check tutorial gating for the specific input
    if (this.tutorialManager) {
      if (this.stateMachine.state === "UNIT_SELECT") {
        if (!this.tutorialManager.isActionAllowed("SELECT_UNIT")) {
          Logger.warn(`Tutorial: SELECT_UNIT is currently blocked.`);
          return;
        }
      } else if (this.stateMachine.state === "TARGET_SELECT") {
        if (this.selection.pendingAction && !this.tutorialManager.isActionAllowed(this.selection.pendingAction)) {
          Logger.warn(`Tutorial: ${this.selection.pendingAction} is currently blocked.`);
          return;
        }
      } else {
        option = config.options.find((o) => o.key.toString() === key);
        if (option && !this.isActionAllowedInTutorial(option)) {
          Logger.warn(`Tutorial: Option ${option.label} is currently blocked.`);
          return;
        }
      }
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

  public handleCanvasClick(cell: Vector2, state?: GameState): void {
    const activeState = state || this.lastState;
    if (!activeState) return;

    if (this.stateMachine.state === "TARGET_SELECT") {
      const options = this.overlayOptions; // Use getter to lazy-populate
      const option = options.find(
        (o) => o.pos?.x === cell.x && o.pos.y === cell.y,
      );
      if (option) {
        this.handleTargetSelect(option.key, activeState);
      } else {
        // Direct cell selection for actions that support it (Move To, some items)
        if (
          this.selection.pendingAction === CommandType.MOVE_TO ||
          this.selection.pendingAction === CommandType.USE_ITEM
        ) {
          this.selection.pendingTargetLocation = cell;
          this.selection.pendingTargetId = null;
          this.selection.overlayOptions = [];

          if (
            this.selection.pendingUnitIds &&
            this.selection.pendingUnitIds.length > 0
          ) {
            this.executePendingCommand(this.selection.pendingUnitIds);
          } else {
            this.transitionTo("UNIT_SELECT", "Selected Location");
          }
        }
      }
    } else {
      // Direct unit selection from canvas
      const unitAtCell = activeState.units.find(
        (u) =>
          MathUtils.sameCellPosition(u.pos, cell) &&
          u.state !== UnitState.Dead &&
          u.state !== UnitState.Extracted &&
          u.isDeployed !== false,
      );

      if (unitAtCell) {
        if (this.tutorialManager && !this.tutorialManager.isActionAllowed("SELECT_UNIT")) {
          return;
        }
        
        if (this.stateMachine.state === "UNIT_SELECT") {
            const unitIdx = activeState.units.indexOf(unitAtCell);
            this.handleUnitSelect((unitIdx + 1).toString(), activeState);
        } else {
            this.selectUnit(unitAtCell.id);
        }
      }
    }
  }

  public selectUnit(unitId: string) {
    if (this.tutorialManager && !this.tutorialManager.isActionAllowed("SELECT_UNIT")) {
      return;
    }

    if (this.stateMachine.state !== "ACTION_SELECT") {
      this.reset();
    }
    this.selection.pendingUnitIds = [unitId];
  }

  private handleActionSelect(key: string, _gameState: GameState) {
    const config = MENU_CONFIG.ACTION_SELECT;
    const option = config.options.find((o) => o.key.toString() === key);

    if (option) {
      if (option.type === "TRANSITION") {
        this.transitionTo(option.nextState || "ACTION_SELECT", option.label);
      } else if (option.type === "ACTION" && option.commandType) {
        this.selection.pendingAction = option.commandType;
        if (option.commandType === CommandType.SET_ENGAGEMENT) {
          this.selection.pendingLabel = "Policy Change";
          this.transitionTo("MODE_SELECT", option.label);
        } else if (option.commandType === CommandType.USE_ITEM) {
          this.transitionTo("ITEM_SELECT", option.label);
        } else if (option.commandType === CommandType.PICKUP) {
          this.selection.pendingLabel = "Picking Up";
          this.transitionTo("TARGET_SELECT", option.label);
        } else if (option.commandType === CommandType.EXTRACT) {
          this.selection.pendingLabel = "Extracting";
          this.transitionTo("UNIT_SELECT", option.label);
        }
      }
    }
  }

  private handleOrdersSelect(key: string, _gameState: GameState) {
    const config = MENU_CONFIG.ORDERS_SELECT;
    const option = config.options.find((o) => o.key.toString() === key);

    if (option) {
      if (option.type === "BACK") {
        this.goBack();
      } else if (option.type === "ACTION" && option.commandType) {
        this.selection.pendingAction = option.commandType;
        if (option.nextState) {
          if (option.nextState === "TARGET_SELECT" || option.nextState === "UNIT_SELECT") {
            this.selection.pendingLabel = option.label;
          }
          this.transitionTo(option.nextState, option.label);
        } else {
          // Direct execution (e.g. Stop)
          this.selection.pendingLabel = option.label;
          if (this.selection.pendingUnitIds) {
            this.executePendingCommand(this.selection.pendingUnitIds);
          } else {
            this.transitionTo("UNIT_SELECT", option.label);
          }
        }
      }
    }
  }

  private handleItemSelect(key: string, gameState: GameState) {
    const items = Object.entries(gameState.squadInventory).filter(
      ([_, count]) => count > 0,
    );
    const num = parseInt(key);

    if (key === "0") {
      this.goBack();
      return;
    }

    if (!isNaN(num) && num > 0 && num <= items.length) {
      const itemId = items[num - 1][0];
      const item = ItemLibrary[itemId];
      this.selection.pendingItemId = itemId;

      if (item?.action === "Heal") {
        this.selection.pendingLabel = "Healing";
        // Convention: Pick TARGET first
        this.transitionTo("UNIT_SELECT", item.name);
      } else if (item?.action === "Grenade") {
        this.selection.pendingLabel = "Throwing Grenade";
        this.transitionTo("TARGET_SELECT", item.name);
      } else if (item?.action === "Scanner") {
        this.selection.pendingLabel = "Scanning";
        this.transitionTo("TARGET_SELECT", item.name);
      } else if (item?.action === "Mine") {
        this.selection.pendingLabel = "Placing Mine";
        // Sequence: Item -> Unit -> Target
        this.transitionTo("UNIT_SELECT", item.name);
      } else if (item?.action === "Sentry") {
        this.selection.pendingLabel = "Deploying Sentry";
        // Sequence: Item -> Unit -> Target
        this.transitionTo("UNIT_SELECT", item.name);
      }
    }
  }

  private handleModeSelect(key: string, _gameState: GameState) {
    const config = MENU_CONFIG.MODE_SELECT;
    const option = config.options.find((o) => o.key.toString() === key);
    if (option?.type === "MODE") {
      this.selection.pendingMode = option.modeValue || null;
      this.transitionTo(option.nextState || "UNIT_SELECT", option.label);
    } else if (option?.type === "BACK") {
      this.goBack();
    }
  }

  private handleTargetSelect(key: string, _gameState: GameState) {
    if (key === "0") {
      this.goBack();
      return;
    }

    const options = this.overlayOptions;
    const option = options.find((o) => o.key === key);
    if (option?.pos) {
      this.selection.pendingTargetLocation = option.pos;
      this.selection.pendingTargetId = option.id || null;
      this.selection.overlayOptions = [];

      const item = this.selection.pendingItemId
        ? ItemLibrary[this.selection.pendingItemId]
        : null;
      const isGlobal =
        item && (item.action === "Grenade" || item.action === "Scanner");

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
    if (key === "0") {
      this.goBack();
      return;
    }

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

    if (selectedIds.length > 0) {
      const item = this.selection.pendingItemId
        ? ItemLibrary[this.selection.pendingItemId]
        : null;
      
      // If action needs a target AFTER unit selection (e.g. Mine, Sentry)
      if (
        this.selection.pendingAction === CommandType.USE_ITEM &&
        (item?.action === "Mine" || item?.action === "Sentry")
      ) {
        this.selection.pendingUnitIds = selectedIds;
        this.transitionTo("TARGET_SELECT", "Select Location");
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

  public transitionTo(state: MenuState, breadcrumb: string) {
    this.stateMachine.push(state, breadcrumb);
  }

  public getRenderableState(gameState: GameState): RenderableMenuState {
    const config = MENU_CONFIG[this.stateMachine.state];
    const breadcrumbs = [...this.stateMachine.breadcrumbs];
    if (this.selection.isShiftHeld && breadcrumbs.length > 0) {
      breadcrumbs[breadcrumbs.length - 1] += " (QUEUE)";
    }

    const result: RenderableMenuState = {
      title: config.title,
      options: [],
      breadcrumbs,
    };

    const fullState = this.rehydrateState(gameState);

    // Update overlays if in Target Select
    if (this.stateMachine.state === "TARGET_SELECT") {
      this.populateOverlays(fullState);
    }

    if (
      this.stateMachine.state === "ACTION_SELECT" ||
      this.stateMachine.state === "ORDERS_SELECT" ||
      this.stateMachine.state === "MODE_SELECT"
    ) {
      result.options = config.options.map((opt) => ({
        key: opt.key.toString(),
        label: opt.key === 0 ? "0. Back" : `${opt.key}. ${opt.label}`,
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
            const cell = MathUtils.toCellCoord(e.pos);
            return isCellVisible(gameState, cell.x, cell.y);
          });
          disabled = !hasVisibleEnemies;
        }

        if (this.tutorialManager && !this.tutorialManager.isActionAllowed(CommandType.USE_ITEM)) {
          disabled = true;
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
      const options = this.overlayOptions;
      if (
        options.length === 0 &&
        this.selection.pendingAction !== CommandType.MOVE_TO &&
        this.selection.pendingAction !== CommandType.USE_ITEM
      ) {
        result.error = "No POIs Available.";
      } else {
        result.options = options.map((opt) => ({
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
      result.footer = "(Click Map or Press 1-9, Q/ESC to Back)";
    } else if (this.stateMachine.state === "UNIT_SELECT") {
      let activeUnits = gameState.units.filter(
        (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
      );

      if (
        this.selection.pendingAction === CommandType.ESCORT_UNIT &&
        this.selection.pendingTargetId
      ) {
        activeUnits = activeUnits.filter(
          (u) => u.id !== this.selection.pendingTargetId,
        );
      }

      result.options = [];
      activeUnits.forEach((u) => {
        // Find the unit's tactical number (index in the original units array + 1)
        const tacticalNumber =
          u.tacticalNumber ||
          gameState.units.findIndex((origU) => origU.id === u.id) + 1;
        const key = result.options.length + 1;
        const displayName = u.name || u.id;

        let disabled = false;
        if (this.tutorialManager && !this.tutorialManager.isActionAllowed("SELECT_UNIT")) {
          disabled = true;
        }

        result.options.push({
          key: key.toString(),
          label: `${key}. ${displayName} (${tacticalNumber})`,
          disabled,
          dataAttributes: { index: key.toString(), "unit-id": u.id },
        });
      });

      const allUnitsKey = result.options.length + 1;
      const isPickup = this.selection.pendingAction === CommandType.PICKUP;

      if (!isPickup) {
        let disabled = false;
        if (this.tutorialManager && !this.tutorialManager.isActionAllowed("SELECT_UNIT")) {
          disabled = true;
        }

        result.options.push({
          key: allUnitsKey.toString(),
          label: `${allUnitsKey}. All Units`,
          disabled,
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

  private populateOverlays(fullState: GameState) {
    if (this.selection.pendingAction === CommandType.MOVE_TO) {
      if (this.selection.pendingLabel === "Collecting") {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "ITEM",
          fullState,
          this.discovery,
        );
      } else {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "CELL",
          fullState,
          this.discovery,
        );
      }
    } else if (this.selection.pendingAction === CommandType.OVERWATCH_POINT) {
      this.selection.overlayOptions = TargetOverlayGenerator.generate(
        "INTERSECTION",
        fullState,
        this.discovery,
      );
    } else if (this.selection.pendingAction === CommandType.USE_ITEM) {
      const item = this.selection.pendingItemId
        ? ItemLibrary[this.selection.pendingItemId]
        : null;
      if (item?.action === "Heal") {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "FRIENDLY_UNIT",
          fullState,
          this.discovery,
        );
      } else if (item?.action === "Grenade") {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "HOSTILE_UNIT",
          fullState,
          this.discovery,
        );
      } else if (item?.action === "Scanner") {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "FRIENDLY_UNIT",
          fullState,
          this.discovery,
        );
      } else if (item?.action === "Mine") {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "PLACEMENT_POINT",
          fullState,
          this.discovery,
        );
      } else if (item?.action === "Sentry") {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "PLACEMENT_POINT",
          fullState,
          this.discovery,
        );
      } else {
        this.selection.overlayOptions = TargetOverlayGenerator.generate(
          "CELL",
          fullState,
          this.discovery,
        );
      }
    } else if (this.selection.pendingAction === CommandType.PICKUP) {
      this.selection.overlayOptions = TargetOverlayGenerator.generate(
        "ITEM",
        fullState,
        this.discovery,
      );
    } else if (this.selection.pendingAction === CommandType.ESCORT_UNIT) {
      this.selection.overlayOptions = TargetOverlayGenerator.generate(
        "ESCORT_TARGET",
        fullState,
        this.discovery,
      );
    }
  }

  private isOptionDisabled(
    option: MenuOptionDefinition,
    gameState: GameState,
  ): boolean {
    if (this.tutorialManager && !this.isActionAllowedInTutorial(option)) {
      return true;
    }

    if (option.commandType === CommandType.USE_ITEM) {
      const availableItems = Object.entries(gameState.squadInventory).filter(
        ([itemId, count]) => {
          if (count <= 0) return false;
          const item = ItemLibrary[itemId];
          if (item?.action === "Grenade") {
            return gameState.enemies.some((e) => {
              const cell = MathUtils.toCellCoord(e.pos);
              return isCellVisible(gameState, cell.x, cell.y);
            });
          }
          return true;
        },
      );
      return availableItems.length === 0;
    }

    if (option.commandType === CommandType.ESCORT_UNIT) {
      const activeUnits = gameState.units.filter(
        (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
      );
      if (activeUnits.length < 2) return true;

      const validTargets = activeUnits.filter(
        (u) => u.archetypeId === "vip" || !!u.carriedObjectiveId,
      );
      return validTargets.length === 0;
    }

    if (option.commandType === CommandType.EXTRACT) {
      if (!gameState.map.extraction) return true;
      return !isCellDiscovered(
        gameState,
        gameState.map.extraction.x,
        gameState.map.extraction.y,
      );
    }

    return false;
  }

  private isActionAllowedInTutorial(option: MenuOptionDefinition): boolean {
    if (!this.tutorialManager) return true;

    // Always allow back navigation
    if (option.type === "BACK") return true;

    // Command types MUST be gated by the tutorial
    if (option.commandType) {
      return this.tutorialManager.isActionAllowed(option.commandType);
    }

    // Always allow pure transitions, mode selections, and item selections to allow UI exploration
    if (
      option.type === "TRANSITION" ||
      option.type === "MODE" ||
      option.type === "ITEM" ||
      option.type === "SPECIAL"
    ) {
      return true;
    }

    return false;
  }

  private executePendingCommand(unitIds: string[]) {
    if (this.selection.pendingAction && this.tutorialManager && !this.tutorialManager.isActionAllowed(this.selection.pendingAction)) {
      Logger.warn(`Tutorial: Execution of ${this.selection.pendingAction} is currently blocked.`);
      this.reset();
      return;
    }

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
      this.client.applyCommand(command);
    }

    this.reset();
  }

  private rehydrateState(state: GameState): GameState {
    if (!this.lastFullMap) return state;
    return {
      ...state,
      map: {
        ...this.lastFullMap,
        doors: state.map.doors || this.lastFullMap.doors, // Doors are dynamic
      },
    };
  }
}
