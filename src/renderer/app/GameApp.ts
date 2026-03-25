import { InputBinder } from "./InputBinder";
import type {
  MapGeneratorType,
  SquadSoldierConfig,
  Unit} from "@src/shared/types";
import {
  MissionType,
  CommandType,
  UnitState,
  SquadConfig,
} from "@src/shared/types";
import type {
  MissionReport,
  CampaignNode} from "@src/shared/campaign_types";
import {
  calculateSpawnPoints
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
import { GlobalShortcuts } from "../GlobalShortcuts";
import { TooltipManager } from "../ui/TooltipManager";
import { AppServiceRegistry } from "./AppServiceRegistry";
import type { Renderer } from "../Renderer";
import { Logger } from "@src/shared/Logger";
import type { AdvisorOverlay } from "../ui/AdvisorOverlay";

const VERSION = pkg.version;

export class GameApp {
  // Services
  public registry: AppServiceRegistry;
  
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
  public campaignScreen!: CampaignScreen;
  public debriefScreen!: DebriefScreen;
  public equipmentScreen!: EquipmentScreen;
  public missionSetupScreen!: MissionSetupScreen;
  public campaignSummaryScreen!: CampaignSummaryScreen;
  public statisticsScreen!: StatisticsScreen;
  public engineeringScreen!: EngineeringScreen;
  public settingsScreen!: SettingsScreen;
  public mainMenuScreen!: MainMenuScreen;

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
      onAbortMission: () => { void this.registry.missionRunner.abortMission(); },
      onMenuInput: (key, shift) => this.registry.inputOrchestrator.handleMenuInput(key, shift),
      onTimeScaleChange: (scale) => {
        if (this.gameClient.getIsPaused() && scale > 0) {
          this.gameClient.resume();
        }
        this.gameClient.setTimeScale(scale);
        this.registry.uiOrchestrator.syncSpeedUI();
      },
      onCopyWorldState: () => { void this.registry.uiOrchestrator.copyWorldState(); },
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
      onTogglePause: () => this.registry.uiOrchestrator.togglePause(),
      onToggleDebug: (enabled) => this.gameClient.toggleDebugOverlay(enabled),
      onToggleLos: (enabled) => this.gameClient.toggleLosOverlay(enabled),
      onCanvasClick: (e) => this.registry.inputOrchestrator.handleCanvasClick(e),
      onRendererCreated: (renderer) => { this.renderer = renderer; },
      getCurrentGameState: () => this.registry.missionRunner.getCurrentGameState(),
      isDebriefVisible: () => this.debriefScreen.isVisible(),
      getSelectedUnitId: () => this.registry.missionRunner.getSelectedUnitId(),
      getCellCoordinates: (px, py) => {
        if (!this.renderer) throw new Error("Renderer not initialized");
        return this.renderer.getCellCoordinates(px, py);
      },
      getWorldCoordinates: (px, py) => {
        if (!this.renderer) throw new Error("Renderer not initialized");
        return this.renderer.getWorldCoordinates(px, py);
      },
      cycleUnits: (reverse) => this.registry.inputOrchestrator.cycleUnits(reverse),
      panMap: (direction) => this.registry.inputOrchestrator.panMap(direction),
      panMapBy: (dx, dy) => this.registry.inputOrchestrator.panMapBy(dx, dy),
      zoomMap: (ratio, cx, cy) => this.registry.inputOrchestrator.zoomMap(ratio, cx, cy),
      getRenderer: () => this.renderer,
      onForceWin: () => this.gameClient.applyCommand({ type: CommandType.DEBUG_FORCE_WIN }),
      onForceLose: () => this.gameClient.applyCommand({ type: CommandType.DEBUG_FORCE_LOSE }),
    });

    this.initializeScreens();

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

    this.squadBuilder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: this.registry.campaignManager,
      campaignShell: this.registry.campaignShell,
      modalService: this.registry.modalService,
      initialSquad: this.registry.missionSetupManager.currentSquad,
      missionType: this.registry.missionSetupManager.currentMissionType,
      isCampaign: this.registry.missionSetupManager.isCampaign(),
      onSquadUpdated: (squad) => {
        this.registry.missionSetupManager.currentSquad = squad;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
    });

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
      },
    );

    // 4. Setup global UI and shortcuts
    this.registry.uiOrchestrator.setupAdditionalUIBindings({
      onAbortMission: () => { void this.registry.missionRunner.abortMission(); },
      onRetryMission: () => this.registry.missionRunner.launchMission(),
      onForceWin: () =>
        this.gameClient.applyCommand({ type: CommandType.DEBUG_FORCE_WIN }),
      onForceLose: () =>
        this.gameClient.applyCommand({ type: CommandType.DEBUG_FORCE_LOSE }),
    });

    // 5. Bind events
    this.setupInputBindings();

    const globalShortcuts = new GlobalShortcuts(
      this.registry.inputDispatcher,
      () => this.registry.uiOrchestrator.togglePause(),
      () => this.registry.screenManager.goBack(),
    );
    globalShortcuts.init();

    TooltipManager.getInstance();

    this.registry.missionSetupManager.loadAndApplyConfig(false);
    const mvEl = document.getElementById("menu-version");
    if (mvEl) mvEl.textContent = `v${VERSION}`;

    this.registry.uiOrchestrator.setupResponsiveDrawers();

    // Visual Identity (voidlock-089xc.1)
    this.renderTerminalTitleBar();
    const globalConfig = ConfigManager.loadGlobal();
    if (globalConfig.phosphor === "amber") {
      document.body.classList.add("crt-amber");
    }
  }

  private initializeScreens() {
    this.mainMenuScreen = new MainMenuScreen(
      "screen-main-menu",
      this.registry.inputDispatcher,
    );
    this.missionSetupScreen = new MissionSetupScreen({
      containerId: "screen-mission-setup",
      inputDispatcher: this.registry.inputDispatcher,
      onBack: () => {
        this.registry.screenManager.goBack();
      },
    });

    this.campaignScreen = new CampaignScreen({
      containerId: "screen-campaign",
      campaignManager: this.registry.campaignManager,
      themeManager: this.registry.themeManager,
      inputDispatcher: this.registry.inputDispatcher,
      modalService: this.registry.modalService,
      onNodeSelect: (node: CampaignNode) => this.registry.navigationOrchestrator.onCampaignNodeSelect(node),
      onMainMenu: () => this.showMainMenu(),
      onCampaignStart: () => this.onCampaignStart(),
      onShowSummary: () => this.registry.navigationOrchestrator.onShowSummary(),
    });

    this.debriefScreen = new DebriefScreen({
      containerId: "screen-debrief",
      gameClient: this.gameClient,
      themeManager: this.registry.themeManager,
      assetManager: this.registry.assetManager,
      inputDispatcher: this.registry.inputDispatcher,
      onContinue: () => {
        Logger.debug("[GameApp] Debrief continue clicked");
        this.debriefScreen.hide();

        const state = this.registry.campaignManager.getState();
        Logger.debug("[GameApp] State history length:", state?.history?.length);
        if (
          state &&
          (state.status === "Victory" || state.status === "Defeat")
        ) {
          this.registry.navigationOrchestrator.switchScreenWithArgs({ id: "campaign-summary", isCampaign: true, updateHash: true, force: false, showArgs: [state] });
          return;
        }

        if (state && state.history?.length === 1) {
          // Mission 2: Ready Room tutorial flow
          const nextNode = state.nodes.find((n) => n.status === "Accessible");
          Logger.debug("[GameApp] Mission 2 tutorial flow, nextNode:", nextNode?.id);
          if (nextNode) {
            this.registry.navigationOrchestrator.onCampaignNodeSelect(nextNode);
            return;
          }
        }

        if (this.registry.missionSetupManager.currentCampaignNode) {
          this.registry.navigationOrchestrator.switchScreen("campaign", true);
          this.registry.campaignShell.show("campaign", "sector-map");
        } else {
          this.registry.campaignShell.hide();
          this.showMainMenu();
        }
      },
      onReplay: () => {
        this.debriefScreen.hide();
        this.registry.missionRunner.launchMission();
      },
      onExport: () => this.registry.uiOrchestrator.exportReplay(),
    });

    this.equipmentScreen = new EquipmentScreen({
      containerId: "screen-equipment",
      campaignManager: this.registry.campaignManager,
      inputDispatcher: this.registry.inputDispatcher,
      modalService: this.registry.modalService,
      currentSquad: this.registry.missionSetupManager.currentSquad,
      onBack: (config: SquadConfig) => this.registry.navigationOrchestrator.onEquipmentBack(config),
      onUpdate: () => this.registry.campaignShell.refresh(),
      onLaunch: (config: SquadConfig) => {
        if (this.registry.missionSetupManager.currentMissionType === MissionType.Prologue) {
          // Manually save for Prologue since we intercept the launch
          config.soldiers.forEach((soldier: SquadSoldierConfig) => {
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

          this.AdvisorOverlay.showMessage({
            id: "prologue_intro",
            title: "Project Voidlock: Operation First Light",
            text: "Commander, wake up. The Voidlock is failing. The station's core is unstable, and the swarms are breaching the lower decks. \n\nYour objective is clear: Recover the decrypted data disk from the secure terminal and extract your squad. Failure is not an option. The future of the project depends on this data.",
            illustration: "bg_station",
            portrait: "logo_gemini",
            blocking: true
          }, () => {
            this.registry.missionRunner.launchMission();
          });
        } else {
          this.registry.navigationOrchestrator.onLaunchMission(config);
        }
      },
      isShop: false,
      isCampaign: false,
    });

    this.statisticsScreen = new StatisticsScreen({
      containerId: "screen-statistics",
      metaManager: this.registry.metaManager,
      inputDispatcher: this.registry.inputDispatcher,
    });
    this.engineeringScreen = new EngineeringScreen({
      containerId: "screen-engineering",
      metaManager: this.registry.metaManager,
      inputDispatcher: this.registry.inputDispatcher,
      onUpdate: () => this.registry.campaignShell.refresh(),
    });

    this.settingsScreen = new SettingsScreen({
      containerId: "screen-settings",
      themeManager: this.registry.themeManager,
      assetManager: this.registry.assetManager,
      inputDispatcher: this.registry.inputDispatcher,
      cloudSync: this.registry.cloudSync,
      modalService: this.registry.modalService,
      onBack: () => {
        this.registry.screenManager.goBack();
        const screen = this.registry.screenManager.getCurrentScreen();
        this.registry.navigationOrchestrator.handleExternalScreenChange(
          screen,
          !!this.registry.campaignManager.getState(),
        );
      },
    });

    this.campaignSummaryScreen = new CampaignSummaryScreen(
      "screen-campaign-summary",
      this.registry.inputDispatcher,
      () => {
        this.campaignSummaryScreen.hide();
        this.gameClient.stop();
        ConfigManager.clearCampaign();
        this.registry.campaignManager.deleteSave();
        this.showMainMenu();
      },
    );
  }

  private setupInputBindings() {
    this.inputBinder = new InputBinder();
    this.inputBinder.bindAll({
      onTogglePause: () => this.registry.uiOrchestrator.togglePause(),
      onAbortMission: () => { void this.registry.missionRunner.abortMission(); },
      onCustomMission: () => this.onCustomMission(),
      onCampaignMenu: () => {
        this.registry.navigationOrchestrator.handleExternalScreenChange("campaign", true);
      },
      onResetData: () => { void this.campaignFlowCoordinator.onResetData(); },
      onShowEquipment: () => {
        const isCampaign = !!this.registry.missionSetupManager.currentCampaignNode;
        this.registry.navigationOrchestrator.handleExternalScreenChange("equipment", isCampaign);
      },
      onLoadStaticMap: (json) => { void this.registry.missionSetupManager.loadStaticMap(json); },
      onUploadStaticMap: (file) => { void this.registry.missionSetupManager.uploadStaticMap(file); },
      onConvertAscii: (ascii) => { void this.registry.missionSetupManager.convertAscii(ascii); },
      onExportReplay: () => this.registry.uiOrchestrator.exportReplay(),
      onShowStatistics: () => {
        this.registry.navigationOrchestrator.switchScreen("statistics", false);
        this.registry.campaignShell.show("statistics", "stats");
      },
      onEngineeringMenu: () => this.onEngineeringMenu(),
      onSettingsMenu: () => this.onSettingsMenu(),
      onSetupBack: () => { this.registry.screenManager.goBack(); },
      onLaunchMission: () => this.registry.missionRunner.launchMission(),
      onMapGeneratorChange: (type: MapGeneratorType) => {
        if (this.registry.missionSetupManager.currentMapGeneratorType === type) return;
        this.registry.missionSetupManager.currentMapGeneratorType = type;
        this.registry.missionSetupManager.saveCurrentConfig();
      },
      onMissionTypeChange: (type: MissionType) => this.onMissionTypeChange(type),
      onThemeChange: (themeId: string) => {
        this.registry.missionSetupManager.currentThemeId = themeId;
        this.registry.missionSetupManager.saveCurrentConfig();
        this.registry.themeManager.setTheme(themeId);
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
      onMapSizeChange: (width: number, _height: number) => this.onMapSizeChange(width, _height),
      onLoadReplay: (file) => this.onLoadReplay(file),
    });
  }

  private onCustomMission() {
    this.registry.missionSetupManager.currentCampaignNode = null;
    this.registry.missionSetupManager.loadAndApplyConfig(false);
    this.registry.campaignShell.show("custom", "setup");
    this.squadBuilder.update(
      this.registry.missionSetupManager.currentSquad,
      this.registry.missionSetupManager.currentMissionType,
      false,
    );
    this.registry.navigationOrchestrator.switchScreen("mission-setup", false);
  }

  private onEngineeringMenu() {
    const state = this.registry.campaignManager.getState();
    this.registry.navigationOrchestrator.switchScreen("engineering", !!state);
    if (state) {
      this.registry.campaignShell.show("campaign", "engineering");
    } else {
      this.registry.campaignShell.show("statistics", "engineering");
    }
  }

  private onSettingsMenu() {
    const state = this.registry.campaignManager.getState();
    this.registry.navigationOrchestrator.switchScreen("settings", !!state);
    if (state) {
      this.registry.campaignShell.show("campaign", "settings");
    } else {
      this.registry.campaignShell.show("global", "settings", false);
    }
  }

  private onMissionTypeChange(type: MissionType) {
    this.registry.missionSetupManager.currentMissionType = type;
    if (this.registry.missionSetupManager.currentMissionType === MissionType.EscortVIP) {
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
  }

  private onMapSizeChange(width: number, height: number) {
    if (this.registry.missionSetupManager.currentCampaignNode) return;
    this.registry.missionSetupManager.currentMapWidth = width;
    this.registry.missionSetupManager.currentMapHeight = height;
    this.registry.missionSetupManager.currentSpawnPointCount = calculateSpawnPoints(width);
    const spInput = document.getElementById("map-spawn-points") as HTMLInputElement;
    const spValue = document.getElementById("map-spawn-points-value");
    if (spInput) {
      spInput.value = this.registry.missionSetupManager.currentSpawnPointCount.toString();
      if (spValue) spValue.textContent = spInput.value;
    }
    this.registry.missionSetupManager.saveCurrentConfig();
  }

  private onLoadReplay(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const data = JSON.parse(content);
        const replayData = data.replayData || data;
        const currentState = data.currentState;

        if (!replayData?.commands) {
          void this.modalService.alert("Invalid replay file format.");
          return;
        }

        this.gameClient.loadReplay(replayData);
        const report: MissionReport = currentState
          ? this.buildReportFromState(currentState)
          : this.buildReportFromReplay(replayData);

        if (replayData.themeId) {
          this.registry.themeManager.setTheme(replayData.themeId);
        }

        this.registry.navigationOrchestrator.switchScreenWithArgs({
          id: "debrief",
          isCampaign: false,
          updateHash: true,
          force: false,
          showArgs: [report, replayData.unitStyle || this.registry.missionSetupManager.unitStyle],
        });
      } catch (_err) {
        void this.modalService.alert("Failed to parse replay file.");
      }
    };
    reader.readAsText(file);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildReportFromState(currentState: any): MissionReport {
    return {
      nodeId: "custom",
      seed: currentState.seed,
      result: currentState.status === "Won" ? "Won" : "Lost",
      aliensKilled: currentState.stats.aliensKilled,
      scrapGained: currentState.stats.scrapGained,
      intelGained: 0,
      timeSpent: currentState.t,
      soldierResults: currentState.units.map((u: Unit) => ({
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
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildReportFromReplay(replayData: any): MissionReport {
    return {
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
    this.registry.destroy();
  }

  public destroy() {
    this.stop();
  }

  private showMainMenu() {
    this.registry.navigationOrchestrator.switchScreen("main-menu");
  }

  private onCampaignStart() {
    const state = this.registry.campaignManager.getState();
    const firstNode = state?.nodes.find((n) => n.rank === 0);
    const isPrologue = firstNode?.missionType === MissionType.Prologue;

    if (isPrologue && firstNode) {
      // Direct to Ready Room for Prologue (ADR 0049)
      this.registry.navigationOrchestrator.onCampaignNodeSelect(firstNode);
    } else {
      this.registry.campaignShell.show("campaign", "sector-map");
      this.registry.navigationOrchestrator.switchScreen("campaign", true);
    }
  }

  private renderTerminalTitleBar() {
    const appEl = document.getElementById("app");
    if (!appEl) return;

    // Check if it already exists
    if (document.querySelector(".terminal-title-bar")) return;

    const titleBar = document.createElement("div");
    titleBar.className = "terminal-title-bar";
    
    const leftText = document.createElement("span");
    leftText.textContent = `VOIDLOCK REMOTE OPS TERMINAL v${VERSION}`;
    
    const rightText = document.createElement("span");
    rightText.textContent = "OPERATOR: [SECURE_LINK_ESTABLISHED]";
    
    titleBar.appendChild(leftText);
    titleBar.appendChild(rightText);
    
    appEl.insertBefore(titleBar, appEl.firstChild);
  }
}
