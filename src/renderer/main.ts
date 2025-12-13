import { GameClient } from '../engine/GameClient';
import { Renderer } from './Renderer';
import { GameState, UnitState, CommandType, Unit, MapDefinition, MapGeneratorType, Door, Vector2 } from '../shared/types';
import { MapGenerator } from '../engine/MapGenerator';

// Factory function for MapGenerator
const mapGeneratorFactory = (seed: number, type: MapGeneratorType, mapData?: MapDefinition): MapGenerator => {
  // Pass default maxTunnelWidth and maxRoomSize to procedural generator
  return new MapGenerator(seed, 1, 2); 
};

// --- Global Input State ---
type InputMode = 'SELECT' | 'CMD_MOVE';
let inputMode: InputMode = 'SELECT';
let selectedUnitId: string | null = null; 
let pendingCommandUnitId: string | null = null;

// --- Map Data Transformation ---
// This utility function takes the old map format (with doorId in cells)
// and converts it to the new MapDefinition format (with a top-level doors array).
const transformMapData = (oldMapData: any): MapDefinition => {
  const newCells = oldMapData.cells.map((cell: any) => {
    // Remove doorId from cells as doors are now top-level entities
    const { doorId, ...rest } = cell;
    return rest;
  });

  const doors: Door[] = [];
  const doorIdMap = new Map<string, { segment: Vector2[]; orientation: 'Horizontal' | 'Vertical' }>();

  oldMapData.cells.forEach((cell: any) => {
    if (cell.doorId) {
      const { x, y, doorId } = cell;
      if (!doorIdMap.has(doorId)) {
        // Assume default properties for new doors
        doorIdMap.set(doorId, { segment: [], orientation: 'Vertical' }); // Default to Vertical
      }
      doorIdMap.get(doorId)?.segment.push({ x, y });
    }
  });

  doorIdMap.forEach((doorProps, id) => {
    // Determine orientation based on segment (simple check for now)
    // If all X are same, it's vertical. If all Y are same, it's horizontal.
    const uniqueX = new Set(doorProps.segment.map(v => v.x)).size;
    const uniqueY = new Set(doorProps.segment.map(v => v.y)).size;

    if (uniqueX === 1 && doorProps.segment.length > 1) { // Same X, multiple Ys = Vertical
        doorProps.orientation = 'Vertical';
        // Sort segment for consistent representation (top-to-bottom)
        doorProps.segment.sort((a,b) => a.y - b.y);
    } else if (uniqueY === 1 && doorProps.segment.length > 1) { // Same Y, multiple Xs = Horizontal
        doorProps.orientation = 'Horizontal';
        // Sort segment for consistent representation (left-to-right)
        doorProps.segment.sort((a,b) => a.x - b.x);
    } else {
        // Single cell segment, assume vertical (or handle error)
        doorProps.orientation = 'Vertical'; // Arbitrary default
    }


    doors.push({
      id,
      segment: doorProps.segment,
      orientation: doorProps.orientation,
      state: 'Closed', // Default state
      hp: 100, maxHp: 100, openDuration: 1
    });
  });

  return {
    ...oldMapData,
    cells: newCells,
    doors, // Add top-level doors array
  };
};

// --- Game Setup ---
const gameClient = new GameClient(mapGeneratorFactory);
let renderer: Renderer;
let currentGameState: GameState | null = null;
let currentSeed: number = Date.now();
let currentMapGeneratorType: MapGeneratorType = MapGeneratorType.Procedural;
let currentStaticMapData: MapDefinition | undefined = undefined;

