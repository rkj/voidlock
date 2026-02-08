// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Renderer } from "@src/renderer/Renderer";
import {
  GameState,
  CellType,
  EngineMode,
} from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Renderer Replay Missing Map Repro (voidlock-0u4r)", () => {
  let mockContext: any;
  let mockCanvas: any;
  let renderer: Renderer;

  beforeEach(() => {
    mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      setLineDash: vi.fn(),
      fillText: vi.fn(),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
    };

    mockCanvas = {
      getContext: vi.fn(() => mockContext),
      width: 0,
      height: 0,
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        width: 640,
        height: 480,
      })),
    };

    renderer = new Renderer(mockCanvas);
  });

  it("should fail to render walls if the first state update has an empty map (the bug)", () => {
    // 1. Initial full state with map
    const fullState = createMockGameState({
      t: 0,
      map: {
        width: 2,
        height: 2,
        cells: [
          { x: 0, y: 0, type: CellType.Floor },
          { x: 1, y: 0, type: CellType.Floor },
          { x: 0, y: 1, type: CellType.Floor },
          { x: 1, y: 1, type: CellType.Floor },
        ],
        walls: [
          { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
        ],
      },
      settings: { mode: EngineMode.Replay },
    });

    // 2. Optimized state update with EMPTY map data (what we suspect happens in replay)
    const optimizedState = {
      ...fullState,
      t: 100,
      map: {
        ...fullState.map,
        cells: [],
        walls: [],
        boundaries: [],
      }
    } as any as GameState;

    // IF the renderer's first call is with optimizedState, it won't have the graph.
    renderer.render(optimizedState);

    // Verify: No walls were drawn because sharedState.graph is null
    // MapLayer.renderMap returns early if graph is null for walls.
    // Wait, let's see if moveTo was called for walls.
    const wallColor = "#00ffff"; // Default neon cyan wall color
    
    // We expect moveTo/lineTo NOT to be called for walls if the bug is present.
    // Actually, we should check if sharedState.graph is null.
    expect((renderer as any).sharedState.graph).toBeNull();
  });

  it("should render walls if the first state update is full", () => {
    const fullState = createMockGameState({
      t: 0,
      map: {
        width: 2,
        height: 2,
        cells: [
          { x: 0, y: 0, type: CellType.Floor },
          { x: 1, y: 0, type: CellType.Floor },
          { x: 0, y: 1, type: CellType.Floor },
          { x: 1, y: 1, type: CellType.Floor },
        ],
        walls: [
          { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
        ],
      },
      settings: { mode: EngineMode.Replay },
    });

    renderer.render(fullState);
    expect((renderer as any).sharedState.graph).not.toBeNull();
  });
});
