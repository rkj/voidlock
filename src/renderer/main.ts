import { GameClient } from '../engine/GameClient';
import { Renderer } from './Renderer';
import { GameState, UnitState, CommandType } from '../shared/types';
import { MapGenerator } from '../engine/MapGenerator';

// --- Game Setup ---
const gameClient = new GameClient();
let renderer: Renderer;
let currentGameState: GameState | null = null;
let selectedUnitId: string | null = null; // For click-to-move
let currentSeed: number = Date.now();

const initGame = (seed?: number) => {
  currentSeed = seed ?? Date.now();
  
  // Use MapGenerator
  const generator = new MapGenerator(currentSeed);
  const map = generator.generate(30, 20); // 30x20 map

  // Initialize engine in worker
  gameClient.init(currentSeed, map);

  // CoreEngine now spawns default squad automatically on init (M3 logic)
  
  gameClient.onStateUpdate((state) => {
    currentGameState = state;
    if (!renderer) {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      if (canvas) {
        renderer = new Renderer(canvas);
        renderer.setCellSize(32); // Default size
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
  const generateButton = document.getElementById('generate-map');
  const seedInput = document.getElementById('map-seed') as HTMLInputElement;
  
  const exportButton = document.getElementById('export-replay');
  const importInput = document.getElementById('import-replay') as HTMLInputElement;
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  if (startButton) {
    startButton.addEventListener('click', () => {
      initGame(currentSeed); // Restart with same seed
    });
  }

  if (generateButton) {
    generateButton.addEventListener('click', () => {
      const seedVal = parseInt(seedInput.value);
      const seed = !isNaN(seedVal) ? seedVal : undefined;
      initGame(seed);
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
        a.download = `xenopurge-replay-${replay.seed}.json`;
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
            currentSeed = replayData.seed;
            if(seedInput) seedInput.value = currentSeed.toString();
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
  
  // Start initial game
  initGame();
});
