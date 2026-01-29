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
  MapDefinition,
  MapGenerationConfig,
} from "@src/shared/types";
import {
  CampaignNode,
  calculateSpawnPoints,
} from "@src/shared/campaign_types";
import { DebugUtility } from "@src/renderer/DebugUtility";
import { MapUtility } from "@src/renderer/MapUtility";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { ModalService } from "@src/renderer/ui/ModalService";
import {
  CampaignShell,
  CampaignTabId,
  CampaignShellMode,
} from "@src/renderer/ui/CampaignShell";
import pkg from "../../../package.json";
import { SquadBuilder } from "../components/SquadBuilder";
import { MissionCoordinator } from "./MissionCoordinator";
import { CampaignFlowCoordinator } from "./CampaignFlowCoordinator";
import { CampaignScreen } from "../screens/CampaignScreen";
import { BarracksScreen } from "../screens/BarracksScreen";
import { DebriefScreen } from "../screens/DebriefScreen";
import { EquipmentScreen } from "../screens/EquipmentScreen";
import { CampaignSummaryScreen } from "../screens/CampaignSummaryScreen";
import { StatisticsScreen } from "../screens/StatisticsScreen";
import { ConfigManager, GameConfig } from "../ConfigManager";
import { ThemeManager } from "../ThemeManager";
import { CampaignManager } from "../campaign/CampaignManager";
import { ScreenManager } from "../ScreenManager";
import { MapFactory } from "@src/engine/map/MapFactory";
import { MenuController } from "../MenuController";
import { HUDManager } from "../ui/HUDManager";
import { InputManager } from "../InputManager";

const VERSION = pkg.version;

export class GameApp {
  private context: AppContext;
  private inputBinder: InputBinder;
  private squadBuilder!: SquadBuilder;
  private missionCoordinator: MissionCoordinator;
  private campaignFlowCoordinator: CampaignFlowCoordinator;

  // screens
  private campaignScreen!: CampaignScreen;
  private barracksScreen!: BarracksScreen;
  private debriefScreen!: DebriefScreen;
  private equipmentScreen!: EquipmentScreen;
  private campaignSummaryScreen!: CampaignSummaryScreen;
  private statisticsScreen!: StatisticsScreen;

  // app state
  private currentCampaignNode: CampaignNode | null = null;
  private selectedUnitId: string | null = null;
  private currentGameState: GameState | null = null;

  private fogOfWarEnabled = ConfigManager.getDefault().fogOfWarEnabled;
  private debugOverlayEnabled = ConfigManager.getDefault().debugOverlayEnabled;
  private losOverlayEnabled = false;
  private agentControlEnabled = ConfigManager.getDefault().agentControlEnabled;
  private allowTacticalPause = true;
  private unitStyle = ConfigManager.getDefault().unitStyle;

  private currentMapWidth = ConfigManager.getDefault().mapWidth;
  private currentMapHeight = ConfigManager.getDefault().mapHeight;
  private currentSeed: number = ConfigManager.getDefault().lastSeed;
  private currentThemeId: string = ConfigManager.getDefault().themeId;
  private currentMapGeneratorType: MapGeneratorType =
    ConfigManager.getDefault().mapGeneratorType;
  private currentMissionType: MissionType =
    ConfigManager.getDefault().missionType;
  private currentStaticMapData: MapDefinition | undefined = undefined;
  private currentSquad: SquadConfig = ConfigManager.getDefault().squadConfig;
  private currentSpawnPointCount = ConfigManager.getDefault().spawnPointCount;

  constructor() {
    this.context = new AppContext();
    this.inputBinder = new InputBinder(this.context);
    this.missionCoordinator = new MissionCoordinator(this.context);
    this.campaignFlowCoordinator = new CampaignFlowCoordinator(this.context);
  }

