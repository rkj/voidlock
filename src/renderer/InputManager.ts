import { ScreenManager } from "@src/renderer/ScreenManager";
import { MenuController } from "@src/renderer/MenuController";
import {
  GameState,
  InputContext,
  InputPriority,
  ShortcutInfo,
} from "@src/shared/types";
import { ModalService } from "./ui/ModalService";
import { InputDispatcher } from "./InputDispatcher";

export class InputManager implements InputContext {
  public id = "TacticalInput";
  public priority = InputPriority.Game;
  public trapsFocus = false;

  private draggingUnitId: string | null = null;
  private isDragging: boolean = false;

  // Touch state
  private lastTouchPos: { x: number; y: number } | null = null;
  private lastTouchDistance: number | null = null;
  private lastTouchCenter: { x: number; y: number } | null = null;
  private touchStartTime: number | null = null;
  private hasMovedSignificantly: boolean = false;

  private boundDragOver: (e: DragEvent) => void;
  private boundDrop: (e: DragEvent) => void;

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
    private panMapBy: (dx: number, dy: number) => void,
    private zoomMap: (ratio: number, cx: number, cy: number) => void,
  ) {
    this.boundDragOver = this.handleDragOver.bind(this);
    this.boundDrop = this.handleDrop.bind(this);
  }

  public init() {
    InputDispatcher.getInstance().pushContext(this);
    const canvas = document.getElementById("game-canvas");
    if (canvas) {
      canvas.addEventListener("dragover", this.boundDragOver);
      canvas.addEventListener("drop", this.boundDrop);
      canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  }

  public destroy() {
    InputDispatcher.getInstance().popContext(this.id);
    const canvas = document.getElementById("game-canvas");
    if (canvas) {
      canvas.removeEventListener("dragover", this.boundDragOver);
      canvas.removeEventListener("drop", this.boundDrop);
    }
  }

  public getShortcuts(): ShortcutInfo[] {
    const shortcuts: ShortcutInfo[] = [
      {
        key: "Space",
        label: "Space",
        description: "Toggle Pause",
        category: "General",
      },
      {
        key: "~",
        label: "~",
        description: "Toggle Debug Overlay",
        category: "General",
      },
      {
        key: "Shift+~",
        label: "Shift+~",
        description: "Toggle LOS Visualization",
        category: "General",
      },
      {
        key: "ESC / Q",
        label: "ESC / Q",
        description: "Back / Menu / Deselect",
        category: "Navigation",
      },
      {
        key: "Arrows",
        label: "Arrows",
        description: "Pan Map",
        category: "Tactical",
      },
      {
        key: "Tab",
        label: "Tab",
        description: "Cycle Units",
        category: "Tactical",
      },
    ];

    if (this.screenManager.getCurrentScreen() === "mission") {
      shortcuts.push(
        {
          key: "1-9",
          label: "1-9",
          description: "Select Menu Option",
          category: "Menu",
        },
        {
          key: "M",
          label: "M",
          description: "Quick Move Command",
          category: "Tactical",
        },
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
        const state = this.currentGameState();
        if (state && state.status === "Deployment") {
          return false; // Allow Tab to navigate UI during deployment
        }
        this.cycleUnits(e.shiftKey);
        return true;
      }

      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        // Only pan if focus is on body or canvas
        const active = document.activeElement;
        if (active && active !== document.body && active.tagName !== "CANVAS") {
          return false;
        }
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

  // --- Mouse Handlers ---

  public handleMouseDown(e: MouseEvent): boolean {
    if (this.isDebriefing()) return false;
    this.menuController.isShiftHeld = e.shiftKey;

    const target = e.target as HTMLElement;
    if (target.id !== "game-canvas") return false;

    const state = this.currentGameState();
    if (!state || state.status !== "Deployment") return false;

    const cell = this.getCellCoordinates(e.clientX, e.clientY);
    const unit = state.units.find(
      (u) => Math.floor(u.pos.x) === cell.x && Math.floor(u.pos.y) === cell.y,
    );

    if (unit && unit.archetypeId !== "vip") {
      this.draggingUnitId = unit.id;
      this.isDragging = false;
      const canvas = document.getElementById("game-canvas");
      if (canvas) canvas.style.cursor = "grabbing";
      return true;
    }
    return false;
  }

  public handleMouseMove(e: MouseEvent): boolean {
    if (this.isDebriefing()) return false;

    if (this.draggingUnitId) {
      this.isDragging = true;
      return true;
    }

    const target = e.target as HTMLElement;
    if (target.id === "game-canvas") {
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
    return false;
  }

  public handleMouseUp(e: MouseEvent): boolean {
    if (this.isDebriefing()) return false;

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
      setTimeout(() => {
        this.isDragging = false;
      }, 0);
      return true;
    }

    const target = e.target as HTMLElement;
    if (target.id === "game-canvas") {
      if (!this.isDragging) {
        this.handleCanvasClick(e);
        return true;
      }
    }

    return false;
  }

  public handleWheel(e: WheelEvent): boolean {
    if (this.isDebriefing()) return false;
    const target = e.target as HTMLElement;
    if (target.id !== "game-canvas" && !target.closest("#game-container"))
      return false;

    const ratio = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoomMap(ratio, e.clientX, e.clientY);
    return true;
  }

  // --- Touch Handlers ---

  public handleTouchStart(e: TouchEvent): boolean {
    if (this.isDebriefing()) return false;
    const target = e.target as HTMLElement;
    if (target.id !== "game-canvas" && !target.closest("#game-container"))
      return false;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.lastTouchPos = { x: touch.clientX, y: touch.clientY };
      this.touchStartTime = Date.now();
      this.hasMovedSignificantly = false;

      // Handle deployment dragging via touch
      const state = this.currentGameState();
      if (state && state.status === "Deployment") {
        const cell = this.getCellCoordinates(touch.clientX, touch.clientY);
        const unit = state.units.find(
          (u) =>
            Math.floor(u.pos.x) === cell.x && Math.floor(u.pos.y) === cell.y,
        );
        if (unit && unit.archetypeId !== "vip") {
          this.draggingUnitId = unit.id;
          this.isDragging = false;
        }
      }
    } else if (e.touches.length === 2) {
      this.lastTouchDistance = this.getTouchDistance(e.touches);
      this.lastTouchCenter = this.getTouchCenter(e.touches);
      this.draggingUnitId = null; // Cancel unit drag on multi-touch
    }
    return true;
  }

  public handleTouchMove(e: TouchEvent): boolean {
    if (this.isDebriefing()) return false;

    if (e.touches.length === 1 && this.lastTouchPos) {
      const touch = e.touches[0];
      const dx = this.lastTouchPos.x - touch.clientX;
      const dy = this.lastTouchPos.y - touch.clientY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this.hasMovedSignificantly = true;
      }

      if (this.draggingUnitId) {
        this.isDragging = true;
      } else {
        this.panMapBy(dx, dy);
      }

      this.lastTouchPos = { x: touch.clientX, y: touch.clientY };
    } else if (
      e.touches.length === 2 &&
      this.lastTouchDistance &&
      this.lastTouchCenter
    ) {
      const currentDistance = this.getTouchDistance(e.touches);
      const currentCenter = this.getTouchCenter(e.touches);

      const ratio = currentDistance / this.lastTouchDistance;
      this.zoomMap(ratio, currentCenter.x, currentCenter.y);

      // Pan to follow center shift
      const dx = this.lastTouchCenter.x - currentCenter.x;
      const dy = this.lastTouchCenter.y - currentCenter.y;
      this.panMapBy(dx, dy);

      this.lastTouchDistance = currentDistance;
      this.lastTouchCenter = currentCenter;
    }
    return true;
  }

  public handleTouchEnd(e: TouchEvent): boolean {
    if (this.isDebriefing()) return false;

    if (this.draggingUnitId) {
      const touch = e.changedTouches[0];
      const cell = this.getCellCoordinates(touch.clientX, touch.clientY);
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
      this.isDragging = false;
    } else if (
      e.touches.length === 0 &&
      this.touchStartTime &&
      Date.now() - this.touchStartTime < 300 &&
      !this.hasMovedSignificantly
    ) {
      // Single Tap -> Click
      const touch = e.changedTouches[0];
      const mockEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        shiftKey: false,
      } as MouseEvent;
      this.handleCanvasClick(mockEvent);
    }

    this.lastTouchPos = null;
    this.lastTouchDistance = null;
    this.lastTouchCenter = null;
    this.touchStartTime = null;
    return true;
  }

  private handleDragOver(e: DragEvent) {
    if (this.isDebriefing()) return;
    const state = this.currentGameState();
    if (!state || state.status !== "Deployment") return;

    e.preventDefault(); // Allow drop
    e.dataTransfer!.dropEffect = "move";
  }

  private handleDrop(e: DragEvent) {
    if (this.isDebriefing()) return;
    const state = this.currentGameState();
    if (!state || state.status !== "Deployment") return;

    e.preventDefault();
    const unitId = e.dataTransfer?.getData("text/plain");
    if (!unitId) return;

    const cell = this.getCellCoordinates(e.clientX, e.clientY);
    
    // Validate spawn point
    const isValidSpawn =
      state.map.squadSpawns?.some((s) => s.x === cell.x && s.y === cell.y) ||
      (state.map.squadSpawn?.x === cell.x && state.map.squadSpawn?.y === cell.y);

    if (isValidSpawn) {
      this.onDeployUnit(unitId, cell.x + 0.5, cell.y + 0.5);
    }
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getTouchCenter(touches: TouchList): { x: number; y: number } {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }
}
