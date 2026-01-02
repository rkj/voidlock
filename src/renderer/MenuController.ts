import {
  CommandType,
  EngagementPolicy,
  GameState,
  ItemLibrary,
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
  public pendingItemId: string | null = null;
  public pendingMode: EngagementPolicy | null = null;
  public pendingLabel: string | null = null;
  public pendingTargetLocation: Vector2 | null = null;
  public overlayOptions: OverlayOption[] = [];

  private cellToRoomId: Map<string, string> = new Map();
  private discoveredRoomOrder: string[] = [];

  constructor(private client: { sendCommand: (cmd: any) => void }) {}

  public reset() {
    this.menuState = "ACTION_SELECT";
    this.pendingAction = null;
    this.pendingItemId = null;
    this.pendingMode = null;
    this.pendingLabel = null;
    this.pendingTargetLocation = null;
    this.overlayOptions = [];
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
      if (this.pendingAction === CommandType.USE_ITEM) {
        this.executePendingCommand([]);
      } else {
        this.menuState = "UNIT_SELECT";
      }
    }
  }

  public handleMenuInput(key: string, gameState: GameState): void {
    if (key === "0") {
      this.goBack();
      return;
    }

    const config = MENU_CONFIG[this.menuState];

    if (this.menuState === "ACTION_SELECT") {
      const option = config.options.find((o) => o.key.toString() === key);
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
        } else if (option.label === "USE ITEM") {
          this.pendingLabel = "Using Item";
          this.menuState = "ITEM_SELECT";
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
    } else if (this.menuState === "ITEM_SELECT") {
      const items = Object.entries(gameState.squadInventory).filter(
        ([_, count]) => count > 0,
      );
      const num = parseInt(key);
      if (!isNaN(num) && num > 0 && num <= items.length) {
        const [itemId] = items[num - 1];
        this.pendingItemId = itemId;
        this.menuState = "TARGET_SELECT";
        this.generateTargetOverlay("CELL", gameState);
      }
    } else if (this.menuState === "MODE_SELECT") {
      const option = config.options.find((o) => o.key.toString() === key);
      if (option && option.type === "MODE") {
        this.pendingMode = option.modeValue || null;
        this.menuState = option.nextState || "UNIT_SELECT";
      }
    } else if (this.menuState === "TARGET_SELECT") {
      const option = this.overlayOptions.find((o) => o.key === key);
      if (option && option.pos) {
        this.pendingTargetLocation = option.pos;
        if (this.pendingAction === CommandType.USE_ITEM) {
          this.executePendingCommand([]);
        } else {
          this.menuState = "UNIT_SELECT";
        }
      }
    } else if (this.menuState === "UNIT_SELECT") {
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
    } else if (this.menuState === "ITEM_SELECT") {
      this.menuState = "ACTION_SELECT";
    } else if (
      this.menuState === "MODE_SELECT" ||
      this.menuState === "TARGET_SELECT"
    ) {
      if (
        this.menuState === "TARGET_SELECT" &&
        this.pendingAction === CommandType.USE_ITEM
      ) {
        this.menuState = "ITEM_SELECT";
      } else {
        this.menuState = "ACTION_SELECT";
      }
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
      } else if (this.pendingAction === CommandType.USE_ITEM) {
        this.generateTargetOverlay("CELL", gameState);
      }
    }

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
    } else if (this.menuState === "ITEM_SELECT") {
      const items = Object.entries(gameState.squadInventory).filter(
        ([_, count]) => count > 0,
      );
      result.options = items.map(([itemId, count], idx) => ({
        key: (idx + 1).toString(),
        label: `${idx + 1}. ${ItemLibrary[itemId]?.name || itemId} (${count})`,
        dataAttributes: { index: (idx + 1).toString(), "item-id": itemId },
      }));
      result.options.push({
        key: "0",
        label: "0. BACK",
        isBack: true,
        dataAttributes: { index: "0" },
      });
      result.footer = "(Select Item)";
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
    if (option.label === "USE ITEM") {
      const hasItems = Object.values(gameState.squadInventory).some(
        (count) => count > 0,
      );
      return !hasItems;
    } else if (option.label === "COLLECT") {
      // Check for any visible pending items
      const hasVisibleItems = gameState.objectives.some(
        (obj) => obj.state === "Pending" && obj.visible && obj.targetCell,
      );
      return !hasVisibleItems;
    } else if (option.label === "EXTRACT") {
      if (!gameState.map.extraction) return true;
      const key = `${gameState.map.extraction.x},${gameState.map.extraction.y}`;
      return !gameState.discoveredCells.includes(key);
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
    } else if (
      this.pendingAction === CommandType.USE_ITEM &&
      this.pendingItemId &&
      this.pendingTargetLocation
    ) {
      this.client.sendCommand({
        type: CommandType.USE_ITEM,
        itemId: this.pendingItemId,
        target: this.pendingTargetLocation,
        label: this.pendingLabel || undefined,
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

  private generateTargetOverlay(type: "CELL" | "ITEM", gameState: GameState) {
    this.overlayOptions = [];

    if (type === "ITEM") {
      let itemCounter = 0;
      gameState.objectives.forEach((obj) => {
        if (obj.state === "Pending" && obj.visible && obj.targetCell) {
          this.overlayOptions.push({
            key: this.getRoomKey(itemCounter),
            label: `Collect ${obj.kind}`,
            pos: obj.targetCell,
          });
          itemCounter++;
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
          label: `Room`,
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
