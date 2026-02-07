import { ScreenManager } from "@src/renderer/ScreenManager";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, InputContext, InputPriority, ShortcutInfo } from "@src/shared/types";
import { ModalService } from "./ui/ModalService";
import { InputDispatcher } from "./InputDispatcher";

export class InputManager implements InputContext {
  public id = "TacticalInput";
  public priority = InputPriority.Game;
  public trapsFocus = false;

  constructor(
    private screenManager: ScreenManager,
    private menuController: MenuController,
    private modalService: ModalService,
    private togglePause: () => void,
    private handleMenuInput: (key: string, shiftHeld?: boolean) => void,
    private abortMission: () => void,
    private onUnitDeselect: () => void,
    private getSelectedUnitId: () => string | null,
    private handleCanvasClick: (e: MouseEvent) => void,
    private onToggleDebug: (enabled: boolean) => void,
    private onToggleLos: (enabled: boolean) => void,
    private currentGameState: () => GameState | null,
    private isDebriefing: () => boolean,
    private onDeployUnit: (
      unitId: string,
      targetX: number,
      targetY: number,
    ) => void,
    private getCellCoordinates: (
      pixelX: number,
      pixelY: number,
    ) => { x: number; y: number },
    private cycleUnits: (reverse?: boolean) => void,
    private panMap: (direction: string) => void,
  ) {
    this.boundHandleKeyUp = (e: KeyboardEvent) => {
      this.menuController.isShiftHeld = e.shiftKey;
    };
    this.boundHandleCanvasClick = (e: MouseEvent) => {
      if (this.isDebriefing()) return;
      if (this.isDragging) return; // Don't trigger click if we just dragged
      this.menuController.isShiftHeld = e.shiftKey;
      this.handleCanvasClick(e);
    };

    this.boundHandleMouseDown = (e: MouseEvent) => {
      if (this.isDebriefing()) return;
      const state = this.currentGameState();
      if (!state || state.status !== "Deployment") return;

      const cell = this.getCellCoordinates(e.clientX, e.clientY);
      const unit = state.units.find(
        (u) => Math.floor(u.pos.x) === cell.x && Math.floor(u.pos.y) === cell.y,
      );

      if (unit && unit.archetypeId !== "vip") {
        this.draggingUnitId = unit.id;
        this.isDragging = false; // Start as false, set true on first move
        const canvas = document.getElementById("game-canvas");
        if (canvas) canvas.style.cursor = "grabbing";
      }
    };

    this.boundHandleMouseMove = (e: MouseEvent) => {
      if (this.draggingUnitId) {
        this.isDragging = true;
        // Optionally update some visual state in renderer if we had a dedicated "drag layer"
      } else {
        // Change cursor if hovering over a draggable unit in Deployment
        const state = this.currentGameState();
        if (state && state.status === "Deployment") {
          const cell = this.getCellCoordinates(e.clientX, e.clientY);
          const unit = state.units.find(
            (u) =>
              Math.floor(u.pos.x) === cell.x && Math.floor(u.pos.y) === cell.y,
          );
          const canvas = document.getElementById("game-canvas");
          if (canvas) {
            if (unit && unit.archetypeId !== "vip") {
              canvas.style.cursor = "grab";
            } else {
              canvas.style.cursor = "default";
            }
          }
        }
      }
    };

    this.boundHandleMouseUp = (e: MouseEvent) => {
      if (this.draggingUnitId) {
        const cell = this.getCellCoordinates(e.clientX, e.clientY);
        const state = this.currentGameState();

        if (state && state.status === "Deployment") {
          const isValidSpawn =
            state.map.squadSpawns?.some(
              (s) => s.x === cell.x && s.y === cell.y,
            ) ||
            (state.map.squadSpawn?.x === cell.x &&
              state.map.squadSpawn?.y === cell.y);

          if (isValidSpawn) {
            this.onDeployUnit(this.draggingUnitId, cell.x + 0.5, cell.y + 0.5);
          }
        }

        this.draggingUnitId = null;
        const canvas = document.getElementById("game-canvas");
        if (canvas) canvas.style.cursor = "default";
        // Delay resetting isDragging to allow click handler to see it
        setTimeout(() => {
          this.isDragging = false;
        }, 0);
      }
    };
  }

