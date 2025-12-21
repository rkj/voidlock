import { GameClient } from '../engine/GameClient';
import { Renderer } from './Renderer';
import { GameState, UnitState, CommandType, Unit, MapDefinition, MapGeneratorType, Door, Vector2, SquadConfig, Archetype, ArchetypeLibrary, MissionType } from '../shared/types';
import { MapGenerator } from '../engine/MapGenerator';
import { SpaceshipGenerator } from '../engine/generators/SpaceshipGenerator';
import { TreeShipGenerator } from '../engine/generators/TreeShipGenerator';
import { ScreenManager } from './ScreenManager';
import { ConfigManager, GameConfig } from './ConfigManager';

// --- Screen Management ---
const screenManager = new ScreenManager();

// Factory function for MapGenerator
const mapGeneratorFactory = (seed: number, type: MapGeneratorType, mapData?: MapDefinition, width: number = 32, height: number = 32): MapGenerator | SpaceshipGenerator | TreeShipGenerator => {
  if (type === MapGeneratorType.Static && mapData) {
      const gen = new MapGenerator(seed);
      return gen;
  }
  
  if (type === MapGeneratorType.TreeShip) {
      return new TreeShipGenerator(seed, width, height);
  }

  if (type === MapGeneratorType.Procedural) {
      return new SpaceshipGenerator(seed, width, height);
  }

  return new MapGenerator(seed, 1, 2); 
};

// --- Global Input State ---
type InputMode = 'SELECT' | 'CMD_MOVE';
let inputMode: InputMode = 'SELECT';
let selectedUnitId: string | null = null; 
let pendingCommandUnitId: string | null = null;

