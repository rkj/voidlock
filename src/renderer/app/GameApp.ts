import { InputBinder } from "./InputBinder";
import {
  MapGeneratorType,
  MissionType,
  SquadConfig,
  UnitState,
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
import { CampaignFlowCoordinator } from "./CampaignFlowCoordinator";
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
import { Logger } from "@src/shared/Logger";
import { GlobalShortcuts } from "../GlobalShortcuts";
import { TooltipManager } from "../ui/TooltipManager";
import { InputDispatcher } from "../InputDispatcher";
import { AppServiceRegistry } from "./AppServiceRegistry";
import { Renderer } from "../Renderer";
import { AdvisorOverlay } from "../ui/AdvisorOverlay";

const VERSION = pkg.version;

export class GameApp {
  // Services
  private registry: AppServiceRegistry;
  
  private get gameClient() { return this.registry.gameClient; }
  private get inputManager() { return this.registry.inputManager; }
  private get modalService() { return this.registry.modalService; }

  public renderer: Renderer | null = null;

  public get AdvisorOverlay(): AdvisorOverlay {
    return this.registry.advisorOverlay;
  }

  // Coordinators
  private inputBinder!: InputBinder;
  private campaignFlowCoordinator!: CampaignFlowCoordinator;

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

  constructor() {
    this.registry = new AppServiceRegistry();
  }

  public async initialize() {
    await this.registry.initialize({
      onScreenChange: (id, isCampaign) =>
        this.registry.navigationOrchestrator.handleExternalScreenChange(id, isCampaign),
      onShellTabChange: (tabId) => this.registry.navigationOrchestrator.onShellTabChange(tabId),
      onShellMainMenu: () => this.showMainMenu(),
      onUnitClick: (unit, shift) => this.registry.inputOrchestrator.onUnitClick(unit, shift),
      onAbortMission: () => this.registry.missionRunner.abortMission(),
      onMenuInput: (key, shift) => this.registry.inputOrchestrator.handleMenuInput(key, shift),
      onTimeScaleChange: (scale) => {
        this.gameClient.setTimeScale(scale);
        this.registry.missionRunner.syncSpeedUI();
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
      onCanvasClick: (e) => this.registry.inputOrchestrator.handleCanvasClick(e),
      onRendererCreated: (renderer) => { this.renderer = renderer; },
      getCurrentGameState: () => this.registry.missionRunner.getCurrentGameState(),
      isDebriefVisible: () => this.debriefScreen.isVisible(),
      getSelectedUnitId: () => this.registry.missionRunner.getSelectedUnitId(),
      getCellCoordinates: (px, py) => this.renderer!.getCellCoordinates(px, py),
      cycleUnits: (reverse) => this.registry.inputOrchestrator.cycleUnits(reverse),
      panMap: (direction) => this.registry.inputOrchestrator.panMap(direction),
      panMapBy: (dx, dy) => this.registry.inputOrchestrator.panMapBy(dx, dy),
      zoomMap: (ratio, cx, cy) => this.registry.inputOrchestrator.zoomMap(ratio, cx, cy),
      getRenderer: () => this.renderer,
    });

    this.mainMenuScreen = new MainMenuScreen("screen-main-menu");
    this.missionSetupScreen = new MissionSetupScreen(
      "screen-mission-setup",
      () => {
        this.registry.screenManager.goBack();
      },
    );

    // Initialize remaining Coordinators that are not in registry yet (if any)
    this.campaignFlowCoordinator = new CampaignFlowCoordinator(
      this.registry.campaignManager,
      this.registry.screenManager,
      this.registry.campaignShell,
      this.registry.modalService,
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
      this.registry.campaignManager,
      this.registry.campaignShell,
      this.registry.modalService,
      this.registry.missionSetupManager.currentSquad,
      this.registry.missionSetupManager.currentMissionType,
      !!this.registry.missionSetupManager.currentCampaignNode,
      (squad) => {
        this.registry.missionSetupManager.currentSquad = squad;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
    );

    // 3. Initialize screens
    this.campaignScreen = new CampaignScreen(
      "screen-campaign",
      this.registry.campaignManager,
      this.registry.modalService,
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

        const state = this.registry.campaignManager.getState();
        if (
          state &&
          (state.status === "Victory" || state.status === "Defeat")
        ) {
          this.registry.navigationOrchestrator.switchScreen("campaign-summary", true, true, state);
          return;
        }

        if (this.registry.missionSetupManager.currentCampaignNode) {
          this.registry.navigationOrchestrator.switchScreen("campaign", true);
          this.registry.campaignShell.show("campaign", "sector-map");
        } else {
          this.registry.campaignShell.hide();
          this.showMainMenu();
        }
      },
      () => {
        this.debriefScreen.hide();
        this.gameClient.stop();
        this.registry.missionRunner.launchMission();
      },
      () => this.exportReplay(),
    );

    this.equipmentScreen = new EquipmentScreen(
      "screen-equipment",
      this.registry.campaignManager,
      this.registry.modalService,
      this.registry.missionSetupManager.currentSquad,
      (config) => this.onEquipmentConfirmed(config),
      () => {
        this.registry.screenManager.goBack();
        const screen = this.registry.screenManager.getCurrentScreen();
        this.registry.navigationOrchestrator.handleExternalScreenChange(
          screen,
          !!this.registry.campaignManager.getState(),
        );
      },
      () => this.registry.campaignShell.refresh(),
      (config) => {
        this.registry.missionSetupManager.currentSquad = config;
        this.registry.missionSetupManager.saveCurrentConfig();
        this.registry.missionRunner.launchMission();
      },
      false, // isShop
      false, // isCampaign
    );

    this.statisticsScreen = new StatisticsScreen("screen-statistics", this.registry.metaManager);
    this.engineeringScreen = new EngineeringScreen("screen-engineering", this.registry.metaManager, () =>
      this.registry.campaignShell.refresh(),
    );

    this.settingsScreen = new SettingsScreen(
      "screen-settings",
      this.registry.themeManager,
      this.registry.cloudSync,
      this.registry.modalService,
      () => {
        this.registry.screenManager.goBack();
        const screen = this.registry.screenManager.getCurrentScreen();
        this.registry.navigationOrchestrator.handleExternalScreenChange(
          screen,
          !!this.registry.campaignManager.getState(),
        );
      },
    );

    this.campaignSummaryScreen = new CampaignSummaryScreen(
      "screen-campaign-summary",
      () => {
        this.campaignSummaryScreen.hide();
        this.gameClient.stop();
        ConfigManager.clearCampaign();
        this.registry.campaignManager.deleteSave();
        this.showMainMenu();
      },
    );

    this.registry.finalizeNavigation(
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
      this.squadBuilder,
      {
        showMainMenu: () => this.showMainMenu(),
      }
    );

    // 4. Setup global UI and shortcuts
    this.setupAdditionalUIBindings();

    // 5. Bind events
    this.inputBinder = new InputBinder(this.registry.screenManager, this.gameClient);
    this.inputBinder.bindAll({
      onTogglePause: () => this.togglePause(),
      onAbortMission: () => this.registry.missionRunner.abortMission(),
      onCustomMission: () => {
        this.registry.missionSetupManager.currentCampaignNode = null;
        this.registry.missionSetupManager.loadAndApplyConfig(false);
        this.registry.campaignShell.show("custom", "setup");
        this.squadBuilder.update(
          this.registry.missionSetupManager.currentSquad,
          this.registry.missionSetupManager.currentMissionType,
          false,
        );
        this.registry.navigationOrchestrator.switchScreen("mission-setup", false);
      },
      onCampaignMenu: () => {
        this.campaignFlowCoordinator.onCampaignMenu(
          () => this.registry.navigationOrchestrator.applyCampaignTheme(),
          (state) => this.registry.navigationOrchestrator.switchScreen("campaign-summary", true, true, state),
          () => this.registry.navigationOrchestrator.switchScreen("campaign", true),
        );
      },
      onResetData: () => this.campaignFlowCoordinator.onResetData(),
      onShowEquipment: () => {
        const isCampaign = !!this.registry.missionSetupManager.currentCampaignNode;
        this.equipmentScreen.setCampaign(isCampaign);
        this.equipmentScreen.updateConfig(
          this.registry.missionSetupManager.currentSquad,
        );
        this.registry.navigationOrchestrator.switchScreen("equipment", isCampaign);
        if (isCampaign) {
          this.registry.campaignShell.show("campaign", "ready-room", true);
        } else {
          this.registry.campaignShell.show("custom", "setup");
        }
      },
      onLoadStaticMap: (json) => this.registry.missionSetupManager.loadStaticMap(json),
      onUploadStaticMap: (file) =>
        this.registry.missionSetupManager.uploadStaticMap(file),
      onConvertAscii: (ascii) => this.registry.missionSetupManager.convertAscii(ascii),
      onExportReplay: () => this.exportReplay(),
      onShowStatistics: () => {
        this.registry.navigationOrchestrator.switchScreen("statistics", false);
        this.registry.campaignShell.show("statistics", "stats");
      },
      onEngineeringMenu: () => {
        const state = this.registry.campaignManager.getState();
        this.registry.navigationOrchestrator.switchScreen("engineering", !!state);
        if (state) {
          this.registry.campaignShell.show("campaign", "engineering");
        } else {
          this.registry.campaignShell.show("statistics", "engineering");
        }
      },
      onSettingsMenu: () => {
        const state = this.registry.campaignManager.getState();
        this.registry.navigationOrchestrator.switchScreen("settings", !!state);
        if (state) {
          this.registry.campaignShell.show("campaign", "settings");
        } else {
          this.registry.campaignShell.show("global", "settings", false);
        }
      },
      onSetupBack: () => {
        this.registry.screenManager.goBack();
      },
      onLaunchMission: () => this.registry.missionRunner.launchMission(),
      onMapGeneratorChange: (type: MapGeneratorType) => {
        if (this.registry.missionSetupManager.currentMapGeneratorType === type) return;
        this.registry.missionSetupManager.currentMapGeneratorType = type;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
      onMissionTypeChange: (type: MissionType) => {
        this.registry.missionSetupManager.currentMissionType = type;
        if (
          this.registry.missionSetupManager.currentMissionType === MissionType.EscortVIP
        ) {
          this.registry.missionSetupManager.currentSquad.soldiers =
            this.registry.missionSetupManager.currentSquad.soldiers.filter(
              (s) => s.archetypeId !== "vip",
            );
        }
        this.registry.missionSetupManager.saveCurrentConfig();
        this.squadBuilder.update(
          this.registry.missionSetupManager.currentSquad,
          this.registry.missionSetupManager.currentMissionType,
          !!this.registry.missionSetupManager.currentCampaignNode,
        );
      },
      onThemeChange: (themeId: string) => {
        this.registry.missionSetupManager.currentThemeId = themeId;
        this.registry.missionSetupManager.saveCurrentConfig();
        this.registry.themeManager.setTheme(themeId);
      },
      onUnitStyleChange: (style: string) => {
        this.registry.missionSetupManager.unitStyle = style as UnitStyle;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
      onToggleFog: (enabled: boolean) => {
        this.registry.missionSetupManager.fogOfWarEnabled = enabled;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
      onToggleDebug: (enabled: boolean) => {
        this.registry.missionSetupManager.debugOverlayEnabled = enabled;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
      onToggleLos: (enabled: boolean) => {
        this.registry.missionSetupManager.losOverlayEnabled = enabled;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
      onToggleAi: (enabled: boolean) => {
        this.registry.missionSetupManager.agentControlEnabled = enabled;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
      onToggleManualDeployment: (enabled: boolean) => {
        this.registry.missionSetupManager.manualDeployment = enabled;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
      onTogglePauseAllowed: (enabled: boolean) => {
        this.registry.missionSetupManager.allowTacticalPause = enabled;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
      onMapSizeChange: (width: number, _height: number) => {
        if (this.registry.missionSetupManager.currentCampaignNode) return;
        this.registry.missionSetupManager.currentMapWidth = width;
        this.registry.missionSetupManager.currentMapHeight = _height;
        this.registry.missionSetupManager.currentSpawnPointCount =
          calculateSpawnPoints(width);
        const spInput = document.getElementById(
          "map-spawn-points",
        ) as HTMLInputElement;
        const spValue = document.getElementById("map-spawn-points-value");
        if (spInput) {
          spInput.value =
            this.registry.missionSetupManager.currentSpawnPointCount.toString();
          if (spValue) spValue.textContent = spInput.value;
        }
        this.registry.missionSetupManager.saveCurrentConfig();
      },
      onLoadReplay: (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          try {
            const data = JSON.parse(content);
            const replayData = data.replayData || data;
            const currentState = data.currentState as any;

            if (replayData && replayData.commands) {
              this.gameClient.loadReplay(replayData);

              let report: MissionReport;
              if (currentState) {
                report = {
                  nodeId: "custom",
                  seed: currentState.seed,
                  result: currentState.status === "Won" ? "Won" : "Lost",
                  aliensKilled: currentState.stats.aliensKilled,
                  scrapGained: currentState.stats.scrapGained,
                  intelGained: 0,
                  timeSpent: currentState.t,
                  soldierResults: currentState.units.map((u: any) => ({
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
                report = {
                  nodeId: "custom",
                  seed: replayData.seed || 0,
                  result: "Won",
                  aliensKilled: 0,
                  scrapGained: 0,
                  intelGained: 0,
                  timeSpent: replayData.commands.length > 0 ? replayData.commands[replayData.commands.length - 1].t : 0,
                  soldierResults: (replayData.squadConfig?.soldiers || []).map((s: SquadSoldierConfig, idx: number) => ({
                    soldierId: s.id || `s-${idx}`,
                    name: s.name || s.archetypeId || "Unknown",
                    tacticalNumber: s.tacticalNumber || idx + 1,
                    xpBefore: 0,
                    xpGained: 0,
                    kills: 0,
                    promoted: false,
                    status: "Healthy",
                  })),
                };
              }

              if (replayData.themeId) {
                this.registry.themeManager.setTheme(replayData.themeId);
              }

              this.registry.navigationOrchestrator.switchScreen(
                "debrief",
                false,
                true,
                report,
                replayData.unitStyle || this.registry.missionSetupManager.unitStyle,
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
      () => this.registry.screenManager.goBack(),
    );
    globalShortcuts.init();

    TooltipManager.getInstance();

    this.registry.missionSetupManager.loadAndApplyConfig(false);
    const mvEl = document.getElementById("menu-version");
    if (mvEl) mvEl.textContent = `v${VERSION}`;

    this.setupResponsiveDrawers();
  }

  public start() {
    const persisted = this.registry.screenManager.loadPersistedState();
    if (persisted) {
      this.registry.navigationOrchestrator.handleExternalScreenChange(persisted.screenId, persisted.isCampaign);
    } else {
      this.showMainMenu();
    }
  }

  public stop() {
    this.gameClient.stop();
    this.inputManager.destroy();
    this.registry.screenManager.destroy();
    InputDispatcher.getInstance().popContext("tactical");
  }

  private showMainMenu() {
    this.registry.navigationOrchestrator.switchScreen("main-menu");
  }

  private setupAdditionalUIBindings() {
    const btnAbort = document.getElementById("btn-abort");
    if (btnAbort) btnAbort.onclick = () => this.registry.missionRunner.abortMission();

    const btnRetry = document.getElementById("btn-retry");
    if (btnRetry) btnRetry.onclick = () => this.registry.missionRunner.launchMission();

    const btnExport = document.getElementById("btn-export");
    if (btnExport) btnExport.onclick = () => this.exportReplay();

    const speedSlider = document.getElementById("speed-slider") as HTMLInputElement;
    if (speedSlider) {
      speedSlider.oninput = () => {
        this.gameClient.setTimeScale(parseFloat(speedSlider.value));
        this.registry.missionRunner.syncSpeedUI();
      };
    }

    const btnPause = document.getElementById("btn-pause");
    if (btnPause) btnPause.onclick = () => this.togglePause();

    const btnForceWin = document.getElementById("btn-debug-win");
    if (btnForceWin) btnForceWin.onclick = () => this.gameClient.applyCommand({ type: CommandType.DEBUG_FORCE_WIN });

    const btnForceLose = document.getElementById("btn-debug-lose");
    if (btnForceLose) btnForceLose.onclick = () => this.gameClient.applyCommand({ type: CommandType.DEBUG_FORCE_LOSE });
  }

  private onEquipmentConfirmed(config: SquadConfig) {
    if (this.registry.missionSetupManager.currentCampaignNode) {
      config.soldiers.forEach((soldier) => {
        if (soldier.id) {
          this.registry.campaignManager.assignEquipment(soldier.id, {
            rightHand: soldier.rightHand,
            leftHand: soldier.leftHand,
            body: soldier.body,
            feet: soldier.feet,
          });
        }
      });
      this.registry.missionSetupManager.currentSquad = config;
      this.registry.missionSetupManager.saveCurrentConfig();
      this.registry.navigationOrchestrator.switchScreen("campaign", true);
      this.registry.campaignShell.show("campaign", "sector-map");
    } else {
      this.registry.missionSetupManager.currentSquad = config;
      this.registry.missionSetupManager.saveCurrentConfig();
      this.registry.missionSetupManager.loadAndApplyConfig(false);
      this.squadBuilder.update(
        this.registry.missionSetupManager.currentSquad,
        this.registry.missionSetupManager.currentMissionType,
        false,
      );
      this.registry.navigationOrchestrator.switchScreen("mission-setup", false);
      this.registry.campaignShell.show("custom", "setup");
    }
  }

  private onShowSummary() {
    const state = this.registry.campaignManager.getState();
    if (state) {
      this.registry.navigationOrchestrator.switchScreen("campaign-summary", true, true, state);
    }
  }

  private async copyWorldState() {
    const state = this.registry.missionRunner.getCurrentGameState();
    if (!state) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
      this.modalService.alert("World state copied to clipboard!");
    } catch (err) {
      Logger.error("Failed to copy world state:", err);
    }
  }

  private exportReplay() {
    const replay = this.gameClient.getReplayData();
    const blob = new Blob([JSON.stringify(replay, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voidlock-replay-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private onCampaignNodeSelect(node: CampaignNode) {
    this.registry.missionSetupManager.currentCampaignNode = node;
    this.registry.missionSetupManager.currentSeed = node.mapSeed;
    this.registry.missionSetupManager.currentMissionType = node.missionType || MissionType.RecoverIntel;
    this.registry.missionSetupManager.currentStaticMapData = undefined;

    this.registry.navigationOrchestrator.applyCampaignTheme();
    this.registry.missionSetupManager.loadAndApplyConfig(true);
    this.registry.missionSetupManager.saveCurrentConfig();
    this.equipmentScreen.setCampaign(true);
    this.equipmentScreen.setHasNodeSelected(true);
    this.equipmentScreen.updateConfig(this.registry.missionSetupManager.currentSquad);
    this.registry.navigationOrchestrator.switchScreen("equipment", true);
    this.registry.campaignShell.show("campaign", "ready-room", true);
  }

  private onCampaignStart() {
    this.registry.campaignShell.show("campaign", "sector-map");
    this.registry.navigationOrchestrator.switchScreen("campaign", true);
  }

  private togglePause() {
    const isPaused = this.gameClient.getIsPaused();
    this.gameClient.setTimeScale(isPaused ? 1.0 : 0.0);
    this.registry.missionRunner.syncSpeedUI();
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
