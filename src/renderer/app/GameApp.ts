import { InputBinder } from "./InputBinder";
import {
  MapGeneratorType,
  MissionType,
  SquadConfig,
  UnitState,
  GameState,
  Unit,
  CommandType,
  UnitStyle,
  SquadSoldierConfig,
} from "@src/shared/types";
import {
  calculateSpawnPoints,
  CampaignNode,
  MissionReport,
} from "@src/shared/campaign_types";
import pkg from "../../../package.json";
import { ConfigManager } from "../ConfigManager";
import { MissionCoordinator } from "./MissionCoordinator";
import { CampaignFlowCoordinator } from "./CampaignFlowCoordinator";
import { MissionSetupManager } from "./MissionSetupManager";
import { CampaignScreen } from "../screens/CampaignScreen";
import { DebriefScreen } from "../screens/DebriefScreen";
import { EquipmentScreen } from "../screens/EquipmentScreen";
import { MissionSetupScreen } from "../screens/MissionSetupScreen";
import { CampaignSummaryScreen } from "../screens/CampaignSummaryScreen";
import { StatisticsScreen } from "../screens/StatisticsScreen";
import { EngineeringScreen } from "../screens/EngineeringScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { MainMenuScreen } from "../screens/MainMenuScreen";
import { SquadBuilder } from "../components/SquadBuilder";
import { NavigationOrchestrator } from "./NavigationOrchestrator";
import { Logger } from "@src/shared/Logger";
import { GlobalShortcuts } from "../GlobalShortcuts";
import { TooltipManager } from "../ui/TooltipManager";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { InputDispatcher } from "../InputDispatcher";
import { AppServiceRegistry } from "./AppServiceRegistry";
import { Renderer } from "../Renderer";
import { AdvisorOverlay } from "../ui/AdvisorOverlay";
import prologueMap from "@src/content/maps/prologue.json";

const VERSION = pkg.version;

export class GameApp {
  // Services
  private registry: AppServiceRegistry;
  
  private get gameClient() { return this.registry.gameClient; }
  private get screenManager() { return this.registry.screenManager; }
  private get campaignManager() { return this.registry.campaignManager; }
  private get metaManager() { return this.registry.metaManager; }
  private get themeManager() { return this.registry.themeManager; }
  private get menuController() { return this.registry.menuController; }
  private get hudManager() { return this.registry.hudManager; }
  private get inputManager() { return this.registry.inputManager; }
  private get modalService() { return this.registry.modalService; }
  private get campaignShell() { return this.registry.campaignShell; }
  private get cloudSync() { return this.registry.cloudSync; }

  public renderer: Renderer | null = null;

  public get AdvisorOverlay(): AdvisorOverlay {
    return this.registry.advisorOverlay;
  }

  // Coordinators
  private inputBinder!: InputBinder;
  private missionCoordinator!: MissionCoordinator;
  private campaignFlowCoordinator!: CampaignFlowCoordinator;
  private missionSetupManager!: MissionSetupManager;
  private navigationOrchestrator!: NavigationOrchestrator;

  // Components
  private squadBuilder!: SquadBuilder;

