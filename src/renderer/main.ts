import { GameClient } from "../engine/GameClient";
import { Renderer } from "./Renderer";
import {
  GameState,
  UnitState,
  Unit,
  MapDefinition,
  MapGeneratorType,
  MissionType,
  SquadConfig,
  ArchetypeLibrary,
} from "../shared/types";
import { MapGenerator } from "../engine/MapGenerator";
import { ScreenManager } from "./ScreenManager";
import { ConfigManager } from "./ConfigManager";
import { MenuController } from "./MenuController";
import { HUDManager } from "./ui/HUDManager";
import { MapUtility } from "./MapUtility";
import { InputManager } from "./InputManager";
import { EquipmentScreen } from "./screens/EquipmentScreen";
import { BarracksScreen } from "./screens/BarracksScreen";
import { DebriefScreen } from "./screens/DebriefScreen";
import { CampaignManager } from "./campaign/CampaignManager";
import { CampaignScreen } from "./screens/CampaignScreen";
import { CampaignNode, MissionReport } from "../shared/campaign_types";
import { Icons } from "./Icons";
import { StatDisplay } from "./ui/StatDisplay";
import pkg from "../../package.json";

const VERSION = pkg.version;

// --- State ---
const screenManager = new ScreenManager();
const campaignManager = CampaignManager.getInstance();
let campaignScreen: CampaignScreen;
let barracksScreen: BarracksScreen;

const debriefScreen = new DebriefScreen("screen-debrief", () => {
  debriefScreen.hide();
  if (currentCampaignNode) {
    campaignScreen.show();
    screenManager.show("campaign");
  } else {
    screenManager.show("main-menu");
  }
});
let currentCampaignNode: CampaignNode | null = null;
let selectedUnitId: string | null = null;
let currentGameState: GameState | null = null;
let debriefShown = false;
let currentMapWidth = ConfigManager.getDefault().mapWidth;
let currentMapHeight = ConfigManager.getDefault().mapHeight;

let fogOfWarEnabled = ConfigManager.getDefault().fogOfWarEnabled;
let debugOverlayEnabled = ConfigManager.getDefault().debugOverlayEnabled;
let losOverlayEnabled = false;
let agentControlEnabled = ConfigManager.getDefault().agentControlEnabled;
let currentSeed: number = ConfigManager.getDefault().lastSeed;
let currentMapGeneratorType: MapGeneratorType =
  ConfigManager.getDefault().mapGeneratorType;
let currentMissionType: MissionType = ConfigManager.getDefault().missionType;
let currentStaticMapData: MapDefinition | undefined = undefined;
let currentSquad: SquadConfig = ConfigManager.getDefault().squadConfig;
let currentSpawnPointCount = ConfigManager.getDefault().spawnPointCount;

const mapGeneratorFactory = (
  seed: number,
  _type: MapGeneratorType,
  _mapData?: MapDefinition,
  _width: number = 32,
  _height: number = 32,
): MapGenerator => {
  return new MapGenerator(seed);
};

const gameClient = new GameClient(
  (seed, type, mapData) =>
    mapGeneratorFactory(
      seed,
      type,
      mapData,
      currentMapWidth,
      currentMapHeight,
    ) as any,
);
const menuController = new MenuController(gameClient);
let renderer: Renderer;

const copyWorldState = () => {
  if (!currentGameState) return;
  const replayData = gameClient.getReplayData();
  const fullState = {
    replayData,
    currentState: currentGameState,
    version: VERSION,
    timestamp: Date.now(),
  };

  const json = JSON.stringify(fullState, null, 2);
  navigator.clipboard
    .writeText(json)
    .then(() => {
      alert("World State copied to clipboard!");
    })
    .catch((err) => {
      console.error("Failed to copy state to clipboard:", err);
      console.log("Full World State JSON:");
      console.log(json);
      alert("Failed to copy to clipboard. See console for JSON.");
    });
};

// --- Managers ---
const hudManager = new HUDManager(
  menuController,
  (unit) => onUnitClick(unit),
  () => abortMission(),
  (key) => handleMenuInput(key),
  () => copyWorldState(),
  VERSION,
);

