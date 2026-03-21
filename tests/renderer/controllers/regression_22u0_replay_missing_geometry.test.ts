/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Renderer } from "@src/renderer/Renderer";
import { GameState, CellType, EngineMode, MissionType } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Replay Geometry Regression (voidlock-22u0)", () => {
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

  it("should initialize graph even if first state has empty cells but map data is present in structure", () => {
    const state = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [], // Empty cells in first tick (replay artifact)
        walls: [{ id: "w1", p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 }, type: "Wall" as any }],
      },
    });

    renderer.render(state);
    
    // Graph should be initialized from width/height/walls even if cells array is empty
    expect((renderer as any).sharedState.graph).not.toBeNull();
  });

  it("should initialize graph if cells are provided in the first state", () => {
    const state = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 0, y: 0, type: CellType.Floor }],
        walls: [{ id: "w1", p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 }, type: "Wall" as any }],
      },
    });

    renderer.render(state);
    expect((renderer as any).sharedState.graph).not.toBeNull();
  });
});
