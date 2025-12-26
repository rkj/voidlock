import { GameClient } from "../engine/GameClient";
import { Renderer } from "./Renderer";
import {
  GameState,
  UnitState,
  CommandType,
  Unit,
  MapDefinition,
  MapGeneratorType,
  Door,
  Vector2,
  SquadConfig,
  Archetype,
  ArchetypeLibrary,
  MissionType,
  OverlayOption,
  EngagementPolicy,
} from "../shared/types";
import { MapGenerator } from "../engine/MapGenerator";
import { SpaceshipGenerator } from "../engine/generators/SpaceshipGenerator";
import { TreeShipGenerator } from "../engine/generators/TreeShipGenerator";
import { ScreenManager } from "./ScreenManager";
import { ConfigManager, GameConfig } from "./ConfigManager";
import { MenuController, RenderableMenuState } from "./MenuController";
import pkg from "../../package.json";

const VERSION = pkg.version;

// --- Screen Management ---
const screenManager = new ScreenManager();

// Factory function for MapGenerator
const mapGeneratorFactory = (
  seed: number,
  type: MapGeneratorType,
  mapData?: MapDefinition,
  width: number = 32,
  height: number = 32,
): MapGenerator => {
  // Always return the facade MapGenerator. It handles dispatching to specific implementations in its generate() method.
  return new MapGenerator(seed);
};

// --- Global Input State ---
let selectedUnitId: string | null = null;
let currentGameState: GameState | null = null; // Hoisted for access

// --- Engine & Renderer State ---
// (Moved up slightly for dependency)
let currentMapWidth = ConfigManager.getDefault().mapWidth;
let currentMapHeight = ConfigManager.getDefault().mapHeight;

const statefulMapGeneratorFactory = (
  seed: number,
  type: MapGeneratorType,
  mapData?: MapDefinition,
): MapGenerator | SpaceshipGenerator | TreeShipGenerator => {
  return mapGeneratorFactory(
    seed,
    type,
    mapData,
    currentMapWidth,
    currentMapHeight,
  );
};

const gameClient = new GameClient(statefulMapGeneratorFactory as any);
const menuController = new MenuController(gameClient);
let renderer: Renderer;
let isPaused = false;
let lastSpeed = 1.0;

// --- Map Data Transformation ---
const transformMapData = (oldMapData: any): MapDefinition => {
  const newCells = oldMapData.cells.map((cell: any) => {
    const { doorId, ...rest } = cell;
    return rest;
  });

  const doors: Door[] = [];
  const doorIdMap = new Map<
    string,
    { segment: Vector2[]; orientation: "Horizontal" | "Vertical" }
  >();

  oldMapData.cells.forEach((cell: any) => {
    if (cell.doorId) {
      const { x, y, doorId } = cell;
      if (!doorIdMap.has(doorId)) {
        doorIdMap.set(doorId, { segment: [], orientation: "Vertical" });
      }
      doorIdMap.get(doorId)?.segment.push({ x, y });
    }
  });

  doorIdMap.forEach((doorProps, id) => {
    const uniqueX = new Set(doorProps.segment.map((v) => v.x)).size;
    const uniqueY = new Set(doorProps.segment.map((v) => v.y)).size;

    if (uniqueX === 1 && doorProps.segment.length > 1) {
      doorProps.orientation = "Vertical";
      doorProps.segment.sort((a, b) => a.y - b.y);
    } else if (uniqueY === 1 && doorProps.segment.length > 1) {
      doorProps.orientation = "Horizontal";
      doorProps.segment.sort((a, b) => a.x - b.x);
    } else {
      doorProps.orientation = "Vertical";
    }

    doors.push({
      id,
      segment: doorProps.segment,
      orientation: doorProps.orientation,
      state: "Closed",
      hp: 100,
      maxHp: 100,
      openDuration: 1,
    });
  });

  return {
    ...oldMapData,
    cells: newCells,
    doors,
  };
};

// --- Game Configuration State ---
let defaultConfig = ConfigManager.getDefault();

