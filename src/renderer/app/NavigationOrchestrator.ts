import { ScreenManager, ScreenId } from "../ScreenManager";
import { CampaignShell, CampaignTabId, CampaignShellMode } from "../ui/CampaignShell";
import { CampaignManager } from "../campaign/CampaignManager";
import { ThemeManager } from "../ThemeManager";
import { MissionSetupManager } from "./MissionSetupManager";
import { SquadBuilder } from "../components/SquadBuilder";
import { MainMenuScreen } from "../screens/MainMenuScreen";
import { CampaignScreen } from "../screens/CampaignScreen";
import { DebriefScreen } from "../screens/DebriefScreen";
import { EquipmentScreen } from "../screens/EquipmentScreen";
import { MissionSetupScreen } from "../screens/MissionSetupScreen";
import { CampaignSummaryScreen } from "../screens/CampaignSummaryScreen";
import { StatisticsScreen } from "../screens/StatisticsScreen";
import { EngineeringScreen } from "../screens/EngineeringScreen";
import { SettingsScreen } from "../screens/SettingsScreen";

export interface NavigationScreens {
  mainMenu: MainMenuScreen;
  campaign: CampaignScreen;
  debrief: DebriefScreen;
  equipment: EquipmentScreen;
  missionSetup: MissionSetupScreen;
  campaignSummary: CampaignSummaryScreen;
  statistics: StatisticsScreen;
  engineering: EngineeringScreen;
  settings: SettingsScreen;
}

export class NavigationOrchestrator {
  constructor(
    private screenManager: ScreenManager,
    private campaignShell: CampaignShell,
    private campaignManager: CampaignManager,
    private themeManager: ThemeManager,
    private missionSetupManager: MissionSetupManager,
    private squadBuilder: SquadBuilder,
    private screens: NavigationScreens,
    private callbacks: {
      showMainMenu: () => void;
      launchMission: () => void;
      resumeMission: () => void;
    }
  ) {}

  /**
   * Centralized screen switcher that ensures all other screens are hidden
   * (and their input contexts popped) before showing the target screen.
   */
  public switchScreen(
    id: ScreenId,
    isCampaign: boolean = false,
    updateHash: boolean = true,
    ...showArgs: unknown[]
  ) {
    // 1. Hide ALL screens to clear input contexts and DOM
    this.allScreens.forEach((s) => s.hide());

    // 2. Hide CampaignShell for non-campaign screens (Main Menu, Mission, etc.)
    if (id === "main-menu" || id === "mission") {
      this.campaignShell.hide();
    }

    // 3. Show target screen object
    const screenObj = this.getScreenObject(id);
    if (screenObj) {
      // We use Function.apply here because screens have different show() signatures
      (screenObj.show as Function).apply(screenObj, showArgs);
    }

    // 4. Update ScreenManager (DOM display and Hash)
    this.screenManager.show(id, updateHash, isCampaign);
  }

  private get allScreens(): { hide: () => void }[] {
    return [
      this.screens.mainMenu,
      this.screens.campaign,
      this.screens.debrief,
      this.screens.equipment,
      this.screens.missionSetup,
      this.screens.campaignSummary,
      this.screens.statistics,
      this.screens.engineering,
      this.screens.settings,
    ].filter((s) => !!s);
  }

  private getScreenObject(id: ScreenId): { show: Function; hide: Function } | null {
    switch (id) {
      case "main-menu":
        return this.screens.mainMenu;
      case "campaign":
        return this.screens.campaign;
      case "mission-setup":
        return this.screens.missionSetup;
      case "equipment":
        return this.screens.equipment;
      case "debrief":
        return this.screens.debrief;
      case "campaign-summary":
        return this.screens.campaignSummary;
      case "statistics":
        return this.screens.statistics;
      case "engineering":
        return this.screens.engineering;
      case "settings":
        return this.screens.settings;
      default:
        return null;
    }
  }

  public onShellTabChange(tabId: CampaignTabId) {
    const hasCampaign = !!this.campaignManager.getState();
    const isCustomFlow =
      !hasCampaign && this.missionSetupManager.currentCampaignNode === null;

    let mode: CampaignShellMode = hasCampaign ? "campaign" : "statistics";
    if (
      isCustomFlow &&
      (tabId === "setup" || tabId === "settings" || tabId === "stats")
    ) {
      mode = "custom";
    }

    let actualTabId = tabId;

    switch (tabId) {
      case "setup":
        if (hasCampaign || !isCustomFlow) {
          // If we somehow get here in campaign, go to ready-room
          this.missionSetupManager.loadAndApplyConfig(true);
          this.screens.equipment.setCampaign(true);
          this.screens.equipment.setHasNodeSelected(!!this.missionSetupManager.currentCampaignNode);
          this.screens.equipment.updateConfig(
            this.missionSetupManager.currentSquad,
          );
          this.switchScreen("equipment", true);
          actualTabId = "ready-room";
        } else {
          this.squadBuilder.update(
            this.missionSetupManager.currentSquad,
            this.missionSetupManager.currentMissionType,
            false,
          );
          this.switchScreen("mission-setup", false);
        }
        break;
      case "sector-map":
        this.switchScreen("campaign", true);
        break;
      case "ready-room": {
        const hasCampaign = !!this.campaignManager.getState();
        this.missionSetupManager.loadAndApplyConfig(hasCampaign);
        this.screens.equipment.setCampaign(hasCampaign);
        this.screens.equipment.setHasNodeSelected(!!this.missionSetupManager.currentCampaignNode);
        this.screens.equipment.updateConfig(
          this.missionSetupManager.currentSquad,
        );
        this.switchScreen("equipment", hasCampaign);
        break;
      }
      case "engineering":
        this.switchScreen("engineering", hasCampaign);
        break;
      case "stats":
        this.switchScreen("statistics", false);
        break;
      case "settings":
        this.switchScreen("settings", hasCampaign || isCustomFlow);
        break;
    }

    this.campaignShell.show(mode, actualTabId);
  }

