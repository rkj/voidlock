import { AppContext } from "./AppContext";
import { InputBinder } from "./InputBinder";
import { GameClient } from "@src/engine/GameClient";
import {
  GameState,
  MapGeneratorType,
  MissionType,
  SquadConfig,
  UnitStyle,
  Unit,
  UnitState,
  MapGenerationConfig,
} from "@src/shared/types";
import { calculateSpawnPoints } from "@src/shared/campaign_types";
import { DebugUtility } from "@src/renderer/DebugUtility";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { ModalService } from "@src/renderer/ui/ModalService";
import {
  CampaignShell,
  CampaignTabId,
  CampaignShellMode,
} from "@src/renderer/ui/CampaignShell";
import pkg from "../../../package.json";
import { MissionCoordinator } from "./MissionCoordinator";
import { CampaignFlowCoordinator } from "./CampaignFlowCoordinator";
import { MissionSetupManager } from "./MissionSetupManager";
import { CampaignScreen } from "../screens/CampaignScreen";
import { BarracksScreen } from "../screens/BarracksScreen";
import { DebriefScreen } from "../screens/DebriefScreen";
import { EquipmentScreen } from "../screens/EquipmentScreen";
import { CampaignSummaryScreen } from "../screens/CampaignSummaryScreen";
import { StatisticsScreen } from "../screens/StatisticsScreen";
import { ThemeManager } from "../ThemeManager";
import { CampaignManager } from "../campaign/CampaignManager";
import { ScreenManager, ScreenId } from "../ScreenManager";
import { MapFactory } from "@src/engine/map/MapFactory";
import { MenuController } from "../MenuController";
import { HUDManager } from "../ui/HUDManager";
import { InputManager } from "../InputManager";

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
  private campaignSummaryScreen!: CampaignSummaryScreen;
  private statisticsScreen!: StatisticsScreen;

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
    await ThemeManager.getInstance().init();
    this.context.themeManager = ThemeManager.getInstance();
    this.context.campaignManager = CampaignManager.getInstance();
    this.context.campaignManager.load();
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
      () => this.copyWorldState(),
      () => this.context.gameClient.forceWin(),
      () => this.context.gameClient.forceLose(),
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
    );

    // 3. Initialize screens
    this.campaignSummaryScreen = new CampaignSummaryScreen(
      "screen-campaign-summary",
      () => {
        this.campaignSummaryScreen.hide();
        this.context.gameClient.stop();
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
          this.campaignSummaryScreen.show(state);
          this.context.screenManager.show("campaign-summary");
          return;
        }

        if (this.missionSetupManager.currentCampaignNode) {
          this.campaignScreen.show();
          this.context.screenManager.show("campaign");
          this.context.campaignShell.show("campaign", "sector-map");
        } else {
          this.context.campaignShell.hide();
          this.showMainMenu();
        }
      },
    );

    this.barracksScreen = new BarracksScreen(
      "screen-barracks",
      this.context.campaignManager,
      this.context.modalService,
      () => {
        this.campaignScreen.show();
        this.context.screenManager.show("campaign", true, true);
        this.context.campaignShell.show("campaign", "sector-map");
      },
      () => this.context.campaignShell.refresh(),
    );

    this.campaignScreen = new CampaignScreen(
      "screen-campaign",
      this.context.campaignManager,
      this.context.modalService,
      (node) =>
        this.campaignFlowCoordinator.onCampaignNodeSelected(
          node,
          () => this.campaignScreen.show(),
          (n, size, spawnPoints) =>
            this.missionSetupManager.prepareMissionSetup(n, size, spawnPoints),
        ),
      () => this.showMainMenu(),
      () => {
        this.applyCampaignTheme();
        this.context.campaignShell.show("campaign", "sector-map");
      },
      () => {
        const state = this.context.campaignManager.getState();
        if (state) {
          this.campaignSummaryScreen.show(state);
          this.context.screenManager.show("campaign-summary", true, true);
          this.context.campaignShell.hide();
        }
      },
    );

    this.equipmentScreen = new EquipmentScreen(
      "screen-equipment",
      this.context.campaignManager,
      this.missionSetupManager.currentSquad,
      (config) => this.onEquipmentConfirmed(config),
      () => {
        this.context.screenManager.goBack();
        const screen = this.context.screenManager.getCurrentScreen();
        if (screen === "campaign")
          this.context.campaignShell.show("campaign", "sector-map");
        else if (screen === "barracks")
          this.context.campaignShell.show("campaign", "barracks");
        else if (screen === "mission-setup") {
          if (this.missionSetupManager.currentCampaignNode) {
            this.context.campaignShell.show("campaign", "sector-map", false);
          } else {
            this.context.campaignShell.show("custom");
          }
        }
      },
      () => this.context.campaignShell.refresh(),
    );

    this.statisticsScreen = new StatisticsScreen("screen-statistics");

    // Special bindings that were in main.ts
    this.setupAdditionalUIBindings();

    // 4. Bind events
    this.inputBinder.bindAll({
      onTogglePause: () => this.togglePause(),
      onAbortMission: () => this.abortMission(),
      onCustomMission: () => {
        this.missionSetupManager.currentCampaignNode = null;
        this.missionSetupManager.loadAndApplyConfig(false);
        this.context.campaignShell.show("custom");
        this.context.screenManager.show("mission-setup");
      },
      onCampaignMenu: () => {
        this.campaignFlowCoordinator.onCampaignMenu(
          () => this.applyCampaignTheme(),
          (state) => this.campaignSummaryScreen.show(state),
          () => this.campaignScreen.show(),
        );
      },
      onResetData: () => this.campaignFlowCoordinator.onResetData(),
      onShowEquipment: () => {
        this.equipmentScreen.updateConfig(
          this.missionSetupManager.currentSquad,
        );
        const isCampaign = !!this.missionSetupManager.currentCampaignNode;
        this.context.screenManager.show("equipment", true, isCampaign);
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
      onExportReplay: () => {
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
      },
      onShowStatistics: () => {
        this.statisticsScreen.show();
        this.context.screenManager.show("statistics", true, false);
        this.context.campaignShell.show("statistics", "stats");
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
      onUnitStyleChange: (style: UnitStyle) => {
        this.missionSetupManager.unitStyle = style;
        this.missionSetupManager.saveCurrentConfig();
        this.missionSetupManager.renderUnitStylePreview();
      },
      onThemeChange: (themeId: string) => {
        this.missionSetupManager.currentThemeId = themeId;
        this.context.themeManager.setTheme(
          this.missionSetupManager.currentThemeId,
        );
        this.missionSetupManager.saveCurrentConfig();
        this.missionSetupManager.renderUnitStylePreview();
      },
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
        this.missionSetupManager.renderSquadBuilder(
          this.missionSetupManager.currentCampaignNode !== null,
        );
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
    });

    this.context.inputManager.init();

    // Initial UI state
    this.missionSetupManager.loadAndApplyConfig(false);
    const mvEl = document.getElementById("menu-version");
    if (mvEl) mvEl.textContent = `v${VERSION}`;
  }

  private showMainMenu() {
    this.context.campaignShell.hide();
    this.context.screenManager.show("main-menu");
  }

  private onShellTabChange(tabId: CampaignTabId) {
    switch (tabId) {
      case "sector-map":
        this.campaignScreen.show();
        this.context.screenManager.show("campaign", true, true);
        break;
      case "barracks":
        this.barracksScreen.show();
        this.context.screenManager.show("barracks", true, true);
        break;
      case "engineering":
        // Not implemented
        break;
      case "stats":
        this.statisticsScreen.show();
        this.context.screenManager.show("statistics", true, false);
        break;
    }

    const state = this.context.campaignManager.getState();
    const mode: CampaignShellMode = state ? "campaign" : "statistics";
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
          this.campaignSummaryScreen.show(state);
          this.context.screenManager.show("campaign-summary", true, true);
          this.context.campaignShell.hide();
        } else {
          this.campaignScreen.show();
          this.context.campaignShell.show("campaign", "sector-map");
        }
        break;
      }
      case "campaign-summary": {
        const state = this.context.campaignManager.getState();
        if (state) {
          this.campaignSummaryScreen.show(state);
          this.context.screenManager.show("campaign-summary", true, true);
          this.context.campaignShell.hide();
        } else {
          this.showMainMenu();
        }
        break;
      }
      case "mission-setup": {
        const rehydrated = isCampaign
          ? this.missionSetupManager.rehydrateCampaignNode()
          : false;
        this.missionSetupManager.loadAndApplyConfig(rehydrated);
        if (rehydrated) {
          this.applyCampaignTheme();
          this.context.campaignShell.show("campaign", "sector-map", false);
        } else {
          this.context.campaignShell.show("custom");
        }
        break;
      }
      case "equipment":
        this.applyCampaignTheme();
        this.equipmentScreen.updateConfig(
          this.missionSetupManager.currentSquad,
        );
        if (isCampaign || this.missionSetupManager.currentCampaignNode) {
          this.context.campaignShell.show("campaign", "sector-map", false);
        } else {
          this.context.campaignShell.show("custom");
        }
        break;
      case "barracks":
        this.applyCampaignTheme();
        this.barracksScreen.show();
        this.context.campaignShell.show("campaign", "barracks");
        break;
      case "statistics":
        this.statisticsScreen.show();
        this.context.campaignShell.show("statistics", "stats");
        break;
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
    this.launchMission();
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

  private applyCampaignTheme() {
    const state = this.context.campaignManager.getState();
    if (state && state.rules.themeId) {
      this.context.themeManager.setTheme(state.rules.themeId);
    } else {
      this.context.themeManager.setTheme("default");
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

    if (btn) btn.textContent = isPaused ? "▶ PLAY" : "|| PAUSE";
    if (gameSpeedValue)
      gameSpeedValue.textContent = TimeUtility.formatSpeed(lastSpeed, isPaused);
    if (gameSpeedSlider)
      gameSpeedSlider.value = TimeUtility.scaleToSlider(lastSpeed).toString();
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
    const config = this.missionSetupManager.saveCurrentConfig();
    this.missionCoordinator.launchMission(
      {
        ...config,
        seed: config.lastSeed,
        staticMapData: this.missionSetupManager.currentStaticMapData,
        campaignNode: this.missionSetupManager.currentCampaignNode || undefined,
      },
      (report) => {
        if (report.nodeId !== "custom") {
          this.context.campaignManager.processMissionResult(report);
        }

        this.setMissionHUDVisible(false);

        this.debriefScreen.show(report, this.missionSetupManager.unitStyle);
        this.context.screenManager.show("debrief");
        return true;
      },
      (state) => this.updateUI(state),
      () => this.syncSpeedUI(),
    );
  }

  private resumeMission() {
    this.setMissionHUDVisible(true);
    this.missionCoordinator.resumeMission(
      (report) => {
        if (report.nodeId !== "custom") {
          this.context.campaignManager.processMissionResult(report);
        }

        this.setMissionHUDVisible(false);

        this.debriefScreen.show(report, this.missionSetupManager.unitStyle);
        this.context.screenManager.show("debrief");
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

  private abortMission() {
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
        this.debriefScreen.show(report, this.missionSetupManager.unitStyle);
        this.context.screenManager.show("debrief");
        return true;
      },
      () => this.showMainMenu(),
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