let currentSpawnPointCount = defaultConfig.spawnPointCount;
let fogOfWarEnabled = defaultConfig.fogOfWarEnabled;
let debugOverlayEnabled = defaultConfig.debugOverlayEnabled;
let losOverlayEnabled = false;
let agentControlEnabled = defaultConfig.agentControlEnabled;
let currentSeed: number = defaultConfig.lastSeed;
let currentMapGeneratorType: MapGeneratorType = defaultConfig.mapGeneratorType;
let currentMissionType: MissionType = defaultConfig.missionType;
let currentStaticMapData: MapDefinition | undefined = undefined;
let currentSquad: SquadConfig = defaultConfig.squadConfig;

// --- UI Logic ---

const updateSeedOverlay = (seed: number) => {
  const el = document.getElementById("seed-display");
  if (el) el.textContent = `Seed: ${seed}`;
};

let lastMenuHtml = "";

const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const renderMenu = (state: RenderableMenuState): string => {
  let html = `<h3>${escapeHtml(state.title)}</h3>`;

  if (state.error) {
    html += `<p style="color:#f00;">${escapeHtml(state.error)}</p>`;
  }

  state.options.forEach((opt) => {
    const style = opt.isBack
      ? 'style="color: #ffaa00; margin-top: 10px;"'
      : "";
    let dataAttrs = "";
    if (opt.dataAttributes) {
      Object.entries(opt.dataAttributes).forEach(([k, v]) => {
        dataAttrs += ` data-${k}="${escapeHtml(v)}"`;
      });
    }

    html += `<div class="menu-item clickable" ${dataAttrs} ${style}>${escapeHtml(opt.label)}</div>`;
  });

  if (state.footer) {
    html += `<p style="color:#888; font-size:0.8em; margin-top:10px;">${escapeHtml(state.footer)}</p>`;
  }

  return html;
};