  // screens
  private campaignScreen!: CampaignScreen;
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
    this.registry = new AppServiceRegistry();
  }

  public async initialize() {
    await this.registry.initialize({
      onScreenChange: (id, isCampaign) =>
        this.navigationOrchestrator.handleExternalScreenChange(id, isCampaign),
      onShellTabChange: (tabId) => this.navigationOrchestrator.onShellTabChange(tabId),
      onShellMainMenu: () => this.showMainMenu(),
      onUnitClick: (unit, shift) => this.onUnitClick(unit, shift),
      onAbortMission: () => this.abortMission(),
      onMenuInput: (key, shift) => this.handleMenuInput(key, shift),
      onTimeScaleChange: (scale) => {
        this.gameClient.setTimeScale(scale);
        this.syncSpeedUI();
      },
      onCopyWorldState: () => this.copyWorldState(),
      onDebugForceWin: () =>
        this.gameClient.applyCommand({ type: CommandType.DEBUG_FORCE_WIN }),
      onDebugForceLose: () =>
        this.gameClient.applyCommand({ type: CommandType.DEBUG_FORCE_LOSE }),
      onStartMission: () =>
        this.gameClient.applyCommand({
          type: CommandType.START_MISSION,
        }),
      onDeployUnit: (unitId, x, y) =>
        this.gameClient.applyCommand({
          type: CommandType.DEPLOY_UNIT,
          unitId,
          target: { x, y },
        }),
      onUndeployUnit: (unitId) =>
        this.gameClient.applyCommand({
          type: CommandType.UNDEPLOY_UNIT,
          unitId,
        }),
      onTogglePause: () => this.togglePause(),
      onToggleDebug: (enabled) => this.gameClient.toggleDebugOverlay(enabled),
      onToggleLos: (enabled) => this.gameClient.toggleLosOverlay(enabled),
      onCanvasClick: (e) => this.handleCanvasClick(e),
      getCurrentGameState: () => this.currentGameState,
      isDebriefVisible: () => this.debriefScreen.isVisible(),
      getSelectedUnitId: () => this.selectedUnitId,
      getCellCoordinates: (px, py) => this.renderer!.getCellCoordinates(px, py),
      cycleUnits: (reverse) => this.cycleUnits(reverse),
      panMap: (direction) => this.panMap(direction),
      panMapBy: (dx, dy) => this.panMapBy(dx, dy),
      zoomMap: (ratio, cx, cy) => this.zoomMap(ratio, cx, cy),
    });

    this.mainMenuScreen = new MainMenuScreen("screen-main-menu");
    this.missionSetupScreen = new MissionSetupScreen(
      "screen-mission-setup",
      () => {
        this.screenManager.goBack();
      },
    );

    // Initialize Coordinators
    this.missionCoordinator = new MissionCoordinator(
      this.campaignShell,
      this.gameClient,
      this.screenManager,
      this.menuController,
      this.campaignManager,
      (renderer) => {
        this.renderer = renderer;
      },
    );
    this.campaignFlowCoordinator = new CampaignFlowCoordinator(
      this.campaignManager,
      this.screenManager,
      this.campaignShell,
      this.modalService,
    );
    this.missionSetupManager = new MissionSetupManager(
      this.campaignManager,
      this.themeManager,
      this.modalService,
    );

    // Ensure squad-builder element exists (resilience for tests)
    if (!document.getElementById("squad-builder")) {
      const sb = document.createElement("div");
      sb.id = "squad-builder";
      sb.style.display = "none";
      document.body.appendChild(sb);
    }

    this.squadBuilder = new SquadBuilder(
      "squad-builder",
      this.campaignManager,
      this.campaignShell,
      this.modalService,
      this.missionSetupManager.currentSquad,
      this.missionSetupManager.currentMissionType,
      !!this.missionSetupManager.currentCampaignNode,
      (squad) => {
        this.missionSetupManager.currentSquad = squad;
        this.missionSetupManager.saveCurrentConfig();
      },
    );

    // 3. Initialize screens
    this.campaignScreen = new CampaignScreen(
      "screen-campaign",
      this.campaignManager,
      this.modalService,
      (node) => this.onCampaignNodeSelect(node),
      () => this.showMainMenu(),
      () => this.onCampaignStart(),
      () => this.onShowSummary(),
    );

    this.debriefScreen = new DebriefScreen(
      "screen-debrief",
      this.gameClient,
      () => {
        this.debriefScreen.hide();
        this.gameClient.stop();

        const state = this.campaignManager.getState();
        if (
          state &&
          (state.status === "Victory" || state.status === "Defeat")
        ) {
          this.navigationOrchestrator.switchScreen("campaign-summary", true, true, state);
          return;
        }

        if (this.missionSetupManager.currentCampaignNode) {
          this.navigationOrchestrator.switchScreen("campaign", true);
          this.campaignShell.show("campaign", "sector-map");
        } else {
          this.campaignShell.hide();
          this.showMainMenu();
        }
      },
      () => {
        this.debriefScreen.hide();
        this.gameClient.stop();
        this.launchMission();
      },
      () => this.exportReplay(),
    );

    this.equipmentScreen = new EquipmentScreen(
      "screen-equipment",
      this.campaignManager,
      this.modalService,
      this.missionSetupManager.currentSquad,
      (config) => this.onEquipmentConfirmed(config),
      () => {
        this.screenManager.goBack();
        const screen = this.screenManager.getCurrentScreen();
        this.navigationOrchestrator.handleExternalScreenChange(
          screen,
          !!this.campaignManager.getState(),
        );
      },
      () => this.campaignShell.refresh(),
      (config) => {
        this.missionSetupManager.currentSquad = config;
        this.missionSetupManager.saveCurrentConfig();
        this.launchMission();
      },
      false, // isShop
      false, // isCampaign
    );

    this.statisticsScreen = new StatisticsScreen("screen-statistics", this.metaManager);
    this.engineeringScreen = new EngineeringScreen("screen-engineering", this.metaManager, () =>
      this.campaignShell.refresh(),
    );

    this.settingsScreen = new SettingsScreen(
      "screen-settings",
      this.themeManager,
      this.cloudSync,
      this.modalService,
      () => {
        this.screenManager.goBack();
        const screen = this.screenManager.getCurrentScreen();
        this.navigationOrchestrator.handleExternalScreenChange(
          screen,
          !!this.campaignManager.getState(),
        );
      },
    );

    this.campaignSummaryScreen = new CampaignSummaryScreen(
      "screen-campaign-summary",
      () => {
        this.campaignSummaryScreen.hide();
        this.gameClient.stop();
        ConfigManager.clearCampaign();
        this.campaignManager.deleteSave();
        this.showMainMenu();
      },
    );

    this.navigationOrchestrator = new NavigationOrchestrator(
      this.screenManager,
      this.campaignShell,
      this.campaignManager,
      this.themeManager,
      this.missionSetupManager,
      this.squadBuilder,
      {
        mainMenu: this.mainMenuScreen,
        campaign: this.campaignScreen,
        debrief: this.debriefScreen,
        equipment: this.equipmentScreen,
        missionSetup: this.missionSetupScreen,
        campaignSummary: this.campaignSummaryScreen,
        statistics: this.statisticsScreen,
        engineering: this.engineeringScreen,
        settings: this.settingsScreen,
      },
      {
        showMainMenu: () => this.showMainMenu(),
        launchMission: () => this.launchMission(),
        resumeMission: () => this.resumeMission(),
      }
    );

    // 4. Setup global UI and shortcuts
    this.setupAdditionalUIBindings();

    // 5. Bind events
    this.inputBinder = new InputBinder(this.screenManager, this.gameClient);
    this.inputBinder.bindAll({
      onTogglePause: () => this.togglePause(),
      onAbortMission: () => this.abortMission(),
      onCustomMission: () => {
        this.missionSetupManager.currentCampaignNode = null;
        this.missionSetupManager.loadAndApplyConfig(false);
        this.campaignShell.show("custom", "setup");
        this.squadBuilder.update(
          this.missionSetupManager.currentSquad,
          this.missionSetupManager.currentMissionType,
          false,
        );
        this.navigationOrchestrator.switchScreen("mission-setup", false);
      },
      onCampaignMenu: () => {
        this.campaignFlowCoordinator.onCampaignMenu(
          () => this.navigationOrchestrator.applyCampaignTheme(),
          (state) => this.navigationOrchestrator.switchScreen("campaign-summary", true, true, state),
          () => this.navigationOrchestrator.switchScreen("campaign", true),
        );
      },
      onResetData: () => this.campaignFlowCoordinator.onResetData(),
      onShowEquipment: () => {
        const isCampaign = !!this.missionSetupManager.currentCampaignNode;
        this.equipmentScreen.setCampaign(isCampaign);
        this.equipmentScreen.updateConfig(
          this.missionSetupManager.currentSquad,
        );
        this.navigationOrchestrator.switchScreen("equipment", isCampaign);
        if (isCampaign) {
          this.campaignShell.show("campaign", "ready-room", true);
        } else {
          this.campaignShell.show("custom", "setup");
        }
      },
      onLoadStaticMap: (json) => this.missionSetupManager.loadStaticMap(json),
      onUploadStaticMap: (file) =>
        this.missionSetupManager.uploadStaticMap(file),
      onConvertAscii: (ascii) => this.missionSetupManager.convertAscii(ascii),
      onExportReplay: () => this.exportReplay(),
      onShowStatistics: () => {
        this.navigationOrchestrator.switchScreen("statistics", false);
        this.campaignShell.show("statistics", "stats");
      },
      onEngineeringMenu: () => {
        const state = this.campaignManager.getState();
        this.navigationOrchestrator.switchScreen("engineering", !!state);
        if (state) {
          this.campaignShell.show("campaign", "engineering");
        } else {
          this.campaignShell.show("statistics", "engineering");
        }
      },
      onSettingsMenu: () => {
        const state = this.campaignManager.getState();
        this.navigationOrchestrator.switchScreen("settings", !!state);
        if (state) {
          this.campaignShell.show("campaign", "settings");
        } else {
          this.campaignShell.show("global", "settings", false);
        }
      },
      onSetupBack: () => {
        this.screenManager.goBack();
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
        this.squadBuilder.update(
          this.missionSetupManager.currentSquad,
          this.missionSetupManager.currentMissionType,
          !!this.missionSetupManager.currentCampaignNode,
        );
      },
      onThemeChange: (themeId: string) => {
        this.missionSetupManager.currentThemeId = themeId;
        this.missionSetupManager.saveCurrentConfig();
        this.themeManager.setTheme(themeId);
      },
      onUnitStyleChange: (style: string) => {
        this.missionSetupManager.unitStyle = style as UnitStyle;
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
              this.gameClient.loadReplay(replayData);

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
                    (s: SquadSoldierConfig, idx: number) => ({
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

              if (replayData.themeId) {
                this.themeManager.setTheme(replayData.themeId);
              }

              this.navigationOrchestrator.switchScreen(
                "debrief",
                false,
                true,
                report,
                replayData.unitStyle || this.missionSetupManager.unitStyle,
              );
            } else {
              this.modalService.alert("Invalid replay file format.");
            }
          } catch (err) {
            this.modalService.alert("Failed to parse replay file.");
          }
        };
        reader.readAsText(file);
      },
    });

    const globalShortcuts = new GlobalShortcuts(
      () => this.togglePause(),
      () => this.screenManager.goBack(),
    );
    globalShortcuts.init();

    TooltipManager.getInstance();

    // Initial UI state
    this.missionSetupManager.loadAndApplyConfig(false);
    const mvEl = document.getElementById("menu-version");
    if (mvEl) mvEl.textContent = `v${VERSION}`;

    this.setupResponsiveDrawers();
  }





  public start() {
    const persisted = this.screenManager.loadPersistedState();
    if (persisted) {
      this.navigationOrchestrator.handleExternalScreenChange(persisted.screenId, persisted.isCampaign);
    } else {
      this.showMainMenu();
    }
  }



  private showMainMenu() {
    this.navigationOrchestrator.switchScreen("main-menu");
  }

  private onMissionComplete(report: MissionReport) {
    Logger.info("Mission Complete!", report);

    // Update campaign state via manager
    if (report.nodeId !== "custom") {
      this.campaignManager.processMissionResult(report);
    }

    const replayData = this.gameClient.getReplayData();

    // Show debrief screen
    this.navigationOrchestrator.switchScreen(
      "debrief",
      false,
      true,
      report,
      replayData?.unitStyle || this.missionSetupManager.unitStyle,
    );
  }

  public stop() {
    this.gameClient.stop();
    this.inputManager.destroy();
    this.screenManager.destroy();
    InputDispatcher.getInstance().popContext("tactical");
  }

  private setupAdditionalUIBindings() {
    // Top bar buttons
    const btnAbort = document.getElementById("btn-abort");
    if (btnAbort) btnAbort.onclick = () => this.abortMission();

    const btnRetry = document.getElementById("btn-retry");
    if (btnRetry) btnRetry.onclick = () => this.launchMission();

    const btnExport = document.getElementById("btn-export");
    if (btnExport) btnExport.onclick = () => this.exportReplay();

    // Speed controls
    const speedSlider = document.getElementById(
      "speed-slider",
    ) as HTMLInputElement;
    if (speedSlider) {
      speedSlider.oninput = () => {
        this.gameClient.setTimeScale(parseFloat(speedSlider.value));
        this.syncSpeedUI();
      };
    }

    const btnPause = document.getElementById("btn-pause");
    if (btnPause) btnPause.onclick = () => this.togglePause();

    // Debug tools
    const btnForceWin = document.getElementById("btn-debug-win");
    if (btnForceWin) {
      btnForceWin.onclick = () => {
        this.gameClient.applyCommand({ type: CommandType.DEBUG_FORCE_WIN });
      };
    }

    const btnForceLose = document.getElementById("btn-debug-lose");
    if (btnForceLose) {
      btnForceLose.onclick = () => {
        this.gameClient.applyCommand({ type: CommandType.DEBUG_FORCE_LOSE });
      };
    }
  }

  private onEquipmentConfirmed(config: SquadConfig) {
    if (this.missionSetupManager.currentCampaignNode) {
      // In campaign, update the roster with the new equipment
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

      // Return to sector map (Spec: flow is Sector -> Equipment -> Launch)
      // Confirm Squad just saves it and goes back
      this.navigationOrchestrator.switchScreen("campaign", true);
      this.campaignShell.show("campaign", "sector-map");
    } else {
      // In custom, just update the setup manager
      this.missionSetupManager.currentSquad = config;
      this.missionSetupManager.saveCurrentConfig();

      // Also return to mission-setup in custom flow
      this.missionSetupManager.loadAndApplyConfig(false);
      this.squadBuilder.update(
        this.missionSetupManager.currentSquad,
        this.missionSetupManager.currentMissionType,
        false,
      );
      this.navigationOrchestrator.switchScreen("mission-setup", false);
      this.campaignShell.show("custom", "setup");
    }
  }

  private onShowSummary() {
    const state = this.campaignManager.getState();
    if (state) {
      this.navigationOrchestrator.switchScreen("campaign-summary", true, true, state);
    }
  }

  private updateUI(state: GameState) {
    this.currentGameState = state;
    this.hudManager.update(state, this.selectedUnitId);
    this.menuController.update(state);
  }

  private async copyWorldState() {
    if (!this.currentGameState) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(this.currentGameState, null, 2),
      );
      this.modalService.alert("World state copied to clipboard!");
    } catch (err) {
      Logger.error("Failed to copy world state:", err);
    }
  }

  private exportReplay() {
    const replay = this.gameClient.getReplayData();
    const blob = new Blob([JSON.stringify(replay, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voidlock-replay-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }



  private onCampaignNodeSelect(node: CampaignNode) {
    // 1. Set the node in setup manager
    this.missionSetupManager.currentCampaignNode = node;

    // 2. Set mission parameters from node
    this.missionSetupManager.currentSeed = node.mapSeed;
    this.missionSetupManager.currentMissionType =
      node.missionType || MissionType.RecoverIntel;

    // 3. Clear any manually loaded map data
    this.missionSetupManager.currentStaticMapData = undefined;

    // 4. Update squad (VIP auto-add for Escort)
    if (node.missionType === MissionType.EscortVIP) {
      // Ensure VIP is in the squad
      const hasVip = this.missionSetupManager.currentSquad.soldiers.some(
        (s) => s.archetypeId === "vip",
      );
      if (!hasVip) {
        // VIP slot is handled by SquadBuilder/MissionManager, 
        // but we ensure it's not blocked by 4-soldier cap
      }
    }

    // 5. Navigate to equipment screen (skipping mission-setup)
    this.navigationOrchestrator.applyCampaignTheme();
    this.missionSetupManager.loadAndApplyConfig(true);
    this.missionSetupManager.saveCurrentConfig();
    this.equipmentScreen.setCampaign(true);
    this.equipmentScreen.setHasNodeSelected(true);
    this.equipmentScreen.updateConfig(
      this.missionSetupManager.currentSquad,
    );
    this.navigationOrchestrator.switchScreen("equipment", true);
    this.campaignShell.show("campaign", "ready-room", true);
  }

  private onCampaignStart() {
    // Show the campaign shell and the campaign screen (sector map)
    this.campaignShell.show("campaign", "sector-map");
    this.navigationOrchestrator.switchScreen("campaign", true);
  }

  private handleMenuInput(key: string, shiftHeld: boolean = false) {
    if (!this.currentGameState) return;
    this.menuController.isShiftHeld = shiftHeld;
    this.menuController.handleMenuInput(key, this.currentGameState);
    this.updateUI(this.currentGameState);
  }

  private togglePause() {
    const isPaused = this.gameClient.getIsPaused();
    this.gameClient.setTimeScale(isPaused ? 1.0 : 0.0);
    this.syncSpeedUI();
  }

  private syncSpeedUI() {
    const isPaused = this.gameClient.getIsPaused();
    const timeScale = this.gameClient.getTimeScale();

    const speedSlider = document.getElementById(
      "speed-slider",
    ) as HTMLInputElement;
    if (speedSlider) {
      speedSlider.value = timeScale.toString();
    }

    const btnPause = document.getElementById("btn-pause");
    if (btnPause) {
      btnPause.textContent = isPaused ? "▶" : "⏸";
      btnPause.title = isPaused ? "Resume" : "Pause";
    }
  }

  private cycleUnits(reverse: boolean = false) {
    if (!this.currentGameState) return;
    const units = this.currentGameState.units;
    if (units.length === 0) return;

    let index = units.findIndex((u) => u.id === this.selectedUnitId);
    if (reverse) {
      index = index <= 0 ? units.length - 1 : index - 1;
    } else {
      index = index === -1 || index >= units.length - 1 ? 0 : index + 1;
    }

    this.selectedUnitId = units[index].id;
    this.centerOnUnit(this.selectedUnitId);
  }

  private centerOnUnit(unitId: string) {
    if (!this.currentGameState || !this.renderer) return;
    const unit = this.currentGameState.units.find((u) => u.id === unitId);
    if (unit) {
      const cellSize = this.renderer.cellSize;
      const container = document.getElementById("game-container");
      if (container) {
        container.scrollTo({
          left: unit.pos.x * cellSize - container.clientWidth / 2,
          top: unit.pos.y * cellSize - container.clientHeight / 2,
          behavior: "smooth",
        });
      }
    }
  }

  private panMap(direction: string) {
    const container = document.getElementById("game-container");
    if (!container) return;
    const panAmount = 100;
    switch (direction) {
      case "up":
        container.scrollTop -= panAmount;
        break;
      case "down":
        container.scrollTop += panAmount;
        break;
      case "left":
        container.scrollLeft -= panAmount;
        break;
      case "right":
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
    if (!this.renderer) return;
    const container = document.getElementById("game-container");
    if (!container) return;

    const oldCellSize = this.renderer.cellSize;
    const newCellSize = Math.max(32, Math.min(512, oldCellSize * ratio));

    if (newCellSize === oldCellSize) return;

    const rect = container.getBoundingClientRect();
    const localCX = centerX - rect.left;
    const localCY = centerY - rect.top;

    const scrollX = container.scrollLeft;
    const scrollY = container.scrollTop;

    const actualRatio = newCellSize / oldCellSize;

    this.renderer.setCellSize(newCellSize);
    if (this.currentGameState) {
      this.renderer.render(this.currentGameState);
    }

    container.scrollLeft = (scrollX + localCX) * actualRatio - localCX;
    container.scrollTop = (scrollY + localCY) * actualRatio - localCY;
  }

  private onUnitClick(unit: Unit | null, shiftHeld: boolean = false) {
    if (!unit) {
      this.selectedUnitId = null;
      if (this.currentGameState) this.updateUI(this.currentGameState);
      return;
    }

    if (this.menuController.menuState === "UNIT_SELECT") {
      this.menuController.selectUnit(unit.id);
      if (this.currentGameState) this.updateUI(this.currentGameState);
      return;
    }

    // Selecting a new unit from HUD should cancel any previous pending action selection flow
    if (this.selectedUnitId !== unit.id) {
      this.menuController.reset();
    }

    this.selectedUnitId = unit.id;
    if (!shiftHeld) {
      this.centerOnUnit(unit.id);
    }
  }

  private handleCanvasClick(event: MouseEvent) {
    if (!this.renderer || !this.currentGameState) return;
    const clickedCell = this.renderer.getCellCoordinates(
      event.clientX,
      event.clientY,
    );

    if (this.currentGameState.status === "Deployment") {
      // Right Click: Undeploy
      if (event.button === 2) {
        const unit = this.currentGameState.units.find(
          (u) =>
            MathUtils.sameCellPosition(u.pos, clickedCell) &&
            u.isDeployed !== false,
        );
        if (unit && unit.archetypeId !== "vip") {
          this.gameClient.applyCommand({
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
            this.gameClient.applyCommand({
              type: CommandType.DEPLOY_UNIT,
              unitId: unit.id,
              target: { x: clickedCell.x + 0.5, y: clickedCell.y + 0.5 },
            });
            return;
          }
        }
      }
    }

    const prevState = this.menuController.menuState;
    this.menuController.handleCanvasClick(
      clickedCell,
      this.currentGameState,
    );

    if (this.menuController.menuState !== prevState) {
      this.updateUI(this.currentGameState);
      return;
    }

    const unitAtClick = this.currentGameState.units.find(
      (unit) =>
        MathUtils.sameCellPosition(unit.pos, clickedCell) &&
        unit.state !== UnitState.Dead &&
        unit.state !== UnitState.Extracted &&
        unit.isDeployed !== false,
    );
    if (unitAtClick) this.onUnitClick(unitAtClick);
  }

  private launchMission() {
    this.setMissionHUDVisible(true);
    this.navigationOrchestrator.switchScreen("mission", false, false);

    const config = this.missionSetupManager.saveCurrentConfig();

    // Handle Prologue Map (ADR 0042)
    let staticMapData = this.missionSetupManager.currentStaticMapData;
    if (config.missionType === MissionType.Prologue) {
      staticMapData = prologueMap as any;
    }

    this.missionCoordinator.launchMission(
      {
        ...config,
        seed: config.lastSeed,
        staticMapData,
        campaignNode: this.missionSetupManager.currentCampaignNode || undefined,
        skipDeployment: !this.missionSetupManager.manualDeployment || config.missionType === MissionType.Prologue,
      },
      (report) => {
        this.onMissionComplete(report);
        return true;
      },
      (state) => this.updateUI(state),
      () => this.syncSpeedUI(),
    );
  }

  private resumeMission() {
    this.setMissionHUDVisible(true);
    this.navigationOrchestrator.switchScreen("mission", false, false);

    this.missionCoordinator.resumeMission(
      (report) => {
        this.onMissionComplete(report);
        return true;
      },
      (state) => this.updateUI(state),
      () => this.syncSpeedUI(),
      (node) => {
        this.missionSetupManager.currentCampaignNode = node;
        if (node) this.navigationOrchestrator.applyCampaignTheme();
      },
    );
  }

  private async abortMission() {
    const confirmed = await this.modalService.confirm(
      "Abort Mission and return to menu?",
    );
    if (!confirmed) return;

    this.missionCoordinator.abortMission(
      this.currentGameState,
      this.missionSetupManager.currentCampaignNode,
      this.missionSetupManager.currentSeed,
      this.missionSetupManager.currentSquad,
      (report) => {
        this.onMissionComplete(report);
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
}
