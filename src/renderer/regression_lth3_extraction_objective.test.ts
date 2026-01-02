import { describe, it, expect, beforeEach, vi } from "vitest";
import { Renderer } from "./Renderer";
import { GameState, MapDefinition, CellType, UnitState } from "../shared/types";
import { createMockGameState } from "../engine/tests/utils/MockFactory";
import { Icons } from "./Icons";

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
} as unknown as CanvasRenderingContext2D;

describe("Renderer Regression: LTH3 Redundant Objective Marker", () => {
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
    extraction: { x: 1, y: 1 },
  };

  const mockGameState: GameState = createMockGameState({
    t: 1000,
    map: mockMap,
    units: [],
    enemies: [],
    visibleCells: ["1,1"],
    discoveredCells: ["1,1"],
    objectives: [
      {
        id: "obj1",
        kind: "Recover",
        targetCell: { x: 1, y: 1 }, // SAME AS EXTRACTION
        state: "Pending",
        visible: true,
      },
      {
        id: "obj2",
        kind: "Recover",
        targetCell: { x: 0, y: 0 }, // DIFFERENT FROM EXTRACTION
        state: "Pending",
        visible: true,
      },
    ],
    stats: {
      threatLevel: 0,
      aliensKilled: 0,
      elitesKilled: 0,
      casualties: 0,
      scrapGained: 0,
    },
    status: "Playing",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new Renderer(mockCanvas);
    renderer.setCellSize(32);
  });

  it("should not render objective icon if it matches extraction coordinates", () => {
    renderer.render(mockGameState);

    // Get all drawImage calls
    const drawCalls = (mockContext.drawImage as any).mock.calls;

    // Find calls for Extraction icon (Exit)
    const exitCalls = drawCalls.filter(
      (call: any) => call[0].src === Icons.Exit,
    );
    expect(exitCalls.length).toBe(1);

    // Find calls for Objective icon
    const objectiveCalls = drawCalls.filter(
      (call: any) => call[0].src === Icons.Objective,
    );

    // CURRENT BEHAVIOR (The Bug): Both obj1 and obj2 are rendered.
    // We expect only obj2 to be rendered because obj1 is at the extraction point.

    // Verify that objectiveCalls only contains the one at (0, 0)
    // obj2 is at (0, 0), x=0, y=0
    // obj1 is at (1, 1), x=32, y=32

    const obj1Calls = objectiveCalls.filter((call: any) => {
      const x = call[1];
      const y = call[2];
      // The Renderer draws icons centered.
      // For cellSize=32, iconSize=32*0.6=19.2.
      // offset = (32 - 19.2) / 2 = 6.4.
      // x for (1, 1) should be 32 + 6.4 = 38.4
      return Math.abs(x - 38.4) < 0.1 && Math.abs(y - 38.4) < 0.1;
    });

    const obj2Calls = objectiveCalls.filter((call: any) => {
      const x = call[1];
      const y = call[2];
      // x for (0, 0) should be 0 + 6.4 = 6.4
      return Math.abs(x - 6.4) < 0.1 && Math.abs(y - 6.4) < 0.1;
    });

    expect(obj2Calls.length).toBe(1);

    // THIS IS THE FAILING EXPECTATION
    expect(obj1Calls.length).toBe(0);
  });
});
