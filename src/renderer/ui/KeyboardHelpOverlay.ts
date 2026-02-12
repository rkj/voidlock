import { InputContext, InputPriority, ShortcutInfo } from "@src/shared/types";
import { InputDispatcher } from "../InputDispatcher";

export class KeyboardHelpOverlay implements InputContext {
  public id = "KeyboardHelpOverlay";
  public priority = InputPriority.Overlay;
  public trapsFocus = true;
  public container: HTMLElement;

  private backdrop: HTMLElement;

  constructor() {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "help-overlay-backdrop";
    this.backdrop.style.position = "fixed";
    this.backdrop.style.inset = "0";
    this.backdrop.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
    this.backdrop.style.zIndex = "5000";
    this.backdrop.style.backdropFilter = "blur(4px)";
    this.backdrop.style.display = "none";
    this.backdrop.style.alignItems = "center";
    this.backdrop.style.justifyContent = "center";

    this.container = document.createElement("div");
    this.container.className = "help-overlay-window flex-col gap-20 p-40";
    this.container.style.backgroundColor = "var(--color-surface-elevated)";
    this.container.style.border = "2px solid var(--color-accent)";
    this.container.style.minWidth = "400px";
    this.container.style.maxWidth = "80vw";
    this.container.style.maxHeight = "80vh";
    this.container.style.overflowY = "auto";
    this.container.style.boxShadow = "0 0 30px rgba(0, 150, 255, 0.1)";

    this.backdrop.appendChild(this.container);
    document.body.appendChild(this.backdrop);
  }

  public show() {
    this.render();
    this.backdrop.style.display = "flex";
    InputDispatcher.getInstance().pushContext(this);
  }

  public hide() {
    this.backdrop.style.display = "none";
    InputDispatcher.getInstance().popContext(this.id);
  }

  private render() {
    this.container.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = "KEYBOARD SHORTCUTS";
    title.style.margin = "0";
    title.style.color = "var(--color-accent)";
    title.style.letterSpacing = "2px";
    title.style.borderBottom = "1px solid var(--color-border)";
    title.style.paddingBottom = "10px";
    this.container.appendChild(title);

    const shortcuts = InputDispatcher.getInstance().getActiveShortcuts();

    // Group by category
    const grouped = new Map<string, ShortcutInfo[]>();
    shortcuts.forEach((s) => {
      const list = grouped.get(s.category) || [];
      list.push(s);
      grouped.set(s.category, list);
    });

    const categories: ShortcutInfo["category"][] = [
      "General",
      "Tactical",
      "Navigation",
      "Menu",
    ];

    categories.forEach((category) => {
      const list = grouped.get(category);
      if (list && list.length > 0) {
        const section = document.createElement("div");
        section.className = "help-section flex-col gap-10";
        section.style.marginTop = "20px";

        const header = document.createElement("h3");
        header.textContent = category;
        header.style.color = "var(--color-text-dim)";
        header.style.fontSize = "0.9em";
        header.style.margin = "0 0 5px 0";
        section.appendChild(header);

        list.forEach((s) => {
          const row = document.createElement("div");
          row.className = "help-row flex-row justify-between items-center";
          row.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
          row.style.padding = "5px 0";

          const keyLabel = document.createElement("span");
          keyLabel.className = "shortcut-key";
          keyLabel.textContent = s.label;
          keyLabel.style.color = "var(--color-primary)";
          keyLabel.style.fontWeight = "bold";
          keyLabel.style.fontFamily = "monospace";
          keyLabel.style.backgroundColor = "rgba(0, 255, 0, 0.1)";
          keyLabel.style.padding = "2px 6px";
          keyLabel.style.borderRadius = "4px";
          keyLabel.style.minWidth = "60px";
          keyLabel.style.textAlign = "center";

          const desc = document.createElement("span");
          desc.textContent = s.description;
          desc.style.color = "var(--color-text)";
          desc.style.marginLeft = "20px";
          desc.style.flex = "1";

          row.appendChild(keyLabel);
          row.appendChild(desc);
          section.appendChild(row);
        });

        this.container.appendChild(section);
      }
    });

    const footer = document.createElement("div");
    footer.style.marginTop = "30px";
    footer.style.textAlign = "center";
    footer.style.color = "var(--color-text-dim)";
    footer.style.fontSize = "0.8em";
    footer.textContent = "Press Esc or ? to close";
    this.container.appendChild(footer);
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === "Escape" || e.key === "?") {
      this.hide();
      return true;
    }
    return false;
  }

  public getShortcuts(): ShortcutInfo[] {
    return [
      {
        key: "ESC",
        label: "Esc",
        description: "Close Help Overlay",
        category: "Navigation",
      },
      {
        key: "?",
        label: "?",
        description: "Close Help Overlay",
        category: "Navigation",
      },
    ];
  }
}
