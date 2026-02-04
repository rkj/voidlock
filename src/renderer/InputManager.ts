import { ScreenManager } from "@src/renderer/ScreenManager";
import { MenuController } from "@src/renderer/MenuController";
import { GameState } from "@src/shared/types";
import { ModalService } from "./ui/ModalService";

export class InputManager {
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
    private onDeployUnit: (unitId: string, targetX: number, targetY: number) => void,
    private getCellCoordinates: (pixelX: number, pixelY: number) => { x: number, y: number },
  ) {
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
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
        (u) => Math.floor(u.pos.x) === cell.x && Math.floor(u.pos.y) === cell.y
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
            (u) => Math.floor(u.pos.x) === cell.x && Math.floor(u.pos.y) === cell.y
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
          const isValidSpawn = state.map.squadSpawns?.some(s => s.x === cell.x && s.y === cell.y) || 
                               (state.map.squadSpawn?.x === cell.x && state.map.squadSpawn?.y === cell.y);
          
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

  private boundHandleKeyDown: (e: KeyboardEvent) => void;
  private boundHandleKeyUp: (e: KeyboardEvent) => void;
  private boundHandleCanvasClick: (e: MouseEvent) => void;
  private boundHandleMouseDown: (e: MouseEvent) => void;
  private boundHandleMouseMove: (e: MouseEvent) => void;
  private boundHandleMouseUp: (e: MouseEvent) => void;

  private draggingUnitId: string | null = null;
  private isDragging: boolean = false;

  public init() {
    document.addEventListener("keydown", this.boundHandleKeyDown);
    document.addEventListener("keyup", this.boundHandleKeyUp);
    const canvas = document.getElementById("game-canvas");
    canvas?.addEventListener("click", this.boundHandleCanvasClick);
    canvas?.addEventListener("mousedown", this.boundHandleMouseDown);
    window.addEventListener("mousemove", this.boundHandleMouseMove);
    window.addEventListener("mouseup", this.boundHandleMouseUp);
  }

  public destroy() {
    document.removeEventListener("keydown", this.boundHandleKeyDown);
    document.removeEventListener("keyup", this.boundHandleKeyUp);
    const canvas = document.getElementById("game-canvas");
    canvas?.removeEventListener("click", this.boundHandleCanvasClick);
    canvas?.removeEventListener("mousedown", this.boundHandleMouseDown);
    window.removeEventListener("mousemove", this.boundHandleMouseMove);
    window.removeEventListener("mouseup", this.boundHandleMouseUp);
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.isDebriefing()) return;
    this.menuController.isShiftHeld = e.shiftKey;
    if (
      (e.target as HTMLElement).tagName === "INPUT" ||
      (e.target as HTMLElement).tagName === "TEXTAREA"
    )
      return;

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
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        this.togglePause();
        return;
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
        return;
      }

      if (e.key === "m" || e.key === "M") {
        if (this.menuController.menuState === "ACTION_SELECT") {
          this.handleMenuInput("1", e.shiftKey);
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (/^[0-9a-z]$/.test(key)) {
        this.handleMenuInput(key, e.shiftKey);
      }
    } else {
      if (e.key === "Escape" || e.key === "q" || e.key === "Q") {
        this.screenManager.goBack();
      }
    }
  }
}
