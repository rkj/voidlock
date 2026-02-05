import { AppContext } from "../app/AppContext";
import { ConfigManager } from "../ConfigManager";
import { UnitStyleSelector } from "../components/UnitStyleSelector";

export class SettingsScreen {
  private container: HTMLElement;
  private unitStyleSelector?: UnitStyleSelector;
  private onBack: () => void;

  constructor(
    containerId: string,
    private context: AppContext,
    onBack: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.onBack = onBack;
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
  }

  public hide() {
    this.container.style.display = "none";
  }

  public isVisible(): boolean {
    return this.container.style.display === "flex";
  }

  private render() {
    const global = ConfigManager.loadGlobal();

    this.container.innerHTML = "";
    this.container.className = "screen screen-centered flex-col gap-20 p-20";

    const h1 = document.createElement("h1");
    h1.textContent = "Global Settings";
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-primary)";
    this.container.appendChild(h1);

    const settingsGrid = document.createElement("div");
    settingsGrid.className = "flex-col gap-20 p-20";
    settingsGrid.style.background = "var(--color-surface-elevated)";
    settingsGrid.style.border = "1px solid var(--color-border-strong)";
    settingsGrid.style.minWidth = "500px";

    // Visual Style Section
    const styleGroup = document.createElement("div");
    styleGroup.className = "control-group";
    styleGroup.style.width = "100%";
    const styleLabel = document.createElement("label");
    styleLabel.textContent = "Visual Style:";
    styleGroup.appendChild(styleLabel);

    const stylePreview = document.createElement("div");
    stylePreview.id = "settings-unit-style-preview";
    stylePreview.className = "style-preview-container";
    styleGroup.appendChild(stylePreview);
    settingsGrid.appendChild(styleGroup);

    this.unitStyleSelector = new UnitStyleSelector(
      stylePreview,
      this.context,
      global.unitStyle,
      (style) => {
        ConfigManager.saveGlobal({
          ...ConfigManager.loadGlobal(),
          unitStyle: style,
        });
        this.unitStyleSelector?.renderPreviews();
      },
    );
    this.unitStyleSelector.render();

    // Theme Section
    const themeGroup = document.createElement("div");
    themeGroup.className = "control-group";
    themeGroup.style.width = "100%";
    const themeLabel = document.createElement("label");
    themeLabel.textContent = "Environment Theme:";
    themeLabel.setAttribute("for", "settings-map-theme");
    themeGroup.appendChild(themeLabel);

    const themeSelect = document.createElement("select");
    themeSelect.id = "settings-map-theme";
    const themes = [
      { id: "default", label: "Default (Voidlock Green)" },
      { id: "industrial", label: "Industrial (Amber)" },
      { id: "hive", label: "Xeno Hive (Purple)" },
    ];
    themes.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.label;
      if (t.id === global.themeId) opt.selected = true;
      themeSelect.appendChild(opt);
    });

    themeSelect.onchange = () => {
      const themeId = themeSelect.value;
      this.context.themeManager.setTheme(themeId);
      ConfigManager.saveGlobal({
        ...ConfigManager.loadGlobal(),
        themeId: themeId,
      });
      // Refresh previews when theme changes
      this.unitStyleSelector?.renderPreviews();
    };
    themeGroup.appendChild(themeSelect);
    settingsGrid.appendChild(themeGroup);

    this.container.appendChild(settingsGrid);

    // Actions
    const actions = document.createElement("div");
    actions.className = "flex-row justify-center w-full p-20";
    actions.style.maxWidth = "540px";

    const backBtn = document.createElement("button");
    backBtn.className = "menu-button back-button";
    backBtn.textContent = "Save & Back";
    backBtn.onclick = () => {
      this.onBack();
    };
    actions.appendChild(backBtn);
    this.container.appendChild(actions);
  }
}
