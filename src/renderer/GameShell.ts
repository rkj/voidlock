import { ScreenLayoutConfig } from "./Screen";

export class GameShell {
  private headerTitle: HTMLElement;
  private headerControls: HTMLElement;
  private mainContent: HTMLElement;
  private footer: HTMLElement;

  constructor() {
    this.headerTitle = this.getRequiredElement("header-title");
    this.headerControls = this.getRequiredElement("header-controls");
    this.mainContent = this.getRequiredElement("main-content");
    this.footer = this.getRequiredElement("global-footer");
  }

  private getRequiredElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Required DOM element not found: #${id}`);
    }
    return element;
  }

  /**
   * Updates the shell elements based on the provided screen configuration.
   */
  public updateConfig(config: ScreenLayoutConfig) {
    // Update Title
    this.headerTitle.textContent = config.title;

    // Update Header Controls
    this.headerControls.innerHTML = "";
    if (config.showBackButton && config.onBack) {
      const backBtn = document.createElement("button");
      backBtn.textContent = "← Back";
      backBtn.className = "back-button shell-button";
      backBtn.onclick = config.onBack;
      this.headerControls.appendChild(backBtn);
    }

    if (config.secondaryAction) {
      const secBtn = document.createElement("button");
      secBtn.textContent = config.secondaryAction.label;
      secBtn.className = "menu-button shell-button";
      secBtn.style.fontSize = "0.8em";
      secBtn.style.padding = "4px 12px";
      secBtn.onclick = config.secondaryAction.onClick;
      this.headerControls.appendChild(secBtn);
    }

    // Update Footer
    this.footer.innerHTML = "";
    if (config.primaryAction) {
      const primaryBtn = document.createElement("button");
      primaryBtn.textContent = config.primaryAction.label;
      primaryBtn.className = "primary-button shell-button";
      primaryBtn.disabled = !!config.primaryAction.disabled;
      primaryBtn.onclick = config.primaryAction.onClick;
      this.footer.appendChild(primaryBtn);
      this.footer.style.display = "flex";
    } else {
      this.footer.style.display = "none";
    }
  }

  /**
   * Clears the main content area.
   */
  public clearContent() {
    this.mainContent.innerHTML = "";
    // Ensure we reset scroll
    this.mainContent.scrollTop = 0;
  }

  /**
   * Appends an element to the main content area.
   */
  public setContent(element: HTMLElement) {
    this.clearContent();
    this.mainContent.appendChild(element);
  }

  public getMainContent(): HTMLElement {
    return this.mainContent;
  }
}
