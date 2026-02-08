import { InputContext, InputPriority, ShortcutInfo } from "@src/shared/types";
import { InputDispatcher } from "./InputDispatcher";
import { KeyboardHelpOverlay } from "./ui/KeyboardHelpOverlay";

export class GlobalShortcuts implements InputContext {
  public id = "GlobalShortcuts";
  public priority = InputPriority.Global;
  public trapsFocus = false;

  private helpOverlay: KeyboardHelpOverlay;

  constructor(
    private togglePause: () => void,
    private goBack: () => void,
  ) {
    this.helpOverlay = new KeyboardHelpOverlay();
  }

  public init() {
    InputDispatcher.getInstance().pushContext(this);
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (
      (e.target as HTMLElement).tagName === "INPUT" ||
      (e.target as HTMLElement).tagName === "TEXTAREA"
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
