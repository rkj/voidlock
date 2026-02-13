import { AppContext } from "./AppContext";
import { InputBinder } from "./InputBinder";
import { GameClient } from "@src/engine/GameClient";
import {
  MapGeneratorType,
  MissionType,
  SquadConfig,
  UnitState,
  MapGenerationConfig,
  GameState,
  Unit,
  CommandType,
} from "@src/shared/types";
import {
  calculateSpawnPoints,
  CampaignNode,
  MissionReport,
} from "@src/shared/campaign_types";
import { DebugUtility } from "@src/renderer/DebugUtility";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { ModalService } from "@src/renderer/ui/ModalService";
import {
  CampaignShell,
  CampaignTabId,
  CampaignShellMode,
} from "@src/renderer/ui/CampaignShell";
import pkg from "../../../package.json";
import { ConfigManager } from "../ConfigManager";
import { MissionCoordinator } from "./MissionCoordinator";
import { CampaignFlowCoordinator } from "./CampaignFlowCoordinator";
import { MissionSetupManager } from "./MissionSetupManager";
import { CampaignScreen } from "../screens/CampaignScreen";
import { BarracksScreen } from "../screens/BarracksScreen";
import { DebriefScreen } from "../screens/DebriefScreen";
import { EquipmentScreen } from "../screens/EquipmentScreen";
import { MissionSetupScreen } from "../screens/MissionSetupScreen";
import { CampaignSummaryScreen } from "../screens/CampaignSummaryScreen";
import { StatisticsScreen } from "../screens/StatisticsScreen";
import { EngineeringScreen } from "../screens/EngineeringScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { MainMenuScreen } from "../screens/MainMenuScreen";
import { ThemeManager } from "../ThemeManager";
import { CampaignManager } from "../campaign/CampaignManager";
import { ScreenManager, ScreenId } from "../ScreenManager";
import { MapFactory } from "@src/engine/map/MapFactory";
import { MenuController } from "../MenuController";
import { HUDManager } from "../ui/HUDManager";
import { InputManager } from "../InputManager";
import { AssetManager } from "../visuals/AssetManager";
import { Logger, LogLevel } from "@src/shared/Logger";
import { GlobalShortcuts } from "../GlobalShortcuts";
import { TooltipManager } from "../ui/TooltipManager";

const VERSION = pkg.version;

export class GameApp {
  private context: AppContext;
  private inputBinder: InputBinder;
  private missionCoordinator: MissionCoordinator;
  private campaignFlowCoordinator: CampaignFlowCoordinator;
  private missionSetupManager: MissionSetupManager;

  // screens
  private campaignScreen!: CampaignScreen;
  private barracksScreen!: BarracksScreen;
  private debriefScreen!: DebriefScreen;
  private equipmentScreen!: EquipmentScreen;
  private missionSetupScreen!: MissionSetupScreen;
  private campaignSummaryScreen!: CampaignSummaryScreen;
  private statisticsScreen!: StatisticsScreen;
  private engineeringScreen!: EngineeringScreen;
  private settingsScreen!: SettingsScreen;
  private mainMenuScreen!: MainMenuScreen;

  // app state
  private selectedUnitId: string | null = null;
  private currentGameState: GameState | null = null;

  constructor() {
    this.context = new AppContext();
    this.inputBinder = new InputBinder(this.context);
    this.missionCoordinator = new MissionCoordinator(this.context);
    this.campaignFlowCoordinator = new CampaignFlowCoordinator(this.context);
    this.missionSetupManager = new MissionSetupManager(this.context);
  }

