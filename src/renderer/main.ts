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
  return { width: M1_MAP_WIDTH, height: M1_MAP_HEIGHT, cells };
};

// --- Game Setup ---
const gameClient = new GameClient();
let renderer: Renderer;
let currentGameState: GameState | null = null;
let selectedUnitId: string | null = null; // For click-to-move

const initGame = () => {
  const map = createM1Map();
  const seed = Date.now(); // Not strictly used by engine yet, but good practice

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
    statusElement.textContent = `Time: ${(state.t / 1000).toFixed(1)}s, Units: ${state.units.length}`;
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
      Math.floor(unit.pos.x) === clickedCell.x && Math.floor(unit.pos.y) === clickedCell.y
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
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  if (startButton) {
    startButton.addEventListener('click', () => {
      startButton.textContent = 'Restart Mission'; // Change button text
      initGame();
      // Temporarily add a unit for testing purposes
      gameClient.sendCommand({
        type: CommandType.MOVE_TO,
        unitIds: ['s1'], // Dummy ID
        target: { x: 2, y: 2 } // Initial position
      });
      // The actual adding of units should be part of engine init in the future
      // For now, this is a placeholder to get a unit on screen
      if (currentGameState) {
        currentGameState.units.push({id: 's1', pos: {x:2, y:2}, state: UnitState.Idle});
      }
    });
  }

  if (canvas) {
    canvas.addEventListener('click', handleCanvasClick);
  }
});