// --- Map Data Transformation ---
const transformMapData = (oldMapData: any): MapDefinition => {
  const newCells = oldMapData.cells.map((cell: any) => {
    const { doorId, ...rest } = cell;
    return rest;
  });

  const doors: Door[] = [];
  const doorIdMap = new Map<string, { segment: Vector2[]; orientation: 'Horizontal' | 'Vertical' }>();

  oldMapData.cells.forEach((cell: any) => {
    if (cell.doorId) {
      const { x, y, doorId } = cell;
      if (!doorIdMap.has(doorId)) {
        doorIdMap.set(doorId, { segment: [], orientation: 'Vertical' }); 
      }
      doorIdMap.get(doorId)?.segment.push({ x, y });
    }
  });

  doorIdMap.forEach((doorProps, id) => {
    const uniqueX = new Set(doorProps.segment.map(v => v.x)).size;
    const uniqueY = new Set(doorProps.segment.map(v => v.y)).size;

    if (uniqueX === 1 && doorProps.segment.length > 1) { 
        doorProps.orientation = 'Vertical';
        doorProps.segment.sort((a,b) => a.y - b.y);
    } else if (uniqueY === 1 && doorProps.segment.length > 1) { 
        doorProps.orientation = 'Horizontal';
        doorProps.segment.sort((a,b) => a.x - b.x);
    } else {
        doorProps.orientation = 'Vertical'; 
    }

    doors.push({
      id,
      segment: doorProps.segment,
      orientation: doorProps.orientation,
      state: 'Closed', 
      hp: 100, maxHp: 100, openDuration: 1
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

let currentMapWidth = defaultConfig.mapWidth;
let currentMapHeight = defaultConfig.mapHeight;
let fogOfWarEnabled = defaultConfig.fogOfWarEnabled;
let debugOverlayEnabled = defaultConfig.debugOverlayEnabled;
let agentControlEnabled = defaultConfig.agentControlEnabled;
let currentSeed: number = defaultConfig.lastSeed;
let currentMapGeneratorType: MapGeneratorType = defaultConfig.mapGeneratorType;
let currentMissionType: MissionType = defaultConfig.missionType;
let currentStaticMapData: MapDefinition | undefined = undefined;
let currentSquad: SquadConfig = defaultConfig.squadConfig;

// --- Engine & Renderer State ---
const statefulMapGeneratorFactory = (seed: number, type: MapGeneratorType, mapData?: MapDefinition): MapGenerator | SpaceshipGenerator | TreeShipGenerator => {
    return mapGeneratorFactory(seed, type, mapData, currentMapWidth, currentMapHeight);
};

const gameClient = new GameClient(statefulMapGeneratorFactory as any);
let renderer: Renderer;
let currentGameState: GameState | null = null;


// --- UI Logic ---

const setInputMode = (mode: InputMode) => {
  inputMode = mode;
  pendingCommandUnitId = null;
  const moveBtn = document.getElementById('cmd-move');
  if (moveBtn) moveBtn.className = mode === 'CMD_MOVE' ? 'active' : '';
};

const updateSeedOverlay = (seed: number) => {
    const el = document.getElementById('seed-overlay');
    if (el) el.textContent = `Seed: ${seed}`;
};

const updateUI = (state: GameState) => {
  const statusElement = document.getElementById('game-status');
  if (statusElement) {
    statusElement.textContent = `Time: ${(state.t / 1000).toFixed(1)}s | Status: ${state.status}`;
  }

  const rightPanel = document.getElementById('right-panel'); 
  if (rightPanel) {
      // Simple diffing for right panel components? Or just rebuild since it's less interactive?
      // Rebuilding right panel is probably fine for now as it's mostly status text, not interactive buttons.
      // But let's be safe and check if we need to rebuild.
      // Actually, right panel has no buttons, so rebuild is okayish, but efficient updates are better.
      // For now, let's keep right panel simple rebuild to minimize changes, focus on soldier list.
      
      rightPanel.innerHTML = ''; 

      // Objectives
      const objectivesDiv = document.createElement('div');
      objectivesDiv.className = 'objectives-status';
      objectivesDiv.innerHTML = '<h3>Objectives</h3>';
      state.objectives.forEach(obj => {
          const objEl = document.createElement('p');
          objEl.textContent = `${obj.kind}: Status: ${obj.state}`;
          if (obj.targetCell) objEl.textContent += ` at (${obj.targetCell.x},${obj.targetCell.y})`;
          objectivesDiv.appendChild(objEl);
      });
      rightPanel.appendChild(objectivesDiv);

      // Extraction
      if (state.map.extraction) {
          const extDiv = document.createElement('div');
          extDiv.className = 'extraction-status';
          extDiv.innerHTML = `<h3>Extraction</h3><p>Location: (${state.map.extraction.x},${state.map.extraction.y})</p>`;
          const extractedCount = state.units.filter(u => u.state === UnitState.Extracted).length;
          const totalUnits = state.units.length;
          if (totalUnits > 0) {
              extDiv.innerHTML += `<p>Extracted: ${extractedCount}/${totalUnits}</p>`;
          }
          rightPanel.appendChild(extDiv);
      }

      // Threat Meter
      const threatDiv = document.createElement('div');
      threatDiv.className = 'threat-meter';
      
      const threatLevel = state.threatLevel || 0;
      let threatText = 'Low';
      let threatColor = '#4caf50'; 
      if (threatLevel > 30) { threatText = 'Medium'; threatColor = '#ff9800'; } 
      if (threatLevel > 70) { threatText = 'High'; threatColor = '#f44336'; } 
      if (threatLevel > 90) { threatText = 'CRITICAL'; threatColor = '#b71c1c'; } 

      threatDiv.innerHTML = `
        <h3>Threat Meter</h3>
        <p style="color: ${threatColor}; font-weight: bold; margin: 5px 0;">${threatText} (${threatLevel.toFixed(0)}%)</p>
        <div style="width: 100%; background: #333; height: 10px; border: 1px solid #555;">
            <div style="width: ${threatLevel}%; background: ${threatColor}; height: 100%; transition: width 0.5s;"></div>
        </div>
      `;
      rightPanel.appendChild(threatDiv);
  }

  const listContainer = document.getElementById('soldier-list');
  if (listContainer) {
    // Diffing Logic for Soldier List
    const existingIds = new Set<string>();
    
    state.units.forEach(unit => {
      existingIds.add(unit.id);
      let el = listContainer.querySelector(`.soldier-item[data-unit-id="${unit.id}"]`) as HTMLDivElement;
      
      if (!el) {
        // Create new
        el = document.createElement('div');
        el.className = 'soldier-item';
        el.dataset.unitId = unit.id;
        // Bind events once
        el.addEventListener('click', () => onUnitClick(unit)); 
        listContainer.appendChild(el);
      }

      // Update Class
      const isSelected = unit.id === selectedUnitId || unit.id === pendingCommandUnitId;
      if (isSelected && !el.classList.contains('selected')) el.classList.add('selected');
      if (!isSelected && el.classList.contains('selected')) el.classList.remove('selected');
      
      if (unit.state === UnitState.Dead && !el.classList.contains('dead')) el.classList.add('dead');
      if (unit.state === UnitState.Extracted && !el.classList.contains('extracted')) el.classList.add('extracted');

      // Update Content (Inner HTML) - Only if changed to avoid breaking hover state on buttons?
      // Actually, updating innerHTML destroys buttons and listeners inside.
      // We need to construct the inner HTML carefully or update specific parts.
      // For simplicity, let's check if we can update parts.
      
      let statusText: string = unit.state; 
      if (unit.commandQueue && unit.commandQueue.length > 0) {
        statusText += ` (+${unit.commandQueue.length})`;
      }

      const hpPercent = (unit.hp / unit.maxHp) * 100;
      
      // We can use a template literal and update IF content is different, 
      // BUT updating innerHTML will kill listeners on the buttons.
      // So we should build the structure once and update fields.
      
      if (!el.hasChildNodes()) {
          el.innerHTML = `
            <div class="info-row" style="display:flex; justify-content:space-between; align-items:center;">
              <strong class="u-id"></strong>
              <span class="u-status"></span>
            </div>
            <div class="hp-bar"><div class="hp-fill"></div></div>
            <div class="unit-commands" style="display:flex; gap:5px; margin-top:5px;">
                <button class="btn-stop-unit">Stop</button>
                <button class="btn-engage-unit">Engage</button>
                <button class="btn-ignore-unit">Ignore</button>
            </div>
          `;
          
          // Bind button events
          el.querySelector('.btn-stop-unit')?.addEventListener('click', (event) => {
              event.stopPropagation(); 
              gameClient.sendCommand({ type: CommandType.STOP, unitIds: [unit.id] });
          });
          el.querySelector('.btn-engage-unit')?.addEventListener('click', (event) => {
              event.stopPropagation();
              gameClient.sendCommand({ type: CommandType.SET_ENGAGEMENT, unitIds: [unit.id], mode: 'ENGAGE' });
          });
          el.querySelector('.btn-ignore-unit')?.addEventListener('click', (event) => {
              event.stopPropagation();
              gameClient.sendCommand({ type: CommandType.SET_ENGAGEMENT, unitIds: [unit.id], mode: 'IGNORE' });
          });
      }

      // Update fields
      const idEl = el.querySelector('.u-id');
      if (idEl) idEl.textContent = unit.id;
      
      const statusEl = el.querySelector('.u-status');
      if (statusEl) statusEl.textContent = `HP: ${unit.hp}/${unit.maxHp} | Pos: (${Math.floor(unit.pos.x)},${Math.floor(unit.pos.y)}) | ${unit.engagementPolicy || 'ENGAGE'} | ${statusText}`;
      
      const hpFill = el.querySelector('.hp-fill') as HTMLElement;
      if (hpFill) hpFill.style.width = `${hpPercent}%`;
    });

    // Remove old units
    Array.from(listContainer.children).forEach(child => {
        const id = (child as HTMLElement).dataset.unitId;
        if (id && !existingIds.has(id)) {
            listContainer.removeChild(child);
        }
    });
  }
};

const onUnitClick = (unit: Unit) => {
  if (inputMode === 'CMD_MOVE') {
    if (!pendingCommandUnitId) {
      pendingCommandUnitId = unit.id;
      console.log(`Command Target: Unit ${unit.id} selected. Click map to move.`);
    } else {
      pendingCommandUnitId = unit.id;
    }
  } else {
    selectedUnitId = unit.id === selectedUnitId ? null : unit.id;
  }
  if (currentGameState) updateUI(currentGameState);
};

const handleCanvasClick = (event: MouseEvent) => {
  if (!renderer || !currentGameState) return;

  const clickedCell = renderer.getCellCoordinates(event.clientX, event.clientY);
  
  const unitAtClick = currentGameState.units.find(unit => 
    Math.floor(unit.pos.x) === clickedCell.x && Math.floor(unit.pos.y) === clickedCell.y &&
    unit.state !== UnitState.Dead && unit.state !== UnitState.Extracted
  );

  if (unitAtClick) {
    onUnitClick(unitAtClick);
    return; 
  }

  if (inputMode === 'CMD_MOVE' && pendingCommandUnitId) {
    gameClient.sendCommand({
      type: CommandType.MOVE_TO,
      unitIds: [pendingCommandUnitId],
      target: clickedCell,
      queue: event.shiftKey 
    });
    
    if (!event.shiftKey) {
        setInputMode('SELECT');
    }
  } else if (inputMode === 'SELECT' && selectedUnitId) {
    gameClient.sendCommand({
      type: CommandType.MOVE_TO,
      unitIds: [selectedUnitId],
      target: clickedCell,
      queue: event.shiftKey
    });
  }
};

// --- Game Initialization ---

const launchMission = () => {
    // Collect Config from UI if needed, or rely on state variables updated by change events.
    // Ensure seed is set
    const mapSeedInput = document.getElementById('map-seed') as HTMLInputElement;
    if (mapSeedInput && !mapSeedInput.disabled) {
        const val = parseInt(mapSeedInput.value);
        if (!isNaN(val)) currentSeed = val;
        else currentSeed = Date.now();
    }

    const wInput = document.getElementById('map-width') as HTMLInputElement;
    const hInput = document.getElementById('map-height') as HTMLInputElement;
    if (wInput && hInput) {
        currentMapWidth = parseInt(wInput.value) || 14;
        currentMapHeight = parseInt(hInput.value) || 14;
    }

    // Save Config
    ConfigManager.save({
        mapWidth: currentMapWidth,
        mapHeight: currentMapHeight,
        fogOfWarEnabled,
        debugOverlayEnabled,
        agentControlEnabled,
        mapGeneratorType: currentMapGeneratorType,
        missionType: currentMissionType,
        lastSeed: currentSeed,
        squadConfig: currentSquad
    });

    // Initialize engine
    gameClient.init(currentSeed, currentMapGeneratorType, currentStaticMapData, fogOfWarEnabled, debugOverlayEnabled, agentControlEnabled, currentSquad, currentMissionType);
    updateSeedOverlay(currentSeed);

    // Reset selection
    selectedUnitId = null;
    pendingCommandUnitId = null;
    setInputMode('SELECT');

    // Setup Client Listener
    gameClient.onStateUpdate((state) => {
      currentGameState = state;
      if (!renderer) {
        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        if (canvas) {
          renderer = new Renderer(canvas);
          renderer.setCellSize(128); // M8 Scale
        }
      }
      if (renderer) renderer.render(state);
      updateUI(state);
    });

    // Switch Screen
    screenManager.show('mission');
};

const abortMission = () => {
    // Terminate worker? Or just leave it running?
    // ideally gameClient.terminate() but that kills the worker instance permanently.
    // gameClient doesn't support soft reset yet.
    // For prototype, we just switch screens. The game keeps running in BG but that's fine.
    // Or we could re-init with an empty map to pause?
    screenManager.show('main-menu');
};

// --- Event Listeners & UI Setup ---
document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.getElementById('btn-menu-custom')?.addEventListener('click', () => screenManager.show('mission-setup'));
  document.getElementById('btn-menu-campaign')?.addEventListener('click', () => screenManager.show('campaign'));
  document.getElementById('btn-campaign-back')?.addEventListener('click', () => screenManager.goBack());
  document.getElementById('btn-setup-back')?.addEventListener('click', () => screenManager.goBack());
  document.getElementById('btn-mission-abort')?.addEventListener('click', () => abortMission());
  
  document.getElementById('btn-launch-mission')?.addEventListener('click', () => launchMission());

  // Setup Controls
  const mapGeneratorTypeSelect = document.getElementById('map-generator-type') as HTMLSelectElement;
  
  // Inject Mission Type Select
  const mapGenGroup = mapGeneratorTypeSelect.closest('.control-group');
  if (mapGenGroup) {
      const missionDiv = document.createElement('div');
      missionDiv.style.marginBottom = '10px';
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
      
      const missionSelect = document.getElementById('mission-type') as HTMLSelectElement;
      missionSelect.addEventListener('change', () => {
          currentMissionType = missionSelect.value as MissionType;
      });
  }

  const mapSeedInput = document.getElementById('map-seed') as HTMLInputElement;
  const staticMapControlsDiv = document.getElementById('static-map-controls') as HTMLDivElement;
  const staticMapJsonTextarea = document.getElementById('static-map-json') as HTMLTextAreaElement;
  const loadStaticMapButton = document.getElementById('load-static-map') as HTMLButtonElement;
  const uploadStaticMapInput = document.getElementById('upload-static-map') as HTMLInputElement;
  const asciiMapInput = document.getElementById('ascii-map-input') as HTMLTextAreaElement;
  const convertAsciiToMapButton = document.getElementById('convert-ascii-to-map') as HTMLButtonElement;
  const convertMapToAsciiButton = document.getElementById('convert-map-to-ascii') as HTMLButtonElement;

  // Add TreeShip option
  const treeOption = document.createElement('option');
  treeOption.value = 'TreeShip';
  treeOption.textContent = 'Tree Ship (No Loops)';
  mapGeneratorTypeSelect.appendChild(treeOption);

  // Add DenseShip option
  const denseOption = document.createElement('option');
  denseOption.value = 'DenseShip';
  denseOption.textContent = 'Dense Ship (>90% fill)';
  mapGeneratorTypeSelect.appendChild(denseOption);

  // Dynamic Injections logic (re-adapted for new layout)
  // Inject Generate Random Seed Button
  const mapSeedInputParent = mapSeedInput?.parentNode;
  if (mapSeedInputParent) {
      const randomSeedButton = document.createElement('button');
      randomSeedButton.id = 'generate-random-seed';
      randomSeedButton.textContent = '🎲'; 
      randomSeedButton.type = 'button'; 
      randomSeedButton.title = 'Generate Random Seed';
      // Insert after seed input
      mapSeedInput.parentNode?.insertBefore(randomSeedButton, mapSeedInput.nextSibling); // This might need check

      randomSeedButton.addEventListener('click', () => {
          mapSeedInput.value = Date.now().toString();
      });
  }

  // Toggles Injection
  // We look for where to put them. The id `preset-map-controls` is safe anchor.
  // Actually in new HTML, we can just find #setup-content and append, or find .control-group
  // But let's stick to existing logic if possible, or adapt.
  const presetControls = document.getElementById('preset-map-controls');
  if (presetControls) {
      const togglesDiv = document.createElement('div');
      togglesDiv.className = 'control-group'; // Match styling
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
            <input type="checkbox" id="toggle-agent-control" checked>
            <label for="toggle-agent-control" style="display:inline;">Agent Control</label>
        </div>
      `;
      // Insert after Map Generation group (which contains presetControls)
      // presetControls is inside .control-group. We want to insert after that group.
      const mapGenGroup = presetControls.closest('.control-group');
      if (mapGenGroup) {
          mapGenGroup.parentNode?.insertBefore(togglesDiv, mapGenGroup.nextSibling);
      }

      // Bind
      document.getElementById('toggle-fog-of-war')?.addEventListener('change', (e) => {
          fogOfWarEnabled = (e.target as HTMLInputElement).checked;
      });
      document.getElementById('toggle-debug-overlay')?.addEventListener('change', (e) => {
          debugOverlayEnabled = (e.target as HTMLInputElement).checked;
      });
      document.getElementById('toggle-agent-control')?.addEventListener('change', (e) => {
          agentControlEnabled = (e.target as HTMLInputElement).checked;
      });
  }

  // Handle Map Generator Type selection
  mapGeneratorTypeSelect?.addEventListener('change', () => {
    currentMapGeneratorType = mapGeneratorTypeSelect.value as MapGeneratorType;
    const wInput = document.getElementById('map-width') as HTMLInputElement;
    const hInput = document.getElementById('map-height') as HTMLInputElement;
    if (currentMapGeneratorType === MapGeneratorType.Static) {
      staticMapControlsDiv.style.display = 'block';
      mapSeedInput.disabled = true;
      if (wInput) wInput.disabled = true;
      if (hInput) hInput.disabled = true;
    } else {
      staticMapControlsDiv.style.display = 'none';
      mapSeedInput.disabled = false;
      if (wInput) wInput.disabled = false;
      if (hInput) hInput.disabled = false;
    }
  });

  document.getElementById('map-width')?.addEventListener('change', (e) => {
    currentMapWidth = parseInt((e.target as HTMLInputElement).value) || 24;
  });
  document.getElementById('map-height')?.addEventListener('change', (e) => {
    currentMapHeight = parseInt((e.target as HTMLInputElement).value) || 24;
  });

  // Loading Static Maps
  loadStaticMapButton?.addEventListener('click', () => {
    try {
      const oldMapData = JSON.parse(staticMapJsonTextarea.value);
      const mapData: MapDefinition = transformMapData(oldMapData);
      if (!mapData.width || !mapData.height || !mapData.cells) {
        throw new Error("Invalid MapDefinition JSON: Missing width, height, or cells.");
      }
      currentStaticMapData = mapData;
      alert("Static Map Loaded. Ready to Launch.");
    } catch (err) {
      console.error("Error loading static map:", err);
      alert("Invalid static map JSON provided.");
    }
  });

  uploadStaticMapInput?.addEventListener('change', (e) => {
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
          staticMapControlsDiv.style.display = 'block';
          alert("Static Map Loaded from File.");
        } catch (err) {
          console.error(err);
          alert("Invalid static map JSON file.");
        }
      };
      reader.readAsText(file);
    }
  });

  convertAsciiToMapButton?.addEventListener('click', () => {
    try {
      const ascii = asciiMapInput.value;
      const mapData: MapDefinition = MapGenerator.fromAscii(ascii);
      currentStaticMapData = mapData;
      // Auto-select
      mapGeneratorTypeSelect.value = MapGeneratorType.Static;
      currentMapGeneratorType = MapGeneratorType.Static;
      staticMapControlsDiv.style.display = 'block';
      alert("ASCII Map Converted & Loaded.");
    } catch (err) {
      console.error("Error converting ASCII:", err);
      alert("Invalid ASCII map.");
    }
  });

  convertMapToAsciiButton?.addEventListener('click', () => {
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

  document.getElementById('cmd-move')?.addEventListener('click', () => setInputMode('CMD_MOVE'));

  document.getElementById('export-replay')?.addEventListener('click', () => {
    const replay = gameClient.getReplayData();
    if (replay) {
      const json = JSON.stringify(replay, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xenopurge-replay-${replay.seed}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert("No game data.");
    }
  });

  const importInput = document.getElementById('import-replay') as HTMLInputElement;
  importInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const replayData = JSON.parse(event.target?.result as string);
          gameClient.loadReplay(replayData);
          updateSeedOverlay(replayData.seed);
          // Auto-switch to Mission Screen
          screenManager.show('mission');
          
          // Setup Renderer if needed (might be redundant if loadReplay triggers updates)
          if (!renderer) {
             const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
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
  const canvas = document.getElementById('game-canvas');
  canvas?.addEventListener('click', (e) => handleCanvasClick(e as MouseEvent));

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (screenManager.getCurrentScreen() === 'mission') {
        if (e.key === 'm' || e.key === 'M') {
          setInputMode('CMD_MOVE');
        } else if (e.key === 'Escape') {
          // Pause? Or just deselect?
          if (inputMode !== 'SELECT' || selectedUnitId) {
              setInputMode('SELECT');
              selectedUnitId = null;
              pendingCommandUnitId = null;
              if (currentGameState) updateUI(currentGameState);
          } else {
              // Pause Menu / Abort
              if (confirm("Abort Mission and return to menu?")) {
                  abortMission();
              }
          }
        }
    } else {
        // ESC in other screens
        if (e.key === 'Escape') {
            screenManager.goBack();
        }
    }
  });
  
  // Initial State: Menu
  screenManager.show('main-menu');
  
  // Load Config
  const loadAndApplyConfig = () => {
      const config = ConfigManager.load();
      if (config) {
          currentMapWidth = config.mapWidth;
          currentMapHeight = config.mapHeight;
          fogOfWarEnabled = config.fogOfWarEnabled;
          debugOverlayEnabled = config.debugOverlayEnabled;
          agentControlEnabled = config.agentControlEnabled;
          currentMapGeneratorType = config.mapGeneratorType;
          currentMissionType = config.missionType || MissionType.Default;
          currentSeed = config.lastSeed;
          currentSquad = config.squadConfig;

          // Apply to UI
          const missionSelect = document.getElementById('mission-type') as HTMLSelectElement;
          if (missionSelect) missionSelect.value = currentMissionType;

          if (mapSeedInput) mapSeedInput.value = currentSeed.toString();
          if (mapGeneratorTypeSelect) mapGeneratorTypeSelect.value = currentMapGeneratorType;
          
          const wInput = document.getElementById('map-width') as HTMLInputElement;
          const hInput = document.getElementById('map-height') as HTMLInputElement;
          if (wInput) wInput.value = currentMapWidth.toString();
          if (hInput) hInput.value = currentMapHeight.toString();

          const fowCheck = document.getElementById('toggle-fog-of-war') as HTMLInputElement;
          if (fowCheck) fowCheck.checked = fogOfWarEnabled;

          const debugCheck = document.getElementById('toggle-debug-overlay') as HTMLInputElement;
          if (debugCheck) debugCheck.checked = debugOverlayEnabled;

          const agentCheck = document.getElementById('toggle-agent-control') as HTMLInputElement;
          if (agentCheck) agentCheck.checked = agentControlEnabled;

          // Trigger change event for map type to update UI visibility
          mapGeneratorTypeSelect.dispatchEvent(new Event('change'));
      } else {
          // Set defaults for controls if no config
          mapGeneratorTypeSelect.value = currentMapGeneratorType;
      }
  };

  loadAndApplyConfig();
});
