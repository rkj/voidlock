import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from './Renderer';
import { GameState, MapDefinition, CellType, UnitState, Objective } from '../shared/types';

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
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
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
    ],
    extraction: { x: 1, y: 1 },
    objectives: [{ id: 'o1', kind: 'Recover', state: 'Pending', targetCell: { x: 0, y: 1 } } as Objective]
  };
  const mockGameState: GameState = {
    t: 0,
    map: mockMap,
    units: [
      { id: 's1', pos: { x: 0.5, y: 0.5 }, state: UnitState.Idle, hp: 100, maxHp: 100, damage: 10, attackRange: 1, sightRange: 5 },
    ],
    enemies: [
      { id: 'e1', pos: { x: 0.5, y: 0.5 }, hp: 30, maxHp: 30, type: 'SwarmMelee', damage: 5, attackRange: 1 }, // Visible
      { id: 'e2', pos: { x: 1.5, y: 1.5 }, hp: 30, maxHp: 30, type: 'SwarmMelee', damage: 5, attackRange: 1 }  // Hidden
    ],
    visibleCells: ['0,0'], // Only (0,0) is visible
    discoveredCells: ['0,0', '0,1'], // (0,1) discovered but not visible
    // (1,0) and (1,1) undiscovered
    status: 'Playing',
    objectives: mockMap.objectives as Objective[]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new Renderer(mockCanvas);
    renderer.setCellSize(32);
  });

  it('should render map, fog, and entities', () => {
    renderer.render(mockGameState);

    expect(mockContext.clearRect).toHaveBeenCalled();
    
    // Map rendering
    // 4 cells
    expect(mockContext.fillRect).toHaveBeenCalled(); 

    // Fog Rendering
    // (0,0) visible -> no fog
    // (0,1) discovered -> dim fog
    // (1,0) undiscovered -> black fog
    // (1,1) undiscovered -> black fog
    // We expect fillRect calls with black/rgba colors.
    // Hard to test exact colors without complex mocks, but we can verify calls.
    
    // Enemy Rendering
    // e1 at (0,0) is visible -> rendered
    // e2 at (1,1) is hidden -> NOT rendered
    // How to distinguish? Number of fill/stroke calls?
    // s1 at (0,0) -> rendered.
    
    // e1: fill (red), stroke
    // s1: fill (green), stroke
    // Total entity fills: 2 (+ health bars)
    // Health bar: black bg, colored fg. 2 rects per entity.
    
    // Just verify general calls. 
    // Ideally we'd spy on fillStyle before fill().
  });

  it('should only render visible enemies', () => {
    // We can spy on fillStyle setter?
    // Not easily with this mock setup unless we use a getter/setter spy.
    // But we can check arguments to arc/moveTo/lineTo.
    
    renderer.render(mockGameState);
    
    // s1 is at 0.5, 0.5 -> pixels (16, 16). Arc called.
    expect(mockContext.arc).toHaveBeenCalledWith(16, 16, expect.any(Number), 0, Math.PI * 2);
    
    // e1 is at 0.5, 0.5 -> pixels (16, 16). Triangle (moveTo/lineTo).
    expect(mockContext.moveTo).toHaveBeenCalledWith(16, expect.any(Number));
    
    // e2 is at 1.5, 1.5 -> pixels (48, 48). Should NOT be drawn.
    expect(mockContext.moveTo).not.toHaveBeenCalledWith(48, expect.any(Number));
  });
});