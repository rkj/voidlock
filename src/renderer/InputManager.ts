import { ScreenManager } from "./ScreenManager";
import { MenuController } from "./MenuController";
import { GameState, CommandType } from "../shared/types";

export class InputManager {
  constructor(
    private screenManager: ScreenManager,
    private menuController: MenuController,
    private togglePause: () => void,
    private handleMenuInput: (key: string) => void,
    private abortMission: () => void,
    private onUnitDeselect: () => void,
    private getSelectedUnitId: () => string | null,
    private updateUI: (state: GameState) => void,
    private handleCanvasClick: (e: MouseEvent) => void,
    private sendCommand: (cmd: any) => void,
    private currentGameState: () => GameState | null,
  ) {}

  public init() {
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    const canvas = document.getElementById("game-canvas");
    canvas?.addEventListener("click", (e) =>
      this.handleCanvasClick(e as MouseEvent),
    );
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (
      (e.target as HTMLElement).tagName === "INPUT" ||
      (e.target as HTMLElement).tagName === "TEXTAREA"
    )
      return;

    if (this.screenManager.getCurrentScreen() === "mission") {
      if (e.key === "Escape") {
        if (this.menuController.menuState !== "ACTION_SELECT") {
          this.menuController.goBack();
        } else {
          if (this.getSelectedUnitId()) {
            this.onUnitDeselect();
          } else {
            if (confirm("Abort Mission and return to menu?")) {
              this.abortMission();
            }
          }
        }
        // We need access to state to update UI
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
            this.sendCommand({
              type: CommandType.TOGGLE_LOS_OVERLAY,
              enabled: !state.settings.losOverlayEnabled,
            });
          } else {
            this.sendCommand({
              type: CommandType.TOGGLE_DEBUG_OVERLAY,
              enabled: !state.settings.debugOverlayEnabled,
            });
          }
        }
        return;
      }

      if (e.key === "m" || e.key === "M") {
        if (this.menuController.menuState === "ACTION_SELECT") {
          this.handleMenuInput("1");
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (/^[0-9a-z]$/.test(key)) {
        this.handleMenuInput(key);
      }
    } else {
      if (e.key === "Escape") {
        this.screenManager.goBack();
      }
    }
  }
}
