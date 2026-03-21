import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapEntityLayer } from "@src/renderer/visuals/MapEntityLayer";
import { SharedRendererState } from "@src/renderer/visuals/SharedRendererState";
import { GameState, CellType, UnitStyle } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  src: string = "";
  complete: boolean = true;
}
vi.stubGlobal("Image", MockImage);

describe("DebugLoot Rendering", () => {
  let layer: MapEntityLayer;
  let sharedState: SharedRendererState;
  let mockContext: any;
  let mockAssetManager: any;

  beforeEach(() => {
    mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      setLineDash: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
    };

    const mockTheme = {
      getAssetUrl: vi.fn().mockReturnValue("mock-asset-url"),
      getColor: vi.fn().mockReturnValue("#ffffff"),
    };
    const mockIcon = {
      complete: true,
      naturalWidth: 100,
      naturalHeight: 100,
    };
    mockAssetManager = {
      iconImages: {
        Loot: mockIcon,
        Crate: mockIcon,
        ObjectiveDisk: mockIcon,
      },
      unitSprites: {},
      enemySprites: {},
      getMiscSprite: vi.fn().mockReturnValue(mockIcon),
      getIcon: vi.fn().mockReturnValue(mockIcon),
    };

    sharedState = new SharedRendererState(mockTheme as any, mockAssetManager as any);
    sharedState.unitStyle = UnitStyle.Sprites;
    sharedState.cellSize = 32;
    layer = new MapEntityLayer(sharedState);
  });

  it("should NOT render loot when NOT discovered/visible and debug is OFF", () => {
    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
      },
      loot: [{ id: "loot-1", pos: { x: 5, y: 5 }, itemId: "scrap_crate" }],
      visibleCells: [],
      discoveredCells: [],
      settings: {
        debugOverlayEnabled: false,
        debugSnapshots: false,
      } as any,
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    expect(mockContext.drawImage).not.toHaveBeenCalled();
    expect(mockContext.fillRect).not.toHaveBeenCalled();
  });

  it("should render loot when NOT discovered/visible but debug is ON", () => {
    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
      },
      loot: [{ id: "loot-1", pos: { x: 5, y: 5 }, itemId: "scrap_crate" }],
      visibleCells: [],
      discoveredCells: [],
      settings: {
        debugOverlayEnabled: true,
        debugSnapshots: false,
      } as any,
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    // Should render because debug is ON
    expect(mockContext.drawImage).toHaveBeenCalled();
  });

  it("should render objective when NOT visible but debug is ON", () => {
    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
      },
      objectives: [
        {
          id: "obj-1",
          targetCell: { x: 5, y: 5 },
          kind: "Recover",
          state: "Pending",
          visible: false,
        },
      ],
      visibleCells: [],
      discoveredCells: ["5,5"],
      settings: {
        debugOverlayEnabled: true,
        debugSnapshots: false,
      } as any,
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    expect(mockContext.drawImage).toHaveBeenCalled();
  });
});