const initGame = (seed?: number, generatorType?: MapGeneratorType, staticMapData?: MapDefinition) => {
  currentSeed = seed ?? Date.now();
  currentMapGeneratorType = generatorType ?? MapGeneratorType.Procedural;
  currentStaticMapData = staticMapData;
  
  // Initialize engine in worker
  gameClient.init(currentSeed, currentMapGeneratorType, currentStaticMapData);
  
  // Reset selection
  selectedUnitId = null;
  pendingCommandUnitId = null;
  setInputMode('SELECT');

  gameClient.onStateUpdate((state) => {
    currentGameState = state;
    if (!renderer) {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      if (canvas) {
        renderer = new Renderer(canvas);
        renderer.setCellSize(128); // M8 Scale
      } else {
        console.error("Canvas element not found!");
        return;
      }
    }
    renderer.render(state);
    updateUI(state);
  });
};

const setInputMode = (mode: InputMode) => {
  inputMode = mode;
  pendingCommandUnitId = null; // Reset pending unit when mode changes
  
  // Update UI buttons
  const moveBtn = document.getElementById('cmd-move');
  if (moveBtn) moveBtn.className = mode === 'CMD_MOVE' ? 'active' : '';
  
  console.log(`Input Mode: ${mode}`);
};

const updateUI = (state: GameState) => {
  // Status
  const statusElement = document.getElementById('game-status');
  if (statusElement) {
    statusElement.textContent = `Time: ${(state.t / 1000).toFixed(1)}s | Status: ${state.status}`;
  }

  // Soldier List
  const listContainer = document.getElementById('soldier-list');
  if (listContainer) {
    listContainer.innerHTML = ''; // Clear current list
    
    state.units.forEach(unit => {
      const el = document.createElement('div');
      el.className = `soldier-item ${unit.id === selectedUnitId || unit.id === pendingCommandUnitId ? 'selected' : ''}`;
      if (unit.state === UnitState.Dead) el.classList.add('dead');
      if (unit.state === UnitState.Extracted) el.classList.add('extracted');
      
      let statusText: string = unit.state; // Explicit string type
      if (unit.commandQueue && unit.commandQueue.length > 0) {
        statusText += ` (+${unit.commandQueue.length})`;
      }
      
      el.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <strong>${unit.id}</strong>
          <span>${statusText}</span>
        </div>
        <div class="hp-bar"><div class="hp-fill" style="width: ${(unit.hp / unit.maxHp) * 100}%"></div></div>
      `;
      
      el.addEventListener('click', () => onUnitClick(unit));
      
      listContainer.appendChild(el);
    });
  }
};

const onUnitClick = (unit: Unit) => {
  if (inputMode === 'CMD_MOVE') {
    if (!pendingCommandUnitId) {
      pendingCommandUnitId = unit.id;
      console.log(`Command Target: Unit ${unit.id} selected. Click map to move.`);
    } else {
      // Changed mind? Select this one instead
      pendingCommandUnitId = unit.id;
    }
  } else {
    // Select Mode
    selectedUnitId = unit.id === selectedUnitId ? null : unit.id;
  }
  // Force UI update (will happen on next tick, but good to be responsive if paused)
  if (currentGameState) updateUI(currentGameState);
};

const handleCanvasClick = (event: MouseEvent) => {
  if (!renderer || !currentGameState) return;

  const clickedCell = renderer.getCellCoordinates(event.clientX, event.clientY);
  
  // Check if clicked on a unit (visual selection via map)
  const unitAtClick = currentGameState.units.find(unit => 
    Math.floor(unit.pos.x) === clickedCell.x && Math.floor(unit.pos.y) === clickedCell.y &&
    unit.state !== UnitState.Dead && unit.state !== UnitState.Extracted
  );

  if (unitAtClick) {
    onUnitClick(unitAtClick);
    return; // Handled by unit click logic
  }

  // Clicked on empty map
  if (inputMode === 'CMD_MOVE' && pendingCommandUnitId) {
    // Execute Move
    gameClient.sendCommand({
      type: CommandType.MOVE_TO,
      unitIds: [pendingCommandUnitId],
      target: clickedCell,
      queue: event.shiftKey // Support Shift+Click to queue
    });
    
    // Reset mode or keep for multi-order?
    // "Select Command -> Select Unit -> Target". Usually resets.
    // If Shift is held, maybe keep mode?
    if (!event.shiftKey) {
        setInputMode('SELECT');
    }
  } else if (inputMode === 'SELECT' && selectedUnitId) {
    // Optional: Context sensitive move for selected unit?
    // Standard RTS behavior.
    gameClient.sendCommand({
      type: CommandType.MOVE_TO,
      unitIds: [selectedUnitId],
      target: clickedCell,
      queue: event.shiftKey
    });
  }
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  // Get UI elements
  const mapGeneratorTypeSelect = document.getElementById('map-generator-type') as HTMLSelectElement;
  const mapSeedInput = document.getElementById('map-seed') as HTMLInputElement;
  const generateMapButton = document.getElementById('generate-map') as HTMLButtonElement;
  const staticMapControlsDiv = document.getElementById('static-map-controls') as HTMLDivElement;
  const staticMapJsonTextarea = document.getElementById('static-map-json') as HTMLTextAreaElement;
  const loadStaticMapButton = document.getElementById('load-static-map') as HTMLButtonElement;

  // Handle Map Generator Type selection
  mapGeneratorTypeSelect?.addEventListener('change', () => {
    currentMapGeneratorType = mapGeneratorTypeSelect.value as MapGeneratorType;
    if (currentMapGeneratorType === MapGeneratorType.Static) {
      staticMapControlsDiv.style.display = 'block';
      generateMapButton.style.display = 'none'; // Hide procedural generate button
      mapSeedInput.disabled = true; // Seed is not relevant for static map loading
    } else {
      staticMapControlsDiv.style.display = 'none';
      generateMapButton.style.display = 'block'; // Show procedural generate button
      generateMapButton.textContent = 'Generate New Mission'; // Reset text
      mapSeedInput.disabled = false;
    }
  });

  // Buttons
  document.getElementById('start-button')?.addEventListener('click', () => {
    initGame(currentSeed, currentMapGeneratorType, currentStaticMapData);
  });
  
  generateMapButton?.addEventListener('click', () => {
    const seedVal = parseInt(mapSeedInput.value);
    initGame(!isNaN(seedVal) ? seedVal : undefined, MapGeneratorType.Procedural);
  });

  loadStaticMapButton?.addEventListener('click', () => {
    try {
      const oldMapData = JSON.parse(staticMapJsonTextarea.value);
      const mapData: MapDefinition = transformMapData(oldMapData);
      
      // Validate basic structure (optional, but good practice)
      if (!mapData.width || !mapData.height || !mapData.cells) {
        throw new Error("Invalid MapDefinition JSON: Missing width, height, or cells.");
      }
      currentStaticMapData = mapData;
      initGame(currentSeed, MapGeneratorType.Static, currentStaticMapData);
    } catch (err) {
      console.error("Error loading static map:", err);
      alert("Invalid static map JSON provided. Please check the format.");
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
          currentSeed = replayData.seed;
          mapSeedInput.value = currentSeed.toString();
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
    if (e.key === 'm' || e.key === 'M') {
      setInputMode('CMD_MOVE');
    } else if (e.key === 'Escape') {
      setInputMode('SELECT');
      selectedUnitId = null;
      pendingCommandUnitId = null;
      if (currentGameState) updateUI(currentGameState);
    }
  });
  
  // Start initial game
  // Initialize UI controls to match initial state
  mapGeneratorTypeSelect.value = currentMapGeneratorType;
  if (currentMapGeneratorType === MapGeneratorType.Static) {
    staticMapControlsDiv.style.display = 'block';
    generateMapButton.style.display = 'none'; // Hide procedural generate button
    mapSeedInput.disabled = true;
  } else {
    staticMapControlsDiv.style.display = 'none'; // Hide static map controls
    generateMapButton.style.display = 'block'; // Show procedural generate button
    generateMapButton.textContent = 'Generate New Mission'; // Reset text
    mapSeedInput.disabled = false;
  }
  
  initGame(currentSeed, currentMapGeneratorType, currentStaticMapData);
});