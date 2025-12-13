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
    t: 1000,
    map: mockMap,
    units: [
      { id: 's1', pos: { x: 0.5, y: 0.5 }, state: UnitState.Idle, hp: 100, maxHp: 100, damage: 10, attackRange: 1, sightRange: 5, commandQueue: [] },
    ],
    enemies: [
      { id: 'e1', pos: { x: 0.5, y: 0.5 }, hp: 30, maxHp: 30, type: 'SwarmMelee', damage: 5, attackRange: 1 }, // Visible
      { id: 'e2', pos: { x: 1.5, y: 1.5 }, hp: 30, maxHp: 30, type: 'SwarmMelee', damage: 5, attackRange: 1 }  // Hidden
    ],
    visibleCells: ['0,0'], 
    discoveredCells: ['0,0', '0,1'],
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
    expect(mockContext.fillRect).toHaveBeenCalled(); 
  });

  it('should only render visible enemies', () => {
    renderer.render(mockGameState);
    
    // s1 at 0.5 -> 16px.
    expect(mockContext.arc).toHaveBeenCalledWith(16, 16, expect.any(Number), 0, Math.PI * 2);
    
    // e1 at 0.5 -> 16px.
    expect(mockContext.moveTo).toHaveBeenCalledWith(16, expect.any(Number));
    
    // e2 at 1.5 -> 48px. Hidden.
    expect(mockContext.moveTo).not.toHaveBeenCalledWith(48, expect.any(Number));
  });

  it('should render combat tracers', () => {
    // Add attack data
    const combatState = {
        ...mockGameState,
        units: [{
            ...mockGameState.units[0],
            lastAttackTime: 950, // 50ms ago (within 150ms window)
            lastAttackTarget: { x: 0.5, y: 0.5 } // Target enemy
        }]
    };

    renderer.render(combatState);

    // Should draw line from unit (16,16) to target (16,16)
    // tracer lineTo
    expect(mockContext.lineTo).toHaveBeenCalledWith(16, 16);
  });
});
