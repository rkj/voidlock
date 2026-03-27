import type { ScreenManager, ScreenId } from "../ScreenManager";
import type { CampaignShell, CampaignTabId, CampaignShellMode } from "../ui/CampaignShell";
import type { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import type { ThemeManager } from "../ThemeManager";
import type { MissionSetupManager } from "./MissionSetupManager";
import type { SquadBuilder } from "../components/SquadBuilder";
import type { CampaignNode } from "@src/shared/campaign_types";
import type { SquadConfig } from "@src/shared/types";
import { MissionType } from "@src/shared/types";
import type { MainMenuScreen } from "../screens/MainMenuScreen";
import type { CampaignScreen } from "../screens/CampaignScreen";
import type { DebriefScreen } from "../screens/DebriefScreen";
import type { EquipmentScreen } from "../screens/EquipmentScreen";
import type { MissionSetupScreen } from "../screens/MissionSetupScreen";
import type { CampaignSummaryScreen } from "../screens/CampaignSummaryScreen";
import type { StatisticsScreen } from "../screens/StatisticsScreen";
import type { EngineeringScreen } from "../screens/EngineeringScreen";
import type { SettingsScreen } from "../screens/SettingsScreen";
import type { ModalService } from "../ui/ModalService";
import { EventModal, OutcomeModal } from "../ui/EventModal";
import { PRNG } from "@src/shared/PRNG";
import { CampaignEvents } from "@src/content/CampaignEvents";
import type { TutorialManager } from "../controllers/TutorialManager";
import { Logger } from "@src/shared/Logger";

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

export interface NavigationOrchestratorCallbacks {
  showMainMenu: () => void;
  launchMission: () => void;
  resumeMission: () => void;
}

export interface NavigationOrchestratorConfig {
  screenManager: ScreenManager;
  campaignShell: CampaignShell;
  campaignManager: CampaignManager;
  themeManager: ThemeManager;
  modalService: ModalService;
  missionSetupManager: MissionSetupManager;
  squadBuilder: SquadBuilder;
  screens: NavigationScreens;
  tutorialManager: TutorialManager;
  callbacks: NavigationOrchestratorCallbacks;
}

export interface SwitchScreenParams {
  id: ScreenId;
  isCampaign?: boolean;
  updateHash?: boolean;
  force?: boolean;
  showArgs?: unknown[];
}


export class NavigationOrchestrator {
  private screenManager: ScreenManager;
  private campaignShell: CampaignShell;
  private campaignManager: CampaignManager;
  private themeManager: ThemeManager;
  private modalService: ModalService;
  private missionSetupManager: MissionSetupManager;
  private squadBuilder: SquadBuilder;
  private screens: NavigationScreens;
  private tutorialManager: TutorialManager;
  private callbacks: NavigationOrchestratorCallbacks;

  constructor(config: NavigationOrchestratorConfig) {
    this.screenManager = config.screenManager;
    this.campaignShell = config.campaignShell;
    this.campaignManager = config.campaignManager;
    this.themeManager = config.themeManager;
    this.modalService = config.modalService;
    this.missionSetupManager = config.missionSetupManager;
    this.squadBuilder = config.squadBuilder;
    this.screens = config.screens;
    this.tutorialManager = config.tutorialManager;
    this.callbacks = config.callbacks;
  }

  /**
   * Centralized screen switcher that ensures all other screens are hidden
   * (and their input contexts popped) before showing the target screen.
   */
  public switchScreen(
    id: ScreenId,
    isCampaign: boolean = false,
    updateHash: boolean = true,
    force: boolean = false,
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
      screenObj.show();
    }

    // 4. Update ScreenManager (DOM display and Hash)
    this.screenManager.showEx({ id, updateHash, isCampaign, force });

    // 5. Trigger tutorial hooks
    this.tutorialManager.onScreenShow(id);

    // 6. Apply snappy tactical transition (Spec 8.1)
    this.applyScreenTransition(id);
  }

  private applyScreenTransition(id: ScreenId) {
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

  /**
   * Switches to screen and then calls show() with extra args on the screen object.
   */
  public switchScreenWithArgs(params: SwitchScreenParams) {
    const { id, isCampaign = false, updateHash = true, force = false, showArgs = [] } = params;

    // 1. Hide ALL screens to clear input contexts and DOM
    this.allScreens.forEach((s) => s.hide());

    // 2. Hide CampaignShell for non-campaign screens (Main Menu, Mission, etc.)
    if (id === "main-menu" || id === "mission") {
      this.campaignShell.hide();
    }

    // 3. Show target screen object with args
    const screenObj = this.getScreenObject(id);
    if (screenObj) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (screenObj.show as (...args: any[]) => void)(...showArgs);
    }

    // 4. Update ScreenManager (DOM display and Hash)
    this.screenManager.showEx({ id, updateHash, isCampaign, force });

    // 5. Trigger tutorial hooks
    this.tutorialManager.onScreenShow(id);

    // 6. Apply snappy tactical transition (Spec 8.1)
    this.applyScreenTransition(id);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getScreenObject(id: ScreenId): { show: (...args: any[]) => void; hide: () => void } | null {
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
        const hasCampaignState = !!this.campaignManager.getState();
        this.setupEquipmentScreen(hasCampaignState);
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

    this.campaignShell.show(
      mode,
      actualTabId,
      true,
      hasCampaign ? this.missionSetupManager.currentMissionType : null,
    );
  }

  public handleExternalScreenChange(
    id: ScreenId,
    isCampaign: boolean = false,
  ) {
    Logger.info(`NavOrch: handleExternalScreenChange(${id}, isCampaign=${isCampaign})`);
    switch (id) {
      case "campaign":
        this.handleCampaignScreen();
        break;
      case "campaign-summary":
        this.handleCampaignSummaryScreen();
        break;
      case "mission-setup":
        this.handleMissionSetupScreen(isCampaign);
        break;
      case "equipment":
        this.handleEquipmentScreen(isCampaign);
        break;
      case "statistics":
        this.handleStatisticsScreen(isCampaign);
        break;
      case "engineering":
        this.handleEngineeringScreen(isCampaign);
        break;
      case "settings":
        this.handleSettingsScreen(isCampaign);
        break;
      case "main-menu":
        this.callbacks.showMainMenu();
        break;
      case "mission":
        this.campaignShell.hide();
        this.callbacks.resumeMission();
        break;
    }
  }

  private handleCampaignScreen() {
    this.applyCampaignTheme();
    const state = this.campaignManager.getState();
    Logger.info(`NavOrch: handleExternalScreenChange(campaign), history=${state?.history?.length}`);

    if (state && state.history?.length === 2 && !state.rules.skipPrologue) {
      this.tutorialManager.triggerEvent("sector_map_intro");
    }

    if (state && (state.status === "Victory" || state.status === "Defeat")) {
      this.switchScreenWithArgs({ id: "campaign-summary", isCampaign: true, updateHash: true, force: true, showArgs: [state] });
    } else {
      this.switchScreen("campaign", true, true, true);
      this.campaignShell.show(
        "campaign",
        "sector-map",
        true,
        this.missionSetupManager.currentMissionType,
      );
    }
  }

  private handleCampaignSummaryScreen() {
    const state = this.campaignManager.getState();
    if (state) {
      this.switchScreenWithArgs({ id: "campaign-summary", isCampaign: true, updateHash: true, force: true, showArgs: [state] });
    } else {
      this.callbacks.showMainMenu();
    }
  }

  private handleMissionSetupScreen(isCampaign: boolean) {
    const rehydrated = isCampaign
      ? this.missionSetupManager.rehydrateCampaignNode()
      : false;

    if (rehydrated) {
      this.setupEquipmentScreen(true);
    } else {
      this.missionSetupManager.loadAndApplyConfig(false);
      this.campaignShell.show("custom", "setup");
      this.squadBuilder.update(
        this.missionSetupManager.currentSquad,
        this.missionSetupManager.currentMissionType,
        false,
      );
      this.switchScreen("mission-setup", false, true, true);
    }
  }

  private handleEquipmentScreen(isCampaign: boolean) {
    if (isCampaign && !this.missionSetupManager.currentCampaignNode) {
      this.missionSetupManager.rehydrateCampaignNode();
    }
    const isCurrentlyCampaign =
      isCampaign || !!this.missionSetupManager.currentCampaignNode;
    this.setupEquipmentScreen(isCurrentlyCampaign);
  }

  private handleStatisticsScreen(isCampaign: boolean) {
    this.switchScreen("statistics", false, true, true);
    const isCustomFlow =
      !isCampaign &&
      this.missionSetupManager.currentCampaignNode === null &&
      !this.campaignManager.getState();
    if (isCustomFlow) {
      this.campaignShell.show("custom", "stats");
    } else {
      this.campaignShell.show(
        "statistics",
        "stats",
        true,
        this.missionSetupManager.currentMissionType,
      );
    }
  }

  private handleEngineeringScreen(isCampaign: boolean) {
    const hasCampaign = isCampaign || !!this.campaignManager.getState();
    this.switchScreen("engineering", hasCampaign, true, true);
    if (hasCampaign) {
      this.campaignShell.show(
        "campaign",
        "engineering",
        true,
        this.missionSetupManager.currentMissionType,
      );
    } else {
      this.campaignShell.show("statistics", "engineering");
    }
  }

  private handleSettingsScreen(isCampaign: boolean) {
    const state = this.campaignManager.getState();
    const isCustomFlow =
      !isCampaign && this.missionSetupManager.currentCampaignNode === null;
    this.switchScreen("settings", isCampaign || !!state || isCustomFlow, true, true);
    if (state) {
      this.campaignShell.show(
        "campaign",
        "settings",
        true,
        this.missionSetupManager.currentMissionType,
      );
    } else if (isCustomFlow) {
      this.campaignShell.show("custom", "settings");
    } else {
      this.campaignShell.show("global", "settings", false);
    }
  }

  private setupEquipmentScreen(isCampaign: boolean) {
    this.applyCampaignTheme();
    this.missionSetupManager.loadAndApplyConfig(isCampaign);
    this.screens.equipment.setCampaign(isCampaign);

    const state = this.campaignManager.getState();
    const node = this.missionSetupManager.currentCampaignNode;
    const isPrologue = isCampaign && (
      node?.missionType === MissionType.Prologue ||
      this.missionSetupManager.currentMissionType === MissionType.Prologue
    );
    const isMission2Tutorial = isCampaign && state?.history?.length === 1 && !state?.rules.skipPrologue;

    this.configureEquipmentScreenLocks(isPrologue, isMission2Tutorial);
    this.triggerEquipmentTutorials(isCampaign, isMission2Tutorial, state);

    const isShop = node?.type === "Shop";
    this.screens.equipment.setShop(isShop);
    this.screens.equipment.setHasNodeSelected(!!node);

    this.screens.equipment.updateConfig(this.missionSetupManager.currentSquad);
    this.switchScreen("equipment", isCampaign);

    if (isCampaign) {
      this.campaignShell.show(
        "campaign",
        "ready-room",
        true,
        (isPrologue || isMission2Tutorial) ? MissionType.Prologue : null,
      );
    } else {
      this.campaignShell.show("custom", "setup");
    }
  }

  private configureEquipmentScreenLocks(isPrologue: boolean, isMission2Tutorial: boolean) {
    this.screens.equipment.setPrologue(isPrologue);
    this.screens.equipment.setStoreLocked(isMission2Tutorial || isPrologue);
    this.screens.equipment.setSquadSelectionLocked(isMission2Tutorial || isPrologue);
  }

  private triggerEquipmentTutorials(
    isCampaign: boolean,
    isMission2Tutorial: boolean,
    state: ReturnType<typeof this.campaignManager.getState>,
  ) {
    if (isMission2Tutorial) {
      this.tutorialManager.triggerEvent("ready_room_intro");
    }
    if (isCampaign && state?.history?.length === 2 && !state?.rules.skipPrologue) {
      this.tutorialManager.triggerEvent("squad_selection_intro");
    }
  }

  public applyCampaignTheme() {
    const themeId = this.missionSetupManager.currentThemeId;
    this.themeManager.setTheme(themeId);
  }

  public onCampaignNodeSelect(node: CampaignNode) {
    // Ensure the engine's state reflects the selected node (Fixes voidlock-fxlcc)
    this.campaignManager.selectNode(node.id);

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
        void outcomeModal.show(event.title, outcome.text);
      });
      void modal.show(event);
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
    if (config.soldiers.filter(s => !!s).length === 0) {
      void this.modalService.alert("Squad cannot be empty. Please select at least one soldier.");
      return;
    }
    this.persistEquipment(config);
    this.callbacks.launchMission();
  }

  public onShowSummary() {
    const state = this.campaignManager.getState();
    if (state) {
      this.switchScreenWithArgs({ id: "campaign-summary", isCampaign: true, updateHash: true, force: false, showArgs: [state] });
    }
  }
}
