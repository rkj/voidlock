import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapRenderer } from "../../src/map-viewer/MapRenderer";
import { MapDefinition, CellType } from "../../src/shared/types";

// Mock Canvas and Context
const mockContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  setTransform: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  measureText: vi.fn(() => ({ width: 10 })),
};

const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  width: 0,
  height: 0,
} as unknown as HTMLCanvasElement;

const sampleMap: MapDefinition = {
  width: 2,
  height: 2,
  cells: [
    { x: 0, y: 0, type: CellType.Floor },
    { x: 1, y: 0, type: CellType.Floor },
    { x: 0, y: 1, type: CellType.Floor },
    { x: 1, y: 1, type: CellType.Floor },
  ],
  doors: [],
  spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
  extraction: { x: 1, y: 1 },
  objectives: [],
};

describe("MapRenderer", () => {
  let renderer: MapRenderer;

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new MapRenderer(mockCanvas);
  });

  it("should render a map", () => {
    renderer.render(sampleMap);
    expect(mockContext.clearRect).toHaveBeenCalled();
    // 4 floor cells + 1 extraction
    expect(mockContext.fillRect).toHaveBeenCalledTimes(5);
    expect(mockContext.fill).toHaveBeenCalledTimes(1); // 1 spawn point
  });

  it("should toggle coordinates", () => {
    renderer.setShowCoordinates(true);
    renderer.render(sampleMap);
    // Should call fillText for coordinates (4 cells) + extraction (1) + spawn (1)
    // So at least 6 calls.
    expect(mockContext.fillText).toHaveBeenCalled();

    vi.clearAllMocks();
    renderer.setShowCoordinates(false);
    renderer.render(sampleMap);
    // Should NOT call fillText for coordinates.
    // But it still calls it for 'E' and 'S'.
    // 2 calls expected.
    expect(mockContext.fillText).toHaveBeenCalledTimes(2);
  });

  it("should generate SVG", () => {
    renderer.setShowCoordinates(true);
    const svg = renderer.toSVG(sampleMap);
    expect(svg).toContain("<svg");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("<rect");
    expect(svg).toContain("<circle");
    expect(svg).toContain("<text");
    // Check for coordinate text
    expect(svg).toContain(">0,0</text>");
    expect(svg).toContain(">1,1</text>");
  });
});
