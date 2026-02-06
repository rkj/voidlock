import { AppContext } from "../app/AppContext";
import { ConfigManager } from "../ConfigManager";
import { UnitStyleSelector } from "../components/UnitStyleSelector";
import { Logger, LogLevel } from "@src/shared/Logger";

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
    this.container.style.overflowY = "auto";

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

    // Developer Options Section
    const devHeader = document.createElement("h3");
    devHeader.textContent = "Developer Options";
    devHeader.style.marginTop = "20px";
    devHeader.style.borderBottom = "1px solid var(--color-border)";
    devHeader.style.paddingBottom = "5px";
    devHeader.style.color = "var(--color-text-dim)";
    settingsGrid.appendChild(devHeader);

    // Log Level
    const logGroup = document.createElement("div");
    logGroup.className = "control-group flex-row justify-between align-center";
    logGroup.style.width = "100%";
    const logLabel = document.createElement("label");
    logLabel.textContent = "Log Level:";
    logGroup.appendChild(logLabel);

    const logSelect = document.createElement("select");
    logSelect.id = "settings-log-level";
    const levels = ["DEBUG", "INFO", "WARN", "ERROR", "NONE"];
    levels.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l;
      opt.textContent = l;
      if (l === global.logLevel) opt.selected = true;
      logSelect.appendChild(opt);
    });
    logSelect.onchange = () => {
      const newLevelStr = logSelect.value;
      if (
        newLevelStr === "DEBUG" ||
        newLevelStr === "INFO" ||
        newLevelStr === "WARN" ||
        newLevelStr === "ERROR" ||
        newLevelStr === "NONE"
      ) {
        Logger.setLevel(LogLevel[newLevelStr]);
        ConfigManager.saveGlobal({
          ...ConfigManager.loadGlobal(),
          logLevel: newLevelStr,
        });
      }
    };
    logGroup.appendChild(logSelect);
    settingsGrid.appendChild(logGroup);

    // Debug Snapshots
    const snapshotGroup = document.createElement("div");
    snapshotGroup.className =
      "control-group flex-row justify-between align-center";
    snapshotGroup.style.width = "100%";
    const snapshotLabel = document.createElement("label");
    snapshotLabel.textContent = "Debug Snapshots:";
    snapshotGroup.appendChild(snapshotLabel);

    const snapshotToggle = document.createElement("input");
    snapshotToggle.type = "checkbox";
    snapshotToggle.checked = global.debugSnapshots;
    snapshotToggle.onchange = () => {
      ConfigManager.saveGlobal({
        ...ConfigManager.loadGlobal(),
        debugSnapshots: snapshotToggle.checked,
      });
    };
    snapshotGroup.appendChild(snapshotToggle);
    settingsGrid.appendChild(snapshotGroup);

    // Debug Overlay
    const overlayGroup = document.createElement("div");
    overlayGroup.className =
      "control-group flex-row justify-between align-center";
    overlayGroup.style.width = "100%";
    const overlayLabel = document.createElement("label");
    overlayLabel.textContent = "Debug Overlay:";
    overlayGroup.appendChild(overlayLabel);

    const overlayToggle = document.createElement("input");
    overlayToggle.type = "checkbox";
    overlayToggle.checked = global.debugOverlayEnabled;
    overlayToggle.onchange = () => {
      ConfigManager.saveGlobal({
        ...ConfigManager.loadGlobal(),
        debugOverlayEnabled: overlayToggle.checked,
      });
    };
    overlayGroup.appendChild(overlayToggle);
    settingsGrid.appendChild(overlayGroup);

    // Data Management Section
    const dataHeader = document.createElement("h3");
    dataHeader.textContent = "Data Management";
    dataHeader.style.marginTop = "20px";
    dataHeader.style.borderBottom = "1px solid var(--color-border)";
    dataHeader.style.paddingBottom = "5px";
    dataHeader.style.color = "var(--color-text-dim)";
    settingsGrid.appendChild(dataHeader);

    const resetGroup = document.createElement("div");
    resetGroup.className = "control-group flex-col gap-10";
    resetGroup.style.width = "100%";

    const resetDesc = document.createElement("div");
    resetDesc.textContent =
      "Clear all campaign progress, settings, and local data.";
    resetDesc.style.fontSize = "0.8em";
    resetDesc.style.color = "var(--color-text-dim)";
    resetGroup.appendChild(resetDesc);

    const resetBtn = document.createElement("button");
    resetBtn.className = "menu-button back-button";
    resetBtn.style.width = "100%";
    resetBtn.style.marginTop = "10px";
    resetBtn.textContent = "Reset All Data";
    resetBtn.onclick = async () => {
      const confirmed = await this.context.modalService.show<boolean>({
        title: "RESET ALL DATA",
        message:
          "This will permanently delete all your campaign progress, settings, and local storage. This action cannot be undone. Are you sure?",
        buttons: [
          {
            label: "CANCEL",
            isCancel: true,
            onClick: (modal) => modal.close(false),
          },
          {
            label: "DELETE EVERYTHING",
            isPrimary: true,
            className: "menu-button back-button",
            onClick: (modal) => modal.close(true),
          },
        ],
      });

      if (confirmed) {
        localStorage.clear();
        window.location.reload();
      }
    };
    resetGroup.appendChild(resetBtn);
    settingsGrid.appendChild(resetGroup);

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
