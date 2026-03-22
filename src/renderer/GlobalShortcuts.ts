import type { InputContext, ShortcutInfo } from "@src/shared/types";
import { InputPriority } from "@src/shared/types";
import { InputDispatcher } from "./InputDispatcher";
import { KeyboardHelpOverlay } from "./ui/KeyboardHelpOverlay";

export class GlobalShortcuts implements InputContext {
  public id = "GlobalShortcuts";
  public priority = InputPriority.Global;
  public trapsFocus = false;

  private helpOverlay: KeyboardHelpOverlay;

  constructor(
    private inputDispatcher: InputDispatcher,
    private togglePause: () => void,
    private goBack: () => void,
  ) {
    this.helpOverlay = new KeyboardHelpOverlay(this.inputDispatcher);
  }

  public init() {
    this.inputDispatcher.pushContext(this);
  }

  public destroy() {
    this.inputDispatcher.popContext(this.id);
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
    ) {
      return false;
    }

    if (e.key === "?") {
      this.helpOverlay.show();
      return true;
    }

    // Space and Escape are often handled by more specific contexts (like InputManager or ModalService)
    // with higher priority. These are the fallbacks.
    if (e.code === "Space") {
      this.togglePause();
      return true;
    }

    if (e.key === "Escape" || e.key === "q" || e.key === "Q") {
      this.goBack();
      return true;
    }

    return false;
  }

  public getShortcuts(): ShortcutInfo[] {
    return [
      {
        key: "Space",
        label: "Space",
        description: "Toggle Pause",
        category: "General",
      },
      {
        key: "ESC / Q",
        label: "ESC / Q",
        description: "Back / Menu",
        category: "Navigation",
      },
      { key: "?", label: "?", description: "Show Help", category: "General" },
    ];
  }
}