const inputManager = new InputManager(
  screenManager,
  menuController,
  () => togglePause(),
  (key) => handleMenuInput(key),
  () => abortMission(),
  () => {
    selectedUnitId = null;
    updateUI(currentGameState!);
  },
  () => selectedUnitId,
  (state) => updateUI(state),
  (e) => handleCanvasClick(e),
  (enabled) => gameClient.toggleDebugOverlay(enabled),
  (enabled) => gameClient.toggleLosOverlay(enabled),
  () => currentGameState,
);

// --- Functions ---
const updateUI = (state: GameState) => {
  hudManager.update(state, selectedUnitId);
};

const generateMissionReport = (
  state: GameState,
  node: CampaignNode | null,
): MissionReport => {
  return {
    nodeId: node ? node.id : "custom",
    seed: currentSeed,
    result: state.status === "Won" ? "Won" : "Lost",
    aliensKilled: state.stats.aliensKilled,
    scrapGained: state.stats.scrapGained,
    intelGained: state.status === "Won" ? 5 : 0,
    timeSpent: state.t,
    soldierResults: state.units.map((u) => ({
      soldierId: u.id,
      xpGained:
        (state.status === "Won" ? 50 : 10) +
        (u.state !== UnitState.Dead ? 20 : 0) +
        u.kills * 10,
      kills: u.kills,
      promoted: false,
      status: u.state === UnitState.Dead ? "Dead" : "Healthy",
    })),
  };
};

const handleMenuInput = (key: string, shiftHeld: boolean = false) => {
  if (!currentGameState) return;
  menuController.isShiftHeld = shiftHeld;
  menuController.handleMenuInput(key, currentGameState);
  updateUI(currentGameState);
};

const togglePause = () => {
  gameClient.togglePause();
  const isPaused = gameClient.getIsPaused();
  const lastSpeed = gameClient.getTargetScale();

  const btn = document.getElementById("btn-pause-toggle") as HTMLButtonElement;
  const gameSpeedSlider = document.getElementById(
    "game-speed",
  ) as HTMLInputElement;
  const gameSpeedValue = document.getElementById("speed-value");

  if (isPaused) {
    if (btn) btn.textContent = "▶ Play";
    if (gameSpeedValue) gameSpeedValue.textContent = `0.05x`;
  } else {
    if (btn) btn.textContent = "⏸ Pause";
    if (gameSpeedValue) gameSpeedValue.textContent = `${lastSpeed.toFixed(1)}x`;
    if (gameSpeedSlider) gameSpeedSlider.value = lastSpeed.toString();
  }
};

const onUnitClick = (unit: Unit, shiftHeld: boolean = false) => {
  if (menuController.menuState === "UNIT_SELECT") {
    menuController.isShiftHeld = shiftHeld;
    menuController.selectUnit(unit.id);
    if (currentGameState) updateUI(currentGameState);
    return;
  }
  selectedUnitId = unit.id === selectedUnitId ? null : unit.id;
  if (currentGameState) updateUI(currentGameState);
};

const handleCanvasClick = (event: MouseEvent) => {
  if (!renderer || !currentGameState) return;
  const clickedCell = renderer.getCellCoordinates(event.clientX, event.clientY);
  const prevState = menuController.menuState;
  menuController.handleCanvasClick(clickedCell, currentGameState);

  if (menuController.menuState !== prevState) {
    updateUI(currentGameState);
    return;
  }

  const unitAtClick = currentGameState.units.find(
    (unit) =>
      Math.floor(unit.pos.x) === clickedCell.x &&
      Math.floor(unit.pos.y) === clickedCell.y &&
      unit.state !== UnitState.Dead &&
      unit.state !== UnitState.Extracted,
  );
  if (unitAtClick) onUnitClick(unitAtClick);
};