  public handleExternalScreenChange(
    id: ScreenId,
    isCampaign: boolean = false,
  ) {
    switch (id) {
      case "campaign": {
        this.applyCampaignTheme();
        const state = this.campaignManager.getState();
        if (
          state &&
          (state.status === "Victory" || state.status === "Defeat")
        ) {
          this.switchScreen("campaign-summary", true, true, state);
        } else {
          this.switchScreen("campaign", true);
          this.campaignShell.show("campaign", "sector-map");
        }
        break;
      }
      case "campaign-summary": {
        const state = this.campaignManager.getState();
        if (state) {
          this.switchScreen("campaign-summary", true, true, state);
        } else {
          this.callbacks.showMainMenu();
        }
        break;
      }
      case "mission-setup": {
        const rehydrated = isCampaign
          ? this.missionSetupManager.rehydrateCampaignNode()
          : false;

        if (rehydrated) {
          // Redirect to equipment screen (Spec: Sector -> Equipment -> Launch)
          this.applyCampaignTheme();
          this.missionSetupManager.loadAndApplyConfig(true);
          this.screens.equipment.setCampaign(true);
          this.screens.equipment.setHasNodeSelected(true);
          this.screens.equipment.updateConfig(
            this.missionSetupManager.currentSquad,
          );
          this.switchScreen("equipment", true);
          this.campaignShell.show("campaign", "ready-room", true);
        } else {
          this.missionSetupManager.loadAndApplyConfig(false);
          this.campaignShell.show("custom", "setup");
          this.squadBuilder.update(
            this.missionSetupManager.currentSquad,
            this.missionSetupManager.currentMissionType,
            false,
          );
          this.switchScreen("mission-setup", false);
        }
        break;
      }
      case "equipment": {
        if (isCampaign && !this.missionSetupManager.currentCampaignNode) {
          this.missionSetupManager.rehydrateCampaignNode();
        }
        this.applyCampaignTheme();
        const isCurrentlyCampaign =
          isCampaign || !!this.missionSetupManager.currentCampaignNode;
        this.missionSetupManager.loadAndApplyConfig(isCurrentlyCampaign);
        this.screens.equipment.setCampaign(isCurrentlyCampaign);
        this.screens.equipment.updateConfig(
          this.missionSetupManager.currentSquad,
        );
        this.switchScreen("equipment", isCurrentlyCampaign);
        if (isCurrentlyCampaign) {
          this.campaignShell.show("campaign", "ready-room", true);
        } else {
          this.campaignShell.show("custom", "setup");
        }
        break;
      }
      case "statistics":
        this.switchScreen("statistics", false);
        if (
          !isCampaign &&
          this.missionSetupManager.currentCampaignNode === null &&
          !this.campaignManager.getState()
        ) {
          this.campaignShell.show("custom", "stats");
        } else {
          this.campaignShell.show("statistics", "stats");
        }
        break;
      case "engineering":
        this.switchScreen("engineering", isCampaign || !!this.campaignManager.getState());
        if (isCampaign || this.campaignManager.getState()) {
          this.campaignShell.show("campaign", "engineering");
        } else {
          this.campaignShell.show("statistics", "engineering");
        }
        break;
      case "settings": {
        const state = this.campaignManager.getState();
        const isCustomFlow =
          !isCampaign && this.missionSetupManager.currentCampaignNode === null;
        this.switchScreen("settings", isCampaign || !!state || isCustomFlow);
        if (state) {
          this.campaignShell.show("campaign", "settings");
        } else if (isCustomFlow) {
          this.campaignShell.show("custom", "settings");
        } else {
          this.campaignShell.show("global", "settings", false);
        }
        break;
      }
      case "main-menu":
        this.callbacks.showMainMenu();
        break;
      case "mission":
        this.campaignShell.hide();
        this.callbacks.resumeMission();
        break;
    }
  }

  public applyCampaignTheme() {
    const themeId = this.missionSetupManager.currentThemeId;
    this.themeManager.setTheme(themeId);
  }
}
