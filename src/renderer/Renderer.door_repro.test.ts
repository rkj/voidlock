import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from './Renderer';
import { GameState, MapDefinition, CellType, UnitState, Door } from '../shared/types';

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
} as unknown as CanvasRenderingContext2D;

describe('Renderer Door Drawing', () => {
  let renderer: Renderer;
  
  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new Renderer(mockCanvas);
    renderer.setCellSize(100);
  });

  it('should draw a closed door exactly once', () => {
    const door: Door = {
        id: 'd1',
        state: 'Closed',
        orientation: 'Vertical',
        segment: [{x:0, y:0}, {x:1, y:0}],
        hp: 100, maxHp: 100, openDuration: 1
    };

    const map: MapDefinition = {
        width: 2, height: 1,
        cells: [
            { x: 0, y: 0, type: CellType.Floor, walls: { n:true, e:false, s:true, w:true } },
            { x: 1, y: 0, type: CellType.Floor, walls: { n:true, e:false, s:true, w:true } }
        ],
        doors: [door]
    };

    const state: GameState = {
        t: 0,
        map,
        units: [],
        enemies: [],
        visibleCells: ['0,0', '1,0'],
        discoveredCells: ['0,0', '1,0'],
        objectives: [],
        threatLevel: 0,
        status: 'Playing'
    };

    renderer.render(state);

    // Check how many times fillRect was called for the door.
    // fillRect is called for floor cells (2 times) + door (1 time for closed).
    // Floor is very dark grey #0a0a0a.
    // Door is #FFD700 (Gold).
    
    // We can inspect the calls arguments or style
    // But since we can't easily check style in this mock setup unless we track it...
    // Let's assume fillRect calls count.
    // 2 calls for floors. 1 call for door body.
    // total 3.
    
    expect(mockContext.fillRect).toHaveBeenCalledTimes(3); 
  });
});