  public async initialize() {
    // 1. Initialize core managers
    await ThemeManager.getInstance().init();
    this.context.themeManager = ThemeManager.getInstance();
    this.context.campaignManager = CampaignManager.getInstance();
    this.context.modalService = new ModalService();
    this.context.screenManager = new ScreenManager();

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
        this.context.campaignManager.deleteSave();
        this.showMainMenu();
      },
    );

    this.debriefScreen = new DebriefScreen("screen-debrief", () => {
      this.debriefScreen.hide();
      this.context.gameClient.stop();

      const state = this.context.campaignManager.getState();
      if (state && (state.status === "Victory" || state.status === "Defeat")) {
        this.campaignSummaryScreen.show(state);
        this.context.screenManager.show("campaign-summary");
        return;
      }

      if (this.currentCampaignNode) {
        this.campaignScreen.show();
        this.context.screenManager.show("campaign");
        this.context.campaignShell.show("campaign", "sector-map");
      } else {
        this.context.campaignShell.hide();
        this.showMainMenu();
      }
    });

    this.barracksScreen = new BarracksScreen(
      "screen-barracks",
      this.context.campaignManager,
      this.context.modalService,
      () => {
        this.campaignScreen.show();
        this.context.screenManager.show("campaign");
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
          (n, size, spawnPoints) => this.prepareMissionSetup(n, size, spawnPoints),
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
          this.context.screenManager.show("campaign-summary");
          this.context.campaignShell.hide();
        }
      },
    );

    this.equipmentScreen = new EquipmentScreen(
      "screen-equipment",
      this.context.campaignManager,
      this.currentSquad,
      (config) => this.onEquipmentConfirmed(config),
      () => {
        this.context.screenManager.goBack();
        const screen = this.context.screenManager.getCurrentScreen();
        if (screen === "campaign")
          this.context.campaignShell.show("campaign", "sector-map");
        else if (screen === "barracks")
          this.context.campaignShell.show("campaign", "barracks");
        else if (screen === "mission-setup") this.context.campaignShell.hide();
      },
      () => this.context.campaignShell.refresh(),
    );

    this.statisticsScreen = new StatisticsScreen("screen-statistics");

    this.squadBuilder = new SquadBuilder(
      "squad-builder",
      this.context,
      this.currentSquad,
      this.currentMissionType,
      false,
      (squad) => {
        this.currentSquad = squad;
      },
    );

    // Special bindings that were in main.ts
    this.setupAdditionalUIBindings();

    // 4. Bind events
    this.inputBinder.bindAll({
      onTogglePause: () => this.togglePause(),
      onAbortMission: () => this.abortMission(),
      onCustomMission: () => {
        this.currentCampaignNode = null;
        this.loadAndApplyConfig(false);
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
        this.equipmentScreen.updateConfig(this.currentSquad);
        this.context.screenManager.show("equipment");
        if (this.currentCampaignNode) {
          this.context.campaignShell.show("campaign", "sector-map");
        } else {
          this.context.campaignShell.show("custom");
        }
      },
      onLoadStaticMap: async (json) => {
        try {
          this.currentStaticMapData = MapUtility.transformMapData(
            JSON.parse(json),
          );
          await this.context.modalService.alert("Static Map Loaded.");
        } catch (e) {
          await this.context.modalService.alert("Invalid JSON.");
        }
      },
      onUploadStaticMap: (file) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            this.currentStaticMapData = MapUtility.transformMapData(
              JSON.parse(ev.target?.result as string),
            );
            await this.context.modalService.alert(
              "Static Map Loaded from File.",
            );
          } catch (err) {
            await this.context.modalService.alert("Invalid file.");
          }
        };
        reader.readAsText(file);
      },
      onConvertAscii: async (ascii) => {
        try {
          if (ascii) {
            this.currentStaticMapData = MapFactory.fromAscii(ascii);
          }
          await this.context.modalService.alert("ASCII Map Converted.");
        } catch (e) {
          await this.context.modalService.alert("Invalid ASCII.");
        }
      },
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
        this.context.screenManager.show("statistics");
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
        this.unitStyle = style;
        this.saveCurrentConfig();
      },
      onThemeChange: (themeId: string) => {
        this.currentThemeId = themeId;
        this.context.themeManager.setTheme(this.currentThemeId);
        this.saveCurrentConfig();
      },
      onMapGeneratorChange: (type: MapGeneratorType) => {
        if (this.currentMapGeneratorType === type) return;
        this.currentMapGeneratorType = type;
        this.saveCurrentConfig();
      },
      onMissionTypeChange: (type: MissionType) => {
        this.currentMissionType = type;
        if (this.currentMissionType === MissionType.EscortVIP) {
          this.currentSquad.soldiers = this.currentSquad.soldiers.filter(
            (s) => s.archetypeId !== "vip",
          );
        }
        this.renderSquadBuilder(this.currentCampaignNode !== null);
        this.saveCurrentConfig();
      },
      onToggleFog: (enabled: boolean) => {
        this.fogOfWarEnabled = enabled;
        this.saveCurrentConfig();
      },
      onToggleDebug: (enabled: boolean) => {
        this.debugOverlayEnabled = enabled;
        this.saveCurrentConfig();
      },
      onToggleLos: (enabled: boolean) => {
        this.losOverlayEnabled = enabled;
        this.saveCurrentConfig();
      },
      onToggleAi: (enabled: boolean) => {
        this.agentControlEnabled = enabled;
        this.saveCurrentConfig();
      },
      onTogglePauseAllowed: (enabled: boolean) => {
        this.allowTacticalPause = enabled;
        this.saveCurrentConfig();
      },
      onMapSizeChange: (width: number, _height: number) => {
        if (this.currentCampaignNode) return;
        this.currentMapWidth = width;
        this.currentMapHeight = _height;
        this.currentSpawnPointCount = calculateSpawnPoints(width);
        const spInput = document.getElementById(
          "map-spawn-points",
        ) as HTMLInputElement;
        const spValue = document.getElementById("map-spawn-points-value");
        if (spInput) {
          spInput.value = this.currentSpawnPointCount.toString();
          if (spValue) spValue.textContent = spInput.value;
        }
        this.saveCurrentConfig();
      },
    });

    this.context.inputManager.init();

    // Initial UI state
    this.loadAndApplyConfig(false);
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
        this.context.screenManager.show("campaign");
        break;
      case "barracks":
        this.barracksScreen.show();
        this.context.screenManager.show("barracks");
        break;
      case "engineering":
        // Not implemented
        break;
      case "stats":
        this.statisticsScreen.show();
        this.context.screenManager.show("statistics");
        break;
    }

    const state = this.context.campaignManager.getState();
    const mode: CampaignShellMode = state ? "campaign" : "statistics";
    this.context.campaignShell.show(mode, tabId);
  }

  public start() {
    const persistedScreen = this.context.screenManager.loadPersistedState();
    if (persistedScreen === "mission") {
      this.context.campaignShell.hide();
      this.resumeMission();
    } else if (persistedScreen) {
      if (
        persistedScreen === "campaign" ||
        persistedScreen === "campaign-summary"
      ) {
        this.applyCampaignTheme();
        const state = this.context.campaignManager.getState();
        if (
          state &&
          (state.status === "Victory" || state.status === "Defeat")
        ) {
          this.campaignSummaryScreen.show(state);
          this.context.screenManager.show("campaign-summary");
          this.context.campaignShell.hide();
        } else {
          this.campaignScreen.show();
          this.context.campaignShell.show("campaign", "sector-map");
        }
      } else if (persistedScreen === "mission-setup") {
        if (this.currentCampaignNode) {
          this.context.campaignShell.show("campaign", "sector-map");
        } else {
          this.context.campaignShell.show("custom");
        }
      } else if (persistedScreen === "equipment") {
        this.equipmentScreen.updateConfig(this.currentSquad);
        if (this.currentCampaignNode) {
          this.context.campaignShell.show("campaign", "sector-map");
        } else {
          this.context.campaignShell.show("custom");
        }
      } else if (persistedScreen === "barracks") {
        this.barracksScreen.show();
        this.context.campaignShell.show("campaign", "barracks");
      } else if (persistedScreen === "statistics") {
        this.statisticsScreen.show();
        this.context.campaignShell.show("statistics", "stats");
      } else {
        this.context.campaignShell.hide();
      }
    } else {
      this.showMainMenu();
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

  private prepareMissionSetup(node: CampaignNode, size: number, spawnPoints: number) {
    this.currentCampaignNode = node;
    this.currentSeed = node.mapSeed;

    this.loadAndApplyConfig(true);

    this.currentSeed = node.mapSeed;
    this.currentMapWidth = size;
    this.currentMapHeight = size;
    this.currentSpawnPointCount = spawnPoints;

    const mapSeedInput = document.getElementById(
      "map-seed",
    ) as HTMLInputElement;
    if (mapSeedInput) mapSeedInput.value = this.currentSeed.toString();

    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    if (wInput) wInput.value = this.currentMapWidth.toString();
    if (hInput) hInput.value = this.currentMapHeight.toString();

    const spInput = document.getElementById(
      "map-spawn-points",
    ) as HTMLInputElement;
    if (spInput) {
      spInput.value = this.currentSpawnPointCount.toString();
      const spVal = document.getElementById("map-spawn-points-value");
      if (spVal) spVal.textContent = spInput.value;
    }

    this.context.campaignShell.show("campaign", "sector-map");
    this.context.screenManager.show("mission-setup");
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

    this.currentSquad = config;
    this.launchMission();
  }

  private updateUI(state: GameState) {
    this.currentGameState = state;
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
    if (this.currentCampaignNode) {
      const campaignState = this.context.campaignManager.getState();
      if (campaignState) {
        this.allowTacticalPause = campaignState.rules.allowTacticalPause;
        this.currentMapGeneratorType = campaignState.rules.mapGeneratorType;
        if (campaignState.rules.unitStyle) {
          this.unitStyle = campaignState.rules.unitStyle;
        }
      }
    }

    const config = this.saveCurrentConfig();
    this.missionCoordinator.launchMission(
      {
        seed: this.currentSeed,
        mapGeneratorType: this.currentMapGeneratorType,
        staticMapData: this.currentStaticMapData,
        fogOfWarEnabled: this.fogOfWarEnabled,
        debugOverlayEnabled: this.debugOverlayEnabled,
        agentControlEnabled: this.agentControlEnabled,
        squadConfig: this.currentSquad,
        missionType: this.currentMissionType,
        mapWidth: this.currentMapWidth,
        mapHeight: this.currentMapHeight,
        spawnPointCount: this.currentSpawnPointCount,
        losOverlayEnabled: this.losOverlayEnabled,
        startingThreatLevel: config.startingThreatLevel,
        baseEnemyCount: config.baseEnemyCount,
        enemyGrowthPerMission: config.enemyGrowthPerMission,
        allowTacticalPause: this.allowTacticalPause,
        unitStyle: this.unitStyle,
        campaignNode: this.currentCampaignNode || undefined,
      },
      (report) => {
        this.context.campaignManager.processMissionResult(report);
        this.debriefScreen.show(report);
      },
      (state) => this.updateUI(state),
      () => this.syncSpeedUI(),
    );
  }

  private saveCurrentConfig() {
    const mapSeedInput = document.getElementById(
      "map-seed",
    ) as HTMLInputElement;
    if (mapSeedInput && !mapSeedInput.disabled) {
      const val = parseInt(mapSeedInput.value);
      this.currentSeed = !isNaN(val) ? val : this.currentSeed;
    }

    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    const spInput = document.getElementById(
      "map-spawn-points",
    ) as HTMLInputElement;
    const baseEnemiesInput = document.getElementById(
      "map-base-enemies",
    ) as HTMLInputElement;
    const growthInput = document.getElementById(
      "map-enemy-growth",
    ) as HTMLInputElement;
    const threatInput = document.getElementById(
      "map-starting-threat",
    ) as HTMLInputElement;
    const themeSelect = document.getElementById(
      "map-theme",
    ) as HTMLSelectElement;

    if (wInput && hInput) {
      this.currentMapWidth = parseInt(wInput.value) || 14;
      this.currentMapHeight = parseInt(hInput.value) || 14;
    }
    if (spInput) this.currentSpawnPointCount = parseInt(spInput.value) || 1;
    if (themeSelect) this.currentThemeId = themeSelect.value;

    let baseEnemyCount = 3;
    if (baseEnemiesInput)
      baseEnemyCount = parseInt(baseEnemiesInput.value) || 3;
    let enemyGrowthPerMission = 1;
    if (growthInput) enemyGrowthPerMission = parseFloat(growthInput.value) || 1;
    let startingThreatLevel = 0;
    if (threatInput) startingThreatLevel = parseInt(threatInput.value) || 0;

    if (this.currentCampaignNode) {
      const campaignState = this.context.campaignManager.getState();
      if (campaignState) {
        this.allowTacticalPause = campaignState.rules.allowTacticalPause;
        this.currentMapGeneratorType = campaignState.rules.mapGeneratorType;
        baseEnemyCount = campaignState.rules.baseEnemyCount;
        enemyGrowthPerMission = campaignState.rules.enemyGrowthPerMission;
        if (campaignState.rules.unitStyle) {
          this.unitStyle = campaignState.rules.unitStyle;
        }
      }
    }

    const config = {
      mapWidth: this.currentMapWidth,
      mapHeight: this.currentMapHeight,
      spawnPointCount: this.currentSpawnPointCount,
      fogOfWarEnabled: this.fogOfWarEnabled,
      debugOverlayEnabled: this.debugOverlayEnabled,
      losOverlayEnabled: this.losOverlayEnabled,
      agentControlEnabled: this.agentControlEnabled,
      allowTacticalPause: this.allowTacticalPause,
      unitStyle: this.unitStyle,
      mapGeneratorType: this.currentMapGeneratorType,
      missionType: this.currentMissionType,
      lastSeed: this.currentSeed,
      themeId: this.currentThemeId,
      squadConfig: this.currentSquad,
      startingThreatLevel,
      baseEnemyCount,
      enemyGrowthPerMission,
      campaignNodeId: this.currentCampaignNode?.id,
      bonusLootCount: this.currentCampaignNode?.bonusLootCount || 0,
    };

    if (this.currentCampaignNode) {
      ConfigManager.saveCampaign(config);
    } else {
      ConfigManager.saveCustom(config);
    }

    return config;
  }

  private resumeMission() {
    this.missionCoordinator.resumeMission(
      (report) => {
        this.context.campaignManager.processMissionResult(report);
        this.debriefScreen.show(report);
      },
      (state) => this.updateUI(state),
      () => this.syncSpeedUI(),
      (node) => {
        this.currentCampaignNode = node;
        if (node) this.applyCampaignTheme();
      },
    );
  }

  private abortMission() {
    const handled = this.missionCoordinator.abortMission(
      this.currentGameState,
      this.currentCampaignNode,
      this.currentSeed,
      this.currentSquad,
      (report) => {
        this.context.campaignManager.processMissionResult(report);
        this.debriefScreen.show(report);
      },
      () => this.showMainMenu(),
    );

    if (handled) {
      this.context.gameClient.stop();
      this.context.gameClient.onStateUpdate(null);
      const state = this.context.campaignManager.getState();
      if (state) this.campaignSummaryScreen.show(state);
      this.context.screenManager.show("campaign-summary");
    }
  }

  private loadAndApplyConfig(isCampaign: boolean = false) {
    const contextHeader = document.getElementById("mission-setup-context");
    if (contextHeader) {
      if (isCampaign) {
        const state = this.context.campaignManager.getState();
        if (state) {
          const missionNum = state.history.length + 1;
          const sectorNum = state.currentSector;
          const difficulty = state.rules.difficulty.toUpperCase();
          contextHeader.textContent = `CAMPAIGN: ${difficulty} | MISSION ${missionNum} | SECTOR ${sectorNum}`;
        }
      } else {
        contextHeader.textContent = "CUSTOM SIMULATION";
      }
    }

    const config = isCampaign
      ? ConfigManager.loadCampaign()
      : ConfigManager.loadCustom();
    const mapConfigSection = document.getElementById("map-config-section");
    if (mapConfigSection)
      mapConfigSection.style.display = isCampaign ? "none" : "block";

    if (config) {
      this.currentMapWidth = config.mapWidth;
      this.currentMapHeight = config.mapHeight;
      this.currentSpawnPointCount = config.spawnPointCount || 1;
      this.fogOfWarEnabled = config.fogOfWarEnabled;
      this.debugOverlayEnabled = config.debugOverlayEnabled;
      this.losOverlayEnabled = config.losOverlayEnabled || false;
      this.agentControlEnabled = config.agentControlEnabled;
      this.allowTacticalPause =
        config.allowTacticalPause !== undefined
          ? config.allowTacticalPause
          : true;
      this.unitStyle = config.unitStyle || UnitStyle.TacticalIcons;
      this.currentMapGeneratorType = config.mapGeneratorType;
      this.currentMissionType = config.missionType || MissionType.Default;
      this.currentSeed = config.lastSeed;
      this.currentThemeId = config.themeId || "default";
      this.currentSquad = config.squadConfig;

      this.updateSetupUIFromConfig(config);
    } else {
      const defaults = ConfigManager.getDefault();
      this.currentMapWidth = defaults.mapWidth;
      this.currentMapHeight = defaults.mapHeight;
      this.currentSpawnPointCount = defaults.spawnPointCount;
      this.fogOfWarEnabled = defaults.fogOfWarEnabled;
      this.debugOverlayEnabled = defaults.debugOverlayEnabled;
      this.losOverlayEnabled = defaults.losOverlayEnabled;
      this.agentControlEnabled = defaults.agentControlEnabled;
      this.allowTacticalPause = defaults.allowTacticalPause;
      this.unitStyle = defaults.unitStyle;
      this.currentMapGeneratorType = defaults.mapGeneratorType;
      this.currentMissionType = defaults.missionType;
      this.currentSeed = defaults.lastSeed;
      this.currentThemeId = defaults.themeId;
      this.currentSquad = JSON.parse(JSON.stringify(defaults.squadConfig));

      this.updateSetupUIFromConfig(defaults);
    }

    if (isCampaign) {
      this.applyCampaignTheme();
    } else {
      this.context.themeManager.setTheme(this.currentThemeId);
    }

    if (isCampaign) {
      const state = this.context.campaignManager.getState();
      if (state) {
        if (state.rules.unitStyle) {
          this.unitStyle = state.rules.unitStyle;
          const styleSelect = document.getElementById(
            "select-unit-style",
          ) as HTMLSelectElement;
          if (styleSelect) styleSelect.value = this.unitStyle;
        }
        if (state.rules.mapGeneratorType) {
          this.currentMapGeneratorType = state.rules.mapGeneratorType;
          const mapGenSelect = document.getElementById(
            "map-generator-type",
          ) as HTMLSelectElement;
          if (mapGenSelect) mapGenSelect.value = this.currentMapGeneratorType;
        }
        if (state.rules.allowTacticalPause !== undefined) {
          this.allowTacticalPause = state.rules.allowTacticalPause;
          const allowPauseCheck = document.getElementById(
            "toggle-allow-tactical-pause",
          ) as HTMLInputElement;
          if (allowPauseCheck)
            allowPauseCheck.checked = this.allowTacticalPause;
        }

        const hasNonCampaignSoldiers = this.currentSquad.soldiers.some(
          (s) => !s.id,
        );
        if (this.currentSquad.soldiers.length === 0 || hasNonCampaignSoldiers) {
          const healthy = state.roster
            .filter((s) => s.status === "Healthy")
            .slice(0, 4);
          this.currentSquad.soldiers = healthy.map((s) => ({
            id: s.id,
            name: s.name,
            archetypeId: s.archetypeId,
            hp: s.hp,
            maxHp: s.maxHp,
            soldierAim: s.soldierAim,
            rightHand: s.equipment.rightHand,
            leftHand: s.equipment.leftHand,
            body: s.equipment.body,
            feet: s.equipment.feet,
          }));
        } else {
          this.currentSquad.soldiers = this.currentSquad.soldiers.filter(
            (s) => {
              if (s.id) {
                const rs = state.roster.find((r) => r.id === s.id);
                if (rs) {
                  if (rs.status === "Dead" || rs.status === "Wounded")
                    return false;
                  s.name = rs.name;
                  s.hp = rs.hp;
                  s.maxHp = rs.maxHp;
                  s.soldierAim = rs.soldierAim;
                  s.rightHand = rs.equipment.rightHand;
                  s.leftHand = rs.equipment.leftHand;
                  s.body = rs.equipment.body;
                  s.feet = rs.equipment.feet;
                  return true;
                }
              }
              return true;
            },
          );
        }
      }
    }
    this.renderSquadBuilder(isCampaign);
  }

  private updateSetupUIFromConfig(config: GameConfig | Partial<GameConfig>) {
    const missionSelect = document.getElementById(
      "mission-type",
    ) as HTMLSelectElement;
    if (missionSelect) missionSelect.value = this.currentMissionType;
    const mapSeedInput = document.getElementById(
      "map-seed",
    ) as HTMLInputElement;
    if (mapSeedInput) mapSeedInput.value = this.currentSeed.toString();
    const mapGenSelect = document.getElementById(
      "map-generator-type",
    ) as HTMLSelectElement;
    if (mapGenSelect) mapGenSelect.value = this.currentMapGeneratorType;
    const themeSelect = document.getElementById(
      "map-theme",
    ) as HTMLSelectElement;
    if (themeSelect) themeSelect.value = this.currentThemeId;

    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    const spInput = document.getElementById(
      "map-spawn-points",
    ) as HTMLInputElement;
    const threatInput = document.getElementById(
      "map-starting-threat",
    ) as HTMLInputElement;

    if (wInput) wInput.value = this.currentMapWidth.toString();
    if (hInput) hInput.value = this.currentMapHeight.toString();
    if (spInput) {
      spInput.value = this.currentSpawnPointCount.toString();
      const spVal = document.getElementById("map-spawn-points-value");
      if (spVal) spVal.textContent = spInput.value;
    }
    if (threatInput) {
      threatInput.value = (config.startingThreatLevel || 0).toString();
      const threatVal = document.getElementById("map-starting-threat-value");
      if (threatVal) threatVal.textContent = threatInput.value;
    }

    const baseEnemiesInput = document.getElementById(
      "map-base-enemies",
    ) as HTMLInputElement;
    if (baseEnemiesInput) {
      baseEnemiesInput.value = (config.baseEnemyCount ?? 3).toString();
      const valDisp = document.getElementById("map-base-enemies-value");
      if (valDisp) valDisp.textContent = baseEnemiesInput.value;
    }
    const growthInput = document.getElementById(
      "map-enemy-growth",
    ) as HTMLInputElement;
    if (growthInput) {
      growthInput.value = (config.enemyGrowthPerMission ?? 1).toString();
      const valDisp = document.getElementById("map-enemy-growth-value");
      if (valDisp) valDisp.textContent = growthInput.value;
    }

    const fowCheck = document.getElementById(
      "toggle-fog-of-war",
    ) as HTMLInputElement;
    if (fowCheck) fowCheck.checked = this.fogOfWarEnabled;
    const debugCheck = document.getElementById(
      "toggle-debug-overlay",
    ) as HTMLInputElement;
    if (debugCheck) debugCheck.checked = this.debugOverlayEnabled;
    const losCheck = document.getElementById(
      "toggle-los-overlay",
    ) as HTMLInputElement;
    if (losCheck) losCheck.checked = this.losOverlayEnabled;
    const agentCheck = document.getElementById(
      "toggle-agent-control",
    ) as HTMLInputElement;
    if (agentCheck) agentCheck.checked = this.agentControlEnabled;
    const allowPauseCheck = document.getElementById(
      "toggle-allow-tactical-pause",
    ) as HTMLInputElement;
    if (allowPauseCheck) allowPauseCheck.checked = this.allowTacticalPause;
    const styleSelect = document.getElementById(
      "select-unit-style",
    ) as HTMLSelectElement;
    if (styleSelect) styleSelect.value = this.unitStyle;

    if (mapGenSelect) mapGenSelect.dispatchEvent(new Event("change"));
  }

  private renderSquadBuilder(isCampaign: boolean = false) {
    this.squadBuilder.update(
      this.currentSquad,
      this.currentMissionType,
      isCampaign,
    );
  }
}
