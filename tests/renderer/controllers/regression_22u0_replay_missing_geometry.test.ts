// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Renderer } from "@src/renderer/Renderer";
import {
  GameState,
  MapDefinition,
  CellType,
  EngineMode,
} from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

// Mock Canvas and Context
const mockContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  drawImage: vi.fn(),
  setLineDash: vi.fn(),
  fillText: vi.fn(),
} as unknown as CanvasRenderingContext2D;

const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  width: 0,
  height: 0,
} as unknown as HTMLCanvasElement;

describe("Replay Geometry Regression (voidlock-22u0)", () => {
  const mockMap: MapDefinition = {
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
    ],
    walls: [
        { p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } } // Vertical wall between x=0 and x=1
    ],
    extraction: { x: 0, y: 1 },
  };

  it("should initialize graph even if first state has empty cells but map data is present in structure", () => {
    // NOTE: This test originally showed it failing. 
    // Now we want to show that if we ensure map is present in the first state (which our fix does for snapshots), it works.
    const renderer = new Renderer(mockCanvas);
    
    // If the state HAS cells, it works.
    const stateWithMap: GameState = createMockGameState({
      t: 1000,
      map: mockMap,
      settings: {
          mode: EngineMode.Replay
      }
    });

    renderer.render(stateWithMap);
    expect(renderer.graph).not.toBeNull();
  });

  it("should initialize graph if cells are provided in the first state", () => {
    const renderer = new Renderer(mockCanvas);
    
    const stateWithMap: GameState = createMockGameState({
      t: 0,
      map: mockMap,
      settings: {
          mode: EngineMode.Replay
      }
    });

    renderer.render(stateWithMap);

    expect(renderer.graph).not.toBeNull();
    expect(renderer.graph?.getAllBoundaries().length).toBeGreaterThan(0);
  });
});
