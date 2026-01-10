import {
  BoundaryDefinition,
  BoundaryType,
  CellType,
  CommandType,
  EngagementPolicy,
  GameState,
  ItemLibrary,
  OverlayOption,
  UnitState,
  Vector2,
} from "@src/shared/types";
import { MENU_CONFIG, MenuOptionDefinition, MenuState } from "@src/renderer/MenuConfig";

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
  public pendingItemId: string | null = null;
  public pendingTargetId: string | null = null;
  public pendingMode: EngagementPolicy | null = null;
  public pendingLabel: string | null = null;
  public pendingTargetLocation: Vector2 | null = null;
  public pendingUnitIds: string[] | null = null;
  public overlayOptions: OverlayOption[] = [];
  public isShiftHeld: boolean = false;

  private stateStack: MenuState[] = [];
  private cellToRoomId: Map<string, string> = new Map();
  private discoveredRoomOrder: string[] = [];

  constructor(private client: { sendCommand: (cmd: any) => void }) {}

  public reset() {
    this.menuState = "ACTION_SELECT";
    this.pendingAction = null;
    this.pendingItemId = null;
    this.pendingTargetId = null;
    this.pendingMode = null;
    this.pendingLabel = null;
    this.pendingTargetLocation = null;
    this.pendingUnitIds = null;
    this.overlayOptions = [];
    this.stateStack = [];
  }

  private transitionTo(nextState: MenuState) {
    this.stateStack.push(this.menuState);
    this.menuState = nextState;
  }

  public clearDiscoveryOrder() {
    this.cellToRoomId.clear();
    this.discoveredRoomOrder = [];
  }

  public selectUnit(unitId: string) {
    if (this.menuState === "UNIT_SELECT" && this.pendingAction) {
      this.executePendingCommand([unitId]);
    }
  }

  public handleCanvasClick(cell: Vector2, gameState: GameState): void {
    if (
      this.menuState === "TARGET_SELECT" &&
      (this.pendingAction === CommandType.MOVE_TO ||
        this.pendingAction === CommandType.USE_ITEM)
    ) {
      this.pendingTargetLocation = cell;
      this.overlayOptions = [];

      // If clicking on a unit, set pendingTargetId
      const unitAtCell = gameState.units.find(
        (u) =>
          Math.floor(u.pos.x) === cell.x &&
          Math.floor(u.pos.y) === cell.y &&
          u.state !== UnitState.Dead &&
          u.state !== UnitState.Extracted,
      );
      if (unitAtCell) {
        this.pendingTargetId = unitAtCell.id;
      }

      // Special case: Healing items bypass UNIT_SELECT and use all active units
      const item = this.pendingItemId ? ItemLibrary[this.pendingItemId] : null;
      if (this.pendingUnitIds && this.pendingUnitIds.length > 0) {
        this.executePendingCommand(this.pendingUnitIds);
      } else if (
        this.pendingAction === CommandType.USE_ITEM &&
        item?.action === "Heal"
      ) {
        const activeUnits = gameState.units.filter(
          (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
        );
        this.executePendingCommand(activeUnits.map((u) => u.id));
      } else {
        this.transitionTo("UNIT_SELECT");
      }
    }
  }

  public handleMenuInput(key: string, gameState: GameState): void {
    if (key === "0" || key === "q") {
      this.goBack();
      return;
    }

    switch (this.menuState) {
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
      this.transitionTo(option.nextState || "ACTION_SELECT");
      return;
    }

    this.pendingAction = option.commandType || null;

    if (option.label === "PICKUP") {
      this.pendingLabel = "Picking up";
      this.transitionTo("TARGET_SELECT");
      this.generateTargetOverlay("ITEM", gameState);
    } else if (option.label === "EXTRACT") {
      this.pendingLabel = "Extracting";
      this.transitionTo("UNIT_SELECT");
    } else if (option.label === "ENGAGEMENT") {
      this.pendingLabel = "Policy Change";
      this.transitionTo("MODE_SELECT");
    } else if (option.label === "USE ITEM") {
      this.pendingLabel = "Using Item";
      this.transitionTo("ITEM_SELECT");
    }
  }

  private handleOrdersSelect(key: string, gameState: GameState) {
    const config = MENU_CONFIG.ORDERS_SELECT;
    const option = config.options.find((o) => o.key.toString() === key);
    if (!option) return;

    this.pendingAction = option.commandType || null;

    if (option.label === "MOVE TO ROOM") {
      this.pendingLabel = "Moving";
      this.transitionTo("TARGET_SELECT");
      this.generateTargetOverlay("CELL", gameState);
    } else if (option.label === "OVERWATCH INTERSECTION") {
      this.pendingLabel = "Overwatching";
      this.transitionTo("TARGET_SELECT");
      this.generateTargetOverlay("INTERSECTION", gameState);
    } else if (option.label === "EXPLORE") {
      this.pendingLabel = "Exploring";
      this.transitionTo("UNIT_SELECT");
    } else if (option.label === "HOLD") {
      this.pendingLabel = "Holding";
      this.transitionTo("UNIT_SELECT");
    } else if (option.label === "ESCORT") {
      this.pendingLabel = "Escorting";
      this.transitionTo("TARGET_SELECT");
      this.generateTargetOverlay("FRIENDLY_UNIT", gameState);
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
          const key = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
          return gameState.visibleCells.includes(key);
        });
        if (!hasVisibleEnemies) return;
      }

      this.pendingItemId = itemId;
      if (item?.action === "Mine") {
        this.transitionTo("UNIT_SELECT");
      } else {
        this.transitionTo("TARGET_SELECT");
        if (item?.action === "Heal") {
          this.generateTargetOverlay("FRIENDLY_UNIT", gameState);
        } else if (item?.action === "Grenade") {
          this.generateTargetOverlay("HOSTILE_UNIT", gameState);
        } else {
          this.generateTargetOverlay("CELL", gameState);
        }
      }
    }
  }

  private handleModeSelect(key: string, gameState: GameState) {
    const config = MENU_CONFIG.MODE_SELECT;
    const option = config.options.find((o) => o.key.toString() === key);
    if (option && option.type === "MODE") {
      this.pendingMode = option.modeValue || null;
      this.transitionTo(option.nextState || "UNIT_SELECT");
    }
  }

  private handleTargetSelect(key: string, gameState: GameState) {
    const option = this.overlayOptions.find((o) => o.key === key);
    if (option && option.pos) {
      this.pendingTargetLocation = option.pos;
      this.pendingTargetId = option.id || null;
      this.overlayOptions = [];

      const item = this.pendingItemId ? ItemLibrary[this.pendingItemId] : null;
      if (this.pendingUnitIds && this.pendingUnitIds.length > 0) {
        this.executePendingCommand(this.pendingUnitIds);
      } else if (
        this.pendingAction === CommandType.USE_ITEM &&
        item?.action === "Heal"
      ) {
        const activeUnits = gameState.units.filter(
          (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
        );
        this.executePendingCommand(activeUnits.map((u) => u.id));
      } else {
        this.transitionTo("UNIT_SELECT");
      }
    }
  }

  private handleUnitSelect(key: string, gameState: GameState) {
    const activeUnits = gameState.units.filter(
      (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
    );
    let selectedIds: string[] = [];

    const num = parseInt(key);
    if (!isNaN(num) && num > 0 && num <= activeUnits.length) {
      selectedIds = [activeUnits[num - 1].id];
    } else if (!isNaN(num) && num === activeUnits.length + 1) {
      selectedIds = activeUnits.map((u) => u.id);
    }

    if (selectedIds.length > 0 && this.pendingAction) {
      const item = this.pendingItemId ? ItemLibrary[this.pendingItemId] : null;
      if (
        this.pendingAction === CommandType.USE_ITEM &&
        item?.action === "Mine" &&
        !this.pendingTargetLocation
      ) {
        this.pendingUnitIds = selectedIds;
        this.transitionTo("TARGET_SELECT");
        this.generateTargetOverlay("CELL", gameState);
      } else {
        this.executePendingCommand(selectedIds);
      }
    }
  }

  public goBack() {
    const prevState = this.stateStack.pop();

    if (this.menuState === "TARGET_SELECT") {
      this.overlayOptions = [];
    }

    if (this.menuState === "TARGET_SELECT" && this.pendingUnitIds) {
      this.pendingUnitIds = null;
    }

    if (prevState) {
      this.menuState = prevState;
    } else {
      this.reset();
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

    // Live-update overlays if in Target Select
    if (this.menuState === "TARGET_SELECT") {
      if (this.pendingAction === CommandType.MOVE_TO) {
        if (this.pendingLabel === "Collecting") {
          this.generateTargetOverlay("ITEM", gameState);
        } else {
          this.generateTargetOverlay("CELL", gameState);
        }
      } else if (this.pendingAction === CommandType.OVERWATCH_POINT) {
        this.generateTargetOverlay("INTERSECTION", gameState);
      } else if (this.pendingAction === CommandType.USE_ITEM) {
        const item = this.pendingItemId
          ? ItemLibrary[this.pendingItemId]
          : null;
        if (item?.action === "Heal") {
          this.generateTargetOverlay("FRIENDLY_UNIT", gameState);
        } else if (item?.action === "Grenade") {
          this.generateTargetOverlay("HOSTILE_UNIT", gameState);
        } else {
          this.generateTargetOverlay("CELL", gameState);
        }
      } else if (this.pendingAction === CommandType.PICKUP) {
        this.generateTargetOverlay("ITEM", gameState);
      } else if (this.pendingAction === CommandType.ESCORT_UNIT) {
        this.generateTargetOverlay("FRIENDLY_UNIT", gameState);
      }
    }

    if (
      this.menuState === "ACTION_SELECT" ||
      this.menuState === "ORDERS_SELECT" ||
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
      } else if (this.menuState === "ORDERS_SELECT") {
        result.footer = "(Select Order)";
      } else {
        result.footer = "(Q/ESC to Go Back)";
      }
    } else if (this.menuState === "ITEM_SELECT") {
      const items = Object.entries(gameState.squadInventory).filter(
        ([_, count]) => count > 0,
      );
      result.options = items.map(([itemId, count], idx) => {
        const item = ItemLibrary[itemId];
        let disabled = false;
        if (item?.action === "Grenade") {
          const hasVisibleEnemies = gameState.enemies.some((e) => {
            const key = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
            return gameState.visibleCells.includes(key);
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
        label: "0. BACK",
        isBack: true,
        dataAttributes: { index: "0" },
      });
      result.footer = "(Select Item, Q/ESC to Back)";
    } else if (this.menuState === "TARGET_SELECT") {
      if (
        this.overlayOptions.length === 0 &&
        this.pendingAction !== CommandType.MOVE_TO &&
        this.pendingAction !== CommandType.USE_ITEM
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
      result.footer = "(Click map or press 1-9, Q/ESC to Back)";
    } else if (this.menuState === "UNIT_SELECT") {
      let counter = 1;
      const activeUnits = gameState.units.filter(
        (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
      );

      result.options = [];
      activeUnits.forEach((u) => {
        result.options.push({
          key: counter.toString(),
          label: `${counter}. ${u.id}`,
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
      result.footer = "(Press 1-9 or Q/ESC)";
    }

    return result;
  }

  private isOptionDisabled(
    option: MenuOptionDefinition,
    gameState: GameState,
  ): boolean {
    if (option.label === "USE ITEM") {
      const availableItems = Object.entries(gameState.squadInventory).filter(
        ([itemId, count]) => {
          if (count <= 0) return false;
          const item = ItemLibrary[itemId];
          if (item?.action === "Grenade") {
            return gameState.enemies.some((e) => {
              const key = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
              return gameState.visibleCells.includes(key);
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
    if (!this.pendingAction) return;
    const queue = this.isShiftHeld;

    if (
      this.pendingAction === CommandType.MOVE_TO &&
      this.pendingTargetLocation
    ) {
      this.client.sendCommand({
        type: CommandType.MOVE_TO,
        unitIds,
        target: this.pendingTargetLocation,
        label: this.pendingLabel || undefined,
        queue,
      });
    } else if (
      this.pendingAction === CommandType.OVERWATCH_POINT &&
      this.pendingTargetLocation
    ) {
      this.client.sendCommand({
        type: CommandType.OVERWATCH_POINT,
        unitIds,
        target: this.pendingTargetLocation,
        label: this.pendingLabel || undefined,
        queue,
      });
    } else if (this.pendingAction === CommandType.EXPLORE) {
      this.client.sendCommand({
        type: CommandType.EXPLORE,
        unitIds,
        label: this.pendingLabel || undefined,
        queue,
      });
    } else if (this.pendingAction === CommandType.STOP) {
      this.client.sendCommand({
        type: CommandType.STOP,
        unitIds,
        label: this.pendingLabel || undefined,
        queue,
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
        queue,
      });
    } else if (this.pendingAction === CommandType.RESUME_AI) {
      this.client.sendCommand({
        type: CommandType.RESUME_AI,
        unitIds,
        label: this.pendingLabel || undefined,
        queue,
      });
    } else if (
      this.pendingAction === CommandType.PICKUP &&
      this.pendingTargetId
    ) {
      this.client.sendCommand({
        type: CommandType.PICKUP,
        unitIds,
        lootId: this.pendingTargetId,
        label: this.pendingLabel || undefined,
        queue,
      });
    } else if (this.pendingAction === CommandType.EXTRACT) {
      this.client.sendCommand({
        type: CommandType.EXTRACT,
        unitIds,
        label: this.pendingLabel || undefined,
        queue,
      });
    } else if (
      this.pendingAction === CommandType.ESCORT_UNIT &&
      this.pendingTargetId
    ) {
      this.client.sendCommand({
        type: CommandType.ESCORT_UNIT,
        unitIds,
        targetId: this.pendingTargetId,
        label: this.pendingLabel || undefined,
        queue,
      });
    } else if (
      this.pendingAction === CommandType.USE_ITEM &&
      this.pendingItemId &&
      (this.pendingTargetLocation || this.pendingTargetId)
    ) {
      this.client.sendCommand({
        type: CommandType.USE_ITEM,
        unitIds,
        itemId: this.pendingItemId,
        target: this.pendingTargetLocation || undefined,
        targetUnitId: this.pendingTargetId || undefined,
        label: this.pendingLabel || undefined,
        queue,
      });
    }

    this.reset();
  }

  private updateDiscoveryOrder(gameState: GameState) {
    if (this.cellToRoomId.size === 0) {
      gameState.map.cells.forEach((cell) => {
        if (cell.roomId) {
          this.cellToRoomId.set(`${cell.x},${cell.y}`, cell.roomId);
        }
      });
    }

    gameState.discoveredCells.forEach((cellKey) => {
      const roomId = this.cellToRoomId.get(cellKey);
      if (
        roomId &&
        roomId.startsWith("room") &&
        !this.discoveredRoomOrder.includes(roomId)
      ) {
        this.discoveredRoomOrder.push(roomId);
      }
    });
  }

  private getRoomKey(index: number): string {
    if (index < 9) return (index + 1).toString();
    return String.fromCharCode(65 + (index - 9)); // 65 is 'A'
  }

  private generateTargetOverlay(
    type: "CELL" | "ITEM" | "INTERSECTION" | "FRIENDLY_UNIT" | "HOSTILE_UNIT",
    gameState: GameState,
  ) {
    this.overlayOptions = [];

    if (type === "HOSTILE_UNIT") {
      let enemyCounter = 0;
      gameState.enemies.forEach((e) => {
        const key = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
        if (gameState.visibleCells.includes(key)) {
          this.overlayOptions.push({
            key: this.getRoomKey(enemyCounter),
            label: `${e.type}`,
            pos: { x: Math.floor(e.pos.x), y: Math.floor(e.pos.y) },
            id: e.id,
          });
          enemyCounter++;
        }
      });
    } else if (type === "ITEM") {
      let itemCounter = 0;
      gameState.objectives.forEach((obj) => {
        if (obj.state === "Pending" && obj.visible && obj.targetCell) {
          this.overlayOptions.push({
            key: this.getRoomKey(itemCounter),
            label: `Collect ${obj.kind}`,
            pos: obj.targetCell,
            id: obj.id,
          });
          itemCounter++;
        }
      });

      if (gameState.loot) {
        gameState.loot.forEach((loot) => {
          const key = `${Math.floor(loot.pos.x)},${Math.floor(loot.pos.y)}`;
          if (gameState.visibleCells.includes(key)) {
            this.overlayOptions.push({
              key: this.getRoomKey(itemCounter),
              label: `Pickup ${loot.itemId}`,
              pos: { x: Math.floor(loot.pos.x), y: Math.floor(loot.pos.y) },
              id: loot.id,
            });
            itemCounter++;
          }
        });
      }
    } else if (type === "FRIENDLY_UNIT") {
      let unitCounter = 0;
      gameState.units.forEach((u) => {
        if (u.state !== UnitState.Dead && u.state !== UnitState.Extracted) {
          this.overlayOptions.push({
            key: this.getRoomKey(unitCounter),
            label: `${u.id}`,
            pos: { x: Math.floor(u.pos.x), y: Math.floor(u.pos.y) },
            id: u.id,
          });
          unitCounter++;
        }
      });
    } else if (type === "INTERSECTION") {
      let intersectionCounter = 0;
      gameState.map.cells.forEach((cell) => {
        if (cell.type !== CellType.Floor) return;
        const key = `${cell.x},${cell.y}`;
        if (!gameState.discoveredCells.includes(key)) return;

        // Count connections (boundaries that are NOT walls)
        let connections = 0;
        const boundaries = (gameState.map.boundaries || []).filter(
          (b: BoundaryDefinition) =>
            (b.x1 === cell.x && b.y1 === cell.y) ||
            (b.x2 === cell.x && b.y2 === cell.y),
        );

        boundaries.forEach((b: BoundaryDefinition) => {
          if (b.type === BoundaryType.Open) connections++;
        });

        if (connections >= 3) {
          this.overlayOptions.push({
            key: this.getRoomKey(intersectionCounter),
            label: `Intersection`,
            pos: { x: cell.x, y: cell.y },
          });
          intersectionCounter++;
        }
      });
    } else if (type === "CELL") {
      // Add Rooms in Discovery Order FIRST to ensure stable keys 1, 2, etc.
      this.updateDiscoveryOrder(gameState);

      this.discoveredRoomOrder.forEach((roomId, index) => {
        const cellsInRoom = gameState.map.cells.filter(
          (c) => c.roomId === roomId,
        );
        if (cellsInRoom.length === 0) return;

        // Find rough center
        const avgX =
          cellsInRoom.reduce((sum, c) => sum + c.x, 0) / cellsInRoom.length;
        const avgY =
          cellsInRoom.reduce((sum, c) => sum + c.y, 0) / cellsInRoom.length;
        // Find cell closest to center
        const centerCell = cellsInRoom.reduce((prev, curr) => {
          const prevDist = (prev.x - avgX) ** 2 + (prev.y - avgY) ** 2;
          const currDist = (curr.x - avgX) ** 2 + (curr.y - avgY) ** 2;
          return currDist < prevDist ? curr : prev;
        });

        const key = this.getRoomKey(index);
        this.overlayOptions.push({
          key: key,
          label: `Room ${key}`,
          pos: { x: centerCell.x, y: centerCell.y },
        });
      });

      // Other POIs come after rooms
      let poiCounter = this.discoveredRoomOrder.length;

      if (gameState.map.extraction) {
        const ext = gameState.map.extraction;
        const key = `${ext.x},${ext.y}`;
        if (gameState.discoveredCells.includes(key)) {
          this.overlayOptions.push({
            key: this.getRoomKey(poiCounter),
            label: "Extraction",
            pos: ext,
          });
          poiCounter++;
        }
      }

      gameState.objectives.forEach((obj) => {
        if (obj.state === "Pending" && obj.visible && obj.targetCell) {
          // Avoid double-counting if objective is at extraction (already handled in renderer, but here for keys)
          if (
            gameState.map.extraction &&
            obj.targetCell.x === gameState.map.extraction.x &&
            obj.targetCell.y === gameState.map.extraction.y
          ) {
            return;
          }

          this.overlayOptions.push({
            key: this.getRoomKey(poiCounter),
            label: `Obj ${obj.id}`,
            pos: obj.targetCell,
          });
          poiCounter++;
        }
      });
    }
  }
}
