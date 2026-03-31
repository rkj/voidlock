import { ConfigManager } from "../ConfigManager";
import type { GlobalConfig } from "../ConfigManager";
import { UnitStyleSelector } from "../components/UnitStyleSelector";
import { Logger, LogLevel } from "@src/shared/Logger";
import type { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";
import type { ThemeManager } from "../ThemeManager";
import type { CloudSyncService } from "@src/services/CloudSyncService";
import type { ModalService } from "../ui/ModalService";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";
import { t, getAvailableLocales, setLocale } from "../i18n";
import { I18nKeys } from "../i18n/keys";

import type { AssetManager } from "../visuals/AssetManager";

export interface SettingsScreenConfig {
  containerId: string;
  themeManager: ThemeManager;
  assetManager: AssetManager;
  inputDispatcher: InputDispatcher;
  cloudSync: CloudSyncService;
  modalService: ModalService;
  onBack: () => void;
  onLocaleChange: () => void;
}

export class SettingsScreen {
  private container: HTMLElement;
  private themeManager: ThemeManager;
  private assetManager: AssetManager;
  private inputDispatcher: InputDispatcher;
  private cloudSync: CloudSyncService;
  private modalService: ModalService;
  private onBack: () => void;
  private onLocaleChange: () => void;
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
    this.onLocaleChange = config.onLocaleChange;
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
          label: t(I18nKeys.common.shortcuts.navigate),
          description: t(I18nKeys.common.shortcuts.move_selection),
          category: "Navigation",
        },
        {
          key: "Enter",
          label: t(I18nKeys.common.shortcuts.select),
          description: t(I18nKeys.common.shortcuts.activate_button),
          category: "Navigation",
        },
        {
          key: "ESC",
          label: t(I18nKeys.screen.settings.back),
          description: t(I18nKeys.common.shortcuts.save_return),
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
    const global = ConfigManager.loadGlobal();

    this.container.innerHTML = "";
    this.container.className = "screen screen-centered flex-col p-20 atmospheric-bg bg-station";
    this.container.style.overflowY = "hidden";

    const grain = document.createElement("div");
    grain.className = "grain";
    this.container.appendChild(grain);

    const scanline = document.createElement("div");
    scanline.className = "scanline";
    this.container.appendChild(scanline);

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "flex-col align-center w-full h-full relative";
    contentWrapper.style.zIndex = "10";
    this.container.appendChild(contentWrapper);

    const h1 = document.createElement("h1");
    h1.textContent = t(I18nKeys.screen.settings.title);
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-primary)";
    h1.style.marginBottom = "20px";
    h1.style.flexShrink = "0";
    contentWrapper.appendChild(h1);

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "settings-content flex-col gap-20 p-20 flex-grow w-full";
    scrollContainer.style.overflowY = "auto";
    scrollContainer.style.minHeight = "0";
    scrollContainer.style.maxWidth = "800px";
    scrollContainer.style.margin = "0 auto";
    contentWrapper.appendChild(scrollContainer);

    const settingsGrid = document.createElement("div");
    settingsGrid.className = "flex-col gap-20 p-20";
    settingsGrid.style.background = "var(--color-surface-elevated)";
    settingsGrid.style.border = "1px solid var(--color-border-strong)";
    settingsGrid.style.width = "100%";

    this.renderVisualStyleSection(settingsGrid, global);
    this.renderDeveloperSection(settingsGrid, global);
    this.renderAccountSection(settingsGrid, global);
    this.renderDataManagementSection(settingsGrid, global);

    scrollContainer.appendChild(settingsGrid);

    // Actions
    const actions = document.createElement("div");
    actions.className = "flex-row justify-center w-full p-20";
    actions.style.maxWidth = "540px";
    actions.style.flexShrink = "0";

    const backBtn = document.createElement("button");
    backBtn.className = "menu-button back-button";
    backBtn.setAttribute("data-focus-id", "btn-settings-back");
    backBtn.textContent = t(I18nKeys.screen.settings.back);
    backBtn.onclick = () => {
      this.onBack();
    };
    actions.appendChild(backBtn);
    contentWrapper.appendChild(actions);
  }

  private renderVisualStyleSection(grid: HTMLElement, global: GlobalConfig) {
    const styleGroup = document.createElement("div");
    styleGroup.className = "control-group";
    styleGroup.style.width = "100%";
    const styleLabel = document.createElement("label");
    styleLabel.textContent = t(I18nKeys.screen.settings.visual_style);
    styleGroup.appendChild(styleLabel);

    const stylePreview = document.createElement("div");
    stylePreview.id = "settings-unit-style-preview";
    stylePreview.className = "style-preview-container";
    styleGroup.appendChild(stylePreview);
    grid.appendChild(styleGroup);

    this.unitStyleSelector = new UnitStyleSelector(
      stylePreview,
      this.themeManager,
      this.assetManager,
      global.unitStyle,
      (style) => {
        ConfigManager.saveGlobal({ ...ConfigManager.loadGlobal(), unitStyle: style });
        this.unitStyleSelector?.renderPreviews();
      },
    );
    this.unitStyleSelector.render();

    const themeGroup = document.createElement("div");
    themeGroup.className = "control-group";
    themeGroup.style.width = "100%";
    const themeLabel = document.createElement("label");
    themeLabel.textContent = t(I18nKeys.screen.settings.environment_theme);
    themeLabel.setAttribute("for", "settings-map-theme");
    themeGroup.appendChild(themeLabel);

    const themeSelect = document.createElement("select");
    themeSelect.id = "settings-map-theme";
    const themes = [
      { id: "default", label: t(I18nKeys.screen.settings.theme_default) },
      { id: "industrial", label: t(I18nKeys.screen.settings.theme_industrial) },
      { id: "hive", label: t(I18nKeys.screen.settings.theme_hive) },
    ];
    themes.forEach((t_item) => {
      const opt = document.createElement("option");
      opt.value = t_item.id;
      opt.textContent = t_item.label;
      if (t_item.id === global.themeId) opt.selected = true;
      themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener("change", () => {
      const themeId = themeSelect.value;
      this.themeManager.setTheme(themeId);
      ConfigManager.saveGlobal({ ...ConfigManager.loadGlobal(), themeId });
      this.unitStyleSelector?.renderPreviews();
    });
    themeGroup.appendChild(themeSelect);
    grid.appendChild(themeGroup);

    const phosphorGroup = document.createElement("div");
    phosphorGroup.className = "control-group";
    phosphorGroup.style.width = "100%";
    const phosphorLabel = document.createElement("label");
    phosphorLabel.textContent = t(I18nKeys.screen.settings.terminal_phosphor);
    phosphorLabel.setAttribute("for", "settings-phosphor-mode");
    phosphorGroup.appendChild(phosphorLabel);

    const phosphorSelect = document.createElement("select");
    phosphorSelect.id = "settings-phosphor-mode";
    const modes = [
      { id: "green", label: t(I18nKeys.screen.settings.phosphor_green) },
      { id: "amber", label: t(I18nKeys.screen.settings.phosphor_amber) },
    ];
    modes.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label;
      if (m.id === global.phosphor) opt.selected = true;
      phosphorSelect.appendChild(opt);
    });
    phosphorSelect.addEventListener("change", () => {
      const mode = phosphorSelect.value as "green" | "amber";
      if (mode === "amber") {
        document.body.classList.add("crt-amber");
      } else {
        document.body.classList.remove("crt-amber");
      }
      ConfigManager.saveGlobal({ ...ConfigManager.loadGlobal(), phosphor: mode });
      this.unitStyleSelector?.renderPreviews();
    });
    phosphorGroup.appendChild(phosphorSelect);
    grid.appendChild(phosphorGroup);

    // Language Selector
    const langGroup = document.createElement("div");
    langGroup.className = "control-group";
    langGroup.style.width = "100%";
    const langLabel = document.createElement("label");
    langLabel.textContent = t(I18nKeys.screen.settings.language);
    langLabel.setAttribute("for", "settings-language");
    langGroup.appendChild(langLabel);

    const langSelect = document.createElement("select");
    langSelect.id = "settings-language";
    const availableLocales = getAvailableLocales();
    const localeKeys: Record<string, string> = {
      "en-corporate": I18nKeys.screen.settings.lang_en_corporate,
      "en-standard": I18nKeys.screen.settings.lang_en_standard,
      "pl": I18nKeys.screen.settings.lang_pl,
    };

    availableLocales.forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = loc;
      const key = localeKeys[loc] as any;
      opt.textContent = key ? t(key) : loc;
      if (loc === global.locale) opt.selected = true;
      langSelect.appendChild(opt);
    });

    langSelect.addEventListener("change", () => {
      const newLocale = langSelect.value;
      setLocale(newLocale);
      this.onLocaleChange();
      this.render();
    });
    langGroup.appendChild(langSelect);
    grid.appendChild(langGroup);
  }

  private renderDeveloperSection(grid: HTMLElement, global: GlobalConfig) {
    const devHeader = document.createElement("h3");
    devHeader.textContent = t(I18nKeys.screen.settings.developer_options);
    devHeader.style.marginTop = "20px";
    devHeader.style.borderBottom = "1px solid var(--color-border)";
    devHeader.style.paddingBottom = "5px";
    devHeader.style.color = "var(--color-text-dim)";
    grid.appendChild(devHeader);

    const logGroup = document.createElement("div");
    logGroup.className = "control-group flex-row justify-between align-center";
    logGroup.style.width = "100%";
    const logLabel = document.createElement("label");
    logLabel.textContent = t(I18nKeys.screen.settings.log_level);
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
        newLevelStr === "DEBUG" || newLevelStr === "INFO" ||
        newLevelStr === "WARN" || newLevelStr === "ERROR" || newLevelStr === "NONE"
      ) {
        Logger.setLevel(LogLevel[newLevelStr]);
        ConfigManager.saveGlobal({ ...ConfigManager.loadGlobal(), logLevel: newLevelStr });
      }
    };
    logGroup.appendChild(logSelect);
    grid.appendChild(logGroup);

    const snapshotGroup = document.createElement("div");
    snapshotGroup.className = "control-group flex-row justify-between align-center";
    snapshotGroup.style.width = "100%";
    const snapshotLabel = document.createElement("label");
    snapshotLabel.textContent = t(I18nKeys.screen.settings.debug_snapshots);
    snapshotGroup.appendChild(snapshotLabel);

    const snapshotToggle = document.createElement("input");
    snapshotToggle.type = "checkbox";
    snapshotToggle.checked = global.debugSnapshots;
    snapshotToggle.onchange = () => {
      ConfigManager.saveGlobal({ ...ConfigManager.loadGlobal(), debugSnapshots: snapshotToggle.checked });
    };
    snapshotGroup.appendChild(snapshotToggle);
    grid.appendChild(snapshotGroup);

    const intervalGroup = document.createElement("div");
    intervalGroup.className = "control-group flex-row justify-between align-center";
    intervalGroup.style.width = "100%";
    const intervalLabel = document.createElement("label");
    intervalLabel.textContent = t(I18nKeys.screen.settings.snapshot_interval);
    intervalGroup.appendChild(intervalLabel);

    const intervalInput = document.createElement("input");
    intervalInput.type = "number";
    intervalInput.min = "0";
    intervalInput.max = "1000";
    intervalInput.style.width = "60px";
    intervalInput.value = global.debugSnapshotInterval.toString();
    intervalInput.onchange = () => {
      ConfigManager.saveGlobal({
        ...ConfigManager.loadGlobal(),
        debugSnapshotInterval: parseInt(intervalInput.value) || 0,
      });
    };
    intervalGroup.appendChild(intervalInput);
    grid.appendChild(intervalGroup);

    const overlayGroup = document.createElement("div");
    overlayGroup.className = "control-group flex-row justify-between align-center";
    overlayGroup.style.width = "100%";
    const overlayLabel = document.createElement("label");
    overlayLabel.textContent = t(I18nKeys.screen.settings.debug_overlay);
    overlayGroup.appendChild(overlayLabel);

    const overlayToggle = document.createElement("input");
    overlayToggle.type = "checkbox";
    overlayToggle.checked = global.debugOverlayEnabled;
    overlayToggle.onchange = () => {
      ConfigManager.saveGlobal({ ...ConfigManager.loadGlobal(), debugOverlayEnabled: overlayToggle.checked });
    };
    overlayGroup.appendChild(overlayToggle);
    grid.appendChild(overlayGroup);
  }

  private renderAccountSection(grid: HTMLElement, global: GlobalConfig) {
    const accountHeader = document.createElement("h3");
    accountHeader.textContent = t(I18nKeys.screen.settings.cloud_sync_header);
    accountHeader.style.marginTop = "20px";
    accountHeader.style.borderBottom = "1px solid var(--color-border)";
    accountHeader.style.paddingBottom = "5px";
    accountHeader.style.color = "var(--color-text-dim)";
    grid.appendChild(accountHeader);

    const accountGroup = document.createElement("div");
    accountGroup.className = "control-group flex-col gap-10";
    accountGroup.style.width = "100%";

    const syncGroup = document.createElement("div");
    syncGroup.className = "flex-row justify-between align-center";
    syncGroup.style.width = "100%";
    const isConfigured = this.cloudSync?.isConfigured() ?? false;
    const syncLabel = document.createElement("label");
    syncLabel.textContent = t(I18nKeys.screen.settings.cloud_sync_enable);
    if (!isConfigured) {
      syncLabel.textContent += " " + t(I18nKeys.screen.settings.sync_not_configured);
      syncLabel.style.color = "var(--color-text-dim)";
    }
    syncGroup.appendChild(syncLabel);

    const syncToggle = document.createElement("input");
    syncToggle.type = "checkbox";
    syncToggle.checked = global.cloudSyncEnabled && isConfigured;
    syncToggle.disabled = !isConfigured;
    syncToggle.onchange = () => {
      const enabled = syncToggle.checked;
      ConfigManager.saveGlobal({ ...ConfigManager.loadGlobal(), cloudSyncEnabled: enabled });
      if (this.cloudSync) {
        this.cloudSync.setEnabled(enabled);
        if (enabled) {
          void this.cloudSync.initialize().then(() => this.render());
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
        ? t(I18nKeys.screen.settings.sync_unavailable)
        : t(I18nKeys.screen.settings.sync_unavailable_firebase);
      errorMsg.style.color = "var(--color-error)";
      errorMsg.style.fontSize = "0.8em";
      accountGroup.appendChild(errorMsg);
    } else if (global.cloudSyncEnabled) {
      this.renderCloudSyncAuthUI(accountGroup);
    } else {
      const infoMsg = document.createElement("div");
      infoMsg.textContent = t(I18nKeys.screen.settings.cloud_sync_disabled_msg);
      infoMsg.style.color = "var(--color-text-dim)";
      infoMsg.style.fontSize = "0.8em";
      accountGroup.appendChild(infoMsg);
    }
    grid.appendChild(accountGroup);
  }

  private renderCloudSyncAuthUI(accountGroup: HTMLElement) {
    const user = this.cloudSync.getUser();
    const isAnonymous = this.cloudSync.isAnonymous();

    if (user && !isAnonymous) {
      const userInfo = document.createElement("div");
      userInfo.className = "flex-row justify-between align-center";
      userInfo.style.padding = "10px";
      userInfo.style.background = "var(--color-surface)";
      userInfo.style.border = "1px solid var(--color-border)";

      const userDetails = document.createElement("div");
      userDetails.className = "flex-col";

      const userName = document.createElement("div");
      userName.textContent = user.displayName || user.email || t(I18nKeys.screen.settings.authenticated_user);
      userName.style.fontWeight = "bold";
      userDetails.appendChild(userName);

      const userStatus = document.createElement("div");
      userStatus.textContent = t(I18nKeys.screen.settings.cloud_sync_active);
      userStatus.style.fontSize = "0.8em";
      userStatus.style.color = "var(--color-primary)";
      userDetails.appendChild(userStatus);

      userInfo.appendChild(userDetails);

      const signOutBtn = document.createElement("button");
      signOutBtn.className = "menu-button";
      signOutBtn.style.fontSize = "0.8em";
      signOutBtn.style.padding = "5px 10px";
      signOutBtn.textContent = t(I18nKeys.screen.settings.sign_out);
      signOutBtn.onclick = async () => {
        if (this.cloudSync) {
          await this.cloudSync.signOut();
          this.render();
        }
      };
      userInfo.appendChild(signOutBtn);
      accountGroup.appendChild(userInfo);
    } else {
      const authDesc = document.createElement("div");
      authDesc.textContent = t(I18nKeys.screen.settings.auth_desc);
      authDesc.style.fontSize = "0.8em";
      authDesc.style.color = "var(--color-text-dim)";
      accountGroup.appendChild(authDesc);

      const authButtons = document.createElement("div");
      authButtons.className = "flex-row gap-10";
      authButtons.style.marginTop = "5px";

      const googleBtn = document.createElement("button");
      googleBtn.className = "menu-button";
      googleBtn.style.flex = "1";
      googleBtn.textContent = t(I18nKeys.screen.settings.sign_in_google);
      googleBtn.onclick = async () => {
        if (!this.cloudSync) return;
        try {
          await this.cloudSync.signInWithGoogle();
          this.render();
        } catch (_err) {
          void this.modalService.show({
            title: t(I18nKeys.screen.settings.auth_failed_title),
            message: t(I18nKeys.screen.settings.auth_failed_msg_google),
            buttons: [{ label: t(I18nKeys.common.ok), isPrimary: true, onClick: (m) => m.close() }],
          });
        }
      };
      authButtons.appendChild(googleBtn);

      const githubBtn = document.createElement("button");
      githubBtn.className = "menu-button";
      githubBtn.style.flex = "1";
      githubBtn.textContent = t(I18nKeys.screen.settings.sign_in_github);
      githubBtn.onclick = async () => {
        if (!this.cloudSync) return;
        try {
          await this.cloudSync.signInWithGithub();
          this.render();
        } catch (_err) {
          void this.modalService.show({
            title: t(I18nKeys.screen.settings.auth_failed_title),
            message: t(I18nKeys.screen.settings.auth_failed_msg_github),
            buttons: [{ label: t(I18nKeys.common.ok), isPrimary: true, onClick: (m) => m.close() }],
          });
        }
      };
      authButtons.appendChild(githubBtn);
      accountGroup.appendChild(authButtons);
    }
  }

  private renderDataManagementSection(grid: HTMLElement, global: GlobalConfig) {
    const dataHeader = document.createElement("h3");
    dataHeader.textContent = t(I18nKeys.screen.settings.data_management);
    dataHeader.style.marginTop = "20px";
    dataHeader.style.borderBottom = "1px solid var(--color-border)";
    dataHeader.style.paddingBottom = "5px";
    dataHeader.style.color = "var(--color-text-dim)";
    grid.appendChild(dataHeader);

    const resetGroup = document.createElement("div");
    resetGroup.className = "control-group flex-col gap-10";
    resetGroup.style.width = "100%";

    const resetDesc = document.createElement("div");
    resetDesc.textContent = t(I18nKeys.screen.settings.reset_desc);
    resetDesc.style.fontSize = "0.8em";
    resetDesc.style.color = "var(--color-text-dim)";
    resetGroup.appendChild(resetDesc);

    const resetBtn = document.createElement("button");
    resetBtn.className = "menu-button danger-button";
    resetBtn.style.width = "100%";
    resetBtn.style.marginTop = "10px";
    resetBtn.textContent = t(I18nKeys.screen.settings.reset_btn);
    resetBtn.onclick = async () => {
      const confirmed = await this.modalService.show<boolean>({
        title: t(I18nKeys.screen.settings.reset_confirm_title),
        message: t(I18nKeys.screen.settings.reset_confirm_msg),
        buttons: [
          { label: t(I18nKeys.common.cancel), isCancel: true, onClick: (modal) => modal.close(false) },
          {
            label: t(I18nKeys.screen.settings.reset_delete_everything),
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
    const isConfigured = this.cloudSync?.isConfigured() ?? false;
    if (isConfigured && global.cloudSyncEnabled) {
      const cloudDeleteBtn = document.createElement("button");
      cloudDeleteBtn.className = "menu-button danger-button";
      cloudDeleteBtn.style.width = "100%";
      cloudDeleteBtn.style.marginTop = "10px";
      cloudDeleteBtn.textContent = t(I18nKeys.screen.settings.delete_cloud);
      cloudDeleteBtn.onclick = async () => {
        const confirmed = await this.modalService.show<boolean>({
          title: t(I18nKeys.screen.settings.cloud_delete_confirm_title),
          message: t(I18nKeys.screen.settings.cloud_delete_confirm_msg),
          buttons: [
            { label: t(I18nKeys.common.cancel), isCancel: true, onClick: (modal) => modal.close(false) },
            {
              label: t(I18nKeys.screen.settings.delete_cloud),
              isPrimary: true,
              className: "menu-button danger-button",
              onClick: (modal) => modal.close(true),
            },
          ],
        });
        if (confirmed) {
          try {
            await this.cloudSync.deleteCampaign(CAMPAIGN_DEFAULTS.STORAGE_KEY);
            void this.modalService.show({
              title: t(I18nKeys.screen.settings.cloud_delete_success_title),
              message: t(I18nKeys.screen.settings.cloud_delete_success_msg),
              buttons: [{ label: t(I18nKeys.common.ok), isPrimary: true, onClick: (m) => m.close() }],
            });
          } catch (_err) {
            void this.modalService.show({
              title: t(I18nKeys.screen.settings.cloud_delete_error_title),
              message: t(I18nKeys.screen.settings.cloud_delete_error_msg),
              buttons: [{ label: t(I18nKeys.common.ok), isPrimary: true, onClick: (m) => m.close() }],
            });
          }
        }
      };
      resetGroup.appendChild(cloudDeleteBtn);
    }

    grid.appendChild(resetGroup);
  }
}
