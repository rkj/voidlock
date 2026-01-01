import { describe, it, expect, beforeEach, vi } from "vitest";
import { Renderer } from "./Renderer";
import { GameState, MapDefinition, CellType, UnitState, EnemyType } from "../shared/types";
import { createMockUnit, createMockEnemy, createMockGameState } from "../engine/tests/utils/MockFactory";
import { Graph } from "../engine/Graph";
import { VisibilityPolygon } from "./VisibilityPolygon";

// Mock HTMLCanvasElement and Context
const mockContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  // ... other methods
  setLineDash: vi.fn(),
  fillText: vi.fn(),
  drawImage: vi.fn(),
  arc: vi.fn(),
} as unknown as CanvasRenderingContext2D;

const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  width: 0,
  height: 0,
  getBoundingClientRect: vi.fn(() => ({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  })),
} as unknown as HTMLCanvasElement;

// Mock Image
vi.stubGlobal(
  "Image",
  class {
    src = "";
    onload = null;
  },
);

describe("Renderer LOS", () => {
  let renderer: Renderer;
  let state: GameState;

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new Renderer(mockCanvas);
    renderer.setCellSize(32);

    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: [], // Empty map
      extraction: { x: 9, y: 9 },
    };
    // Fill with floors
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.cells.push({ x, y, type: CellType.Floor });
      }
    }

    state = createMockGameState({
      t: 0,
      map,
      units: [
        createMockUnit({
          id: "u1",
          pos: { x: 5, y: 5 },
          hp: 100,
          maxHp: 100,
          state: UnitState.Idle,
          sightRange: 5,
          speed: 1,
          attackRange: 5,
          damage: 10,
          fireRate: 100,
          commandQueue: [],
          archetypeId: "assault",
        }),
      ],
      enemies: [
        createMockEnemy({
          id: "e1",
          pos: { x: 6, y: 6 },
          hp: 50,
          maxHp: 50,
          speed: 1,
          attackRange: 1,
          damage: 10,
          fireRate: 100,
          type: EnemyType.Melee,
          difficulty: 1,
        }),
      ],
      visibleCells: ["6,6"],
      discoveredCells: [],
      objectives: [],
      losOverlayEnabled: true, // ENABLE OVERLAY
      status: "Playing",
      threatLevel: 0,
      aliensKilled: 0,
      casualties: 0,
    });
  });

  it("should create radial gradient for units when losOverlayEnabled is true", () => {
    renderer.render(state);

    // Check if createRadialGradient was called
    // u1 at 5,5 * 32 = 160, 160. Radius 5 * 32 = 160.
    expect(mockContext.createRadialGradient).toHaveBeenCalledWith(
      160,
      160,
      0,
      160,
      160,
      160,
    );

    // Check if fillStyle was set to the gradient
    // We can't easily check the value of fillStyle if it's an object, but we can check if it was assigned
    // Indirectly, by checking if fill() was called after setting gradient
    expect(mockContext.fill).toHaveBeenCalled();
  });

  it("should create radial gradient for visible enemies", () => {
    renderer.render(state);

    // e1 at 6,6 * 32 = 192, 192. Radius 10 * 32 = 320.
    expect(mockContext.createRadialGradient).toHaveBeenCalledWith(
      192,
      192,
      0,
      192,
      192,
      320,
    );
  });
});
