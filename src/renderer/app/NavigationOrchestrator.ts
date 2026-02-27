import { ScreenManager, ScreenId } from "../ScreenManager";
import { CampaignShell, CampaignTabId, CampaignShellMode } from "../ui/CampaignShell";
import { CampaignManager } from "../campaign/CampaignManager";
import { ThemeManager } from "../ThemeManager";
import { MissionSetupManager } from "./MissionSetupManager";
import { SquadBuilder } from "../components/SquadBuilder";
import { CampaignNode } from "@src/shared/campaign_types";
import { MissionType, SquadConfig } from "@src/shared/types";
import { MainMenuScreen } from "../screens/MainMenuScreen";
import { CampaignScreen } from "../screens/CampaignScreen";
import { DebriefScreen } from "../screens/DebriefScreen";
import { EquipmentScreen } from "../screens/EquipmentScreen";
import { MissionSetupScreen } from "../screens/MissionSetupScreen";
import { CampaignSummaryScreen } from "../screens/CampaignSummaryScreen";
import { StatisticsScreen } from "../screens/StatisticsScreen";
import { EngineeringScreen } from "../screens/EngineeringScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ModalService } from "../ui/ModalService";
import { EventModal, OutcomeModal } from "../ui/EventModal";
import { PRNG } from "@src/shared/PRNG";
import { CampaignEvents } from "@src/content/CampaignEvents";

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
    private modalService: ModalService,
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
    console.log(`[NavigationOrchestrator] switchScreen: ${id}, isCampaign: ${isCampaign}`);
    // 1. Hide ALL screens to clear input contexts and DOM
    this.allScreens.forEach((s) => s.hide());

    // 2. Hide CampaignShell for non-campaign screens (Main Menu, Mission, etc.)
    if (id === "main-menu" || id === "mission") {
      console.log(`[NavigationOrchestrator] Hiding CampaignShell for ${id}`);
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

    // 5. Apply snappy tactical transition (Spec 8.1)
    const el = this.screenManager.getScreenElement(id);
    if (el) {
      // Remove both possible transition classes
      el.classList.remove("screen-fade-in", "screen-slide-up");
      // Trigger reflow to ensure the animation can restart if we switch back quickly
      void el.offsetWidth;
      // Default to fade-in for a clean, snappy feel (< 200ms)
      el.classList.add("screen-fade-in");
    }
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
          this.setupEquipmentScreen(true);
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
        this.setupEquipmentScreen(hasCampaign);
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
          this.setupEquipmentScreen(true);
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
        const isCurrentlyCampaign =
          isCampaign || !!this.missionSetupManager.currentCampaignNode;
        this.setupEquipmentScreen(isCurrentlyCampaign);
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

  private setupEquipmentScreen(isCampaign: boolean) {
    this.applyCampaignTheme();
    this.missionSetupManager.loadAndApplyConfig(isCampaign);
    this.screens.equipment.setCampaign(isCampaign);

    const node = this.missionSetupManager.currentCampaignNode;
    const isShop = node?.type === "Shop";
    this.screens.equipment.setShop(isShop);
    this.screens.equipment.setHasNodeSelected(!!node);

    this.screens.equipment.updateConfig(this.missionSetupManager.currentSquad);
    this.switchScreen("equipment", isCampaign);

    if (isCampaign) {
      this.campaignShell.show("campaign", "ready-room", true);
    } else {
      this.campaignShell.show("custom", "setup");
    }
  }

  public applyCampaignTheme() {
    const themeId = this.missionSetupManager.currentThemeId;
    this.themeManager.setTheme(themeId);
  }

  public onCampaignNodeSelect(node: CampaignNode) {
    if (node.type === "Shop") {
      this.missionSetupManager.currentCampaignNode = node;
      this.setupEquipmentScreen(true);
      return;
    }

    if (node.type === "Event") {
      const prng = new PRNG(node.mapSeed);
      const event =
        CampaignEvents[Math.floor(prng.next() * CampaignEvents.length)];

      const modal = new EventModal(this.modalService, (choice) => {
        const outcome = this.campaignManager.applyEventChoice(
          node.id,
          choice,
          prng,
        );

        const outcomeModal = new OutcomeModal(this.modalService, () => {
          if (outcome.ambush) {
            // Ambush triggers a combat mission at this node
            // The node type has been updated to Combat in the campaign state
            this.onCampaignNodeSelect(node);
          } else {
            this.switchScreen("campaign", true);
            this.campaignShell.show("campaign", "sector-map");
          }
        });
        outcomeModal.show(event.title, outcome.text);
      });
      modal.show(event);
      return;
    }

    this.missionSetupManager.currentCampaignNode = node;
    this.missionSetupManager.currentSeed = node.mapSeed;
    this.missionSetupManager.currentMissionType =
      node.missionType || MissionType.RecoverIntel;
    this.missionSetupManager.currentStaticMapData = undefined;

    this.missionSetupManager.saveCurrentConfig();
    this.setupEquipmentScreen(true);
  }

  private persistEquipment(config: SquadConfig) {
    config.soldiers.forEach((soldier) => {
      if (soldier.id) {
        this.campaignManager.assignEquipment(soldier.id, {
          rightHand: soldier.rightHand,
          leftHand: soldier.leftHand,
          body: soldier.body,
          feet: soldier.feet,
        });
      }
    });
    this.missionSetupManager.currentSquad = config;
    this.missionSetupManager.saveCurrentConfig();
  }

  public onEquipmentBack(config: SquadConfig) {
    const node = this.missionSetupManager.currentCampaignNode;
    this.persistEquipment(config);

    if (node) {
      if (node.type === "Shop") {
        // Clear the node upon exit
        this.campaignManager.advanceCampaignWithoutMission(node.id, 0, 0);
      }

      this.switchScreen("campaign", true);
      this.campaignShell.show("campaign", "sector-map");
    } else {
      this.missionSetupManager.loadAndApplyConfig(false);
      this.squadBuilder.update(
        this.missionSetupManager.currentSquad,
        this.missionSetupManager.currentMissionType,
        false,
      );
      this.switchScreen("mission-setup", false);
      this.campaignShell.show("custom", "setup");
    }
  }

  public onLaunchMission(config: SquadConfig) {
    this.persistEquipment(config);
    this.callbacks.launchMission();
  }

  public onShowSummary() {
    const state = this.campaignManager.getState();
    if (state) {
      this.switchScreen("campaign-summary", true, true, state);
    }
  }
}
