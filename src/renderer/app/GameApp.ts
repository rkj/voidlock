
import { AppContext } from "./AppContext";
import { InputBinder } from "./InputBinder";
import { GameClient } from "@src/engine/GameClient";
import { Renderer } from "@src/renderer/Renderer";
import { ScreenManager } from "@src/renderer/ScreenManager";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { MenuController } from "@src/renderer/MenuController";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { InputManager } from "@src/renderer/InputManager";
import { BarracksScreen } from "@src/renderer/screens/BarracksScreen";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import { CampaignSummaryScreen } from "@src/renderer/screens/CampaignSummaryScreen";
import { StatisticsScreen } from "@src/renderer/screens/StatisticsScreen";
import { MapFactory } from "@src/engine/map/MapFactory";
import { 
    GameState, 
    MapGeneratorType, 
    MissionType, 
    SquadConfig, 
    UnitStyle, 
    EngineMode, 
    Unit,
    UnitState,
    MapDefinition,
    MapGenerationConfig,
} from "@src/shared/types";
import { 
    CampaignNode, 
    MissionReport, 
    calculateMapSize, 
    calculateSpawnPoints 
} from "@src/shared/campaign_types";
import { DebugUtility } from "@src/renderer/DebugUtility";
import { MapUtility } from "@src/renderer/MapUtility";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { ArchetypeLibrary } from "@src/shared/types/units";
import { Icons } from "@src/renderer/Icons";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";
import { CampaignEvents } from "@src/content/CampaignEvents";
import { EventModal, OutcomeModal } from "@src/renderer/ui/EventModal";
import { ModalService } from "@src/renderer/ui/ModalService";
import { PRNG } from "@src/shared/PRNG";
import { CampaignShell, CampaignTabId } from "@src/renderer/ui/CampaignShell";
import pkg from "../../../package.json";
import { SquadBuilder } from "../components/SquadBuilder";

const VERSION = pkg.version;

export class GameApp {
  private context: AppContext;
  private inputBinder: InputBinder;
  private squadBuilder!: SquadBuilder;
  
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
  private debriefShown = false;
  
  private fogOfWarEnabled = ConfigManager.getDefault().fogOfWarEnabled;
  private debugOverlayEnabled = ConfigManager.getDefault().debugOverlayEnabled;
  private losOverlayEnabled = false;
  private agentControlEnabled = ConfigManager.getDefault().agentControlEnabled;
  private allowTacticalPause = true;
  private unitStyle = ConfigManager.getDefault().unitStyle;
  
  private currentMapWidth = ConfigManager.getDefault().mapWidth;
  private currentMapHeight = ConfigManager.getDefault().mapHeight;
  private currentSeed: number = ConfigManager.getDefault().lastSeed;
  private currentMapGeneratorType: MapGeneratorType = ConfigManager.getDefault().mapGeneratorType;
  private currentMissionType: MissionType = ConfigManager.getDefault().missionType;
  private currentStaticMapData: MapDefinition | undefined = undefined;
  private currentSquad: SquadConfig = ConfigManager.getDefault().squadConfig;
  private currentSpawnPointCount = ConfigManager.getDefault().spawnPointCount;

  constructor() {
    this.context = new AppContext();
    this.inputBinder = new InputBinder(this.context);
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
    this.context.gameClient = new GameClient((config) => mapGeneratorFactory(config));
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
      VERSION,
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
      (state) => this.updateUI(state),
      (e) => this.handleCanvasClick(e),
      (enabled) => this.context.gameClient.toggleDebugOverlay(enabled),
      (enabled) => this.context.gameClient.toggleLosOverlay(enabled),
      () => this.currentGameState,
      () => this.debriefScreen.isVisible(),
    );

