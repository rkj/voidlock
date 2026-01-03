import { ScreenManager } from "./ScreenManager";
import { MenuController } from "./MenuController";
import { GameState, CommandType } from "../shared/types";

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
  ) {}

  public init() {
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    document.addEventListener("keyup", (e) => {
      this.menuController.isShiftHeld = e.shiftKey;
    });
    const canvas = document.getElementById("game-canvas");
    canvas?.addEventListener("click", (e) => {
      this.menuController.isShiftHeld = (e as MouseEvent).shiftKey;
      this.handleCanvasClick(e as MouseEvent);
    });
  }

  private handleKeyDown(e: KeyboardEvent) {
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