const updateUI = (state: GameState) => {
  const statusElement = document.getElementById("game-status");

  if (statusElement) {
    statusElement.innerHTML = `<span style=\"color:#888\">T:</span>${(state.t / 1000).toFixed(1)}s | <span style=\"color:#888\">S:</span>${state.status}`;
  }

  const vEl = document.getElementById("version-display");

  if (vEl && vEl.textContent !== `v${VERSION}`) vEl.textContent = `v${VERSION}`;

  const mvEl = document.getElementById("menu-version");

  if (mvEl && mvEl.textContent !== `v${VERSION}`)
    mvEl.textContent = `v${VERSION}`;

  // --- Top Bar: Threat Meter ---

  const threatLevel = state.threatLevel || 0;

  const topThreatFill = document.getElementById("top-threat-fill");

  const topThreatValue = document.getElementById("top-threat-value");

  if (topThreatFill && topThreatValue) {
    let threatColor = "#4caf50";

    if (threatLevel > 30) {
      threatColor = "#ff9800";
    }

    if (threatLevel > 70) {
      threatColor = "#f44336";
    }

    if (threatLevel > 90) {
      threatColor = "#b71c1c";
    }

    topThreatFill.style.width = `${threatLevel}%`;

    topThreatFill.style.backgroundColor = threatColor;

    topThreatValue.textContent = `${threatLevel.toFixed(0)}%`;

    topThreatValue.style.color = threatColor;
  }

  const rightPanel = document.getElementById("right-panel");

  if (rightPanel) {
    if (state.status !== "Playing") {
      // If we already have a summary, don't re-render it every tick (prevents button click issues)

      if (rightPanel.querySelector(".game-over-summary")) return;

      rightPanel.innerHTML = "";

      // --- Game Over Summary ---

      const summaryDiv = document.createElement("div");

      summaryDiv.className = "game-over-summary";

      summaryDiv.style.textAlign = "center";

      summaryDiv.style.padding = "20px";

      summaryDiv.style.background = "#222";

      summaryDiv.style.border =
        "2px solid " + (state.status === "Won" ? "#0f0" : "#f00");

      const title = document.createElement("h2");

      title.textContent =
        state.status === "Won" ? "MISSION ACCOMPLISHED" : "SQUAD WIPED";

      title.style.color = state.status === "Won" ? "#0f0" : "#f00";

      summaryDiv.appendChild(title);

      const stats = document.createElement("div");

      stats.style.margin = "20px 0";

      stats.style.textAlign = "left";

      stats.innerHTML = `

            <p><strong>Time Elapsed:</strong> ${(state.t / 1000).toFixed(1)}s</p>

            <p><strong>Aliens Purged:</strong> ${state.aliensKilled}</p>

            <p><strong>Casualties:</strong> ${state.casualties}</p>

          `;

      summaryDiv.appendChild(stats);

      const menuBtn = document.createElement("button");

      menuBtn.textContent = "BACK TO MENU";

      menuBtn.style.width = "100%";

      menuBtn.style.padding = "15px";

      menuBtn.addEventListener("click", () => abortMission());

      summaryDiv.appendChild(menuBtn);

      rightPanel.appendChild(summaryDiv);

      // Don't return here, continue to update unit list below
    } else {
      // We are playing. Ensure summary is gone.

      if (rightPanel.querySelector(".game-over-summary")) {
        rightPanel.innerHTML = "";

        lastMenuHtml = ""; // Reset cache
      }

      // --- 1. Hierarchical Command Menu ---

      let menuDiv = rightPanel.querySelector(".command-menu") as HTMLElement;

      if (!menuDiv) {
        menuDiv = document.createElement("div");

        menuDiv.className = "command-menu";

        menuDiv.style.borderBottom = "1px solid #444";

        menuDiv.style.paddingBottom = "10px";

        menuDiv.style.marginBottom = "10px";

        // Delegate click events here

        menuDiv.addEventListener("click", (e) => {
          const target = e.target as HTMLElement;

          const clickable = target.closest(
            ".menu-item.clickable",
          ) as HTMLElement;

          if (clickable) {
            const idxStr = clickable.dataset.index;

            if (idxStr !== undefined) {
              handleMenuInput(parseInt(idxStr));
            }
          }
        });

        rightPanel.appendChild(menuDiv);
      }

      const menuRenderState = menuController.getRenderableState(state);
      const menuHtml = renderMenu(menuRenderState);

      if (menuHtml !== lastMenuHtml) {
        menuDiv.innerHTML = menuHtml;

        lastMenuHtml = menuHtml;
      }

      // --- 2. Objectives ---
      let objectivesDiv = rightPanel.querySelector(
        ".objectives-status",
      ) as HTMLElement;
      if (!objectivesDiv) {
        objectivesDiv = document.createElement("div");
        objectivesDiv.className = "objectives-status";
        rightPanel.appendChild(objectivesDiv);
      }
      let objHtml = "<h3>Objectives</h3>";
      state.objectives.forEach((obj) => {
        objHtml += `<p>${obj.kind}: Status: ${obj.state}${obj.targetCell ? ` at (${obj.targetCell.x},${obj.targetCell.y})` : ""}</p>`;
      });
      if (objectivesDiv.innerHTML !== objHtml)
        objectivesDiv.innerHTML = objHtml;

      // --- 4. Extraction ---
      let extDiv = rightPanel.querySelector(
        ".extraction-status",
      ) as HTMLElement;
      if (state.map.extraction) {
        if (!extDiv) {
          extDiv = document.createElement("div");
          extDiv.className = "extraction-status";
          rightPanel.appendChild(extDiv);
        }
        const extractedCount = state.units.filter(
          (u) => u.state === UnitState.Extracted,
        ).length;
        const totalUnits = state.units.length;
        let extHtml = `<h3>Extraction</h3><p>Location: (${state.map.extraction.x},${state.map.extraction.y})</p>`;
        if (totalUnits > 0) {
          extHtml += `<p>Extracted: ${extractedCount}/${totalUnits}</p>`;
        }
        if (extDiv.innerHTML !== extHtml) extDiv.innerHTML = extHtml;
      } else if (extDiv) {
        extDiv.remove();
      }
    }
  }

  const listContainer = document.getElementById("soldier-list");
  if (listContainer) {
    const existingIds = new Set<string>();

    state.units.forEach((unit) => {
      existingIds.add(unit.id);
      let el = listContainer.querySelector(
        `.soldier-item[data-unit-id="${unit.id}"]`,
      ) as HTMLDivElement;

      if (!el) {
        el = document.createElement("div");
        el.className = "soldier-item";
        el.dataset.unitId = unit.id;
        el.addEventListener("click", () => onUnitClick(unit));
        listContainer.appendChild(el);
      }

      const isSelected = unit.id === selectedUnitId;
      if (isSelected && !el.classList.contains("selected"))
        el.classList.add("selected");
      if (!isSelected && el.classList.contains("selected"))
        el.classList.remove("selected");

      if (unit.state === UnitState.Dead && !el.classList.contains("dead"))
        el.classList.add("dead");
      if (
        unit.state === UnitState.Extracted &&
        !el.classList.contains("extracted")
      )
        el.classList.add("extracted");

      let statusText: string = unit.state;
      if (unit.activeCommand) {
        const cmd = unit.activeCommand;
        const cmdLabel = cmd.label || cmd.type;
        statusText = `${cmdLabel} (${unit.state})`;
      }

      if (unit.commandQueue && unit.commandQueue.length > 0) {
        statusText += ` (+${unit.commandQueue.length})`;
      }

      const hpPercent = (unit.hp / unit.maxHp) * 100;

      if (!el.hasChildNodes()) {
        el.innerHTML = `
            <div class="info-row" style="display:flex; justify-content:space-between; align-items:center;">
              <strong class="u-id"></strong>
              <span class="u-status"></span>
            </div>
            <div class="hp-bar"><div class="hp-fill"></div></div>
          `;
      }

      const idEl = el.querySelector(".u-id");
      if (idEl) idEl.textContent = unit.id;

      const statusEl = el.querySelector(".u-status");
      if (statusEl)
        statusEl.textContent = `${unit.hp}/${unit.maxHp} HP | ${unit.engagementPolicy || "ENGAGE"} | ${statusText}`;

      const hpFill = el.querySelector(".hp-fill") as HTMLElement;
      if (hpFill) hpFill.style.width = `${hpPercent}%`;
    });

    // Remove old units
    Array.from(listContainer.children).forEach((child) => {
      const id = (child as HTMLElement).dataset.unitId;
      if (id && !existingIds.has(id)) {
        listContainer.removeChild(child);
      }
    });
  }
};

