import { ConfigManager } from "../ConfigManager";
import { UnitStyleSelector } from "../components/UnitStyleSelector";
import { Logger, LogLevel } from "@src/shared/Logger";
import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";
import type { ThemeManager } from "../ThemeManager";
import type { CloudSyncService } from "@src/services/CloudSyncService";
import type { ModalService } from "../ui/ModalService";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";

import { AssetManager } from "../visuals/AssetManager";

export interface SettingsScreenConfig {
  containerId: string;
  themeManager: ThemeManager;
  assetManager: AssetManager;
  inputDispatcher: InputDispatcher;
  cloudSync: CloudSyncService;
  modalService: ModalService;
  onBack: () => void;
}

export class SettingsScreen {
  private container: HTMLElement;
  private themeManager: ThemeManager;
  private assetManager: AssetManager;
  private inputDispatcher: InputDispatcher;
  private cloudSync: CloudSyncService;
  private modalService: ModalService;
  private onBack: () => void;
  private unitStyleSelector?: UnitStyleSelector;
  private authUnsubscribe?: () => void;

  constructor(config: SettingsScreenConfig) {
    const el = document.getElementById(config.containerId);
    if (!el) throw new Error(`Container #${config.containerId} not found`);
    this.container = el;
    this.themeManager = config.themeManager;
    this.assetManager = config.assetManager;
    this.inputDispatcher = config.inputDispatcher;
    this.cloudSync = config.cloudSync;
    this.modalService = config.modalService;
    this.onBack = config.onBack;
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
    this.pushInputContext();
  }

