import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from './Renderer';
import { GameState, MapDefinition, CellType, UnitState } from '../shared/types';

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
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
} as unknown as CanvasRenderingContext2D;

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

import { VisibilityPolygon } from './VisibilityPolygon';

vi.mock('./VisibilityPolygon', () => ({
  VisibilityPolygon: {
    compute: vi.fn(() => [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }])
  }
}));

describe('Enemy LOS Visibility', () => {
  let renderer: Renderer;
  const mockMap: MapDefinition = {
    width: 10, height: 10,
    cells: Array.from({ length: 100 }, (_, i) => ({
      x: i % 10,
      y: Math.floor(i / 10),
      type: CellType.Floor,
      
    })),
  };

  const mockGameState: GameState = {
    t: 1000,
    map: mockMap,
    units: [],
    enemies: [
      { id: 'visible-enemy', pos: { x: 1.5, y: 1.5 }, hp: 100, maxHp: 100, type: 'Xeno-Mite', damage: 10, fireRate: 1000, attackRange: 1, speed: 2 },
      { id: 'hidden-enemy', pos: { x: 5.5, y: 5.5 }, hp: 100, maxHp: 100, type: 'Xeno-Mite', damage: 10, fireRate: 1000, attackRange: 1, speed: 2 }
    ],
    visibleCells: ['1,1'], // Only visible-enemy's cell is visible
    discoveredCells: ['1,1', '5,5'],
    objectives: [],
    threatLevel: 0,
    aliensKilled: 0,
    casualties: 0,
    status: 'Playing',
    losOverlayEnabled: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new Renderer(mockCanvas);
    renderer.setCellSize(32);
  });

  it('should only render LOS for visible enemies', () => {
    renderer.render(mockGameState);

    // VisibilityPolygon.compute is called for both units and enemies.
    // In our mockGameState, units is empty.
    // So all calls should be for enemies.
    
    // Total enemies: 2. Only 1 is visible.
    // We expect VisibilityPolygon.compute to be called exactly ONCE if our fix is applied.
    // CURRENTLY it will be called TWICE.
    
    const enemyCalls = (VisibilityPolygon.compute as any).mock.calls.filter((call: any) => {
        // call[0] is the position Vector2
        return call[0].x === 1.5 && call[0].y === 1.5 || call[0].x === 5.5 && call[0].y === 5.5;
    });

    expect(enemyCalls.length).toBe(1);
    expect(enemyCalls[0][0]).toEqual({ x: 1.5, y: 1.5 });
  });
});