  public async initialize() {
    // 1. Initialize core managers
    const globalConfig = ConfigManager.loadGlobal();
    Logger.setLevel(LogLevel[globalConfig.logLevel as keyof typeof LogLevel]);

    await ThemeManager.getInstance().init();
    this.context.themeManager = ThemeManager.getInstance();
    // Ensure sprites are loaded now that the asset manifest is available
    AssetManager.getInstance().loadSprites();
    this.context.campaignManager = CampaignManager.getInstance();

    // Initialize cloudSync from SaveManager
    const storage = (this.context.campaignManager as any).getStorage
      ? this.context.campaignManager.getStorage()
      : null;
    if (storage && "getCloudSync" in storage) {
      this.context.cloudSync = (storage as any).getCloudSync();
      await this.context.cloudSync.initialize();
    }

    await this.context.campaignManager.load();
    this.context.modalService = new ModalService();
    this.context.screenManager = new ScreenManager((id) =>
      this.handleExternalScreenChange(id),
    );

    this.context.campaignShell = new CampaignShell(
      "screen-campaign-shell",
      this.context.campaignManager,
      (tabId) => this.onShellTabChange(tabId),
      () => this.showMainMenu(),
    );

    this.mainMenuScreen = new MainMenuScreen("screen-main-menu");
    this.context.mainMenuScreen = this.mainMenuScreen;
    this.missionSetupScreen = new MissionSetupScreen(
      "screen-mission-setup",
      () => {
        this.context.screenManager.goBack();
        const screen = this.context.screenManager.getCurrentScreen();
        if (screen === "campaign") {
          this.context.campaignShell.show("campaign", "sector-map");
        } else {
          this.context.campaignShell.hide();
          this.showMainMenu();
        }
      },
    );
    this.context.missionSetupScreen = this.missionSetupScreen;

    const mapGeneratorFactory = (config: MapGenerationConfig): MapFactory => {
      return new MapFactory(config);
    };
    this.context.gameClient = new GameClient((config) =>
      mapGeneratorFactory(config),
    );
    this.context.menuController = new MenuController(this.context.gameClient);

    // 2. Initialize UI managers
    this.context.hudManager = new HUDManager(
      this.context.menuController,
      (unit, shift) => this.onUnitClick(unit, shift),
      () => this.abortMission(),
      (key, shift) => this.handleMenuInput(key, shift),
      (scale) => {
        this.context.gameClient.setTimeScale(scale);
        this.syncSpeedUI();
      },
      () => this.copyWorldState(),
      () => this.context.gameClient.forceWin(),
      () => this.context.gameClient.forceLose(),
      () =>
        this.context.gameClient.applyCommand({
          type: CommandType.START_MISSION,
        }),
      (unitId, x, y) =>
        this.context.gameClient.applyCommand({
          type: CommandType.DEPLOY_UNIT,
          unitId,
          target: { x, y },
        }),
    );

    this.context.inputManager = new InputManager(
      this.context.screenManager,
      this.context.menuController,
      this.context.modalService,
      () => this.togglePause(),
      (key, shift) => this.handleMenuInput(key, shift),
      () => this.abortMission(),
      () => {
        this.selectedUnitId = null;
        if (this.currentGameState) this.updateUI(this.currentGameState);
      },
      () => this.selectedUnitId,
      (e) => this.handleCanvasClick(e),
      (enabled) => this.context.gameClient.toggleDebugOverlay(enabled),
      (enabled) => this.context.gameClient.toggleLosOverlay(enabled),
      () => this.currentGameState,
      () => this.debriefScreen.isVisible(),
      (unitId, x, y) =>
        this.context.gameClient.applyCommand({
          type: CommandType.DEPLOY_UNIT,
          unitId,
          target: { x, y },
        }),
      (px, py) => this.context.renderer!.getCellCoordinates(px, py),
      (reverse) => this.cycleUnits(reverse),
      (direction) => this.panMap(direction),
      (dx, dy) => this.panMapBy(dx, dy),
      (ratio, cx, cy) => this.zoomMap(ratio, cx, cy),
    );

    // 3. Initialize screens
    this.campaignSummaryScreen = new CampaignSummaryScreen(
      "screen-campaign-summary",
      () => {
        this.campaignSummaryScreen.hide();
        this.context.gameClient.stop();
        ConfigManager.clearCampaign();
        this.context.campaignManager.deleteSave();
        this.showMainMenu();
      },
    );

    this.debriefScreen = new DebriefScreen(
      "screen-debrief",
      this.context.gameClient,
      () => {
        this.debriefScreen.hide();
        this.context.gameClient.stop();

        const state = this.context.campaignManager.getState();
        if (
          state &&
          (state.status === "Victory" || state.status === "Defeat")
        ) {
          this.switchScreen("campaign-summary", true, true, state);
          return;
        }

        if (this.missionSetupManager.currentCampaignNode) {
          this.switchScreen("campaign", true);
          this.context.campaignShell.show("campaign", "sector-map");
        } else {
          this.context.campaignShell.hide();
          this.showMainMenu();
        }
      },
      () => {
        this.debriefScreen.hide();
        this.context.gameClient.stop();
        this.launchMission();
      },
      () => this.exportReplay(),
    );

    this.barracksScreen = new BarracksScreen(
      "screen-barracks",
      this.context.campaignManager,
      this.context.modalService,
      () => {
        this.switchScreen("campaign", true);
        this.context.campaignShell.show("campaign", "sector-map");
      },
      () => this.context.campaignShell.refresh(),
    );

    this.campaignScreen = new CampaignScreen(
      "screen-campaign",
      this.context,
      (node) => this.onCampaignNodeSelect(node),
      () => this.showMainMenu(),
      () => this.onCampaignStart(),
      () => this.onShowSummary(),
    );

    this.equipmentScreen = new EquipmentScreen(
      "screen-equipment",
      this.context.campaignManager,
      this.missionSetupManager.currentSquad,
      (config) => this.onEquipmentConfirmed(config),
      () => {
        this.context.screenManager.goBack();
        const screen = this.context.screenManager.getCurrentScreen();
        this.handleExternalScreenChange(
          screen,
          !!this.context.campaignManager.getState(),
        );
      },
      () => this.context.campaignShell.refresh(),
      false, // isShop
      false, // isCampaign
    );

    this.statisticsScreen = new StatisticsScreen("screen-statistics");
    this.engineeringScreen = new EngineeringScreen("screen-engineering", () =>
      this.context.campaignShell.refresh(),
    );
    this.settingsScreen = new SettingsScreen(
      "screen-settings",
      this.context,
      () => {
        this.context.screenManager.goBack();
        const screen = this.context.screenManager.getCurrentScreen();
        this.handleExternalScreenChange(
          screen,
          !!this.context.campaignManager.getState(),
        );
      },
    );

    // Special bindings that were in main.ts
    this.setupAdditionalUIBindings();

    // 4. Bind events
    this.inputBinder.bindAll({
      onTogglePause: () => this.togglePause(),
      onAbortMission: () => this.abortMission(),
      onCustomMission: () => {
        this.missionSetupManager.currentCampaignNode = null;
        this.missionSetupManager.loadAndApplyConfig(false);
        this.context.campaignShell.show("custom", "setup");
        this.switchScreen("mission-setup", false);
      },
      onCampaignMenu: () => {
        this.campaignFlowCoordinator.onCampaignMenu(
          () => this.applyCampaignTheme(),
          (state) => this.switchScreen("campaign-summary", true, true, state),
          () => this.switchScreen("campaign", true),
        );
      },
      onResetData: () => this.campaignFlowCoordinator.onResetData(),
      onShowEquipment: () => {
        const isCampaign = !!this.missionSetupManager.currentCampaignNode;
        this.equipmentScreen.setCampaign(isCampaign);
        this.equipmentScreen.updateConfig(
          this.missionSetupManager.currentSquad,
        );
        this.switchScreen("equipment", isCampaign);
        if (isCampaign) {
          this.context.campaignShell.show("campaign", "sector-map", false);
        } else {
          this.context.campaignShell.show("custom");
        }
      },
      onLoadStaticMap: (json) => this.missionSetupManager.loadStaticMap(json),
      onUploadStaticMap: (file) =>
        this.missionSetupManager.uploadStaticMap(file),
      onConvertAscii: (ascii) => this.missionSetupManager.convertAscii(ascii),
      onExportReplay: () => this.exportReplay(),
      onShowStatistics: () => {
        this.switchScreen("statistics", false);
        this.context.campaignShell.show("statistics", "stats");
      },
      onEngineeringMenu: () => {
        const state = this.context.campaignManager.getState();
        this.switchScreen("engineering", !!state);
        if (state) {
          this.context.campaignShell.show("campaign", "engineering");
        } else {
          this.context.campaignShell.show("statistics", "engineering");
        }
      },
      onSettingsMenu: () => {
        const state = this.context.campaignManager.getState();
        this.switchScreen("settings", !!state);
        if (state) {
          this.context.campaignShell.show("campaign", "settings");
        } else {
          this.context.campaignShell.show("global", "settings", false);
        }
      },
      onSetupBack: () => {
        this.context.screenManager.goBack();
        const screen = this.context.screenManager.getCurrentScreen();
        if (screen === "campaign") {
          this.context.campaignShell.show("campaign", "sector-map");
        } else {
          this.context.campaignShell.hide();
        }
      },
      onLaunchMission: () => this.launchMission(),
      onMapGeneratorChange: (type: MapGeneratorType) => {
        if (this.missionSetupManager.currentMapGeneratorType === type) return;
        this.missionSetupManager.currentMapGeneratorType = type;
        this.missionSetupManager.saveCurrentConfig();
      },
      onMissionTypeChange: (type: MissionType) => {
        this.missionSetupManager.currentMissionType = type;
        if (
          this.missionSetupManager.currentMissionType === MissionType.EscortVIP
        ) {
          this.missionSetupManager.currentSquad.soldiers =
            this.missionSetupManager.currentSquad.soldiers.filter(
              (s) => s.archetypeId !== "vip",
            );
        }
        this.missionSetupManager.saveCurrentConfig();
      },
      onThemeChange: (themeId: string) => {
        this.missionSetupManager.currentThemeId = themeId;
        this.missionSetupManager.saveCurrentConfig();
        this.context.themeManager.setTheme(themeId);
      },
      onUnitStyleChange: (style: string) => {
        this.missionSetupManager.unitStyle = style as any;
        this.missionSetupManager.saveCurrentConfig();
      },
      onToggleFog: (enabled: boolean) => {
        this.missionSetupManager.fogOfWarEnabled = enabled;
        this.missionSetupManager.saveCurrentConfig();
      },
      onToggleDebug: (enabled: boolean) => {
        this.missionSetupManager.debugOverlayEnabled = enabled;
        this.missionSetupManager.saveCurrentConfig();
      },
      onToggleLos: (enabled: boolean) => {
        this.missionSetupManager.losOverlayEnabled = enabled;
        this.missionSetupManager.saveCurrentConfig();
      },
      onToggleAi: (enabled: boolean) => {
        this.missionSetupManager.agentControlEnabled = enabled;
        this.missionSetupManager.saveCurrentConfig();
      },
      onToggleManualDeployment: (enabled: boolean) => {
        this.missionSetupManager.manualDeployment = enabled;
        this.missionSetupManager.saveCurrentConfig();
      },
      onTogglePauseAllowed: (enabled: boolean) => {
        this.missionSetupManager.allowTacticalPause = enabled;
        this.missionSetupManager.saveCurrentConfig();
      },
      onMapSizeChange: (width: number, _height: number) => {
        if (this.missionSetupManager.currentCampaignNode) return;
        this.missionSetupManager.currentMapWidth = width;
        this.missionSetupManager.currentMapHeight = _height;
        this.missionSetupManager.currentSpawnPointCount =
          calculateSpawnPoints(width);
        const spInput = document.getElementById(
          "map-spawn-points",
        ) as HTMLInputElement;
        const spValue = document.getElementById("map-spawn-points-value");
        if (spInput) {
          spInput.value =
            this.missionSetupManager.currentSpawnPointCount.toString();
          if (spValue) spValue.textContent = spInput.value;
        }
        this.missionSetupManager.saveCurrentConfig();
      },
      onLoadReplay: (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          try {
            const data = JSON.parse(content);
            const replayData = data.replayData || data;
            const currentState = data.currentState as GameState | undefined;

            if (replayData && replayData.commands) {
              this.context.gameClient.loadReplay(replayData);

              let report: MissionReport;
              // If we have current state, we can construct a detailed report
              if (currentState) {
                report = {
                  nodeId: "custom",
                  seed: currentState.seed,
                  result: currentState.status === "Won" ? "Won" : "Lost",
                  aliensKilled: currentState.stats.aliensKilled,
                  scrapGained: currentState.stats.scrapGained,
                  intelGained: 0,
                  timeSpent: currentState.t,
                  soldierResults: currentState.units.map((u) => ({
                    soldierId: u.id,
                    name: u.name,
                    tacticalNumber: u.tacticalNumber,
                    xpBefore: 0,
                    xpGained: 0,
                    kills: u.kills,
                    promoted: false,
                    status: u.state === UnitState.Dead ? "Dead" : "Healthy",
                  })),
                };
              } else {
                // Fallback report for replay-only data (Spec 8.2 / voidlock-l9bv)
                report = {
                  nodeId: "custom",
                  seed: replayData.seed || 0,
                  result: "Won", // Default for visualization
                  aliensKilled: 0,
                  scrapGained: 0,
                  intelGained: 0,
                  timeSpent:
                    replayData.commands.length > 0
                      ? replayData.commands[replayData.commands.length - 1].t
                      : 0,
                  soldierResults: (replayData.squadConfig?.soldiers || []).map(
                    (s: any, idx: number) => ({
                      soldierId: s.id || `s-${idx}`,
                      name: s.name || s.archetypeId || "Unknown",
                      tacticalNumber: s.tacticalNumber || idx + 1,
                      xpBefore: 0,
                      xpGained: 0,
                      kills: 0,
                      promoted: false,
                      status: "Healthy",
                    }),
                  ),
                };
              }

              this.switchScreen(
                "debrief",
                false,
                true,
                report,
                this.missionSetupManager.unitStyle,
              );
            } else {
              this.context.modalService.alert("Invalid replay file format.");
            }
          } catch (err) {
            this.context.modalService.alert("Failed to parse replay file.");
          }
        };
        reader.readAsText(file);
      },
    });

