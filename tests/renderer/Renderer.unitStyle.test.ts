// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Renderer } from "@src/renderer/Renderer";
import { GameState, EnemyType, UnitStyle, CellType, MissionType } from "@src/shared/types";
import { createMockUnit, createMockEnemy, createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Renderer - unitStyle", () => {
  let canvas: HTMLCanvasElement;
  let renderer: Renderer;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
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
      fillText: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      setLineDash: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      measureText: vi.fn(() => ({ width: 0 })),
    };

    canvas = {
      getContext: () => mockContext,
      width: 800,
      height: 600,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    } as any;

    const mockThemeManager = {
      getAssetUrl: vi.fn().mockReturnValue("mock-asset-url"),
      getColor: vi.fn().mockReturnValue("#ffffff"),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
    };
    const mockAssetManager = {
      iconImages: {},
      unitSprites: {},
      enemySprites: {},
      getUnitSprite: vi.fn(),
      getEnemySprite: vi.fn(),
      getMiscSprite: vi.fn(),
      getIcon: vi.fn(),
    };
    renderer = new Renderer({
      canvas: canvas,
      themeManager: mockThemeManager as any,
      assetManager: mockAssetManager as any
    });
  });

  const mockState: GameState = createMockGameState({
    t: 0,
    seed: 123,
    map: {
      width: 10,
      height: 10,
      cells: [{ x: 5, y: 5, type: CellType.Floor }],
    },
    units: [
      createMockUnit({
        id: "u1",
        pos: { x: 5.5, y: 5.5 },
        archetypeId: "assault",
      }),
    ],
    visibleCells: ["5,5"],
    discoveredCells: ["5,5"],
  });

  it("should draw circles for units in TacticalIcons style", () => {
    renderer.setUnitStyle(UnitStyle.TacticalIcons);
    renderer.render(mockState);

    // Should call arc() to draw the circle
    expect(mockContext.arc).toHaveBeenCalled();
  });

  it("should attempt to draw sprites for units in Sprites style", () => {
    renderer.setUnitStyle(UnitStyle.Sprites);
    renderer.render(mockState);

    // MapLayer still draws floor/walls, but UnitLayer should try drawImage
    // We expect UnitLayer to call getUnitSprite
    const sharedState = (renderer as any).sharedState;
    expect(sharedState.assets.getUnitSprite).toHaveBeenCalledWith("assault");
  });
});
