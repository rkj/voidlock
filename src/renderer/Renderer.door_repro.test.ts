import { describe, it, expect, beforeEach, vi } from "vitest";
import { Renderer } from "./Renderer";
import {
  GameState,
  MapDefinition,
  CellType,
  UnitState,
  Door,
} from "../shared/types";
import { createMockGameState } from "../engine/tests/utils/MockFactory";

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
  drawImage: vi.fn(),
  textAlign: "",
  textBaseline: "",
} as unknown as CanvasRenderingContext2D;

describe("Renderer Door Drawing", () => {
  let renderer: Renderer;

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new Renderer(mockCanvas);
    renderer.setCellSize(100);
  });

  it("should draw a closed door exactly once", () => {
    const door: Door = {
      id: "d1",
      state: "Closed",
      orientation: "Vertical",
      segment: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      hp: 100,
      maxHp: 100,
      openDuration: 1,
    };

    const map: MapDefinition = {
      width: 2,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
      ],
      doors: [door],
    };

    const state: GameState = createMockGameState({
      t: 0,
      map,
      units: [],
      enemies: [],
      visibleCells: ["0,0", "1,0"],
      discoveredCells: ["0,0", "1,0"],
      objectives: [],
      threatLevel: 0,
      aliensKilled: 0,
      casualties: 0,
      status: "Playing",
    });

    renderer.render(state);

    // The new logic uses `stroke` for doors.
    // 2 for door halves (animated), 2 for struts.
    // Plus 1 for all walls.
    // Total 5.

    expect(mockContext.stroke).toHaveBeenCalledTimes(5);
  });
});