  public hide() {
    this.container.style.display = "none";
    this.inputDispatcher.popContext("settings");
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = undefined;
    }
  }

  private pushInputContext() {
    this.inputDispatcher.pushContext({
      id: "settings",
      priority: InputPriority.UI,
      trapsFocus: true,
      container: this.container,
      handleKeyDown: (e) => this.handleKeyDown(e),
      getShortcuts: () => [
        {
          key: "Arrows",
          label: "Navigate",
          description: "Move selection",
          category: "Navigation",
        },
        {
          key: "Enter",
          label: "Select",
          description: "Activate button",
          category: "Navigation",
        },
        {
          key: "ESC",
          label: "Back",
          description: "Save and Return",
          category: "Navigation",
        },
      ],
    });
  }

  private handleKeyDown(e: KeyboardEvent): boolean {
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      return UIUtils.handleArrowNavigation(e, this.container, {
        orientation: "both",
      });
    }
    if (e.key === "Escape") {
      this.onBack();
      return true;
    }
    return false;
  }

  public isVisible(): boolean {
    return this.container.style.display === "flex";
  }

  private render() {
    const globalConfig = ConfigManager.loadGlobal();

    this.container.innerHTML = "";
    this.container.className = "screen screen-centered flex-col p-20 atmospheric-bg bg-station";
    this.container.style.overflowY = "hidden"; // Enforce internal scroll only

    // Grain effect
    const grain = document.createElement("div");
    grain.className = "grain";
    this.container.appendChild(grain);

    // Scanline effect
    const scanline = document.createElement("div");
    scanline.className = "scanline";
    this.container.appendChild(scanline);

    // Content Wrapper (to ensure it's above grain/scanline)
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "flex-col align-center w-full h-full relative";
    contentWrapper.style.zIndex = "10";
    this.container.appendChild(contentWrapper);

    const h1 = document.createElement("h1");
    h1.textContent = "Global Settings";
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-primary)";
    h1.style.marginBottom = "20px";
    h1.style.flexShrink = "0";
    contentWrapper.appendChild(h1);

    // Internal Scroll Container
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "settings-content flex-col gap-20 p-20 flex-grow w-full";
    scrollContainer.style.overflowY = "auto";
    scrollContainer.style.minHeight = "0"; // Critical for flex-grow + overflow
    scrollContainer.style.maxWidth = "800px"; // Better readability
    scrollContainer.style.margin = "0 auto";
    contentWrapper.appendChild(scrollContainer);

    const settingsGrid = document.createElement("div");
    settingsGrid.className = "flex-col gap-20 p-20";
    settingsGrid.style.background = "var(--color-surface-elevated)";
    settingsGrid.style.border = "1px solid var(--color-border-strong)";
    settingsGrid.style.width = "100%";

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
      this.themeManager,
      this.assetManager,
      globalConfig.unitStyle,
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
      if (t.id === globalConfig.themeId) opt.selected = true;
      themeSelect.appendChild(opt);
    });

    themeSelect.addEventListener("change", () => {
      const themeId = themeSelect.value;
      this.themeManager.setTheme(themeId);
      ConfigManager.saveGlobal({
        ...ConfigManager.loadGlobal(),
        themeId,
      });
      // Refresh previews when theme changes
      this.unitStyleSelector?.renderPreviews();
    });
    themeGroup.appendChild(themeSelect);
    settingsGrid.appendChild(themeGroup);

    // Terminal Phosphor Section
    const phosphorGroup = document.createElement("div");
    phosphorGroup.className = "control-group";
    phosphorGroup.style.width = "100%";
    const phosphorLabel = document.createElement("label");
    phosphorLabel.textContent = "Terminal Phosphor:";
    phosphorLabel.setAttribute("for", "settings-phosphor-mode");
    phosphorGroup.appendChild(phosphorLabel);

    const phosphorSelect = document.createElement("select");
    phosphorSelect.id = "settings-phosphor-mode";
    const modes = [
      { id: "green", label: "Green (Standard)" },
      { id: "amber", label: "Amber (Warm)" },
    ];
    modes.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label;
      if (m.id === globalConfig.phosphor) opt.selected = true;
      phosphorSelect.appendChild(opt);
    });

    phosphorSelect.addEventListener("change", () => {
      const mode = phosphorSelect.value as "green" | "amber";
      if (mode === "amber") {
        document.body.classList.add("crt-amber");
      } else {
        document.body.classList.remove("crt-amber");
      }
      ConfigManager.saveGlobal({
        ...ConfigManager.loadGlobal(),
        phosphor: mode,
      });
      // Refresh previews
      this.unitStyleSelector?.renderPreviews();
    });
    phosphorGroup.appendChild(phosphorSelect);
    settingsGrid.appendChild(phosphorGroup);

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
      if (l === globalConfig.logLevel) opt.selected = true;
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
    snapshotToggle.checked = globalConfig.debugSnapshots;
    snapshotToggle.onchange = () => {
      ConfigManager.saveGlobal({
        ...ConfigManager.loadGlobal(),
        debugSnapshots: snapshotToggle.checked,
      });
    };
    snapshotGroup.appendChild(snapshotToggle);
    settingsGrid.appendChild(snapshotGroup);

    // Snapshot Interval
    const intervalGroup = document.createElement("div");
    intervalGroup.className =
      "control-group flex-row justify-between align-center";
    intervalGroup.style.width = "100%";
    const intervalLabel = document.createElement("label");
    intervalLabel.textContent = "Snapshot Interval (Ticks, 0=Default):";
    intervalGroup.appendChild(intervalLabel);

    const intervalInput = document.createElement("input");
    intervalInput.type = "number";
    intervalInput.min = "0";
    intervalInput.max = "1000";
    intervalInput.style.width = "60px";
    intervalInput.value = globalConfig.debugSnapshotInterval.toString();
    intervalInput.onchange = () => {
      ConfigManager.saveGlobal({
        ...ConfigManager.loadGlobal(),
        debugSnapshotInterval: parseInt(intervalInput.value) || 0,
      });
    };
    intervalGroup.appendChild(intervalInput);
    settingsGrid.appendChild(intervalGroup);

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
    overlayToggle.checked = globalConfig.debugOverlayEnabled;
    overlayToggle.onchange = () => {
      ConfigManager.saveGlobal({
        ...ConfigManager.loadGlobal(),
        debugOverlayEnabled: overlayToggle.checked,
      });
    };
    overlayGroup.appendChild(overlayToggle);
    settingsGrid.appendChild(overlayGroup);

    // Account & Cloud Sync Section
    const accountHeader = document.createElement("h3");
    accountHeader.textContent = "Account & Cloud Sync";
    accountHeader.style.marginTop = "20px";
    accountHeader.style.borderBottom = "1px solid var(--color-border)";
    accountHeader.style.paddingBottom = "5px";
    accountHeader.style.color = "var(--color-text-dim)";
    settingsGrid.appendChild(accountHeader);

    const accountGroup = document.createElement("div");
    accountGroup.className = "control-group flex-col gap-10";
    accountGroup.style.width = "100%";

    // Cloud Sync Toggle
    const syncGroup = document.createElement("div");
    syncGroup.className = "flex-row justify-between align-center";
    syncGroup.style.width = "100%";
    const isConfigured = this.cloudSync?.isConfigured() ?? false;
    const syncLabel = document.createElement("label");
    syncLabel.textContent = "Enable Cloud Sync:";
    if (!isConfigured) {
      syncLabel.textContent += " (Not Configured)";
      syncLabel.style.color = "var(--color-text-dim)";
    }
    syncGroup.appendChild(syncLabel);

    const syncToggle = document.createElement("input");
    syncToggle.type = "checkbox";
    syncToggle.checked = globalConfig.cloudSyncEnabled && isConfigured;
    syncToggle.disabled = !isConfigured;
    syncToggle.onchange = () => {
      const enabled = syncToggle.checked;
      ConfigManager.saveGlobal({
        ...ConfigManager.loadGlobal(),
        cloudSyncEnabled: enabled,
      });
      if (this.cloudSync) {
        this.cloudSync.setEnabled(enabled);
        if (enabled) {
          this.cloudSync.initialize().then(() => this.render());
        } else {
          this.render();
        }
      }
    };
    syncGroup.appendChild(syncToggle);
    accountGroup.appendChild(syncGroup);

    if (!this.cloudSync || !isConfigured) {
      const errorMsg = document.createElement("div");
      errorMsg.textContent = !this.cloudSync
        ? "Cloud Sync Service Unavailable"
        : "Cloud Sync Service Unavailable (Firebase not configured)";
      errorMsg.style.color = "var(--color-error)";
      errorMsg.style.fontSize = "0.8em";
      accountGroup.appendChild(errorMsg);
    } else if (globalConfig.cloudSyncEnabled) {
      const user = this.cloudSync.getUser();
      const isAnonymous = this.cloudSync.isAnonymous();

      if (user && !isAnonymous) {
        // Signed in
        const userInfo = document.createElement("div");
        userInfo.className = "flex-row justify-between align-center";
        userInfo.style.padding = "10px";
        userInfo.style.background = "var(--color-surface)";
        userInfo.style.border = "1px solid var(--color-border)";

        const userDetails = document.createElement("div");
        userDetails.className = "flex-col";

        const userName = document.createElement("div");
        userName.textContent =
          user.displayName || user.email || "Authenticated User";
        userName.style.fontWeight = "bold";
        userDetails.appendChild(userName);

        const userStatus = document.createElement("div");
        userStatus.textContent = "✓ Cloud Sync Active";
        userStatus.style.fontSize = "0.8em";
        userStatus.style.color = "var(--color-primary)";
        userDetails.appendChild(userStatus);

        userInfo.appendChild(userDetails);

        const signOutBtn = document.createElement("button");
        signOutBtn.className = "menu-button";
        signOutBtn.style.fontSize = "0.8em";
        signOutBtn.style.padding = "5px 10px";
        signOutBtn.textContent = "Sign Out";
        signOutBtn.onclick = async () => {
          if (this.cloudSync) {
            await this.cloudSync.signOut();
            this.render();
          }
        };
        userInfo.appendChild(signOutBtn);

        accountGroup.appendChild(userInfo);
      } else {
        // Anonymous or Not signed in
        const authDesc = document.createElement("div");
        authDesc.textContent =
          "Sign in to enable cross-device synchronization and protect your saves.";
        authDesc.style.fontSize = "0.8em";
        authDesc.style.color = "var(--color-text-dim)";
        accountGroup.appendChild(authDesc);

        const authButtons = document.createElement("div");
        authButtons.className = "flex-row gap-10";
        authButtons.style.marginTop = "5px";

        const googleBtn = document.createElement("button");
        googleBtn.className = "menu-button";
        googleBtn.style.flex = "1";
        googleBtn.textContent = "Sign in with Google";
        googleBtn.onclick = async () => {
          if (!this.cloudSync) return;
          try {
            await this.cloudSync.signInWithGoogle();
            this.render();
          } catch (err) {
            this.modalService.show({
              title: "Sign In Failed",
              message: "Could not connect to Google. Please try again later.",
              buttons: [
                { label: "OK", isPrimary: true, onClick: (m) => m.close() },
              ],
            });
          }
        };
        authButtons.appendChild(googleBtn);

        const githubBtn = document.createElement("button");
        githubBtn.className = "menu-button";
        githubBtn.style.flex = "1";
        githubBtn.textContent = "Sign in with GitHub";
        githubBtn.onclick = async () => {
          if (!this.cloudSync) return;
          try {
            await this.cloudSync.signInWithGithub();
            this.render();
          } catch (err) {
            this.modalService.show({
              title: "Sign In Failed",
              message: "Could not connect to GitHub. Please try again later.",
              buttons: [
                { label: "OK", isPrimary: true, onClick: (m) => m.close() },
              ],
            });
          }
        };
        authButtons.appendChild(githubBtn);

        accountGroup.appendChild(authButtons);
      }
    } else {
      const infoMsg = document.createElement("div");
      infoMsg.textContent =
        "Cloud Sync is disabled. Enable it above to use online saves.";
      infoMsg.style.color = "var(--color-text-dim)";
      infoMsg.style.fontSize = "0.8em";
      accountGroup.appendChild(infoMsg);
    }
    settingsGrid.appendChild(accountGroup);

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
    resetBtn.className = "menu-button danger-button";
    resetBtn.style.width = "100%";
    resetBtn.style.marginTop = "10px";
    resetBtn.textContent = "Reset All Data";
    resetBtn.onclick = async () => {
      const confirmed = await this.modalService.show<boolean>({
        title: "Reset All Data",
        message:
          "This will permanently delete all your campaign progress, settings, and local storage. This action cannot be undone. Are you sure?",
        buttons: [
          {
            label: "Cancel",
            isCancel: true,
            onClick: (modal) => modal.close(false),
          },
          {
            label: "Delete Everything",
            isPrimary: true,
            className: "menu-button danger-button",
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

    // Cloud Data Management
    if (isConfigured && globalConfig.cloudSyncEnabled) {
      const cloudDeleteBtn = document.createElement("button");
      cloudDeleteBtn.className = "menu-button danger-button";
      cloudDeleteBtn.style.width = "100%";
      cloudDeleteBtn.style.marginTop = "10px";
      cloudDeleteBtn.textContent = "Delete Cloud Backups";
      cloudDeleteBtn.onclick = async () => {
        const confirmed = await this.modalService.show<boolean>({
          title: "Delete Cloud Data",
          message:
            "This will permanently delete all your campaign backups from the cloud. Local data will remain. Are you sure?",
          buttons: [
            {
              label: "Cancel",
              isCancel: true,
              onClick: (modal) => modal.close(false),
            },
            {
              label: "Delete Cloud Data",
              isPrimary: true,
              className: "menu-button danger-button",
              onClick: (modal) => modal.close(true),
            },
          ],
        });

        if (confirmed) {
          try {
            await this.cloudSync.deleteCampaign(CAMPAIGN_DEFAULTS.STORAGE_KEY);
            this.modalService.show({
              title: "Success",
              message: "Cloud backups have been deleted.",
              buttons: [
                { label: "OK", isPrimary: true, onClick: (m) => m.close() },
              ],
            });
          } catch (err) {
            this.modalService.show({
              title: "Error",
              message: "Failed to delete cloud data. Please try again later.",
              buttons: [
                { label: "OK", isPrimary: true, onClick: (m) => m.close() },
              ],
            });
          }
        }
      };
      resetGroup.appendChild(cloudDeleteBtn);
    }

    settingsGrid.appendChild(resetGroup);

    scrollContainer.appendChild(settingsGrid);

    // Actions
    const actions = document.createElement("div");
    actions.className = "flex-row justify-center w-full p-20";
    actions.style.maxWidth = "540px";
    actions.style.flexShrink = "0";

    const backBtn = document.createElement("button");
    backBtn.className = "menu-button back-button";
    backBtn.setAttribute("data-focus-id", "btn-settings-back");
    backBtn.textContent = "Save & Back";
    backBtn.onclick = () => {
      this.onBack();
    };
    actions.appendChild(backBtn);
    contentWrapper.appendChild(actions);
  }
}