const handleMenuInput = (num: number) => {
  console.log("handleMenuInput:", num);
  if (!currentGameState) return;
  menuController.handleMenuInput(num, currentGameState);
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
    if (btn) btn.textContent = "▶ Play"; // Switch to Play icon when paused
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

  if (unitAtClick) {
    onUnitClick(unitAtClick);
    return;
  }
};

// --- Game Initialization ---

const launchMission = () => {
  // Collect Config from UI if needed, or rely on state variables updated by change events.
  // Ensure seed is set
  const mapSeedInput = document.getElementById("map-seed") as HTMLInputElement;
  if (mapSeedInput && !mapSeedInput.disabled) {
    const val = parseInt(mapSeedInput.value);
    if (!isNaN(val)) currentSeed = val;
    else currentSeed = Date.now();
  }

  const wInput = document.getElementById("map-width") as HTMLInputElement;
  const hInput = document.getElementById("map-height") as HTMLInputElement;
  const spInput = document.getElementById(
    "map-spawn-points",
  ) as HTMLInputElement;
  if (wInput && hInput) {
    currentMapWidth = parseInt(wInput.value) || 14;
    currentMapHeight = parseInt(hInput.value) || 14;
  }
  if (spInput) {
    const value = parseInt(spInput.value);
    currentSpawnPointCount = !isNaN(value) ? value : 1; // Default to 1 if NaN or other issue
  }

  // Save Config
  ConfigManager.save({
    mapWidth: currentMapWidth,
    mapHeight: currentMapHeight,
    spawnPointCount: currentSpawnPointCount,
    fogOfWarEnabled,
    debugOverlayEnabled,
    losOverlayEnabled, // Added
    agentControlEnabled,
    mapGeneratorType: currentMapGeneratorType,
    missionType: currentMissionType,
    lastSeed: currentSeed,
    squadConfig: currentSquad,
  });

  // Initialize engine
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
  );
  updateSeedOverlay(currentSeed);

  // Reset selection
  selectedUnitId = null;

  // Clear Game Over / Previous Mission UI
  const rightPanel = document.getElementById("right-panel");
  if (rightPanel) rightPanel.innerHTML = "";
  menuController.reset();

  // Setup Client Listener
  gameClient.onStateUpdate((state) => {
    currentGameState = state;
    if (!renderer) {
      const canvas = document.getElementById(
        "game-canvas",
      ) as HTMLCanvasElement;
      if (canvas) {
        renderer = new Renderer(canvas);
        renderer.setCellSize(128); // M8 Scale
      }
    }
    if (renderer) {
      renderer.setOverlay(menuController.overlayOptions);
      renderer.render(state);
    }
    updateUI(state);
  });

  // Switch Screen
  screenManager.show("mission");
};

