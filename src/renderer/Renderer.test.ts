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

// Mock Image
class MockImage {
  onload: any = null;
  src: string = '';
  complete: boolean = true;
}
vi.stubGlobal('Image', MockImage);

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
  setLineDash: vi.fn(),
  fillText: vi.fn(),
  drawImage: vi.fn(),
  textAlign: '',
  textBaseline: '',
  // Add other methods used in Renderer as needed
} as unknown as CanvasRenderingContext2D;


describe('Renderer', () => {
  let renderer: Renderer;
  const mockMap: MapDefinition = {
    width: 2, height: 2,
    cells: [
      { x: 0, y: 0, type: CellType.Floor, walls: { n: false, e: false, s: false, w: false } },
      { x: 1, y: 0, type: CellType.Wall, walls: { n: false, e: false, s: false, w: false } },
      { x: 0, y: 1, type: CellType.Floor, walls: { n: false, e: false, s: false, w: false } },
      { x: 1, y: 1, type: CellType.Floor, walls: { n: false, e: false, s: false, w: false } },
    ],
    extraction: { x: 1, y: 1 },
    objectives: [{ id: 'o1', kind: 'Recover', state: 'Pending', targetCell: { x: 0, y: 1 } } as Objective]
  };
  const mockGameState: GameState = {
    t: 1000,
    map: mockMap,
    units: [
      { id: 's1', pos: { x: 0.5, y: 0.5 }, state: UnitState.Idle, hp: 100, maxHp: 100, damage: 10, fireRate: 500, attackRange: 1, sightRange: 5, commandQueue: [] },
    ],
    enemies: [
      { id: 'e1', pos: { x: 0.5, y: 0.5 }, hp: 30, maxHp: 30, type: 'SwarmMelee', damage: 5, fireRate: 1000, attackRange: 1 }, // Visible
      { id: 'e2', pos: { x: 1.5, y: 1.5 }, hp: 30, maxHp: 30, type: 'SwarmMelee', damage: 5, fireRate: 1000, attackRange: 1 }  // Hidden
    ],
        visibleCells: ['0,0'],
        discoveredCells: ['0,0', '1,1'],
        objectives: [],
        threatLevel: 0,
        status: 'Playing'
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
    
    // s1 at 0.5 -> 16px (plus flocking offset)
    expect(mockContext.arc).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.any(Number), 0, Math.PI * 2);
    
    // e1 at 0.5 -> 16px (plus flocking offset)
    expect(mockContext.moveTo).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    
    // e2 at 1.5 -> 48px. Hidden.
    expect(mockContext.moveTo).not.toHaveBeenCalledWith(48, expect.any(Number));
  });

  it('should render combat tracers', () => {
    const combatState = {
        ...mockGameState,
        units: [{
            ...mockGameState.units[0],
            lastAttackTime: 950, 
            lastAttackTarget: { x: 0.5, y: 0.5 }
        }]
    };

    renderer.render(combatState);
    expect(mockContext.lineTo).toHaveBeenCalledWith(16, 16);
  });
});