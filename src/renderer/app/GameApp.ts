
import { AppContext } from "./AppContext";
import { InputBinder } from "./InputBinder";
import { GameClient } from "@src/engine/GameClient";
import { Renderer } from "@src/renderer/Renderer";
import { ScreenManager } from "@src/renderer/ScreenManager";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
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
import { PRNG } from "@src/shared/PRNG";
import pkg from "../../../package.json";

const VERSION = pkg.version;

export class GameApp {
  private context: AppContext;
  private inputBinder: InputBinder;
  
  // screens
  private campaignScreen!: CampaignScreen;
  private barracksScreen!: BarracksScreen;
  private debriefScreen!: DebriefScreen;
  private equipmentScreen!: EquipmentScreen;
  private campaignSummaryScreen!: CampaignSummaryScreen;

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
    this.context.screenManager = new ScreenManager();
    
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
      this.context.screenManager.show("main-menu");
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
      } else {
        this.context.screenManager.show("main-menu");
      }
    });

    this.barracksScreen = new BarracksScreen(
      "screen-barracks",
      this.context.campaignManager,
      () => {
        this.campaignScreen.show();
        this.context.screenManager.goBack();
      },
    );

    this.campaignScreen = new CampaignScreen(
      "screen-campaign",
      this.context.campaignManager,
      (node) => this.onCampaignNodeSelected(node),
      () => {
        this.barracksScreen.show();
        this.context.screenManager.show("barracks");
      },
      () => this.context.screenManager.show("main-menu"),
      () => this.applyCampaignTheme(),
      () => {
        const state = this.context.campaignManager.getState();
        if (state) {
          this.campaignSummaryScreen.show(state);
          this.context.screenManager.show("campaign-summary");
        }
      },
    );

    this.equipmentScreen = new EquipmentScreen(
        "screen-equipment",
        this.context.campaignManager,
        this.currentSquad,
        (config) => this.onEquipmentConfirmed(config),
        () => this.context.screenManager.goBack(),
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
            this.context.screenManager.show("mission-setup");
        },
        onCampaignMenu: () => {
            this.applyCampaignTheme();
            const state = this.context.campaignManager.getState();
            if (state && (state.status === "Victory" || state.status === "Defeat")) {
              this.campaignSummaryScreen.show(state);
              this.context.screenManager.show("campaign-summary");
            } else {
              this.campaignScreen.show();
              this.context.screenManager.show("campaign");
            }
        },
        onResetData: () => {
            if (confirm("Are you sure? This will wipe all campaign progress and settings.")) {
                localStorage.clear();
                window.location.reload();
            }
        },
        onShowEquipment: () => {
            this.equipmentScreen.updateConfig(this.currentSquad);
            this.context.screenManager.show("equipment");
        },
        onShowBarracks: () => {
            this.barracksScreen.show();
            this.context.screenManager.show("barracks");
        },
        onLoadStaticMap: (json) => {
            try {
                this.currentStaticMapData = MapUtility.transformMapData(JSON.parse(json));
                alert("Static Map Loaded.");
            } catch (e) {
                alert("Invalid JSON.");
            }
        },
        onUploadStaticMap: (file) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    this.currentStaticMapData = MapUtility.transformMapData(JSON.parse(ev.target?.result as string));
                    alert("Static Map Loaded from File.");
                } catch (err) {
                    alert("Invalid file.");
                }
            };
            reader.readAsText(file);
        },
        onConvertAscii: (ascii) => {
            try {
                if (ascii) {
                    this.currentStaticMapData = MapFactory.fromAscii(ascii);
                }
                alert("ASCII Map Converted.");
            } catch (e) {
                alert("Invalid ASCII.");
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
    });

    // Special bindings that were in main.ts
    this.setupAdditionalUIBindings();

    this.context.inputManager.init();
    
    // Initial UI state
    this.loadAndApplyConfig(false);
    const mvEl = document.getElementById("menu-version");
    if (mvEl) mvEl.textContent = `v${VERSION}`;
  }

  public start() {
    const persistedScreen = this.context.screenManager.loadPersistedState();
    if (persistedScreen === "mission") {
      this.resumeMission();
    } else if (persistedScreen) {
      if (persistedScreen === "campaign" || persistedScreen === "campaign-summary") {
        this.applyCampaignTheme();
        const state = this.context.campaignManager.getState();
        if (state && (state.status === "Victory" || state.status === "Defeat")) {
          this.campaignSummaryScreen.show(state);
          this.context.screenManager.show("campaign-summary");
        } else {
          this.campaignScreen.show();
          this.context.screenManager.show("campaign");
        }
      } else if (persistedScreen === "equipment") {
        this.equipmentScreen.updateConfig(this.currentSquad);
      } else if (persistedScreen === "barracks") {
        this.barracksScreen.show();
      }
    } else {
      this.context.screenManager.show("main-menu");
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

  private onCampaignNodeSelected(node: CampaignNode) {
    if (node.type === "Shop") {
      alert("Supply Depot reached. +100 Scrap granted for resupply.");
      this.context.campaignManager.advanceCampaignWithoutMission(node.id, 100, 0);
      this.campaignScreen.show();
      return;
    }

    if (node.type === "Event") {
      const prng = new PRNG(node.mapSeed);
      const event =
        CampaignEvents[Math.floor(prng.next() * CampaignEvents.length)];

      const modal = new EventModal((choice) => {
        const outcome = this.context.campaignManager.applyEventChoice(
          node.id,
          choice,
          prng,
        );

        const outcomeModal = new OutcomeModal(() => {
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

  private copyWorldState() {
    if (this.currentGameState) {
        DebugUtility.copyWorldState(
            this.currentGameState,
            this.context.gameClient.getReplayData(),
            VERSION,
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
      this.context.screenManager.show("main-menu");
    }
  }

  private abortMission() {
    this.context.gameClient.stop();
    this.context.gameClient.onStateUpdate(null);

    const tsSlider = document.getElementById("time-scale-slider") as HTMLInputElement;
    const tsValue = document.getElementById("time-scale-value");
    if (tsSlider) {
      tsSlider.value = "50";
      if (tsValue) tsValue.textContent = "1.0";
    }
    this.context.screenManager.show("main-menu");
  }

  private loadAndApplyConfig(isCampaign: boolean = false) {
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
      this.unitStyle = config.unitStyle || UnitStyle.Sprites;
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
    const container = document.getElementById("squad-builder");
    if (!container) return;
    container.innerHTML = "";

    const MAX_SQUAD_SIZE = 4;
    const isEscortMission = this.currentMissionType === MissionType.EscortVIP;

    const totalDiv = document.createElement("div");
    totalDiv.id = "squad-total-count";
    totalDiv.style.marginBottom = "10px";
    totalDiv.style.fontWeight = "bold";
    container.appendChild(totalDiv);

    const mainWrapper = document.createElement("div");
    mainWrapper.className = "squad-builder-container";
    container.appendChild(mainWrapper);

    const rosterPanel = document.createElement("div");
    rosterPanel.className = "roster-panel";
    mainWrapper.appendChild(rosterPanel);

    const deploymentPanel = document.createElement("div");
    deploymentPanel.className = "deployment-panel";
    mainWrapper.appendChild(deploymentPanel);

    const updateCount = () => {
      let total = this.currentSquad.soldiers.filter((s) => s.archetypeId !== "vip").length;
      totalDiv.textContent = `Total Soldiers: ${total}/${MAX_SQUAD_SIZE}`;
      totalDiv.style.color = total > MAX_SQUAD_SIZE ? "var(--color-danger)" : total === MAX_SQUAD_SIZE ? "var(--color-primary)" : "var(--color-text-muted)";
      const launchBtn = document.getElementById("btn-goto-equipment") as HTMLButtonElement;
      if (launchBtn) launchBtn.disabled = total === 0 || total > MAX_SQUAD_SIZE;
      renderRoster();
      renderSlots();
    };

    const renderRoster = () => {
      rosterPanel.innerHTML = "<h3>Roster</h3>";
      if (isCampaign) {
        const state = this.context.campaignManager.getState();
        if (state) {
          state.roster.forEach((soldier) => {
            if (soldier.archetypeId === "vip") return;
            const isSelected = this.currentSquad.soldiers.some((s) => s.id === soldier.id);
            const isDisabled = soldier.status !== "Healthy";
            rosterPanel.appendChild(createCampaignCard(soldier, isSelected, isDisabled));
          });
        }
      } else {
        Object.values(ArchetypeLibrary).forEach((arch) => {
          if (arch.id === "vip" && isEscortMission) return;
          rosterPanel.appendChild(createArchetypeCard(arch));
        });
      }
    };

    const renderSlots = () => {
      deploymentPanel.innerHTML = "<h3>Deployment</h3>";
      for (let i = 0; i < 4; i++) deploymentPanel.appendChild(createSlot(i));
    };

    const addToSquad = (data: any) => {
      const totalNonVip = this.currentSquad.soldiers.filter(s => s.archetypeId !== "vip").length;
      const totalOccupied = this.currentSquad.soldiers.length + (isEscortMission ? 1 : 0);
      if (totalOccupied >= 4) { alert("All deployment slots are full."); return; }
      if (data.archetypeId !== "vip" && totalNonVip >= MAX_SQUAD_SIZE) { alert(`Maximum of ${MAX_SQUAD_SIZE} soldiers allowed.`); return; }

      if (data.type === "campaign") {
        if (this.currentSquad.soldiers.some(s => s.id === data.id)) return;
        const state = this.context.campaignManager.getState();
        const s = state?.roster.find((r) => r.id === data.id);
        if (s) {
          this.currentSquad.soldiers.push({
            id: s.id,
            archetypeId: s.archetypeId,
            hp: s.hp,
            maxHp: s.maxHp,
            soldierAim: s.soldierAim,
            rightHand: s.equipment.rightHand,
            leftHand: s.equipment.leftHand,
            body: s.equipment.body,
            feet: s.equipment.feet,
          });
        }
      } else {
        this.currentSquad.soldiers.push({ archetypeId: data.archetypeId });
      }
      updateCount();
    };

    const createCampaignCard = (soldier: any, isSelected: boolean, isDisabled: boolean) => {
      const arch = ArchetypeLibrary[soldier.archetypeId];
      const card = document.createElement("div");
      card.className = `soldier-card ${isDisabled ? "disabled" : ""} ${isSelected ? "selected" : ""}`;
      if (!isDisabled && !isSelected) {
        card.draggable = true;
        card.addEventListener("dragstart", (e) => {
          e.dataTransfer?.setData("text/plain", JSON.stringify({ type: "campaign", id: soldier.id, archetypeId: soldier.archetypeId }));
        });
        card.addEventListener("dblclick", () => addToSquad({ type: "campaign", id: soldier.id, archetypeId: soldier.archetypeId }));
      }
      card.innerHTML = `<strong>${soldier.name}</strong><div style="font-size:0.75em; color:var(--color-text-muted);">${arch?.name || soldier.archetypeId} Lvl ${soldier.level} | Status: ${soldier.status}</div>`;
      return card;
    };

    const createArchetypeCard = (arch: any) => {
      const card = document.createElement("div");
      card.className = "soldier-card";
      card.draggable = true;
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/plain", JSON.stringify({ type: "custom", archetypeId: arch.id }));
      });
      card.addEventListener("dblclick", () => addToSquad({ type: "custom", archetypeId: arch.id }));
      const scaledFireRate = arch.fireRate * (arch.speed > 0 ? 10 / arch.speed : 1);
      const fireRateVal = scaledFireRate > 0 ? (1000 / scaledFireRate).toFixed(1) : "0";
      card.innerHTML = `<strong style="color:var(--color-primary);">${arch.name}</strong><div style="font-size:0.75em; color:var(--color-text-muted); display:flex; gap:8px; flex-wrap:wrap;">${StatDisplay.render(Icons.Speed, arch.speed, "Speed")}${StatDisplay.render(Icons.Accuracy, arch.accuracy, "Accuracy")}${StatDisplay.render(Icons.Damage, arch.damage, "Damage")}${StatDisplay.render(Icons.Rate, fireRateVal, "Fire Rate")}${StatDisplay.render(Icons.Range, arch.attackRange, "Range")}</div>`;
      return card;
    };

    const createSlot = (index: number) => {
      const slot = document.createElement("div");
      slot.className = "deployment-slot";
      if (index === 0 && isEscortMission) {
        slot.classList.add("locked");
        slot.innerHTML = `<div class="slot-label">VIP (Auto-Assigned)</div><strong style="color:var(--color-accent);">VIP</strong>`;
        return slot;
      }
      const soldierIdx = isEscortMission ? index - 1 : index;
      const soldier = this.currentSquad.soldiers[soldierIdx];
      if (soldier) {
        slot.classList.add("occupied");
        const arch = ArchetypeLibrary[soldier.archetypeId];
        let name = arch?.name || soldier.archetypeId;
        if (isCampaign && soldier.id) {
          const state = this.context.campaignManager.getState();
          const rs = state?.roster.find((r) => r.id === soldier.id);
          if (rs) name = rs.name;
        }
        slot.innerHTML = `<div class="slot-label">Slot ${index + 1}</div><strong style="color:var(--color-primary);">${name}</strong><div class="slot-remove" title="Remove">X</div>`;
        slot.querySelector(".slot-remove")?.addEventListener("click", (e) => { e.stopPropagation(); this.currentSquad.soldiers.splice(soldierIdx, 1); updateCount(); });
        slot.addEventListener("dblclick", () => { this.currentSquad.soldiers.splice(soldierIdx, 1); updateCount(); });
      } else {
        slot.innerHTML = `<div class="slot-label">Slot ${index + 1}</div><div style="color:var(--color-text-dim); font-size:0.8em;">(Empty)</div>`;
        slot.addEventListener("dragover", (e) => { e.preventDefault(); slot.classList.add("drag-over"); });
        slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
        slot.addEventListener("drop", (e) => { e.preventDefault(); slot.classList.remove("drag-over"); const dataStr = e.dataTransfer?.getData("text/plain"); if (dataStr) addToSquad(JSON.parse(dataStr)); });
      }
      return slot;
    };

    updateCount();
  }
}
