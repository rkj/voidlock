import { describe, it, expect, beforeEach, vi } from "vitest";
import { Renderer } from "@src/renderer/Renderer";
import {
  GameState,
  MapDefinition,
  CellType,
  EnemyType,
} from "@src/shared/types";
import {
  createMockEnemy,
  createMockGameState,
} from "@src/engine/tests/utils/MockFactory";

// Mock HTMLCanvasElement
const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  width: 0,
  height: 0,
  getBoundingClientRect: vi.fn(() => ({
    left: 0,
    top: 0,
    width: 640,
    height: 480,
  })),
} as unknown as HTMLCanvasElement;

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
  strokeText: vi.fn(),
  drawImage: vi.fn(),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  textAlign: "",
  textBaseline: "",
} as unknown as CanvasRenderingContext2D;

describe("Enemy Indicators", () => {
  let renderer: Renderer;
  const mockMap: MapDefinition = {
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
    ],
  };

  const mockGameState: GameState = createMockGameState({
    map: mockMap,
    enemies: [
      createMockEnemy({
        id: "enemy-0",
        pos: { x: 0.5, y: 0.5 },
        difficulty: 1,
        type: EnemyType.XenoMite,
      }),
      createMockEnemy({
        id: "enemy-1",
        pos: { x: 1.5, y: 0.5 },
        difficulty: 2,
        type: EnemyType.WarriorDrone,
      }),
    ],
    visibleCells: ["0,0", "1,0"],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new Renderer(mockCanvas);
    renderer.setCellSize(32);
  });

  it("should render letter indicators (A, B...) instead of difficulty numbers", () => {
    renderer.render(mockGameState);

    // Verify that difficulty numbers '1' and '2' are NOT rendered
    const fillTextCalls = (mockContext.fillText as any).mock.calls;
    const renderedTexts = fillTextCalls.map((call: any[]) => call[0]);

    expect(renderedTexts).not.toContain("1");
    expect(renderedTexts).not.toContain("2");

    // Verify that letter indicators 'A' and 'B' ARE rendered
    expect(renderedTexts).toContain("A");
    expect(renderedTexts).toContain("B");
  });

  it("should render numbers only when targeting", () => {
    renderer.setOverlay([
      { key: "1", label: "Target 1", pos: { x: 0.5, y: 0.5 } },
      { key: "2", label: "Target 2", pos: { x: 1.5, y: 0.5 } },
    ]);
    renderer.render(mockGameState);

    const fillTextCalls = (mockContext.fillText as any).mock.calls;
    const renderedTexts = fillTextCalls.map((call: any[]) => call[0]);

    // Should still have letter indicators
    expect(renderedTexts).toContain("A");
    expect(renderedTexts).toContain("B");

    // Should also have targeting numbers
    expect(renderedTexts).toContain("1");
    expect(renderedTexts).toContain("2");
  });
});