  private boundHandleKeyUp: (e: KeyboardEvent) => void;
  private boundHandleCanvasClick: (e: MouseEvent) => void;
  private boundHandleMouseDown: (e: MouseEvent) => void;
  private boundHandleMouseMove: (e: MouseEvent) => void;
  private boundHandleMouseUp: (e: MouseEvent) => void;

  private draggingUnitId: string | null = null;
  private isDragging: boolean = false;

  public init() {
    InputDispatcher.getInstance().pushContext(this);
    document.addEventListener("keyup", this.boundHandleKeyUp);
    const canvas = document.getElementById("game-canvas");
    canvas?.addEventListener("click", this.boundHandleCanvasClick);
    canvas?.addEventListener("mousedown", this.boundHandleMouseDown);
    window.addEventListener("mousemove", this.boundHandleMouseMove);
    window.addEventListener("mouseup", this.boundHandleMouseUp);
  }

  public destroy() {
    InputDispatcher.getInstance().popContext(this.id);
    document.removeEventListener("keyup", this.boundHandleKeyUp);
    const canvas = document.getElementById("game-canvas");
    canvas?.removeEventListener("click", this.boundHandleCanvasClick);
    canvas?.removeEventListener("mousedown", this.boundHandleMouseDown);
    window.removeEventListener("mousemove", this.boundHandleMouseMove);
    window.removeEventListener("mouseup", this.boundHandleMouseUp);
  }

  public getShortcuts(): ShortcutInfo[] {
    const shortcuts: ShortcutInfo[] = [
      { key: "Space", label: "Space", description: "Toggle Pause", category: "General" },
      { key: "~", label: "~", description: "Toggle Debug Overlay", category: "General" },
      { key: "Shift+~", label: "Shift+~", description: "Toggle LOS Visualization", category: "General" },
      { key: "ESC / Q", label: "ESC / Q", description: "Back / Menu / Deselect", category: "Navigation" },
      { key: "Arrows", label: "Arrows", description: "Pan Map", category: "Tactical" },
      { key: "Tab", label: "Tab", description: "Cycle Units", category: "Tactical" },
    ];

    if (this.screenManager.getCurrentScreen() === "mission") {
      shortcuts.push(
        { key: "1-9", label: "Menu", description: "Select Menu Option", category: "Menu" },
        { key: "M", label: "Move", description: "Quick Move Command", category: "Tactical" }
      );
    }

    return shortcuts;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (this.isDebriefing()) return false;
    this.menuController.isShiftHeld = e.shiftKey;
    if (
      (e.target as HTMLElement).tagName === "INPUT" ||
      (e.target as HTMLElement).tagName === "TEXTAREA"
    )
      return false;

    if (this.screenManager.getCurrentScreen() === "mission") {
      if (e.key === "Escape" || e.key === "q" || e.key === "Q") {
        if (this.menuController.menuState !== "ACTION_SELECT") {
          this.menuController.goBack();
        } else {
          if (this.getSelectedUnitId()) {
            this.onUnitDeselect();
          } else if (e.key === "Escape") {
            this.modalService
              .confirm("Abort Mission and return to menu?")
              .then((confirmed) => {
                if (confirmed) {
                  this.abortMission();
                }
              });
          }
        }
        return true;
      }

      if (e.code === "Space") {
        this.togglePause();
        return true;
      }

      if (e.key === "Tab") {
        this.cycleUnits(e.shiftKey);
        return true;
      }

      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        this.panMap(e.key);
        return true;
      }

      if (e.code === "Backquote") {
        const state = this.currentGameState();
        if (state) {
          if (e.shiftKey) {
            this.onToggleLos(!state.settings.losOverlayEnabled);
          } else {
            this.onToggleDebug(!state.settings.debugOverlayEnabled);
          }
        }
        return true;
      }

      if (e.key === "m" || e.key === "M") {
        if (this.menuController.menuState === "ACTION_SELECT") {
          this.handleMenuInput("1", e.shiftKey);
        }
        return true;
      }

      const key = e.key.toLowerCase();
      if (/^[0-9a-z]$/.test(key)) {
        this.handleMenuInput(key, e.shiftKey);
        return true;
      }
    }
    return false;
  }
}