const launchMission = () => {
  const mapSeedInput = document.getElementById("map-seed") as HTMLInputElement;
  if (mapSeedInput && !mapSeedInput.disabled) {
    const val = parseInt(mapSeedInput.value);
    currentSeed = !isNaN(val) ? val : Date.now();
  }

  const wInput = document.getElementById("map-width") as HTMLInputElement;
  const hInput = document.getElementById("map-height") as HTMLInputElement;
  const spInput = document.getElementById(
    "map-spawn-points",
  ) as HTMLInputElement;
  const threatInput = document.getElementById(
    "map-starting-threat",
  ) as HTMLInputElement;

  if (wInput && hInput) {
    currentMapWidth = parseInt(wInput.value) || 14;
    currentMapHeight = parseInt(hInput.value) || 14;
  }
  if (spInput) currentSpawnPointCount = parseInt(spInput.value) || 1;

  let startingThreatLevel = 0;
  if (threatInput) {
    startingThreatLevel = parseInt(threatInput.value) || 0;
  }

  const tsSlider = document.getElementById(
    "time-scale-slider",
  ) as HTMLInputElement;
  const initialTimeScale = tsSlider ? parseFloat(tsSlider.value) : 1.0;

  const config = {
    mapWidth: currentMapWidth,
    mapHeight: currentMapHeight,
    spawnPointCount: currentSpawnPointCount,
    fogOfWarEnabled,
    debugOverlayEnabled,
    losOverlayEnabled,
    agentControlEnabled,
    mapGeneratorType: currentMapGeneratorType,
    missionType: currentMissionType,
    lastSeed: currentSeed,
    squadConfig: currentSquad,
    startingThreatLevel,
  };

  if (currentCampaignNode) {
    ConfigManager.saveCampaign(config);
  } else {
    ConfigManager.saveCustom(config);
  }

  gameClient.init(
    currentSeed,
    currentMapGeneratorType,
    currentStaticMapData,
    fogOfWarEnabled,
    debugOverlayEnabled,
    agentControlEnabled,
    currentSquad,
    currentMissionType,
    currentMapWidth,
    currentMapHeight,
    currentSpawnPointCount,
    losOverlayEnabled,
    startingThreatLevel,
    initialTimeScale,
    false, // startPaused
  );

  const seedDisplay = document.getElementById("seed-display");
  if (seedDisplay) seedDisplay.textContent = `Seed: ${currentSeed}`;

  // Sync Speed Slider
  const gameSpeedSlider = document.getElementById(
    "game-speed",
  ) as HTMLInputElement;
  const gameSpeedValue = document.getElementById("speed-value");
  const currentScale = gameClient.getTargetScale();
  if (gameSpeedSlider) gameSpeedSlider.value = currentScale.toString();
  if (gameSpeedValue)
    gameSpeedValue.textContent = `${currentScale.toFixed(1)}x`;

  selectedUnitId = null;
  debriefShown = false;
  const rightPanel = document.getElementById("right-panel");
  if (rightPanel) rightPanel.innerHTML = "";
  menuController.reset();
  menuController.clearDiscoveryOrder();

  gameClient.onStateUpdate((state) => {
    currentGameState = state;
    if (!renderer) {
      const canvas = document.getElementById(
        "game-canvas",
      ) as HTMLCanvasElement;
      if (canvas) {
        renderer = new Renderer(canvas);
        renderer.setCellSize(128);
      }
    }
    if (renderer) {
      renderer.setOverlay(menuController.overlayOptions);
      renderer.render(state);
    }

    if ((state.status === "Won" || state.status === "Lost") && !debriefShown) {
      debriefShown = true;
      const report = generateMissionReport(state, currentCampaignNode);
      campaignManager.processMissionResult(report);

      // Start Replay in background
      const replayData = gameClient.getReplayData();
      if (replayData) {
        gameClient.loadReplay(replayData);
        gameClient.setTimeScale(5.0);
      }

      debriefScreen.show(report);
    }

    updateUI(state);
  });
  screenManager.show("mission");
};

