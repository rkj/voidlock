import { describe, it, expect, beforeEach, vi } from "vitest";
import { Renderer } from "./Renderer";
import { GameState, MapDefinition, CellType, UnitState } from "../shared/types";
import {
  createMockUnit,
  createMockGameState,
} from "../engine/tests/utils/MockFactory";

// Mock Image
class MockImage {
  onload: any = null;
  src: string = "";
  complete: boolean = true;
}
vi.stubGlobal("Image", MockImage);

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
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  textAlign: "",
  textBaseline: "",
  strokeStyle: "",
  lineWidth: 0,
  globalAlpha: 1.0,
} as unknown as CanvasRenderingContext2D;

// Mock HTMLCanvasElement
const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  width: 640,
  height: 480,
  getBoundingClientRect: vi.fn(() => ({
    left: 0,
    top: 0,
    width: 640,
    height: 480,
  })),
} as unknown as HTMLCanvasElement;

describe("Renderer Move Line", () => {
  let renderer: Renderer;
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new Renderer(mockCanvas);
    renderer.setCellSize(32);
  });

  it("should render full path for moving units", () => {
    const gameState: GameState = createMockGameState({
      t: 0,
      map: mockMap,
      units: [
        createMockUnit({
          id: "s1",
          pos: { x: 0.5, y: 0.5 },
          state: UnitState.Moving,
          targetPos: { x: 1.5, y: 0.5 },
          path: [
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 1 },
          ],
          hp: 100,
          maxHp: 100,
          stats: {
            damage: 10,
            fireRate: 500,
            attackRange: 1,
            speed: 2,
            accuracy: 95,
            soldierAim: 90,
            equipmentAccuracyBonus: 0,
          },
          commandQueue: [],
          archetypeId: "assault",
        }),
      ],
      enemies: [],
      visibleCells: ["0,0", "1,0", "2,0", "2,1"],
      discoveredCells: ["0,0", "1,0", "2,0", "2,1"],
      objectives: [],
      stats: {
        threatLevel: 0,
        aliensKilled: 0,
        casualties: 0,
      },
      status: "Playing",
    });

    renderer.render(gameState);

    // Current implementation only draws to targetPos (1.5, 0.5) -> (48, 16)
    // We expect it to also draw to subsequent waypoints in path:
    // (2.5, 0.5) and (2.5, 1.5)

    // Check lineTo calls.
    // Initial call: moveTo(unitPos), lineTo(targetPos)
    // Subsequent calls (expected): lineTo(path[1]), lineTo(path[2])...

    // In current implementation, we only expect one lineTo for the movement line.
    // (Actually there might be other lineTo calls for health bars etc, but they use different coordinates)

    const lineToCalls = (mockContext.lineTo as any).mock.calls;

    // (1.5, 0.5) * 32 = (48, 16)
    expect(lineToCalls).toContainEqual([48, 16]);

    // These are expected with the NEW implementation
    // path[1] = {x: 2, y: 0} -> targetPos (2.5, 0.5) -> (80, 16)
    // path[2] = {x: 2, y: 1} -> targetPos (2.5, 1.5) -> (80, 48)
    expect(lineToCalls).toContainEqual([80, 16]);
    expect(lineToCalls).toContainEqual([80, 48]);
  });
});
