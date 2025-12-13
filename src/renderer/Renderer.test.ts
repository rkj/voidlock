import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from './Renderer';
import { GameState, MapDefinition, CellType, UnitState } from '../shared/types';

// Mock HTMLCanvasElement
const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  width: 0,
  height: 0,
  getBoundingClientRect: vi.fn(() => ({
    left: 0, top: 0, width: 640, height: 480
  })),
} as unknown as HTMLCanvasElement;

// Mock CanvasRenderingContext2D
const mockContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  // Add other methods used in Renderer as needed
} as unknown as CanvasRenderingContext2D;


describe('Renderer', () => {
  let renderer: Renderer;
  const mockMap: MapDefinition = {
    width: 2, height: 2,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Wall },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
    ]
  };
  const mockGameState: GameState = {
    t: 0,
    map: mockMap,
    units: [
      { id: 's1', pos: { x: 0.5, y: 0.5 }, state: UnitState.Idle },
      { id: 's2', pos: { x: 1.2, y: 1.2 }, state: UnitState.Moving, targetPos: { x: 1.5, y: 1.5 } },
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new Renderer(mockCanvas);
    renderer.setCellSize(32);
  });

  it('should instantiate correctly', () => {
    expect(renderer).toBeInstanceOf(Renderer);
    expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
  });

  it('should render map and units when render is called', () => {
    renderer.render(mockGameState);

    expect(mockContext.clearRect).toHaveBeenCalledOnce();
    expect(mockContext.fillRect).toHaveBeenCalledTimes(mockMap.cells.length); // 4 cells
    expect(mockContext.arc).toHaveBeenCalledTimes(mockGameState.units.length + 1); // 2 units + 1 target
    expect(mockContext.fill).toHaveBeenCalledTimes(mockGameState.units.length);
    expect(mockContext.stroke).toHaveBeenCalledTimes(mockGameState.units.length + 1);
  });

  it('should correctly calculate cell coordinates from pixel click', () => {
    renderer.setCellSize(32); // Ensure cellSize is set for calculation
    
    // Simulate a click at pixel (48, 48), which should be in cell (1,1) if cellSize is 32
    const cell = renderer.getCellCoordinates(48, 48);
    expect(cell).toEqual({ x: 1, y: 1 });

    // Simulate a click at pixel (10, 10), which should be in cell (0,0)
    const cell2 = renderer.getCellCoordinates(10, 10);
    expect(cell2).toEqual({ x: 0, y: 0 });
  });
});
