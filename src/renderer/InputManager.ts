import { ScreenManager } from "@src/renderer/ScreenManager";
import { MenuController } from "@src/renderer/MenuController";
import {
  GameState,
  InputContext,
  InputPriority,
  ShortcutInfo,
} from "@src/shared/types";
import { InputDispatcher } from "./InputDispatcher";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { MapUtils } from "@src/shared/utils/MapUtils";

export interface InputManagerConfig {
  screenManager: ScreenManager;
  menuController: MenuController;
  togglePause: () => void;
  handleMenuInput: (key: string, shiftHeld?: boolean) => void;
  abortMission: () => void;
  onUnitDeselect: () => void;
  handleCanvasClick: (e: MouseEvent) => void;
  onToggleDebug: (enabled: boolean) => void;
  onToggleLos: (enabled: boolean) => void;
  currentGameState: () => GameState | null;
  isDebriefing: () => boolean;
  getSelectedUnitId: () => string | null;
  onDeployUnit: (unitId: string, targetX: number, targetY: number) => void;
  onUndeployUnit: (unitId: string) => void;
  getCellCoordinates: (pixelX: number, pixelY: number) => { x: number; y: number };
  getWorldCoordinates: (pixelX: number, pixelY: number) => { x: number; y: number };
  cycleUnits: (reverse?: boolean) => void;
  panMap: (direction: string) => void;
  panMapBy: (dx: number, dy: number) => void;
  zoomMap: (ratio: number, cx: number, cy: number) => void;
}

export class InputManager implements InputContext {
  public id = "TacticalInput";
  public priority = InputPriority.Game;

  public get trapsFocus(): boolean {
    return this.config.currentGameState()?.status === "Deployment";
  }

  public get container(): HTMLElement | undefined {
    return document.getElementById("screen-mission") ?? undefined;
  }

  private draggingUnitId: string | null = null;
  private isDragging: boolean = false;
  private dragGhost: HTMLElement | null = null;

  // Touch state
  private lastTouchPos: { x: number; y: number } | null = null;
  private lastTouchDistance: number | null = null;
  private lastTouchCenter: { x: number; y: number } | null = null;
  private touchStartTime: number | null = null;
  private hasMovedSignificantly: boolean = false;

  private boundDragOver: (e: DragEvent) => void;
  private boundDrop: (e: DragEvent) => void;

