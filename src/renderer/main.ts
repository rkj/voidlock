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
import pkg from "../../package.json";

const VERSION = pkg.version;

// --- State ---
const screenManager = new ScreenManager();
let selectedUnitId: string | null = null;
let currentGameState: GameState | null = null;
let currentMapWidth = ConfigManager.getDefault().mapWidth;
let currentMapHeight = ConfigManager.getDefault().mapHeight;
let isPaused = false;
let lastSpeed = 1.0;

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

// --- Managers ---
const hudManager = new HUDManager(
  menuController,
  (unit) => onUnitClick(unit),
  () => abortMission(),
  (key) => handleMenuInput(key),
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
);

// --- Functions ---
const updateUI = (state: GameState) => {
  hudManager.update(state, selectedUnitId);
};

const handleMenuInput = (key: string) => {
  if (!currentGameState) return;
  menuController.handleMenuInput(key, currentGameState);
  updateUI(currentGameState);
};

const togglePause = () => {
  isPaused = !isPaused;
  const btn = document.getElementById("btn-pause-toggle") as HTMLButtonElement;
  const gameSpeedSlider = document.getElementById(
    "game-speed",
  ) as HTMLInputElement;
  const gameSpeedValue = document.getElementById("speed-value");

  if (isPaused) {
    lastSpeed = parseFloat(gameSpeedSlider.value);
    gameClient.setTimeScale(0.05);
    if (btn) btn.textContent = "▶ Play";
    if (gameSpeedValue) gameSpeedValue.textContent = "0.05x";
  } else {
    gameClient.setTimeScale(lastSpeed);
    if (btn) btn.textContent = "⏸ Pause";
    if (gameSpeedValue) gameSpeedValue.textContent = `${lastSpeed.toFixed(1)}x`;
    if (gameSpeedSlider) gameSpeedSlider.value = lastSpeed.toString();
  }
};

const onUnitClick = (unit: Unit) => {
  if (menuController.menuState === "UNIT_SELECT") {
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

  ConfigManager.save({
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
  });

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
  );

  const seedDisplay = document.getElementById("seed-display");
  if (seedDisplay) seedDisplay.textContent = `Seed: ${currentSeed}`;

  selectedUnitId = null;
  const rightPanel = document.getElementById("right-panel");
  if (rightPanel) rightPanel.innerHTML = "";
  menuController.reset();

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
    updateUI(state);
  });
  screenManager.show("mission");
};

const abortMission = () => {
  gameClient.stop();
  gameClient.onStateUpdate(null);
  screenManager.show("main-menu");
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  inputManager.init();

  // Navigation
  document
    .getElementById("btn-menu-custom")
    ?.addEventListener("click", () => screenManager.show("mission-setup"));
  document
    .getElementById("btn-menu-campaign")
    ?.addEventListener("click", () => screenManager.show("campaign"));
  document
    .getElementById("btn-campaign-back")
    ?.addEventListener("click", () => screenManager.goBack());
  document
    .getElementById("btn-setup-back")
    ?.addEventListener("click", () => screenManager.goBack());
  document
    .getElementById("btn-mission-abort")
    ?.addEventListener("click", () => abortMission());
  document
    .getElementById("btn-launch-mission")
    ?.addEventListener("click", () => launchMission());

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
      gameSpeedValue.textContent = `${speed.toFixed(1)}x`;
      if (isPaused) {
        lastSpeed = speed;
        gameClient.setTimeScale(0.05);
        gameSpeedValue.textContent = `0.05x (Pending: ${speed.toFixed(1)}x)`;
      } else {
        gameClient.setTimeScale(speed);
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
        </select>
      `;
      mapGenGroup.insertBefore(missionDiv, mapGenGroup.firstChild);
      const missionSelect = document.getElementById(
        "mission-type",
      ) as HTMLSelectElement;
      missionSelect.addEventListener("change", () => {
        currentMissionType = missionSelect.value as MissionType;
        if (currentMissionType === MissionType.EscortVIP) {
          currentSquad = currentSquad.filter((s) => s.archetypeId !== "vip");
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
    presetControls.closest(".control-group")?.after(togglesDiv);
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
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `xenopurge-replay-${replay.seed}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  });

  const loadAndApplyConfig = () => {
    const config = ConfigManager.load();
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
        if (threatValueDisplay) threatValueDisplay.textContent = threatInput.value;
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
    renderSquadBuilder();
  };

    function renderSquadBuilder() {
    const container = document.getElementById("squad-builder");
    if (!container) return;
    container.innerHTML = "";
    // ... squad builder logic (keeping it here for now as it is very UI-heavy) ...
    // To keep it simple, I'll just restore the original logic but slightly condensed.
    const MAX_SQUAD_SIZE = 4;
    const totalDiv = document.createElement("div");
    totalDiv.id = "squad-total-count";
    totalDiv.style.marginBottom = "10px";
    totalDiv.style.fontWeight = "bold";
    container.appendChild(totalDiv);

    const updateCount = () => {
      // VIPs do not count towards the squad size limit
      let total = currentSquad
        .filter((s) => s.archetypeId !== "vip")
        .reduce((sum, s) => sum + s.count, 0);

      totalDiv.textContent = `Total Soldiers: ${total}/${MAX_SQUAD_SIZE}`;
      totalDiv.style.color =
        total > MAX_SQUAD_SIZE
          ? "#f00"
          : total === MAX_SQUAD_SIZE
            ? "#0f0"
            : "#aaa";
      const launchBtn = document.getElementById(
        "btn-launch-mission",
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
      const label = document.createElement("label");
      label.textContent = arch.name;
      label.style.flex = "1";
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "4";
      input.value = (
        currentSquad.find((s) => s.archetypeId === arch.id)?.count || 0
      ).toString();
      input.style.width = "60px";
      input.style.marginLeft = "10px";
      input.addEventListener("change", () => {
        const val = parseInt(input.value) || 0;
        let otherTotal = currentSquad
          .filter((s) => s.archetypeId !== arch.id && s.archetypeId !== "vip")
          .reduce((sum, s) => sum + s.count, 0);

        if (arch.id !== "vip" && otherTotal + val > MAX_SQUAD_SIZE) {
          input.value = (
            currentSquad.find((s) => s.archetypeId === arch.id)?.count || 0
          ).toString();
          alert(`Max squad size is ${MAX_SQUAD_SIZE}.`);
          return;
        }
        const idx = currentSquad.findIndex((s) => s.archetypeId === arch.id);
        if (idx >= 0) {
          if (val === 0) currentSquad.splice(idx, 1);
          else currentSquad[idx].count = val;
        } else if (val > 0)
          currentSquad.push({ archetypeId: arch.id, count: val });
        updateCount();
      });
      row.append(label, input);
      container.appendChild(row);
    });
    updateCount();
    }

  loadAndApplyConfig();
  screenManager.show("main-menu");
});