    // 3. Initialize screens
    this.campaignSummaryScreen = new CampaignSummaryScreen("screen-campaign-summary", () => {
      this.campaignSummaryScreen.hide();
      this.context.campaignManager.deleteSave();
      this.showMainMenu();
    });

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
      (node) => this.onCampaignNodeSelected(node),
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
          if (screen === "campaign") this.context.campaignShell.show("campaign", "sector-map");
          else if (screen === "barracks") this.context.campaignShell.show("campaign", "barracks");
          else if (screen === "mission-setup") this.context.campaignShell.hide();
        },
        () => this.context.campaignShell.refresh(),
      );

    this.statisticsScreen = new StatisticsScreen(
      "screen-statistics",
    );

    this.squadBuilder = new SquadBuilder(
      "squad-builder",
      this.context,
      this.currentSquad,
      this.currentMissionType,
      false,
      (squad) => {
        this.currentSquad = squad;
      }
    );

    // 4. Bind events
    this.inputBinder.bindAll({
        onLaunchMission: () => this.launchMission(),
        onTogglePause: () => this.togglePause(),
        onAbortMission: () => this.abortMission(),
        onCustomMission: () => {
            this.currentCampaignNode = null;
            this.context.themeManager.setTheme("default");
            this.loadAndApplyConfig(false);
            this.context.campaignShell.hide();
            this.context.screenManager.show("mission-setup");
        },
        onCampaignMenu: () => {
            this.applyCampaignTheme();
            const state = this.context.campaignManager.getState();
            if (state && (state.status === "Victory" || state.status === "Defeat")) {
              this.campaignSummaryScreen.show(state);
              this.context.screenManager.show("campaign-summary");
              this.context.campaignShell.hide();
            } else {
              this.campaignScreen.show();
              this.context.screenManager.show("campaign");
              this.context.campaignShell.show("campaign", "sector-map");
            }
        },
        onResetData: async () => {
            if (await this.context.modalService.confirm("Are you sure? This will wipe all campaign progress and settings.")) {
                localStorage.clear();
                window.location.reload();
            }
        },
        onShowEquipment: () => {
            this.equipmentScreen.updateConfig(this.currentSquad);
            this.context.screenManager.show("equipment");
            if (this.currentCampaignNode) {
              this.context.campaignShell.show("campaign", "sector-map");
            } else {
              this.context.campaignShell.show("custom");
            }
        },
        onShowBarracks: () => {
            this.barracksScreen.show();
            this.context.screenManager.show("barracks");
            this.context.campaignShell.show("campaign", "barracks");
        },
        onLoadStaticMap: async (json) => {
            try {
                this.currentStaticMapData = MapUtility.transformMapData(JSON.parse(json));
                await this.context.modalService.alert("Static Map Loaded.");
            } catch (e) {
                await this.context.modalService.alert("Invalid JSON.");
            }
        },
        onUploadStaticMap: (file) => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    this.currentStaticMapData = MapUtility.transformMapData(JSON.parse(ev.target?.result as string));
                    await this.context.modalService.alert("Static Map Loaded from File.");
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
                const blob = new Blob([JSON.stringify(replay, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `voidlock-replay-${replay.seed}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
            }
        },
        onUpdateSquadBuilder: () => this.renderSquadBuilder(this.currentCampaignNode !== null),
        onApplyCampaignTheme: () => this.applyCampaignTheme(),
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
        }
    });

    // Special bindings that were in main.ts
    this.setupAdditionalUIBindings();

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
    const mode = state ? "campaign" : "statistics";
    this.context.campaignShell.show(mode as any, tabId);
  }

  public start() {
    const persistedScreen = this.context.screenManager.loadPersistedState();
    if (persistedScreen === "mission") {
      this.context.campaignShell.hide();
      this.resumeMission();
    } else if (persistedScreen) {
      if (persistedScreen === "campaign" || persistedScreen === "campaign-summary") {
        this.applyCampaignTheme();
        const state = this.context.campaignManager.getState();
        if (state && (state.status === "Victory" || state.status === "Defeat")) {
          this.campaignSummaryScreen.show(state);
          this.context.screenManager.show("campaign-summary");
          this.context.campaignShell.hide();
        } else {
          this.campaignScreen.show();
          this.context.screenManager.show("campaign");
          this.context.campaignShell.show("campaign", "sector-map");
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
      const missionSelect = document.getElementById("mission-type") as HTMLSelectElement;
      if (missionSelect) {
          missionSelect.addEventListener("change", () => {
              this.currentMissionType = missionSelect.value as MissionType;
              if (this.currentMissionType === MissionType.EscortVIP) {
                  this.currentSquad.soldiers = this.currentSquad.soldiers.filter(
                      (s) => s.archetypeId !== "vip",
                  );
              }
              this.renderSquadBuilder(this.currentCampaignNode !== null);
          });
      }

      // Add options to map generator select if they don't exist
      const mapGenSelect = document.getElementById("map-generator-type") as HTMLSelectElement;
      if (mapGenSelect && mapGenSelect.options.length < 3) {
          const treeOpt = document.createElement("option");
          treeOpt.value = "TreeShip";
          treeOpt.textContent = "Tree Ship (No Loops)";
          mapGenSelect.appendChild(treeOpt);
          const denseOpt = document.createElement("option");
          denseOpt.value = "DenseShip";
          denseOpt.textContent = "Dense Ship (>90% fill)";
          mapGenSelect.appendChild(denseOpt);
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
              const newMissionSelect = document.getElementById("mission-type") as HTMLSelectElement;
              newMissionSelect.addEventListener("change", () => {
                  this.currentMissionType = newMissionSelect.value as MissionType;
                  if (this.currentMissionType === MissionType.EscortVIP) {
                      this.currentSquad.soldiers = this.currentSquad.soldiers.filter(
                          (s) => s.archetypeId !== "vip",
                      );
                  }
                  this.renderSquadBuilder(this.currentCampaignNode !== null);
              });
          }
      }

      // Toggles and Unit Style
      document.getElementById("toggle-fog-of-war")?.addEventListener("change", (e) => this.fogOfWarEnabled = (e.target as HTMLInputElement).checked);
      document.getElementById("toggle-debug-overlay")?.addEventListener("change", (e) => this.debugOverlayEnabled = (e.target as HTMLInputElement).checked);
      document.getElementById("toggle-los-overlay")?.addEventListener("change", (e) => this.losOverlayEnabled = (e.target as HTMLInputElement).checked);
      document.getElementById("toggle-agent-control")?.addEventListener("change", (e) => this.agentControlEnabled = (e.target as HTMLInputElement).checked);
      document.getElementById("toggle-allow-tactical-pause")?.addEventListener("change", (e) => this.allowTacticalPause = (e.target as HTMLInputElement).checked);
      document.getElementById("select-unit-style")?.addEventListener("change", (e) => {
          this.unitStyle = (e.target as HTMLSelectElement).value as UnitStyle;
      });

      const wInput = document.getElementById("map-width") as HTMLInputElement;
      const hInput = document.getElementById("map-height") as HTMLInputElement;
      const spInput = document.getElementById("map-spawn-points") as HTMLInputElement;
      const spValue = document.getElementById("map-spawn-points-value");

      const updateSpawnPointsFromSize = () => {
          if (this.currentCampaignNode) return;
          const width = parseInt(wInput.value) || 14;
          this.currentSpawnPointCount = calculateSpawnPoints(width);
          if (spInput) {
              spInput.value = this.currentSpawnPointCount.toString();
              if (spValue) spValue.textContent = spInput.value;
          }
      };

      wInput?.addEventListener("input", updateSpawnPointsFromSize);
      hInput?.addEventListener("input", updateSpawnPointsFromSize);
  }

  private async onCampaignNodeSelected(node: CampaignNode) {
    if (node.type === "Shop") {
      await this.context.modalService.alert("Supply Depot reached. +100 Scrap granted for resupply.");
      this.context.campaignManager.advanceCampaignWithoutMission(node.id, 100, 0);
      this.campaignScreen.show();
      return;
    }

    if (node.type === "Event") {
      const prng = new PRNG(node.mapSeed);
      const event =
        CampaignEvents[Math.floor(prng.next() * CampaignEvents.length)];

      const modal = new EventModal(this.context.modalService, (choice) => {
        const outcome = this.context.campaignManager.applyEventChoice(
          node.id,
          choice,
          prng,
        );

        const outcomeModal = new OutcomeModal(this.context.modalService, () => {
          if (outcome.ambush) {
            // Ambush triggers a combat mission at this node
            this.onCampaignNodeSelected(node);
          } else {
            this.campaignScreen.show();
          }
        });
        outcomeModal.show(event.title, outcome.text);
      });
      modal.show(event);
      return;
    }

    this.currentCampaignNode = node;
    this.currentSeed = node.mapSeed;

    const state = this.context.campaignManager.getState();
    const rules = state?.rules;
    const growthRate = rules?.mapGrowthRate ?? 1.0;
    const size = calculateMapSize(node.rank, growthRate);

    this.currentMapWidth = size;
    this.currentMapHeight = size;
    this.currentSpawnPointCount = calculateSpawnPoints(size);

    this.loadAndApplyConfig(true);

    this.currentSeed = node.mapSeed;
    this.currentMapWidth = size;
    this.currentMapHeight = size;
    this.currentSpawnPointCount = calculateSpawnPoints(size);

    const mapSeedInput = document.getElementById("map-seed") as HTMLInputElement;
    if (mapSeedInput) mapSeedInput.value = this.currentSeed.toString();

    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    if (wInput) wInput.value = this.currentMapWidth.toString();
    if (hInput) hInput.value = this.currentMapHeight.toString();

    const spInput = document.getElementById("map-spawn-points") as HTMLInputElement;
    if (spInput) {
      spInput.value = this.currentSpawnPointCount.toString();
      const spVal = document.getElementById("map-spawn-points-value");
      if (spVal) spVal.textContent = spInput.value;
    }

    this.context.campaignShell.hide();
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

    const btn = document.getElementById("btn-pause-toggle") as HTMLButtonElement;
    const gameSpeedSlider = document.getElementById("game-speed") as HTMLInputElement;
    const gameSpeedValue = document.getElementById("speed-value");

    if (btn) btn.textContent = isPaused ? "▶ Play" : "⏸ Pause";
    if (gameSpeedValue) gameSpeedValue.textContent = TimeUtility.formatSpeed(lastSpeed, isPaused);
    if (gameSpeedSlider) gameSpeedSlider.value = TimeUtility.scaleToSlider(lastSpeed).toString();
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
    const clickedCell = this.context.renderer.getCellCoordinates(event.clientX, event.clientY);
    const prevState = this.context.menuController.menuState;
    this.context.menuController.handleCanvasClick(clickedCell, this.currentGameState);

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

    const mapSeedInput = document.getElementById("map-seed") as HTMLInputElement;
    if (mapSeedInput && !mapSeedInput.disabled) {
      const val = parseInt(mapSeedInput.value);
      this.currentSeed = !isNaN(val) ? val : Date.now();
    }

    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    const spInput = document.getElementById("map-spawn-points") as HTMLInputElement;
    const baseEnemiesInput = document.getElementById("map-base-enemies") as HTMLInputElement;
    const growthInput = document.getElementById("map-enemy-growth") as HTMLInputElement;
    const threatInput = document.getElementById("map-starting-threat") as HTMLInputElement;

    if (wInput && hInput) {
      this.currentMapWidth = parseInt(wInput.value) || 14;
      this.currentMapHeight = parseInt(hInput.value) || 14;
    }
    if (spInput) this.currentSpawnPointCount = parseInt(spInput.value) || 1;

    let baseEnemyCount = 3;
    if (baseEnemiesInput) baseEnemyCount = parseInt(baseEnemiesInput.value) || 3;
    let enemyGrowthPerMission = 1;
    if (growthInput) enemyGrowthPerMission = parseFloat(growthInput.value) || 1;
    let missionDepth = 0;
    let startingThreatLevel = 0;
    if (threatInput) startingThreatLevel = parseInt(threatInput.value) || 0;

    if (this.currentCampaignNode) {
      const campaignState = this.context.campaignManager.getState();
      if (campaignState) {
        this.allowTacticalPause = campaignState.rules.allowTacticalPause;
        this.currentMapGeneratorType = campaignState.rules.mapGeneratorType;
        baseEnemyCount = campaignState.rules.baseEnemyCount;
        enemyGrowthPerMission = campaignState.rules.enemyGrowthPerMission;
        missionDepth = this.currentCampaignNode.rank;
        if (campaignState.rules.unitStyle) {
          this.unitStyle = campaignState.rules.unitStyle;
        }
      }
    }

    const tsSlider = document.getElementById("time-scale-slider") as HTMLInputElement;
    const initialTimeScale = tsSlider ? TimeUtility.sliderToScale(parseFloat(tsSlider.value)) : 1.0;

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
      squadConfig: this.currentSquad,
      startingThreatLevel,
      baseEnemyCount,
      enemyGrowthPerMission,
      campaignNodeId: this.currentCampaignNode?.id,
    };

    if (this.currentCampaignNode) {
      ConfigManager.saveCampaign(config);
    } else {
      ConfigManager.saveCustom(config);
    }

    this.context.campaignShell.hide();

    this.context.gameClient.init(
      this.currentSeed,
      this.currentMapGeneratorType,
      this.currentStaticMapData,
      this.fogOfWarEnabled,
      this.debugOverlayEnabled,
      this.agentControlEnabled,
      this.currentSquad,
      this.currentMissionType,
      this.currentMapWidth,
      this.currentMapHeight,
      this.currentSpawnPointCount,
      this.losOverlayEnabled,
      startingThreatLevel,
      initialTimeScale,
      false, // startPaused
      this.allowTacticalPause,
      EngineMode.Simulation,
      [], // commandLog
      this.currentCampaignNode?.id,
      0, // targetTick
      baseEnemyCount,
      enemyGrowthPerMission,
      missionDepth,
      this.currentCampaignNode?.type,
    );

    this.syncSpeedUI();
    this.setupGameClientCallbacks();
    this.context.screenManager.show("mission");
  }

  private setupGameClientCallbacks() {
    this.selectedUnitId = null;
    this.debriefShown = false;
    const rightPanel = document.getElementById("right-panel");
    if (rightPanel) rightPanel.innerHTML = "";
    this.context.menuController.reset();
    this.context.menuController.clearDiscoveryOrder();

    this.context.gameClient.onStateUpdate((state) => {
      this.currentGameState = state;
      if (!this.context.renderer) {
        const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
        if (canvas) {
          this.context.renderer = new Renderer(canvas);
          this.context.renderer.setCellSize(128);
        }
      }
      if (this.context.renderer) {
        this.context.renderer.setUnitStyle(this.unitStyle);
        this.context.renderer.setOverlay(this.context.menuController.overlayOptions);
        this.context.renderer.render(state);
      }

      if ((state.status === "Won" || state.status === "Lost") && !this.debriefShown) {
        this.debriefShown = true;
        const report = this.generateMissionReport(state, this.currentCampaignNode);
        this.context.campaignManager.processMissionResult(report);

        const replayData = this.context.gameClient.getReplayData();
        if (replayData) {
          this.context.gameClient.loadReplay(replayData);
          this.context.gameClient.setTimeScale(5.0);
        }
        this.debriefScreen.show(report);
      }
      this.updateUI(state);
    });
  }

  private generateMissionReport(state: GameState, node: CampaignNode | null): MissionReport {
    return {
      nodeId: node ? node.id : "custom",
      seed: this.currentSeed,
      result: state.status === "Won" ? "Won" : "Lost",
      aliensKilled: state.stats.aliensKilled,
      scrapGained: state.stats.scrapGained,
      intelGained: state.status === "Won" ? 5 : 0,
      timeSpent: state.t,
      soldierResults: state.units.map((u) => ({
        soldierId: u.id,
        xpBefore: 0,
        xpGained: 0,
        kills: u.kills,
        promoted: false,
        status: u.state === UnitState.Dead ? "Dead" : u.hp < u.maxHp ? "Wounded" : "Healthy",
        recoveryTime: 0,
      })),
    };
  }

  private resumeMission() {
    const configStr = localStorage.getItem("voidlock_mission_config");
    const logStr = localStorage.getItem("voidlock_mission_log");
    const tickStr = localStorage.getItem("voidlock_mission_tick");

    if (!configStr) return;

    try {
      const config = JSON.parse(configStr);
      const commandLog = logStr ? JSON.parse(logStr) : [];
      const targetTick = tickStr ? parseInt(tickStr, 10) : 0;

      if (config.campaignNodeId) {
        this.context.campaignManager.load();
        const campaignState = this.context.campaignManager.getState();
        if (campaignState) {
          this.currentCampaignNode = campaignState.nodes.find((n) => n.id === config.campaignNodeId) || null;
          this.applyCampaignTheme();
        }
      }

      this.currentSeed = config.seed;
      this.currentMapGeneratorType = config.mapGeneratorType;
      this.currentStaticMapData = config.mapData;
      this.fogOfWarEnabled = config.fogOfWarEnabled;
      this.debugOverlayEnabled = config.debugOverlayEnabled;
      this.agentControlEnabled = config.agentControlEnabled;
      this.currentSquad = config.squadConfig;
      this.currentMissionType = config.missionType;
      this.currentMapWidth = config.width;
      this.currentMapHeight = config.height;
      this.currentSpawnPointCount = config.spawnPointCount;
      this.losOverlayEnabled = config.losOverlayEnabled;
      const startingThreatLevel = config.startingThreatLevel;
      const initialTimeScale = config.initialTimeScale || 1.0;
      const allowTacticalPause = config.allowTacticalPause ?? true;
      const baseEnemyCount = config.baseEnemyCount ?? 3;
      const enemyGrowthPerMission = config.enemyGrowthPerMission ?? 1;
      const missionDepth = config.missionDepth ?? 0;

      this.setupGameClientCallbacks();

      this.context.gameClient.init(
        this.currentSeed,
        this.currentMapGeneratorType,
        this.currentStaticMapData,
        this.fogOfWarEnabled,
        this.debugOverlayEnabled,
        this.agentControlEnabled,
        this.currentSquad,
        this.currentMissionType,
        this.currentMapWidth,
        this.currentMapHeight,
        this.currentSpawnPointCount,
        this.losOverlayEnabled,
        startingThreatLevel,
        initialTimeScale,
        false,
        allowTacticalPause,
        EngineMode.Simulation,
        commandLog,
        config.campaignNodeId,
        targetTick,
        baseEnemyCount,
        enemyGrowthPerMission,
        missionDepth,
        config.nodeType,
      );

      this.syncSpeedUI();
      this.context.screenManager.show("mission");
    } catch (e) {
      console.error("Failed to resume mission", e);
      this.showMainMenu();
    }
  }

  private abortMission() {
    if (this.currentCampaignNode) {
      const report = this.generateAbortReport();
      this.context.campaignManager.processMissionResult(report);
    }

    this.context.gameClient.stop();
    this.context.gameClient.onStateUpdate(null);

    const tsSlider = document.getElementById("time-scale-slider") as HTMLInputElement;
    const tsValue = document.getElementById("time-scale-value");
    if (tsSlider) {
      tsSlider.value = "50";
      if (tsValue) tsValue.textContent = "1.0";
    }
    this.showMainMenu();
  }

  private generateAbortReport(): MissionReport {
    const state = this.currentGameState;
    const node = this.currentCampaignNode;

    if (state) {
      return {
        nodeId: node ? node.id : "custom",
        seed: this.currentSeed,
        result: "Lost",
        aliensKilled: state.stats.aliensKilled,
        scrapGained: state.stats.scrapGained,
        intelGained: 0,
        timeSpent: state.t,
        soldierResults: state.units.map((u) => ({
          soldierId: u.id,
          xpBefore: 0,
          xpGained: 0,
          kills: u.kills,
          promoted: false,
          status: "Dead", // Abort = Squad Wipe
          recoveryTime: 0,
        })),
      };
    }

    // Fallback if no game state
    return {
      nodeId: node ? node.id : "custom",
      seed: this.currentSeed,
      result: "Lost",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 0,
      soldierResults: this.currentSquad.soldiers.map((s) => ({
        soldierId: s.id!,
        xpBefore: 0,
        xpGained: 0,
        kills: 0,
        promoted: false,
        status: "Dead",
        recoveryTime: 0,
      })),
    };
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

    const config = isCampaign ? ConfigManager.loadCampaign() : ConfigManager.loadCustom();
    const mapConfigSection = document.getElementById("map-config-section");
    if (mapConfigSection) mapConfigSection.style.display = isCampaign ? "none" : "block";

    if (config) {
      this.currentMapWidth = config.mapWidth;
      this.currentMapHeight = config.mapHeight;
      this.currentSpawnPointCount = config.spawnPointCount || 1;
      this.fogOfWarEnabled = config.fogOfWarEnabled;
      this.debugOverlayEnabled = config.debugOverlayEnabled;
      this.losOverlayEnabled = config.losOverlayEnabled || false;
      this.agentControlEnabled = config.agentControlEnabled;
      this.allowTacticalPause = config.allowTacticalPause !== undefined ? config.allowTacticalPause : true;
      this.unitStyle = config.unitStyle || UnitStyle.TacticalIcons;
      this.currentMapGeneratorType = config.mapGeneratorType;
      this.currentMissionType = config.missionType || MissionType.Default;
      this.currentSeed = config.lastSeed;
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
        this.currentSquad = JSON.parse(JSON.stringify(defaults.squadConfig));
        
        this.updateSetupUIFromConfig(defaults as any);
    }

    if (isCampaign) {
      const state = this.context.campaignManager.getState();
      if (state) {
        if (state.rules.unitStyle) {
          this.unitStyle = state.rules.unitStyle;
          const styleSelect = document.getElementById("select-unit-style") as HTMLSelectElement;
          if (styleSelect) styleSelect.value = this.unitStyle;
        }
        if (state.rules.mapGeneratorType) {
          this.currentMapGeneratorType = state.rules.mapGeneratorType;
          const mapGenSelect = document.getElementById("map-generator-type") as HTMLSelectElement;
          if (mapGenSelect) mapGenSelect.value = this.currentMapGeneratorType;
        }
        if (state.rules.allowTacticalPause !== undefined) {
          this.allowTacticalPause = state.rules.allowTacticalPause;
          const allowPauseCheck = document.getElementById("toggle-allow-tactical-pause") as HTMLInputElement;
          if (allowPauseCheck) allowPauseCheck.checked = this.allowTacticalPause;
        }

        const hasNonCampaignSoldiers = this.currentSquad.soldiers.some((s) => !s.id);
        if (this.currentSquad.soldiers.length === 0 || hasNonCampaignSoldiers) {
          const healthy = state.roster.filter((s) => s.status === "Healthy").slice(0, 4);
          this.currentSquad.soldiers = healthy.map((s) => ({
            id: s.id,
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
          this.currentSquad.soldiers = this.currentSquad.soldiers.filter((s) => {
            if (s.id) {
              const rs = state.roster.find((r) => r.id === s.id);
              if (rs) {
                if (rs.status === "Dead" || rs.status === "Wounded") return false;
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
          });
        }
      }
    }
    this.renderSquadBuilder(isCampaign);
  }

  private updateSetupUIFromConfig(config: any) {
    const missionSelect = document.getElementById("mission-type") as HTMLSelectElement;
    if (missionSelect) missionSelect.value = this.currentMissionType;
    const mapSeedInput = document.getElementById("map-seed") as HTMLInputElement;
    if (mapSeedInput) mapSeedInput.value = this.currentSeed.toString();
    const mapGenSelect = document.getElementById("map-generator-type") as HTMLSelectElement;
    if (mapGenSelect) mapGenSelect.value = this.currentMapGeneratorType;

    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    const spInput = document.getElementById("map-spawn-points") as HTMLInputElement;
    const threatInput = document.getElementById("map-starting-threat") as HTMLInputElement;

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

    const baseEnemiesInput = document.getElementById("map-base-enemies") as HTMLInputElement;
    if (baseEnemiesInput) {
        baseEnemiesInput.value = (config.baseEnemyCount ?? 3).toString();
        const valDisp = document.getElementById("map-base-enemies-value");
        if (valDisp) valDisp.textContent = baseEnemiesInput.value;
    }
    const growthInput = document.getElementById("map-enemy-growth") as HTMLInputElement;
    if (growthInput) {
        growthInput.value = (config.enemyGrowthPerMission ?? 1).toString();
        const valDisp = document.getElementById("map-enemy-growth-value");
        if (valDisp) valDisp.textContent = growthInput.value;
    }

    const fowCheck = document.getElementById("toggle-fog-of-war") as HTMLInputElement;
    if (fowCheck) fowCheck.checked = this.fogOfWarEnabled;
    const debugCheck = document.getElementById("toggle-debug-overlay") as HTMLInputElement;
    if (debugCheck) debugCheck.checked = this.debugOverlayEnabled;
    const losCheck = document.getElementById("toggle-los-overlay") as HTMLInputElement;
    if (losCheck) losCheck.checked = this.losOverlayEnabled;
    const agentCheck = document.getElementById("toggle-agent-control") as HTMLInputElement;
    if (agentCheck) agentCheck.checked = this.agentControlEnabled;
    const allowPauseCheck = document.getElementById("toggle-allow-tactical-pause") as HTMLInputElement;
    if (allowPauseCheck) allowPauseCheck.checked = this.allowTacticalPause;
    const styleSelect = document.getElementById("select-unit-style") as HTMLSelectElement;
    if (styleSelect) styleSelect.value = this.unitStyle;

    if (mapGenSelect) mapGenSelect.dispatchEvent(new Event("change"));
  }

  private renderSquadBuilder(isCampaign: boolean = false) {
    this.squadBuilder.update(this.currentSquad, this.currentMissionType, isCampaign);
  }
}