const abortMission = () => {
  // Terminate worker? Or just leave it running?
  // ideally gameClient.terminate() but that kills the worker instance permanently.
  // gameClient doesn't support soft reset yet.
  // For prototype, we just switch screens. The game keeps running in BG but that's fine.
  // Or we could re-init with an empty map to pause?
  screenManager.show("main-menu");
};

// --- Event Listeners & UI Setup ---
document.addEventListener("DOMContentLoaded", () => {
  // Keyboard Navigation
  document.addEventListener("keydown", (e) => {
    // If typing in input, ignore
    if (
      (e.target as HTMLElement).tagName === "INPUT" ||
      (e.target as HTMLElement).tagName === "TEXTAREA"
    )
      return;

    if (screenManager.getCurrentScreen() === "mission") {
      if (e.key === "Escape") {
        if (menuController.menuState !== "ACTION_SELECT") {
          menuController.goBack();
        } else {
          // Already in ACTION_SELECT
          if (selectedUnitId) {
            selectedUnitId = null;
          } else {
            if (confirm("Abort Mission and return to menu?")) {
              abortMission();
            }
          }
        }
        if (currentGameState) updateUI(currentGameState);
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
        return;
      }

      if (e.key === "m" || e.key === "M") {
        if (menuController.menuState === "ACTION_SELECT") {
          handleMenuInput(1); // MOVE
        }
        return;
      }

      // Handle Number Keys 0-9
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 0) {
        handleMenuInput(num);
      }
    } else {
      if (e.key === "Escape") {
        screenManager.goBack();
      }
    }
  });

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

  // Top Bar Speed Slider
  const btnPauseToggle = document.getElementById("btn-pause-toggle");
  btnPauseToggle?.addEventListener("click", () => togglePause());

  const gameSpeedSlider = document.getElementById(
    "game-speed",
  ) as HTMLInputElement;
  const gameSpeedValue = document.getElementById("speed-value");
  if (gameSpeedSlider && gameSpeedValue) {
    // Increase max to 3.0 to match setup
    gameSpeedSlider.max = "3.0";

    gameSpeedSlider.addEventListener("input", () => {
      const speed = parseFloat(gameSpeedSlider.value);
      gameSpeedValue.textContent = `${speed.toFixed(1)}x`;

      if (isPaused) {
        lastSpeed = speed;
        // Stay in active pause
        gameClient.setTimeScale(0.05);
        if (gameSpeedValue)
          gameSpeedValue.textContent =
            "0.05x (Pending: " + speed.toFixed(1) + "x)";
      } else {
        gameClient.setTimeScale(speed);
      }
    });
  }

  // Setup Controls
  const mapGeneratorTypeSelect = document.getElementById(
    "map-generator-type",
  ) as HTMLSelectElement;

  // Inject Mission Type Select
  const mapGenGroup = mapGeneratorTypeSelect.closest(".control-group");
  if (mapGenGroup) {
    const missionDiv = document.createElement("div");
    missionDiv.style.marginBottom = "10px";
    missionDiv.innerHTML = `
        <label for="mission-type">Mission Type:</label>
        <select id="mission-type">
            <option value="${MissionType.Default}">Default (Single Objective)</option>
            <option value="${MissionType.ExtractArtifacts}">Extract Artifacts</option>
            <option value="${MissionType.DestroyHive}">Destroy Hive</option>
        </select>
      `;
    // Insert at top of control group
    mapGenGroup.insertBefore(missionDiv, mapGenGroup.firstChild);

    const missionSelect = document.getElementById(
      "mission-type",
    ) as HTMLSelectElement;
    missionSelect.addEventListener("change", () => {
      currentMissionType = missionSelect.value as MissionType;
    });
  }

  const mapSeedInput = document.getElementById("map-seed") as HTMLInputElement;
  const staticMapControlsDiv = document.getElementById(
    "static-map-controls",
  ) as HTMLDivElement;
  const staticMapJsonTextarea = document.getElementById(
    "static-map-json",
  ) as HTMLTextAreaElement;
  const loadStaticMapButton = document.getElementById(
    "load-static-map",
  ) as HTMLButtonElement;
  const uploadStaticMapInput = document.getElementById(
    "upload-static-map",
  ) as HTMLInputElement;
  const asciiMapInput = document.getElementById(
    "ascii-map-input",
  ) as HTMLTextAreaElement;
  const convertAsciiToMapButton = document.getElementById(
    "convert-ascii-to-map",
  ) as HTMLButtonElement;
  const convertMapToAsciiButton = document.getElementById(
    "convert-map-to-ascii",
  ) as HTMLButtonElement;

  // Add TreeShip option
  const treeOption = document.createElement("option");
  treeOption.value = "TreeShip";
  treeOption.textContent = "Tree Ship (No Loops)";
  mapGeneratorTypeSelect.appendChild(treeOption);

  // Add DenseShip option
  const denseOption = document.createElement("option");
  denseOption.value = "DenseShip";
  denseOption.textContent = "Dense Ship (>90% fill)";
  mapGeneratorTypeSelect.appendChild(denseOption);

  // Dynamic Injections logic (re-adapted for new layout)
  // Inject Generate Random Seed Button
  const mapSeedInputParent = mapSeedInput?.parentNode;
  if (mapSeedInputParent) {
    const randomSeedButton = document.createElement("button");
    randomSeedButton.id = "generate-random-seed";
    randomSeedButton.textContent = "🎲";
    randomSeedButton.type = "button";
    randomSeedButton.title = "Generate Random Seed";
    // Insert after seed input
    mapSeedInput.parentNode?.insertBefore(
      randomSeedButton,
      mapSeedInput.nextSibling,
    ); // This might need check

    randomSeedButton.addEventListener("click", () => {
      mapSeedInput.value = Date.now().toString();
    });
  }

  // Toggles Injection
  // We look for where to put them. The id `preset-map-controls` is safe anchor.
  // Actually in new HTML, we can just find #setup-content and append, or find .control-group
  // But let's stick to existing logic if possible, or adapt.
  const presetControls = document.getElementById("preset-map-controls");
  if (presetControls) {
    const togglesDiv = document.createElement("div");
    togglesDiv.className = "control-group"; // Match styling
    togglesDiv.innerHTML = `
        <h3>Game Options</h3>
        <div>
            <input type="checkbox" id="toggle-fog-of-war" checked>
            <label for="toggle-fog-of-war" style="display:inline;">Fog of War</label>
        </div>
        <div>
            <input type="checkbox" id="toggle-debug-overlay">
            <label for="toggle-debug-overlay" style="display:inline;">Debug Overlay</label>
        </div>
        <div>
            <input type="checkbox" id="toggle-los-overlay">
            <label for="toggle-los-overlay" style="display:inline;">LOS Visualization</label>
        </div>
        <div>
            <input type="checkbox" id="toggle-agent-control" checked>
            <label for="toggle-agent-control" style="display:inline;">Agent Control</label>
        </div>
        <div style="margin-top: 20px;">
            <label for="time-scale-slider" style="display: block; margin-bottom: 10px;">Game Speed (x): <span id="time-scale-value">1.0</span></label>
            <input type="range" id="time-scale-slider" min="0.1" max="3.0" step="0.1" value="1.0" style="width: 100%; height: 20px; cursor: pointer;">
        </div>
      `;
    // Insert after Map Generation group (which contains presetControls)
    // presetControls is inside .control-group. We want to insert after that group.
    const mapGenGroup = presetControls.closest(".control-group");
    if (mapGenGroup) {
      mapGenGroup.parentNode?.insertBefore(togglesDiv, mapGenGroup.nextSibling);
    }

    // Bind
    document
      .getElementById("toggle-fog-of-war")
      ?.addEventListener("change", (e) => {
        fogOfWarEnabled = (e.target as HTMLInputElement).checked;
      });
    document
      .getElementById("toggle-debug-overlay")
      ?.addEventListener("change", (e) => {
        debugOverlayEnabled = (e.target as HTMLInputElement).checked;
      });
    document
      .getElementById("toggle-los-overlay")
      ?.addEventListener("change", (e) => {
        losOverlayEnabled = (e.target as HTMLInputElement).checked;
      });
    document
      .getElementById("toggle-agent-control")
      ?.addEventListener("change", (e) => {
        agentControlEnabled = (e.target as HTMLInputElement).checked;
      });

    const timeScaleSlider = document.getElementById(
      "time-scale-slider",
    ) as HTMLInputElement;
    const timeScaleValue = document.getElementById(
      "time-scale-value",
    ) as HTMLSpanElement;
    if (timeScaleSlider) {
      timeScaleSlider.addEventListener("input", () => {
        const scale = parseFloat(timeScaleSlider.value);
        timeScaleValue.textContent = `${scale}`;
        gameClient.setTimeScale(scale);
      });
    }
  }

  // Handle Map Generator Type selection
  mapGeneratorTypeSelect?.addEventListener("change", () => {
    currentMapGeneratorType = mapGeneratorTypeSelect.value as MapGeneratorType;
    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    if (currentMapGeneratorType === MapGeneratorType.Static) {
      staticMapControlsDiv.style.display = "block";
      mapSeedInput.disabled = true;
      if (wInput) wInput.disabled = true;
      if (hInput) hInput.disabled = true;
    } else {
      staticMapControlsDiv.style.display = "none";
      mapSeedInput.disabled = false;
      if (wInput) wInput.disabled = false;
      if (hInput) hInput.disabled = false;
    }
  });

  document.getElementById("map-width")?.addEventListener("change", (e) => {
    currentMapWidth = parseInt((e.target as HTMLInputElement).value) || 24;
  });
  document.getElementById("map-height")?.addEventListener("change", (e) => {
    currentMapHeight = parseInt((e.target as HTMLInputElement).value) || 24;
  });

  // Loading Static Maps
  loadStaticMapButton?.addEventListener("click", () => {
    try {
      const oldMapData = JSON.parse(staticMapJsonTextarea.value);
      const mapData: MapDefinition = transformMapData(oldMapData);
      if (!mapData.width || !mapData.height || !mapData.cells) {
        throw new Error(
          "Invalid MapDefinition JSON: Missing width, height, or cells.",
        );
      }
      currentStaticMapData = mapData;
      alert("Static Map Loaded. Ready to Launch.");
    } catch (err) {
      console.error("Error loading static map:", err);
      alert("Invalid static map JSON provided.");
    }
  });

  uploadStaticMapInput?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const oldMapData = JSON.parse(event.target?.result as string);
          const mapData: MapDefinition = transformMapData(oldMapData);
          currentStaticMapData = mapData;
          // Auto-select Static type
          mapGeneratorTypeSelect.value = MapGeneratorType.Static;
          currentMapGeneratorType = MapGeneratorType.Static;
          staticMapControlsDiv.style.display = "block";
          alert("Static Map Loaded from File.");
        } catch (err) {
          console.error(err);
          alert("Invalid static map JSON file.");
        }
      };
      reader.readAsText(file);
    }
  });

  convertAsciiToMapButton?.addEventListener("click", () => {
    try {
      const ascii = asciiMapInput.value;
      const mapData: MapDefinition = MapGenerator.fromAscii(ascii);
      currentStaticMapData = mapData;
      // Auto-select
      mapGeneratorTypeSelect.value = MapGeneratorType.Static;
      currentMapGeneratorType = MapGeneratorType.Static;
      staticMapControlsDiv.style.display = "block";
      alert("ASCII Map Converted & Loaded.");
    } catch (err) {
      console.error("Error converting ASCII:", err);
      alert("Invalid ASCII map.");
    }
  });

  convertMapToAsciiButton?.addEventListener("click", () => {
    // If we have a static map loaded, convert that. If not, maybe warn?
    // Ideally we want to convert the *current* map from the last run, but that might be lost if we are in Setup.
    // But `gameClient` holds state.
    const replay = gameClient.getReplayData();
    if (replay && replay.map) {
      try {
        const ascii = MapGenerator.toAscii(replay.map);
        asciiMapInput.value = ascii;
      } catch (err) {
        console.error(err);
        alert("Failed to convert map.");
      }
    } else if (currentStaticMapData) {
      const ascii = MapGenerator.toAscii(currentStaticMapData);
      asciiMapInput.value = ascii;
    } else {
      alert("No map data available to convert.");
    }
  });

  document.getElementById("export-replay")?.addEventListener("click", () => {
    const replay = gameClient.getReplayData();
    if (replay) {
      const json = JSON.stringify(replay, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xenopurge-replay-${replay.seed}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert("No game data.");
    }
  });

  const importInput = document.getElementById(
    "import-replay",
  ) as HTMLInputElement;
  importInput?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const replayData = JSON.parse(event.target?.result as string);
          gameClient.loadReplay(replayData);
          updateSeedOverlay(replayData.seed);
          // Auto-switch to Mission Screen
          screenManager.show("mission");

          // Setup Renderer if needed (might be redundant if loadReplay triggers updates)
          if (!renderer) {
            const canvas = document.getElementById(
              "game-canvas",
            ) as HTMLCanvasElement;
            renderer = new Renderer(canvas);
            renderer.setCellSize(128);
          }
        } catch (err) {
          console.error(err);
          alert("Invalid replay.");
        }
      };
      reader.readAsText(file);
    }
  });

  // Canvas
  const canvas = document.getElementById("game-canvas");
  canvas?.addEventListener("click", (e) => handleCanvasClick(e as MouseEvent));

  // Initial State: Menu
  screenManager.show("main-menu");

  // Load Config
  const loadAndApplyConfig = () => {
    const config = ConfigManager.load();
    if (config) {
      currentMapWidth = config.mapWidth;
      currentMapHeight = config.mapHeight;
      currentSpawnPointCount = config.spawnPointCount || 3;
      fogOfWarEnabled = config.fogOfWarEnabled;
      debugOverlayEnabled = config.debugOverlayEnabled;
      losOverlayEnabled = config.losOverlayEnabled || false; // Added
      agentControlEnabled = config.agentControlEnabled;
      currentMapGeneratorType = config.mapGeneratorType;
      currentMissionType = config.missionType || MissionType.Default;
      currentSeed = config.lastSeed;
      currentSquad = config.squadConfig;

      // Apply to UI
      const missionSelect = document.getElementById(
        "mission-type",
      ) as HTMLSelectElement;
      if (missionSelect) missionSelect.value = currentMissionType;

      if (mapSeedInput) mapSeedInput.value = currentSeed.toString();
      if (mapGeneratorTypeSelect)
        mapGeneratorTypeSelect.value = currentMapGeneratorType;

      const wInput = document.getElementById("map-width") as HTMLInputElement;
      const hInput = document.getElementById("map-height") as HTMLInputElement;
      const spInput = document.getElementById(
        "map-spawn-points",
      ) as HTMLInputElement;
      if (wInput) wInput.value = currentMapWidth.toString();
      if (hInput) hInput.value = currentMapHeight.toString();
      if (spInput) spInput.value = currentSpawnPointCount.toString();

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
      if (losCheck) losCheck.checked = losOverlayEnabled; // Added

      const agentCheck = document.getElementById(
        "toggle-agent-control",
      ) as HTMLInputElement;
      if (agentCheck) agentCheck.checked = agentControlEnabled;

      // Trigger change event for map type to update UI visibility
      mapGeneratorTypeSelect.dispatchEvent(new Event("change"));
    } else {
      // Set defaults for controls if no config
      mapGeneratorTypeSelect.value = currentMapGeneratorType;
    }
    renderSquadBuilder();
  };

  const renderSquadBuilder = () => {
    const container = document.getElementById("squad-builder");
    if (!container) return;
    container.innerHTML = "";

    // Create a map for easy lookup of current counts
    const countMap = new Map<string, number>();
    currentSquad.forEach((s) => countMap.set(s.archetypeId, s.count));

    Object.values(ArchetypeLibrary).forEach((arch) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";

      const label = document.createElement("label");
      label.textContent = arch.name;
      label.style.flex = "1";
      label.style.margin = "0";

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "10";
      input.value = (countMap.get(arch.id) || 0).toString();
      input.style.width = "60px";
      input.style.marginLeft = "10px";

      input.addEventListener("change", () => {
        const val = parseInt(input.value);
        if (!isNaN(val) && val >= 0) {
          // Update currentSquad
          const idx = currentSquad.findIndex((s) => s.archetypeId === arch.id);
          if (idx >= 0) {
            if (val === 0) {
              currentSquad.splice(idx, 1);
            } else {
              currentSquad[idx].count = val;
            }
          } else if (val > 0) {
            currentSquad.push({ archetypeId: arch.id, count: val });
          }
        }
      });

      row.appendChild(label);
      row.appendChild(input);
      container.appendChild(row);
    });
  };

  loadAndApplyConfig();
});