  constructor(private config: InputManagerConfig) {
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
        key: "L",
        label: "L",
        description: "Toggle LOS Overlay",
        category: "General",
      },
      {
        key: "Escape",
        label: "Esc",
        description: "Deselect / Back",
        category: "General",
      },
      {
        key: "Q",
        label: "Q",
        description: "Abort Mission",
        category: "General",
      },
      {
        key: "Tab",
        label: "Tab",
        description: "Next Unit",
        category: "Navigation",
      },
      {
        key: "Shift+Tab",
        label: "S+Tab",
        description: "Prev Unit",
        category: "Navigation",
      },
      {
        key: "W,A,S,D",
        label: "WASD",
        description: "Pan Map",
        category: "Navigation",
      },
    ];

    for (let i = 1; i <= 9; i++) {
      shortcuts.push({
        key: i.toString(),
        label: i.toString(),
        description: `Menu Action ${i}`,
        category: "Tactical",
      });
    }

    return shortcuts;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (this.config.isDebriefing() || this.config.screenManager.getCurrentScreen() !== "mission") {
      return false;
    }

    const panKeys = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];
    if (panKeys.includes(e.key.toLowerCase())) {
      let dir = e.key.toLowerCase();
      if (dir === "arrowup" || dir === "w") dir = "up";
      if (dir === "arrowdown" || dir === "s") dir = "down";
      if (dir === "arrowleft" || dir === "a") dir = "left";
      if (dir === "arrowright" || dir === "d") dir = "right";
      this.config.panMap(dir);
      return true;
    }

    if (e.key === " ") {
      this.config.togglePause();
      return true;
    }

    if (e.key === "~" || e.key === "`") {
      const state = this.config.currentGameState();
      if (state) {
        this.config.onToggleDebug(!this.config.screenManager.getScreenElement("mission")?.classList.contains("debug-overlay-enabled"));
      }
      return true;
    }

    if (e.key.toLowerCase() === "l") {
      const state = this.config.currentGameState();
      if (state) {
        this.config.onToggleLos(!this.config.screenManager.getScreenElement("mission")?.classList.contains("los-overlay-enabled"));
      }
      return true;
    }

    if (e.key === "Escape") {
      if (this.config.menuController.menuState !== "ACTION_SELECT") {
        this.config.handleMenuInput("q", e.shiftKey);
      } else if (this.config.getSelectedUnitId()) {
        this.config.onUnitDeselect();
      } else {
        this.config.abortMission();
      }
      return true;
    }

    if (e.key.toLowerCase() === "q") {
      if (this.config.menuController.menuState !== "ACTION_SELECT") {
        this.config.handleMenuInput("q", e.shiftKey);
      } else if (this.config.getSelectedUnitId()) {
        this.config.onUnitDeselect();
      } else {
        // In ACTION_SELECT with no unit selected, 'q' should NOT abort.
        // We return false to allow GlobalShortcuts to handle it (e.g. for pause menu)
        return false;
      }
      return true;
    }

    if (e.key === "Tab") {
      // Allow default Tab behavior if focus is on a UI element (button, input, etc.)
      // to enable navigating HUD/Deployment elements.
      const active = document.activeElement;
      const isUIElement = active && active !== document.body && active.id !== "game-canvas";
      
      if (isUIElement) {
        return false;
      }

      this.config.cycleUnits(e.shiftKey);
      return true;
    }

    if (/^[1-9]$/.test(e.key)) {
      this.config.handleMenuInput(e.key, e.shiftKey);
      return true;
    }

    return false;
  }

  public handleMouseDown(e: MouseEvent): boolean {
    if (this.config.isDebriefing()) return false;
    this.config.menuController.isShiftHeld = e.shiftKey;

    const target = e.target as HTMLElement;
    if (target.id !== "game-canvas") return false;

    const state = this.config.currentGameState();
    if (!state || state.status !== "Deployment") return false;

    const cell = this.config.getCellCoordinates(e.clientX, e.clientY);
    const worldPos = this.config.getWorldCoordinates(e.clientX, e.clientY);

    const bestUnit = state.units.findLast(
      (u) =>
        MathUtils.sameCellPosition(u.pos, cell) &&
        u.isDeployed !== false &&
        u.archetypeId !== "vip" &&
        MathUtils.getDistance(worldPos, u.pos) <= 0.5,
    );

    if (bestUnit) {
      this.draggingUnitId = bestUnit.id;
      this.isDragging = false;
      this.createDragGhost(bestUnit.id);
      this.updateDragGhost(e.clientX, e.clientY);
      const canvas = document.getElementById("game-canvas");
      if (canvas) canvas.style.cursor = "grabbing";
      return true;
    }
    return false;
  }

  public handleMouseMove(e: MouseEvent): boolean {
    if (this.config.isDebriefing()) return false;

    if (this.draggingUnitId) {
      this.isDragging = true;
      this.updateDragGhost(e.clientX, e.clientY);
      return true;
    }

    const target = e.target as HTMLElement;
    if (target.id === "game-canvas") {
      const canvas = document.getElementById("game-canvas");
      if (canvas) {
        const state = this.config.currentGameState();
        if (state && state.status === "Deployment") {
          const cell = this.config.getCellCoordinates(e.clientX, e.clientY);
          const worldPos = this.config.getWorldCoordinates(e.clientX, e.clientY);
          const bestUnit = state.units.findLast(
            (u) =>
              MathUtils.sameCellPosition(u.pos, cell) &&
              u.isDeployed !== false &&
              u.archetypeId !== "vip" &&
              MathUtils.getDistance(worldPos, u.pos) <= 0.5,
          );
          if (bestUnit) {
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
    if (this.config.isDebriefing()) return false;

    if (this.draggingUnitId) {
      this.removeDragGhost();
      const cell = this.config.getCellCoordinates(e.clientX, e.clientY);
      const state = this.config.currentGameState();

      if (state && state.status === "Deployment") {
        const isValidSpawn = MapUtils.isValidSpawnPoint(state.map, cell);

        if (isValidSpawn) {
          this.config.onDeployUnit(this.draggingUnitId, cell.x + 0.5, cell.y + 0.5);
        } else {
          this.config.onUndeployUnit(this.draggingUnitId);
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
        this.config.handleCanvasClick(e);
        return true;
      }
    }

    return false;
  }

  public handleWheel(e: WheelEvent): boolean {
    if (this.config.isDebriefing()) return false;
    const target = e.target as HTMLElement;
    if (target.id !== "game-canvas" && !target.closest("#game-container"))
      return false;

    const ratio = e.deltaY > 0 ? 0.9 : 1.1;
    this.config.zoomMap(ratio, e.clientX, e.clientY);
    return true;
  }

  public handleTouchStart(e: TouchEvent): boolean {
    if (this.config.isDebriefing()) return false;
    const target = e.target as HTMLElement;
    if (target.id !== "game-canvas" && !target.closest("#game-container"))
      return false;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.lastTouchPos = { x: touch.clientX, y: touch.clientY };
      this.touchStartTime = Date.now();
      this.hasMovedSignificantly = false;

      const state = this.config.currentGameState();
      if (state && state.status === "Deployment") {
        const cell = this.config.getCellCoordinates(touch.clientX, touch.clientY);
        const worldPos = this.config.getWorldCoordinates(touch.clientX, touch.clientY);

        const bestUnit = state.units.findLast(
          (u) =>
            MathUtils.sameCellPosition(u.pos, cell) &&
            u.isDeployed !== false &&
            u.archetypeId !== "vip" &&
            MathUtils.getDistance(worldPos, u.pos) <= 0.5,
        );

        if (bestUnit) {
          this.draggingUnitId = bestUnit.id;
          this.isDragging = false;
          this.createDragGhost(bestUnit.id);
          this.updateDragGhost(touch.clientX, touch.clientY);
          return true;
        }
      }
    } else if (e.touches.length === 2) {
      this.lastTouchDistance = this.getTouchDistance(e.touches);
      this.lastTouchCenter = this.getTouchCenter(e.touches);
      this.draggingUnitId = null;
    }
    return false;
  }

  public handleTouchMove(e: TouchEvent): boolean {
    if (this.config.isDebriefing()) return false;

    if (e.touches.length === 1 && this.lastTouchPos) {
      const touch = e.touches[0];
      const dx = touch.clientX - this.lastTouchPos.x;
      const dy = touch.clientY - this.lastTouchPos.y;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this.hasMovedSignificantly = true;
      }

      if (this.draggingUnitId) {
        this.isDragging = true;
        this.updateDragGhost(touch.clientX, touch.clientY);
      } else {
        this.config.panMapBy(-dx, -dy);
      }

      this.lastTouchPos = { x: touch.clientX, y: touch.clientY };
      return true;
    } else if (e.touches.length === 2 && this.lastTouchDistance && this.lastTouchCenter) {
      const distance = this.getTouchDistance(e.touches);
      const center = this.getTouchCenter(e.touches);

      const ratio = distance / this.lastTouchDistance;
      this.config.zoomMap(ratio, center.x, center.y);

      const dx = center.x - this.lastTouchCenter.x;
      const dy = center.y - this.lastTouchCenter.y;
      this.config.panMapBy(dx, dy);

      this.lastTouchDistance = distance;
      this.lastTouchCenter = center;
      return true;
    }
    return false;
  }

  public handleTouchEnd(e: TouchEvent): boolean {
    if (this.config.isDebriefing()) return false;

    if (this.draggingUnitId) {
      const touch = e.changedTouches[0];
      this.removeDragGhost();
      const cell = this.config.getCellCoordinates(touch.clientX, touch.clientY);
      const state = this.config.currentGameState();

      if (state && state.status === "Deployment") {
        const isValidSpawn = MapUtils.isValidSpawnPoint(state.map, cell);

        if (isValidSpawn) {
          this.config.onDeployUnit(this.draggingUnitId, cell.x + 0.5, cell.y + 0.5);
        } else {
          this.config.onUndeployUnit(this.draggingUnitId);
        }
      }

      this.draggingUnitId = null;
      setTimeout(() => {
        this.isDragging = false;
      }, 0);
      return true;
    }

    if (e.touches.length === 0 && this.lastTouchPos && !this.hasMovedSignificantly) {
      const duration = Date.now() - (this.touchStartTime || 0);
      if (duration < 300) {
        const mouseEvent = new MouseEvent("mousedown", {
          clientX: this.lastTouchPos.x,
          clientY: this.lastTouchPos.y,
        });
        this.config.handleCanvasClick(mouseEvent);
        return true;
      }
    }

    this.lastTouchPos = null;
    this.lastTouchDistance = null;
    this.lastTouchCenter = null;
    return false;
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

  private handleDragOver(e: DragEvent) {
    if (this.config.currentGameState()?.status !== "Deployment") return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
  }

  private handleDrop(e: DragEvent) {
    if (this.config.currentGameState()?.status !== "Deployment") return;
    e.preventDefault();
    const data = e.dataTransfer!.getData("application/voidlock-unit");
    if (data) {
      const unit = JSON.parse(data);
      const cell = this.config.getCellCoordinates(e.clientX, e.clientY);
      this.config.onDeployUnit(unit.id, cell.x + 0.5, cell.y + 0.5);
    }
  }

  private createDragGhost(unitId: string) {
    this.removeDragGhost();
    this.dragGhost = document.createElement("div");
    this.dragGhost.className = "deployment-drag-ghost";
    this.dragGhost.style.position = "fixed";
    this.dragGhost.style.pointerEvents = "none";
    this.dragGhost.style.zIndex = "10000";
    this.dragGhost.style.width = "40px";
    this.dragGhost.style.height = "40px";
    this.dragGhost.style.borderRadius = "50%";
    this.dragGhost.style.background = "var(--color-primary, #2ecc71)";
    this.dragGhost.style.border = "3px solid #000";
    this.dragGhost.style.display = "flex";
    this.dragGhost.style.alignItems = "center";
    this.dragGhost.style.justifyContent = "center";
    this.dragGhost.style.color = "#000";
    this.dragGhost.style.fontWeight = "bold";
    this.dragGhost.textContent = unitId.split("-").pop() || "U";
    document.body.appendChild(this.dragGhost);
  }

  private updateDragGhost(clientX: number, clientY: number) {
    if (this.dragGhost) {
      this.dragGhost.style.left = `${clientX - 20}px`;
      this.dragGhost.style.top = `${clientY - 20}px`;
    }
  }

  private removeDragGhost() {
    if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }
  }
}
