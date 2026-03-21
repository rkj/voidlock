/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Renderer } from "@src/renderer/Renderer";
import { GameState, CellType, EngineMode, MissionType } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Renderer Replay Missing Map Repro (voidlock-0u4r)", () => {
  let canvas: HTMLCanvasElement;
  let renderer: Renderer;
  let mockTheme: any;
  let mockAssets: any;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    
    // Mock getContext
    vi.spyOn(canvas, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      setLineDash: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        width: 640,
        height: 480,
      })),
    } as any);

    mockTheme = {
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#ffffff"),
    };
    mockAssets = {
      iconImages: {},
      unitSprites: {},
      enemySprites: {},
      getMiscSprite: vi.fn(),
    };

    renderer = new Renderer({
      canvas: canvas,
      themeManager: mockTheme as any,
      assetManager: mockAssets as any
    });
  });

  it("should fail to render walls if the first state update has an empty map (the bug)", () => {
    // 1. Initial full state with map
    const fullState = createMockGameState({
      map: {
        width: 5,
        height: 5,
        cells: [{ x: 0, y: 0, type: CellType.Floor }],
        walls: [{ id: "w1", p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 }, type: "Wall" as any }],
      },
    });
    renderer.render(fullState);
    expect((renderer as any).sharedState.graph).not.toBeNull();

    // 2. State update with MISSING map cells (the bug scenario)
    const emptyState: any = {
      t: 100,
      seed: 123,
      units: [],
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      map: {
        width: 5,
        height: 5,
        cells: [], // Empty cells in subsequent state
        walls: [],
      },
      settings: {
        debugOverlayEnabled: false,
        losOverlayEnabled: false,
      }
    };

    // If the bug is present, this might throw or clear the graph incorrectly
    renderer.render(emptyState);
    
    // Actually, the current Renderer.render checks if state.map exists.
    // If it's missing, it SHOULD NOT clear the previous graph.
    expect((renderer as any).sharedState.graph).not.toBeNull();
  });

  it("should render walls if the first state update is full", () => {
    const state = createMockGameState({
      map: {
        width: 2,
        height: 2,
        cells: [
          { x: 0, y: 0, type: CellType.Floor },
          { x: 1, y: 0, type: CellType.Floor },
        ],
        walls: [{ id: "w1", p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 }, type: "Wall" as any }],
      },
      discoveredCells: ["0,0", "1,0"],
    });

    renderer.render(state);
    
    const ctx = canvas.getContext("2d")!;
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
