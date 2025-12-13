import { GameClient } from '../engine/GameClient';
import { Renderer } from './Renderer';
import { MapDefinition, CellType, Unit, UnitState, Vector2, CommandType } from '../shared/types';

// --- Hardcoded Map for M1 ---
const M1_MAP_WIDTH = 20;
const M1_MAP_HEIGHT = 15;
const M1_CELL_SIZE = 30; // Pixels

const createM1Map = (): MapDefinition => {
  const cells = [];
  for (let y = 0; y < M1_MAP_HEIGHT; y++) {
    for (let x = 0; x < M1_MAP_WIDTH; x++) {
      let type = CellType.Floor;
      // Simple walls
      if (x === 0 || x === M1_MAP_WIDTH - 1 || y === 0 || y === M1_MAP_HEIGHT - 1 || (x === 5 && y > 3 && y < 10)) {
        type = CellType.Wall;
      }
      cells.push({ x, y, type });
    }
  }
  return { 
    width: M1_MAP_WIDTH, 
    height: M1_MAP_HEIGHT, 
    cells,
    spawnPoints: [{ id: 'sp1', pos: { x: 18, y: 2 }, radius: 1 }], // Enemy spawn
    extraction: { x: 2, y: 2 },
    objectives: [{ id: 'o1', kind: 'Recover', state: 'Pending', targetCell: { x: 15, y: 10 } }]
  };
};

// --- Game Setup ---
const gameClient = new GameClient();
let renderer: Renderer;
let currentGameState: GameState | null = null;
let selectedUnitId: string | null = null; // For click-to-move

const initGame = () => {
  const map = createM1Map();
  const seed = Date.now(); 

  // Initialize engine in worker
  gameClient.init(seed, map);

  // Add a sample unit after init (or the engine itself can spawn them)
  gameClient.sendCommand({
    type: CommandType.MOVE_TO, // Use a dummy command to "add" a unit for now
    unitIds: [], // Empty for now, will handle adding units properly later
    target: { x: 0, y: 0 }
  });

  gameClient.onStateUpdate((state) => {
    currentGameState = state;
    if (!renderer) {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      if (canvas) {
        renderer = new Renderer(canvas);
        renderer.setCellSize(M1_CELL_SIZE);
      } else {
        console.error("Canvas element not found!");
        return;
      }
    }
    renderer.render(state);
    updateUI(state);
  });
};

const updateUI = (state: GameState) => {
  const statusElement = document.querySelector('#ui-panel p');
  if (statusElement) {
    statusElement.textContent = `Time: ${(state.t / 1000).toFixed(1)}s
Units: ${state.units.filter(u => u.state !== 'Dead' && u.state !== 'Extracted').length}
Status: ${state.status}`;
  }
};

const handleCanvasClick = (event: MouseEvent) => {
  if (!renderer || !currentGameState) return;

  const clickedCell = renderer.getCellCoordinates(event.clientX, event.clientY);
  console.log('Clicked cell:', clickedCell);

  if (selectedUnitId && clickedCell) {
    // Send MOVE_TO command for the selected unit
    gameClient.sendCommand({
      type: CommandType.MOVE_TO,
      unitIds: [selectedUnitId],
      target: clickedCell
    });
    selectedUnitId = null; // Deselect after sending command
  } else if (currentGameState) {
    // If no unit selected, try to select one
    const unitAtClick = currentGameState.units.find(unit => 
      Math.floor(unit.pos.x) === clickedCell.x && Math.floor(unit.pos.y) === clickedCell.y &&
      unit.state !== UnitState.Dead && unit.state !== UnitState.Extracted
    );
    if (unitAtClick) {
      selectedUnitId = unitAtClick.id;
      console.log('Selected unit:', selectedUnitId);
    }
  }
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('start-button');
  const exportButton = document.getElementById('export-replay');
  const importInput = document.getElementById('import-replay') as HTMLInputElement;
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  if (startButton) {
    startButton.addEventListener('click', () => {
      startButton.textContent = 'Restart Mission'; // Change button text
      initGame();
      // Temporarily add a unit for testing purposes
      gameClient.sendCommand({
        type: CommandType.MOVE_TO,
        unitIds: ['s1'], // Dummy ID
        target: { x: 2, y: 2 } // Initial position (extraction point for safety start?) NO, near extraction.
      });
      // Hack: force add unit to state for visual feedback immediately if needed, 
      // but Worker will handle it via command or init eventually.
      // Actually, my CoreEngine logic doesn't support adding units via MOVE_TO command hacking anymore
      // because I removed the dummy unit addition from CoreEngine constructor or didn't add it.
      // Wait, CoreEngine constructor creates empty units array.
      // And I removed the "addUnit" hack in CoreEngine constructor? 
      // I should add a command to SPAWN_UNIT or just add it in CoreEngine constructor for M2.
      // For now, I'll add a 'SPAWN_UNIT' command or just rely on the hack I might have left?
      // In `CoreEngine.ts`, `applyCommand`:
      /*
          if (cmd.type === CommandType.MOVE_TO) {
            cmd.unitIds.forEach(id => {
              const unit = this.state.units.find(u => u.id === id);
              // ...
      */
      // It finds unit. If not found, it does nothing.
      // So my previous hack `gameClient.sendCommand({ ... unitIds: ['s1'] ... })` effectively does nothing if s1 isn't there.
      // I need to properly spawn a unit.
      // I'll add a method to GameClient/CoreEngine to add initial units, or hardcode them in CoreEngine for now.
      // Let's hardcode one unit in CoreEngine constructor for M2 prototype.
      // Or better, `INIT` payload could contain initial units.
      // `MapDefinition` doesn't have units.
      // I'll modify CoreEngine to spawn a default unit on init.
    });
  }

  if (exportButton) {
    exportButton.addEventListener('click', () => {
      const replay = gameClient.getReplayData();
      if (replay) {
        const json = JSON.stringify(replay, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `xenopurge-replay-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert("No game data to export.");
      }
    });
  }

  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const replayData = JSON.parse(event.target?.result as string);
            gameClient.loadReplay(replayData);
            console.log("Replay loaded.");
          } catch (err) {
            console.error("Failed to load replay:", err);
            alert("Invalid replay file.");
          }
        };
        reader.readAsText(file);
      }
    });
  }

  if (canvas) {
    canvas.addEventListener('click', handleCanvasClick);
  }
});