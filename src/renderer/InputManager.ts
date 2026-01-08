import { ScreenManager } from "@src/renderer/ScreenManager";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, CommandType } from "@src/shared/types";

export class InputManager {
  constructor(
    private screenManager: ScreenManager,
    private menuController: MenuController,
    private togglePause: () => void,
    private handleMenuInput: (key: string, shiftHeld?: boolean) => void,
    private abortMission: () => void,
    private onUnitDeselect: () => void,
    private getSelectedUnitId: () => string | null,
    private updateUI: (state: GameState) => void,
    private handleCanvasClick: (e: MouseEvent) => void,
    private onToggleDebug: (enabled: boolean) => void,
    private onToggleLos: (enabled: boolean) => void,
    private currentGameState: () => GameState | null,
    private isDebriefing: () => boolean,
  ) {
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleKeyUp = (e: KeyboardEvent) => {
      this.menuController.isShiftHeld = e.shiftKey;
    };
    this.boundHandleCanvasClick = (e: MouseEvent) => {
      if (this.isDebriefing()) return;
      this.menuController.isShiftHeld = e.shiftKey;
      this.handleCanvasClick(e);
    };
  }

  private boundHandleKeyDown: (e: KeyboardEvent) => void;
  private boundHandleKeyUp: (e: KeyboardEvent) => void;
  private boundHandleCanvasClick: (e: MouseEvent) => void;

  public init() {
    document.addEventListener("keydown", this.boundHandleKeyDown);
    document.addEventListener("keyup", this.boundHandleKeyUp);
    const canvas = document.getElementById("game-canvas");
    canvas?.addEventListener("click", this.boundHandleCanvasClick);
  }

  public destroy() {
    document.removeEventListener("keydown", this.boundHandleKeyDown);
    document.removeEventListener("keyup", this.boundHandleKeyUp);
    const canvas = document.getElementById("game-canvas");
    canvas?.removeEventListener("click", this.boundHandleCanvasClick);
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
            if (confirm("Abort Mission and return to menu?")) {
              this.abortMission();
            }
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