    this.context.inputManager.init();

    const globalShortcuts = new GlobalShortcuts(
      () => this.togglePause(),
      () => this.context.screenManager.goBack(),
    );
    globalShortcuts.init();

    TooltipManager.getInstance();

    // Initial UI state
    this.missionSetupManager.loadAndApplyConfig(false);
    const mvEl = document.getElementById("menu-version");
    if (mvEl) mvEl.textContent = `v${VERSION}`;

    this.setupResponsiveDrawers();
  }

  private setupResponsiveDrawers() {
    const toggleSquad = document.getElementById("btn-toggle-squad");
    const toggleRight = document.getElementById("btn-toggle-right");
    const soldierPanel = document.getElementById("soldier-panel");
    const rightPanel = document.getElementById("right-panel");

    if (toggleSquad && soldierPanel) {
      toggleSquad.addEventListener("click", () => {
        soldierPanel.classList.toggle("active");
        if (rightPanel) rightPanel.classList.remove("active");
      });
    }

    if (toggleRight && rightPanel) {
      toggleRight.addEventListener("click", () => {
        rightPanel.classList.toggle("active");
        if (soldierPanel) soldierPanel.classList.remove("active");
      });
    }

    // Close drawers when clicking the game area
    const gameContainer = document.getElementById("game-container");
    if (gameContainer) {
      gameContainer.addEventListener("click", () => {
        if (window.innerWidth < 768) {
          if (soldierPanel) soldierPanel.classList.remove("active");
          if (rightPanel) rightPanel.classList.remove("active");
        }
      });
    }
  }

  private showMainMenu() {
    this.switchScreen("main-menu");
  }

  /**
   * Centralized screen switcher that ensures all other screens are hidden
   * (and their input contexts popped) before showing the target screen.
   */
  private switchScreen(
    id: ScreenId,
    isCampaign: boolean = false,
    updateHash: boolean = true,
    ...showArgs: any[]
  ) {
    // 1. Hide ALL screens to clear input contexts and DOM
    this.allScreens.forEach((s) => s.hide());

    // 2. Hide CampaignShell for non-campaign screens (Main Menu, Mission, etc.)
    if (id === "main-menu" || id === "mission") {
      this.context.campaignShell.hide();
    }

    // 3. Show target screen object
    const screenObj = this.getScreenObject(id);
    if (screenObj) {
      (screenObj.show as any)(...showArgs);
    }

    // 4. Update ScreenManager (DOM display and Hash)
    this.context.screenManager.show(id, updateHash, isCampaign);
  }

  private get allScreens(): { hide: () => void }[] {
    return [
      this.mainMenuScreen,
      this.campaignScreen,
      this.barracksScreen,
      this.debriefScreen,
      this.equipmentScreen,
      this.missionSetupScreen,
      this.campaignSummaryScreen,
      this.statisticsScreen,
      this.engineeringScreen,
      this.settingsScreen,
    ].filter((s) => !!s);
  }

  private getScreenObject(id: ScreenId): any {
    switch (id) {
      case "main-menu":
        return this.mainMenuScreen;
      case "campaign":
        return this.campaignScreen;
      case "mission-setup":
        return this.missionSetupScreen;
      case "equipment":
        return this.equipmentScreen;
      case "barracks":
        return this.barracksScreen;
      case "debrief":
        return this.debriefScreen;
      case "campaign-summary":
        return this.campaignSummaryScreen;
      case "statistics":
        return this.statisticsScreen;
      case "engineering":
        return this.engineeringScreen;
      case "settings":
        return this.settingsScreen;
      default:
        return null;
    }
  }

  private onShellTabChange(tabId: CampaignTabId) {
    const hasCampaign = !!this.context.campaignManager.getState();
    const isCustomFlow =
      !hasCampaign && this.missionSetupManager.currentCampaignNode === null;

    let mode: CampaignShellMode = hasCampaign ? "campaign" : "statistics";
    if (
      isCustomFlow &&
      (tabId === "setup" || tabId === "settings" || tabId === "stats")
    ) {
      mode = "custom";
    }

    switch (tabId) {
      case "setup":
        this.switchScreen("mission-setup", isCustomFlow ? false : hasCampaign);
        break;
      case "sector-map":
        this.switchScreen("campaign", true);
        break;
      case "barracks":
        this.switchScreen("barracks", true);
        break;
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

    this.context.campaignShell.show(mode, tabId);
  }

  public start() {
    const persisted = this.context.screenManager.loadPersistedState();
    if (persisted) {
      this.handleExternalScreenChange(persisted.screenId, persisted.isCampaign);
    } else {
      this.showMainMenu();
    }
  }

  private handleExternalScreenChange(
    id: ScreenId,
    isCampaign: boolean = false,
  ) {
    switch (id) {
      case "campaign": {
        this.applyCampaignTheme();
        const state = this.context.campaignManager.getState();
        if (
          state &&
          (state.status === "Victory" || state.status === "Defeat")
        ) {
          this.switchScreen("campaign-summary", true, true, state);
        } else {
          this.switchScreen("campaign", true);
          this.context.campaignShell.show("campaign", "sector-map");
        }
        break;
      }
      case "campaign-summary": {
        const state = this.context.campaignManager.getState();
        if (state) {
          this.switchScreen("campaign-summary", true, true, state);
        } else {
          this.showMainMenu();
        }
        break;
      }
      case "mission-setup": {
        const rehydrated = isCampaign
          ? this.missionSetupManager.rehydrateCampaignNode()
          : false;

        // If in campaign, redirect mission-setup to equipment
        if (rehydrated && isCampaign) {
          this.applyCampaignTheme();
          this.missionSetupManager.loadAndApplyConfig(true);
          this.equipmentScreen.setCampaign(true);
          this.equipmentScreen.updateConfig(
            this.missionSetupManager.currentSquad,
          );
          this.switchScreen("equipment", true);
          this.context.campaignShell.show("campaign", "sector-map", false);
          break;
        }

        this.missionSetupManager.loadAndApplyConfig(rehydrated);
        if (rehydrated) {
          this.applyCampaignTheme();
          this.context.campaignShell.show("campaign", "sector-map", false);
        } else {
          this.context.campaignShell.show("custom", "setup");
        }
        this.switchScreen("mission-setup", rehydrated);
        break;
      }
      case "equipment": {
        if (isCampaign && !this.missionSetupManager.currentCampaignNode) {
          this.missionSetupManager.rehydrateCampaignNode();
        }
        this.applyCampaignTheme();
        const isCurrentlyCampaign =
          isCampaign || !!this.missionSetupManager.currentCampaignNode;
        this.equipmentScreen.setCampaign(isCurrentlyCampaign);
        this.equipmentScreen.updateConfig(
          this.missionSetupManager.currentSquad,
        );
        this.switchScreen("equipment", isCurrentlyCampaign);
        if (isCurrentlyCampaign) {
          this.context.campaignShell.show("campaign", "sector-map", false);
        } else {
          this.context.campaignShell.show("custom", "setup");
        }
        break;
      }
      case "barracks":
        this.applyCampaignTheme();
        this.switchScreen("barracks", true);
        this.context.campaignShell.show("campaign", "barracks");
        break;
      case "statistics":
        this.switchScreen("statistics", false);
        if (
          !isCampaign &&
          this.missionSetupManager.currentCampaignNode === null &&
          !this.context.campaignManager.getState()
        ) {
          this.context.campaignShell.show("custom", "stats");
        } else {
          this.context.campaignShell.show("statistics", "stats");
        }
        break;
      case "engineering":
        this.switchScreen("engineering", isCampaign || !!this.context.campaignManager.getState());
        if (isCampaign || this.context.campaignManager.getState()) {
          this.context.campaignShell.show("campaign", "engineering");
        } else {
          this.context.campaignShell.show("statistics", "engineering");
        }
        break;
      case "settings": {
        const state = this.context.campaignManager.getState();
        const isCustomFlow =
          !isCampaign && this.missionSetupManager.currentCampaignNode === null;
        this.switchScreen("settings", isCampaign || !!state || isCustomFlow);
        if (state) {
          this.context.campaignShell.show("campaign", "settings");
        } else if (isCustomFlow) {
          this.context.campaignShell.show("custom", "settings");
        } else {
          this.context.campaignShell.show("global", "settings", false);
        }
        break;
      }
      case "mission":
        this.context.campaignShell.hide();
        this.resumeMission();
        break;
      case "main-menu":
        this.showMainMenu();
        break;
      case "debrief":
        // Debrief requires a report which we don't have from URL
        this.showMainMenu();
        break;
    }
  }

  public stop() {
    this.context.gameClient.stop();
    this.context.inputManager.destroy();
    this.inputBinder.unbindAll();
    this.context.screenManager.destroy();
  }

  // --- Logic copied from main.ts ---

  private setupAdditionalUIBindings() {
    // Add options to map generator select if they don't exist
    const mapGenSelect = document.getElementById(
      "map-generator-type",
    ) as HTMLSelectElement;
    if (mapGenSelect) {
      if (mapGenSelect.options.length < 3) {
        const treeOpt = document.createElement("option");
        treeOpt.value = "TreeShip";
        treeOpt.textContent = "Tree Ship (No Loops)";
        mapGenSelect.appendChild(treeOpt);
        const denseOpt = document.createElement("option");
        denseOpt.value = "DenseShip";
        denseOpt.textContent = "Dense Ship (>90% fill)";
        mapGenSelect.appendChild(denseOpt);
      }
    }

    // Injection of mission type select if not present
    if (mapGenSelect && !document.getElementById("mission-type")) {
      const mapGenGroup = mapGenSelect.closest(".control-group");
      if (mapGenGroup) {
        const missionDiv = document.createElement("div");
        missionDiv.style.marginBottom = "10px";
        missionDiv.id = "mission-type-container";
        missionDiv.innerHTML = `
                <label for="mission-type">Mission Type:</label>
                <select id="mission-type">
                            <option value="${MissionType.Default}">Default (Single Objective)</option>
                            <option value="${MissionType.ExtractArtifacts}">Extract Artifacts</option>
                            <option value="${MissionType.DestroyHive}">Destroy Hive</option>
                            <option value="${MissionType.EscortVIP}">Escort VIP</option>
                            <option value="${MissionType.RecoverIntel}">Recover Intel</option>        </select>
              `;
        mapGenGroup.insertBefore(missionDiv, mapGenGroup.firstChild);
      }
    }
  }

  private onEquipmentConfirmed(config: SquadConfig) {
    config.soldiers.forEach((soldier) => {
      if (soldier.id) {
        this.context.campaignManager.assignEquipment(soldier.id, {
          rightHand: soldier.rightHand,
          leftHand: soldier.leftHand,
          body: soldier.body,
          feet: soldier.feet,
        });
      }
    });

    this.missionSetupManager.currentSquad = config;
    // Navigate back to Mission Setup instead of launching immediately
    const isCampaign = !!this.missionSetupManager.currentCampaignNode;
    this.missionSetupManager.loadAndApplyConfig(isCampaign);
    this.switchScreen("mission-setup", isCampaign);
    if (isCampaign) {
      this.context.campaignShell.show("campaign", "sector-map", false);
    } else {
      this.context.campaignShell.show("custom", "setup");
    }
  }

  private updateUI(state: GameState) {
    this.currentGameState = state;
    this.context.menuController.update(state);
    this.context.hudManager.update(state, this.selectedUnitId);
  }

  private async copyWorldState() {
    if (this.currentGameState) {
      await DebugUtility.copyWorldState(
        this.currentGameState,
        this.context.gameClient.getReplayData(),
        VERSION,
        this.context.modalService,
      );
    }
  }

  private exportReplay() {
    const replay = this.context.gameClient.getReplayData();
    if (replay) {
      const blob = new Blob([JSON.stringify(replay, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `voidlock-replay-${replay.seed}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  private applyCampaignTheme() {
    const global = ConfigManager.loadGlobal();
    this.context.themeManager.setTheme(global.themeId || "default");
  }

  private onCampaignNodeSelect(node: CampaignNode) {
    this.campaignFlowCoordinator.onCampaignNodeSelected(
      node,
      () => this.switchScreen("campaign", true),
      (n, size, spawnPoints) => {
        this.missionSetupManager.prepareMissionSetup(n, size, spawnPoints);
        this.equipmentScreen.setCampaign(true);
        this.equipmentScreen.updateConfig(
          this.missionSetupManager.currentSquad,
        );
        this.switchScreen("equipment", true);
        this.context.campaignShell.show("campaign", "sector-map", false);
      },
    );
  }

  private onCampaignStart() {
    this.applyCampaignTheme();
    this.context.campaignShell.show("campaign", "sector-map");
  }

  private onShowSummary() {
    const state = this.context.campaignManager.getState();
    if (state) {
      this.switchScreen("campaign-summary", true, true, state);
    }
  }

  private handleMenuInput(key: string, shiftHeld: boolean = false) {
    if (!this.currentGameState) return;
    this.context.menuController.isShiftHeld = shiftHeld;
    this.context.menuController.handleMenuInput(key, this.currentGameState);
    this.updateUI(this.currentGameState);
  }

  private togglePause() {
    this.context.gameClient.togglePause();
    this.syncSpeedUI();
  }

  private syncSpeedUI() {
    const isPaused = this.context.gameClient.getIsPaused();
    const lastSpeed = this.context.gameClient.getTargetScale();

    const btn = document.getElementById(
      "btn-pause-toggle",
    ) as HTMLButtonElement;
    const gameSpeedSlider = document.getElementById(
      "game-speed",
    ) as HTMLInputElement;
    const gameSpeedValue = document.getElementById("speed-value");

    if (btn) btn.textContent = isPaused ? "▶ Play" : "|| Pause";
    if (gameSpeedValue)
      gameSpeedValue.textContent = TimeUtility.formatSpeed(lastSpeed, isPaused);
    if (gameSpeedSlider)
      gameSpeedSlider.value = TimeUtility.scaleToSlider(lastSpeed).toString();
  }

  private cycleUnits(reverse: boolean = false) {
    if (!this.currentGameState) return;
    const aliveUnits = this.currentGameState.units.filter(
      (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
    );
    if (aliveUnits.length === 0) return;

    if (!this.selectedUnitId) {
      this.selectedUnitId = aliveUnits[0].id;
    } else {
      const currentIndex = aliveUnits.findIndex(
        (u) => u.id === this.selectedUnitId,
      );
      let nextIndex;
      if (reverse) {
        nextIndex = (currentIndex - 1 + aliveUnits.length) % aliveUnits.length;
      } else {
        nextIndex = (currentIndex + 1) % aliveUnits.length;
      }
      this.selectedUnitId = aliveUnits[nextIndex].id;
    }
    this.updateUI(this.currentGameState);
    if (this.selectedUnitId) {
      this.centerOnUnit(this.selectedUnitId);
    }
  }

  private centerOnUnit(unitId: string) {
    if (!this.currentGameState) return;
    const unit = this.currentGameState.units.find((u) => u.id === unitId);
    if (!unit) return;

    const container = document.getElementById("game-container");
    if (!container) return;

    const cellSize = 128; // Standard cell size
    const targetX = unit.pos.x * cellSize;
    const targetY = unit.pos.y * cellSize;

    container.scrollTo({
      left: targetX - container.clientWidth / 2,
      top: targetY - container.clientHeight / 2,
      behavior: "smooth",
    });
  }

  private panMap(direction: string) {
    const container = document.getElementById("game-container");
    if (!container) return;
    const panAmount = 100;
    switch (direction) {
      case "ArrowUp":
        container.scrollTop -= panAmount;
        break;
      case "ArrowDown":
        container.scrollTop += panAmount;
        break;
      case "ArrowLeft":
        container.scrollLeft -= panAmount;
        break;
      case "ArrowRight":
        container.scrollLeft += panAmount;
        break;
    }
  }

  private panMapBy(dx: number, dy: number) {
    const container = document.getElementById("game-container");
    if (!container) return;
    container.scrollLeft += dx;
    container.scrollTop += dy;
  }

  private zoomMap(ratio: number, centerX: number, centerY: number) {
    if (!this.context.renderer) return;
    const container = document.getElementById("game-container");
    if (!container) return;

    const oldCellSize = this.context.renderer.cellSize;
    const newCellSize = Math.max(32, Math.min(512, oldCellSize * ratio));

    if (newCellSize === oldCellSize) return;

    // To keep the zoom centered, we need to adjust scroll position
    // (scroll + center) / oldSize = (newScroll + center) / newSize
    const rect = container.getBoundingClientRect();
    const localCX = centerX - rect.left;
    const localCY = centerY - rect.top;

    const scrollX = container.scrollLeft;
    const scrollY = container.scrollTop;

    const actualRatio = newCellSize / oldCellSize;

    this.context.renderer.setCellSize(newCellSize);
    if (this.currentGameState) {
      this.context.renderer.render(this.currentGameState);
    }

    // We must wait for the next frame or update immediately if renderer resizes canvas synchronously
    // In our GameRenderer.render, it resizes canvas on next render call.
    // However, for smooth zooming, we should probably force a resize or calculate expected size.
    container.scrollLeft = (scrollX + localCX) * actualRatio - localCX;
    container.scrollTop = (scrollY + localCY) * actualRatio - localCY;
  }

  private onUnitClick(unit: Unit, shiftHeld: boolean = false) {
    if (this.context.menuController.menuState === "UNIT_SELECT") {
      this.context.menuController.isShiftHeld = shiftHeld;
      this.context.menuController.selectUnit(unit.id);
      if (this.currentGameState) this.updateUI(this.currentGameState);
      return;
    }

    // Selecting a new unit from HUD should cancel any previous pending action selection flow
    if (this.context.menuController.menuState !== "ACTION_SELECT") {
      this.context.menuController.reset();
    }

    this.selectedUnitId = unit.id === this.selectedUnitId ? null : unit.id;
    if (this.currentGameState) this.updateUI(this.currentGameState);
  }

  private handleCanvasClick(event: MouseEvent) {
    if (!this.context.renderer || !this.currentGameState) return;
    const clickedCell = this.context.renderer.getCellCoordinates(
      event.clientX,
      event.clientY,
    );

    if (this.currentGameState.status === "Deployment") {
      // Right Click: Undeploy
      if (event.button === 2) {
        const unit = this.currentGameState.units.find(
          (u) =>
            Math.floor(u.pos.x) === clickedCell.x &&
            Math.floor(u.pos.y) === clickedCell.y &&
            u.isDeployed !== false,
        );
        if (unit && unit.archetypeId !== "vip") {
          this.context.gameClient.applyCommand({
            type: CommandType.UNDEPLOY_UNIT,
            unitId: unit.id,
          });
        }
        return;
      }

      // Left Click: Deploy Selected
      if (event.button === 0 && this.selectedUnitId) {
        const unit = this.currentGameState.units.find(
          (u) => u.id === this.selectedUnitId,
        );
        if (unit && unit.archetypeId !== "vip") {
          const isValidSpawn =
            this.currentGameState.map.squadSpawns?.some(
              (s) => s.x === clickedCell.x && s.y === clickedCell.y,
            ) ||
            (this.currentGameState.map.squadSpawn &&
              this.currentGameState.map.squadSpawn.x === clickedCell.x &&
              this.currentGameState.map.squadSpawn.y === clickedCell.y);

          if (isValidSpawn) {
            this.context.gameClient.applyCommand({
              type: CommandType.DEPLOY_UNIT,
              unitId: unit.id,
              target: { x: clickedCell.x + 0.5, y: clickedCell.y + 0.5 },
            });
            return;
          }
        }
      }
    }

    const prevState = this.context.menuController.menuState;
    this.context.menuController.handleCanvasClick(
      clickedCell,
      this.currentGameState,
    );

    if (this.context.menuController.menuState !== prevState) {
      this.updateUI(this.currentGameState);
      return;
    }

    const unitAtClick = this.currentGameState.units.find(
      (unit) =>
        Math.floor(unit.pos.x) === clickedCell.x &&
        Math.floor(unit.pos.y) === clickedCell.y &&
        unit.state !== UnitState.Dead &&
        unit.state !== UnitState.Extracted,
    );
    if (unitAtClick) this.onUnitClick(unitAtClick);
  }

  private launchMission() {
    this.setMissionHUDVisible(true);
    this.switchScreen("mission", false, false);

    const config = this.missionSetupManager.saveCurrentConfig();
    this.missionCoordinator.launchMission(
      {
        ...config,
        seed: config.lastSeed,
        staticMapData: this.missionSetupManager.currentStaticMapData,
        campaignNode: this.missionSetupManager.currentCampaignNode || undefined,
        skipDeployment: !this.missionSetupManager.manualDeployment,
      },
      (report) => {
        if (report.nodeId !== "custom") {
          this.context.campaignManager.processMissionResult(report);
        }

        this.setMissionHUDVisible(false);

        this.switchScreen(
          "debrief",
          false,
          true,
          report,
          this.missionSetupManager.unitStyle,
        );
        return true;
      },
      (state) => this.updateUI(state),
      () => this.syncSpeedUI(),
    );
  }

  private resumeMission() {
    this.setMissionHUDVisible(true);
    this.switchScreen("mission", false, false);

    this.missionCoordinator.resumeMission(
      (report) => {
        if (report.nodeId !== "custom") {
          this.context.campaignManager.processMissionResult(report);
        }

        this.setMissionHUDVisible(false);

        this.switchScreen(
          "debrief",
          false,
          true,
          report,
          this.missionSetupManager.unitStyle,
        );
        return true;
      },
      (state) => this.updateUI(state),
      () => this.syncSpeedUI(),
      (node) => {
        this.missionSetupManager.currentCampaignNode = node;
        if (node) this.applyCampaignTheme();
      },
    );
  }

  private async abortMission() {
    const confirmed = await this.context.modalService.confirm(
      "Abort Mission and return to menu?",
    );
    if (!confirmed) return;

    this.missionCoordinator.abortMission(
      this.currentGameState,
      this.missionSetupManager.currentCampaignNode,
      this.missionSetupManager.currentSeed,
      this.missionSetupManager.currentSquad,
      (report) => {
        if (report.nodeId !== "custom") {
          this.context.campaignManager.processMissionResult(report);
        }

        this.setMissionHUDVisible(false);
        this.switchScreen(
          "debrief",
          false,
          true,
          report,
          this.missionSetupManager.unitStyle,
        );
        return true;
      },
    );
  }

  private setMissionHUDVisible(visible: boolean) {
    const topBar = document.getElementById("top-bar");
    const soldierPanel = document.getElementById("soldier-panel");
    const rightPanel = document.getElementById("right-panel");
    const display = visible ? "flex" : "none";
    if (topBar) topBar.style.display = display;
    if (soldierPanel) soldierPanel.style.display = display;
    if (rightPanel) rightPanel.style.display = display;
  }
}
