import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapEntityLayer } from "@src/renderer/visuals/MapEntityLayer";
import { SharedRendererState } from "@src/renderer/visuals/SharedRendererState";
import { AssetManager } from "@src/renderer/visuals/AssetManager";
import {
  GameState,
  CellType,
  UnitStyle,
} from "@src/shared/types";
import {
  createMockGameState,
} from "@src/engine/tests/utils/MockFactory";

// Mock Image
class MockImage {
  onload: any = null;
  src: string = "";
  complete: boolean = true;
}
vi.stubGlobal("Image", MockImage);

describe("MapEntityLayer", () => {
  let layer: MapEntityLayer;
  let sharedState: SharedRendererState;
  let mockContext: any;

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
    };

    sharedState = new SharedRendererState();
    sharedState.cellSize = 32;
    layer = new MapEntityLayer(sharedState);
  });

  it("should NOT render extraction point when cell is NOT discovered and NOT visible", () => {
    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
        extraction: { x: 5, y: 5 },
      },
      visibleCells: [],
      discoveredCells: [],
    });

    layer.draw(mockContext, gameState);

    // Currently this will FAIL because it DOES render it.
    // We expect 0 calls to fillRect at (5*32, 5*32)
    const fillRectCalls = mockContext.fillRect.mock.calls;
    const extractionPointFill = fillRectCalls.find(
      (args: any[]) => args[0] === 5 * 32 && args[1] === 5 * 32
    );

    expect(extractionPointFill).toBeUndefined();
  });

  it("should render extraction point when cell IS discovered", () => {
    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
        extraction: { x: 5, y: 5 },
      },
      visibleCells: [],
      discoveredCells: ["5,5"],
    });

    layer.draw(mockContext, gameState);

    const fillRectCalls = mockContext.fillRect.mock.calls;
    const extractionPointFill = fillRectCalls.find(
      (args: any[]) => args[0] === 5 * 32 && args[1] === 5 * 32
    );

    expect(extractionPointFill).toBeDefined();
  });

  it("should render extraction point when cell IS visible", () => {
    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
        extraction: { x: 5, y: 5 },
      },
      visibleCells: ["5,5"],
      discoveredCells: [],
    });

    layer.draw(mockContext, gameState);

    const fillRectCalls = mockContext.fillRect.mock.calls;
    const extractionPointFill = fillRectCalls.find(
      (args: any[]) => args[0] === 5 * 32 && args[1] === 5 * 32
    );

    expect(extractionPointFill).toBeDefined();
  });

  it("should render extraction point if debug overlay is enabled even if NOT discovered", () => {
    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
        extraction: { x: 5, y: 5 },
      },
      visibleCells: [],
      discoveredCells: [],
      settings: {
        debugOverlayEnabled: true
      } as any
    });

    layer.draw(mockContext, gameState);

    const fillRectCalls = mockContext.fillRect.mock.calls;
    const extractionPointFill = fillRectCalls.find(
      (args: any[]) => args[0] === 5 * 32 && args[1] === 5 * 32
    );

    expect(extractionPointFill).toBeDefined();
  });

  it.skip("should NOT call drawImage for loot when UnitStyle is TacticalIcons, even if Crate icon exists", () => {
    sharedState.unitStyle = UnitStyle.TacticalIcons;
    
    // Ensure Crate icon exists in AssetManager
    const assetManager = AssetManager.getInstance();
    const mockCrateIcon = new MockImage() as any;
    assetManager.iconImages.Crate = mockCrateIcon;

    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
      },
      loot: [{ id: "loot-1", pos: { x: 5, y: 5 }, itemId: "scrap_crate" }],
      visibleCells: ["5,5"],
      discoveredCells: [],
    });

    layer.draw(mockContext, gameState);

    // Assert drawImage was NOT called for the Crate icon
    const drawImageCalls = mockContext.drawImage.mock.calls;
    const crateDraw = drawImageCalls.find(
      (args: any[]) => args[0] === mockCrateIcon
    );

    expect(crateDraw).toBeUndefined();
    
    // Should use fillRect instead
    // renderLoot uses fillRect if icon is missing, and we want it to use it for TacticalIcons too
    expect(mockContext.fillRect).toHaveBeenCalled();
  });
});
