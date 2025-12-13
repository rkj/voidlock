import { GameClient } from '../engine/GameClient';
import { Renderer } from './Renderer';
import { GameState, UnitState, CommandType, Unit } from '../shared/types';
import { MapGenerator } from '../engine/MapGenerator';

// --- Game Setup ---
const gameClient = new GameClient();
let renderer: Renderer;
let currentGameState: GameState | null = null;
let currentSeed: number = Date.now();

// --- Input State ---
type InputMode = 'SELECT' | 'CMD_MOVE';
let inputMode: InputMode = 'SELECT';
let selectedUnitId: string | null = null; 
let pendingCommandUnitId: string | null = null;

const initGame = (seed?: number) => {
  currentSeed = seed ?? Date.now();
  
  // Use MapGenerator
  const generator = new MapGenerator(currentSeed);
  const map = generator.generate(30, 20); 

  // Initialize engine in worker
  gameClient.init(currentSeed, map);
  
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
        renderer.setCellSize(32); 
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
      
      let statusText = unit.state;
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
  // Buttons
  document.getElementById('start-button')?.addEventListener('click', () => initGame(currentSeed));
  
  document.getElementById('generate-map')?.addEventListener('click', () => {
    const seedInput = document.getElementById('map-seed') as HTMLInputElement;
    const seedVal = parseInt(seedInput.value);
    initGame(!isNaN(seedVal) ? seedVal : undefined);
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
          const seedInput = document.getElementById('map-seed') as HTMLInputElement;
          if(seedInput) seedInput.value = currentSeed.toString();
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
  initGame();
});