const abortMission = () => {
  gameClient.stop();
  gameClient.onStateUpdate(null);

  // Reset time scale slider for next mission setup
  const tsSlider = document.getElementById(
    "time-scale-slider",
  ) as HTMLInputElement;
  const tsValue = document.getElementById("time-scale-value");
  if (tsSlider) {
    tsSlider.value = "1.0";
    if (tsValue) tsValue.textContent = "1.0";
  }

  screenManager.show("main-menu");
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  inputManager.init();

  // Navigation
  barracksScreen = new BarracksScreen(
    "screen-barracks",
    campaignManager,
    () => {
      campaignScreen.show();
      screenManager.goBack();
    },
  );

  campaignScreen = new CampaignScreen(
    "screen-campaign",
    campaignManager,
    (node) => {
      // Node selected! Prepare mission setup
      currentCampaignNode = node;
      currentSeed = node.mapSeed;
      currentMapWidth = 14 + Math.floor(node.difficulty * 2);
      currentMapHeight = 14 + Math.floor(node.difficulty * 2);
      currentSpawnPointCount = 1 + Math.floor(node.difficulty / 5);

      loadAndApplyConfig(true);

      // Explicitly override map settings from node since loadAndApplyConfig might have loaded something else
      currentSeed = node.mapSeed;
      currentMapWidth = 14 + Math.floor(node.difficulty * 2);
      currentMapHeight = 14 + Math.floor(node.difficulty * 2);
      currentSpawnPointCount = 1 + Math.floor(node.difficulty / 5);

      // Update Setup UI
      const mapSeedInput = document.getElementById(
        "map-seed",
      ) as HTMLInputElement;
      if (mapSeedInput) mapSeedInput.value = currentSeed.toString();

      const wInput = document.getElementById("map-width") as HTMLInputElement;
      const hInput = document.getElementById("map-height") as HTMLInputElement;
      if (wInput) wInput.value = currentMapWidth.toString();
      if (hInput) hInput.value = currentMapHeight.toString();

      const spInput = document.getElementById(
        "map-spawn-points",
      ) as HTMLInputElement;
      if (spInput) spInput.value = currentSpawnPointCount.toString();

      screenManager.show("mission-setup");
    },
    () => {
      barracksScreen.show();
      screenManager.show("barracks");
    },
    () => screenManager.goBack(),
  );

  document.getElementById("btn-menu-custom")?.addEventListener("click", () => {
    currentCampaignNode = null;
    loadAndApplyConfig(false);
    screenManager.show("mission-setup");
  });
  document
    .getElementById("btn-menu-campaign")
    ?.addEventListener("click", () => {
      if (!campaignManager.getState()) {
        // For prototype, automatically start a campaign if none exists
        campaignManager.startNewCampaign(Date.now(), "normal");
      }
      campaignScreen.show();
      screenManager.show("campaign");
    });

  document
    .getElementById("btn-campaign-back")
    ?.addEventListener("click", () => screenManager.goBack());
  document
    .getElementById("btn-setup-back")
    ?.addEventListener("click", () => screenManager.goBack());
  document.getElementById("btn-give-up")?.addEventListener("click", () => {
    if (confirm("Abort Mission and return to menu?")) {
      abortMission();
    }
  });

  const equipmentScreen = new EquipmentScreen(
    "screen-equipment",
    currentSquad,
    (config) => {
      currentSquad = config;
      launchMission();
    },
    () => screenManager.goBack(),
  );

  document
    .getElementById("btn-goto-equipment")
    ?.addEventListener("click", () => {
      equipmentScreen.updateConfig(currentSquad);
      screenManager.show("equipment");
    });

  // Speed Controls
  document
    .getElementById("btn-pause-toggle")
    ?.addEventListener("click", () => togglePause());
  const gameSpeedSlider = document.getElementById(
    "game-speed",
  ) as HTMLInputElement;
  const gameSpeedValue = document.getElementById("speed-value");
  if (gameSpeedSlider && gameSpeedValue) {
    gameSpeedSlider.max = "5.0";
    gameSpeedSlider.addEventListener("input", () => {
      const speed = parseFloat(gameSpeedSlider.value);
      gameClient.setTimeScale(speed);

      if (gameClient.getIsPaused()) {
        gameSpeedValue.textContent = `0.05x`;
      } else {
        gameSpeedValue.textContent = `${speed.toFixed(1)}x`;
      }
    });
  }

  // Threat Slider
  const threatSlider = document.getElementById(
    "map-starting-threat",
  ) as HTMLInputElement;
  const threatValue = document.getElementById("map-starting-threat-value");
  if (threatSlider && threatValue) {
    threatSlider.addEventListener("input", () => {
      threatValue.textContent = threatSlider.value;
    });
  }

  // Setup Options
  const mapGenSelect = document.getElementById(
    "map-generator-type",
  ) as HTMLSelectElement;
  if (mapGenSelect) {
    const treeOpt = document.createElement("option");
    treeOpt.value = "TreeShip";
    treeOpt.textContent = "Tree Ship (No Loops)";
    mapGenSelect.appendChild(treeOpt);
    const denseOpt = document.createElement("option");
    denseOpt.value = "DenseShip";
    denseOpt.textContent = "Dense Ship (>90% fill)";
    mapGenSelect.appendChild(denseOpt);

    const mapGenGroup = mapGenSelect.closest(".control-group");
    if (mapGenGroup) {
      const missionDiv = document.createElement("div");
      missionDiv.style.marginBottom = "10px";
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
      const missionSelect = document.getElementById(
        "mission-type",
      ) as HTMLSelectElement;
      missionSelect.addEventListener("change", () => {
        currentMissionType = missionSelect.value as MissionType;
        if (currentMissionType === MissionType.EscortVIP) {
          currentSquad.soldiers = currentSquad.soldiers.filter(
            (s) => s.archetypeId !== "vip",
          );
        }
        renderSquadBuilder();
      });
    }

    mapGenSelect.addEventListener("change", () => {
      currentMapGeneratorType = mapGenSelect.value as MapGeneratorType;
      const isStatic = currentMapGeneratorType === MapGeneratorType.Static;
      const staticControls = document.getElementById("static-map-controls");
      if (staticControls)
        staticControls.style.display = isStatic ? "block" : "none";
      const wInput = document.getElementById("map-width") as HTMLInputElement;
      const hInput = document.getElementById("map-height") as HTMLInputElement;
      const sInput = document.getElementById("map-seed") as HTMLInputElement;
      if (wInput) wInput.disabled = isStatic;
      if (hInput) hInput.disabled = isStatic;
      if (sInput) sInput.disabled = isStatic;
    });
  }

  // Toggles Injection
  const presetControls = document.getElementById("preset-map-controls");
  if (presetControls) {
    const togglesDiv = document.createElement("div");
    togglesDiv.className = "control-group";
    togglesDiv.innerHTML = `
        <h3>Game Options</h3>
        <div><input type="checkbox" id="toggle-fog-of-war" checked><label for="toggle-fog-of-war" style="display:inline;">Fog of War</label></div>
        <div><input type="checkbox" id="toggle-debug-overlay"><label for="toggle-debug-overlay" style="display:inline;">Debug Overlay</label></div>
        <div><input type="checkbox" id="toggle-los-overlay"><label for="toggle-los-overlay" style="display:inline;">LOS Visualization</label></div>
        <div><input type="checkbox" id="toggle-agent-control" checked><label for="toggle-agent-control" style="display:inline;">Agent Control</label></div>
        <div style="margin-top: 20px;">
            <label for="time-scale-slider" style="display: block; margin-bottom: 10px;">Game Speed (x): <span id="time-scale-value">1.0</span></label>
            <input type="range" id="time-scale-slider" min="0.1" max="5.0" step="0.1" value="1.0" style="width: 100%; height: 20px; cursor: pointer;">
        </div>
      `;
    const mapConfigSection = document.getElementById("map-config-section");
    if (mapConfigSection) {
      mapConfigSection.appendChild(togglesDiv);
    } else {
      presetControls.closest(".control-group")?.after(togglesDiv);
    }
    document
      .getElementById("toggle-fog-of-war")
      ?.addEventListener(
        "change",
        (e) => (fogOfWarEnabled = (e.target as HTMLInputElement).checked),
      );
    document
      .getElementById("toggle-debug-overlay")
      ?.addEventListener(
        "change",
        (e) => (debugOverlayEnabled = (e.target as HTMLInputElement).checked),
      );
    document
      .getElementById("toggle-los-overlay")
      ?.addEventListener(
        "change",
        (e) => (losOverlayEnabled = (e.target as HTMLInputElement).checked),
      );
    document
      .getElementById("toggle-agent-control")
      ?.addEventListener(
        "change",
        (e) => (agentControlEnabled = (e.target as HTMLInputElement).checked),
      );
    const tsSlider = document.getElementById(
      "time-scale-slider",
    ) as HTMLInputElement;
    const tsValue = document.getElementById("time-scale-value");
    tsSlider?.addEventListener("input", () => {
      const scale = parseFloat(tsSlider.value);
      if (tsValue) tsValue.textContent = scale.toString();
      gameClient.setTimeScale(scale);
    });
  }

  // Static Map & Replay buttons
  document.getElementById("load-static-map")?.addEventListener("click", () => {
    try {
      const json = (
        document.getElementById("static-map-json") as HTMLTextAreaElement
      ).value;
      currentStaticMapData = MapUtility.transformMapData(JSON.parse(json));
      alert("Static Map Loaded.");
    } catch (e) {
      alert("Invalid JSON.");
    }
  });
  document
    .getElementById("upload-static-map")
    ?.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            currentStaticMapData = MapUtility.transformMapData(
              JSON.parse(ev.target?.result as string),
            );
            alert("Static Map Loaded from File.");
          } catch (err) {
            alert("Invalid file.");
          }
        };
        reader.readAsText(file);
      }
    });
  document
    .getElementById("convert-ascii-to-map")
    ?.addEventListener("click", () => {
      try {
        const ascii = (
          document.getElementById("ascii-map-input") as HTMLTextAreaElement
        ).value;
        currentStaticMapData = MapGenerator.fromAscii(ascii);
        alert("ASCII Map Converted.");
      } catch (e) {
        alert("Invalid ASCII.");
      }
    });
  document.getElementById("export-replay")?.addEventListener("click", () => {
    const replay = gameClient.getReplayData();
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
  });

  const loadAndApplyConfig = (isCampaign: boolean = false) => {
    const config = isCampaign
      ? ConfigManager.loadCampaign()
      : ConfigManager.loadCustom();

    const mapConfigSection = document.getElementById("map-config-section");
    if (mapConfigSection) {
      mapConfigSection.style.display = isCampaign ? "none" : "block";
    }

    if (config) {
      currentMapWidth = config.mapWidth;
      currentMapHeight = config.mapHeight;
      currentSpawnPointCount = config.spawnPointCount || 1;
      fogOfWarEnabled = config.fogOfWarEnabled;
      debugOverlayEnabled = config.debugOverlayEnabled;
      losOverlayEnabled = config.losOverlayEnabled || false;
      agentControlEnabled = config.agentControlEnabled;
      currentMapGeneratorType = config.mapGeneratorType;
      currentMissionType = config.missionType || MissionType.Default;
      currentSeed = config.lastSeed;
      currentSquad = config.squadConfig;
      const startingThreatLevel = config.startingThreatLevel || 0;

      // Apply to UI
      const missionSelect = document.getElementById(
        "mission-type",
      ) as HTMLSelectElement;
      if (missionSelect) missionSelect.value = currentMissionType;

      const mapSeedInput = document.getElementById(
        "map-seed",
      ) as HTMLInputElement;
      if (mapSeedInput) mapSeedInput.value = currentSeed.toString();

      const mapGenSelect = document.getElementById(
        "map-generator-type",
      ) as HTMLSelectElement;
      if (mapGenSelect) mapGenSelect.value = currentMapGeneratorType;

      const wInput = document.getElementById("map-width") as HTMLInputElement;
      const hInput = document.getElementById("map-height") as HTMLInputElement;
      const spInput = document.getElementById(
        "map-spawn-points",
      ) as HTMLInputElement;
      const threatInput = document.getElementById(
        "map-starting-threat",
      ) as HTMLInputElement;

      if (wInput) wInput.value = currentMapWidth.toString();
      if (hInput) hInput.value = currentMapHeight.toString();
      if (spInput) spInput.value = currentSpawnPointCount.toString();
      if (threatInput) {
        threatInput.value = startingThreatLevel.toString();
        const threatValueDisplay = document.getElementById(
          "map-starting-threat-value",
        );
        if (threatValueDisplay)
          threatValueDisplay.textContent = threatInput.value;
      }

      const fowCheck = document.getElementById(
        "toggle-fog-of-war",
      ) as HTMLInputElement;
      if (fowCheck) fowCheck.checked = fogOfWarEnabled;

      const debugCheck = document.getElementById(
        "toggle-debug-overlay",
      ) as HTMLInputElement;
      if (debugCheck) debugCheck.checked = debugOverlayEnabled;

      const losCheck = document.getElementById(
        "toggle-los-overlay",
      ) as HTMLInputElement;
      if (losCheck) losCheck.checked = losOverlayEnabled;

      const agentCheck = document.getElementById(
        "toggle-agent-control",
      ) as HTMLInputElement;
      if (agentCheck) agentCheck.checked = agentControlEnabled;

      if (mapGenSelect) mapGenSelect.dispatchEvent(new Event("change"));
    } else {
      // Fallback to defaults if no saved config exists for this mode
      const defaults = ConfigManager.getDefault();
      currentMapWidth = defaults.mapWidth;
      currentMapHeight = defaults.mapHeight;
      currentSpawnPointCount = defaults.spawnPointCount;
      fogOfWarEnabled = defaults.fogOfWarEnabled;
      debugOverlayEnabled = defaults.debugOverlayEnabled;
      losOverlayEnabled = defaults.losOverlayEnabled;
      agentControlEnabled = defaults.agentControlEnabled;
      currentMapGeneratorType = defaults.mapGeneratorType;
      currentMissionType = defaults.missionType;
      currentSeed = defaults.lastSeed;
      currentSquad = JSON.parse(JSON.stringify(defaults.squadConfig)); // Deep copy
      const startingThreatLevel = defaults.startingThreatLevel;

      // Apply to UI
      const missionSelect = document.getElementById(
        "mission-type",
      ) as HTMLSelectElement;
      if (missionSelect) missionSelect.value = currentMissionType;

      const mapSeedInput = document.getElementById(
        "map-seed",
      ) as HTMLInputElement;
      if (mapSeedInput) mapSeedInput.value = currentSeed.toString();

      const mapGenSelect = document.getElementById(
        "map-generator-type",
      ) as HTMLSelectElement;
      if (mapGenSelect) mapGenSelect.value = currentMapGeneratorType;

      const wInput = document.getElementById("map-width") as HTMLInputElement;
      const hInput = document.getElementById("map-height") as HTMLInputElement;
      const spInput = document.getElementById(
        "map-spawn-points",
      ) as HTMLInputElement;
      const threatInput = document.getElementById(
        "map-starting-threat",
      ) as HTMLInputElement;

      if (wInput) wInput.value = currentMapWidth.toString();
      if (hInput) hInput.value = currentMapHeight.toString();
      if (spInput) spInput.value = currentSpawnPointCount.toString();
      if (threatInput) {
        threatInput.value = startingThreatLevel.toString();
        const threatValueDisplay = document.getElementById(
          "map-starting-threat-value",
        );
        if (threatValueDisplay)
          threatValueDisplay.textContent = threatInput.value;
      }

      const fowCheck = document.getElementById(
        "toggle-fog-of-war",
      ) as HTMLInputElement;
      if (fowCheck) fowCheck.checked = fogOfWarEnabled;

      const debugCheck = document.getElementById(
        "toggle-debug-overlay",
      ) as HTMLInputElement;
      if (debugCheck) debugCheck.checked = debugOverlayEnabled;

      const losCheck = document.getElementById(
        "toggle-los-overlay",
      ) as HTMLInputElement;
      if (losCheck) losCheck.checked = losOverlayEnabled;

      const agentCheck = document.getElementById(
        "toggle-agent-control",
      ) as HTMLInputElement;
      if (agentCheck) agentCheck.checked = agentControlEnabled;

      if (mapGenSelect) mapGenSelect.dispatchEvent(new Event("change"));
    }

    // Always sync with roster if in campaign mode to ensure latest stats/leveling are applied
    if (isCampaign) {
      const state = campaignManager.getState();
      if (state) {
        // If squad is empty (first time), auto-populate with first 4 healthy soldiers
        if (currentSquad.soldiers.length === 0) {
          const healthy = state.roster
            .filter((s) => s.status === "Healthy")
            .slice(0, 4);
          currentSquad.soldiers = healthy.map((s) => ({
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
          // Sync existing squad soldiers with roster
          currentSquad.soldiers.forEach((s) => {
            if (s.id) {
              const rs = state.roster.find((r) => r.id === s.id);
              if (rs) {
                s.hp = rs.hp;
                s.maxHp = rs.maxHp;
                s.soldierAim = rs.soldierAim;
                s.rightHand = rs.equipment.rightHand;
                s.leftHand = rs.equipment.leftHand;
                s.body = rs.equipment.body;
                s.feet = rs.equipment.feet;
              }
            }
          });
        }
      }
    }

    renderSquadBuilder();
  };

  function renderSquadBuilder() {
    const container = document.getElementById("squad-builder");
    if (!container) return;
    container.innerHTML = "";

    const MAX_SQUAD_SIZE = 4;
    const totalDiv = document.createElement("div");
    totalDiv.id = "squad-total-count";
    totalDiv.style.marginBottom = "10px";
    totalDiv.style.fontWeight = "bold";
    container.appendChild(totalDiv);

    const updateCount = () => {
      // VIPs do not count towards the squad size limit
      let total = currentSquad.soldiers.filter(
        (s) => s.archetypeId !== "vip",
      ).length;

      totalDiv.textContent = `Total Soldiers: ${total}/${MAX_SQUAD_SIZE}`;
      totalDiv.style.color =
        total > MAX_SQUAD_SIZE
          ? "#f00"
          : total === MAX_SQUAD_SIZE
            ? "#0f0"
            : "#aaa";
      const launchBtn = document.getElementById(
        "btn-goto-equipment",
      ) as HTMLButtonElement;
      if (launchBtn) launchBtn.disabled = total === 0 || total > MAX_SQUAD_SIZE;
    };

    Object.values(ArchetypeLibrary).forEach((arch) => {
      if (currentMissionType === MissionType.EscortVIP && arch.id === "vip") {
        return; // VIP is auto-added in this mission type
      }
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.borderBottom = "1px solid #333";
      row.style.padding = "5px 0";

      const info = document.createElement("div");
      info.style.flex = "1";
      const scaledFireRate =
        arch.fireRate * (arch.speed > 0 ? 10 / arch.speed : 1);
      const fireRateVal =
        scaledFireRate > 0 ? (1000 / scaledFireRate).toFixed(1) : "0";
      info.innerHTML = `
        <strong style="color:#0f0;">${arch.name}</strong>
        <div style="font-size:0.75em; color:#888; margin-top:2px; display:flex; gap:8px;">
          ${StatDisplay.render(Icons.Speed, arch.speed, "Speed")}
          ${StatDisplay.render(Icons.Accuracy, arch.accuracy, "Accuracy")}
          ${StatDisplay.render(Icons.Damage, arch.damage, "Damage")}
          ${StatDisplay.render(Icons.Rate, fireRateVal, "Fire Rate")}
          ${StatDisplay.render(Icons.Range, arch.attackRange, "Range")}
        </div>
      `;

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "4";
      // Count soldiers of this archetype
      const currentCount = currentSquad.soldiers.filter(
        (s) => s.archetypeId === arch.id,
      ).length;
      input.value = currentCount.toString();

      input.style.width = "60px";
      input.style.marginLeft = "10px";

      input.addEventListener("change", () => {
        const val = parseInt(input.value) || 0;

        // Calculate total excluding this archetype
        const otherSoldiers = currentSquad.soldiers.filter(
          (s) => s.archetypeId !== arch.id,
        );
        const otherTotal = otherSoldiers.filter(
          (s) => s.archetypeId !== "vip",
        ).length;

        if (arch.id !== "vip" && otherTotal + val > MAX_SQUAD_SIZE) {
          input.value = currentCount.toString();
          alert(`Max squad size is ${MAX_SQUAD_SIZE}.`);
          return;
        }

        // Reconstruct soldiers list: keep others, add 'val' of this archetype
        const newSoldiers = [...otherSoldiers];
        for (let i = 0; i < val; i++) {
          newSoldiers.push({ archetypeId: arch.id });
        }
        currentSquad.soldiers = newSoldiers;

        updateCount();
      });
      row.append(info, input);
      container.appendChild(row);
    });
    updateCount();
  }

  loadAndApplyConfig(false);
  screenManager.show("main-menu");
});
