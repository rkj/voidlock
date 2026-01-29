import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapEntityLayer } from "@src/renderer/visuals/MapEntityLayer";
import { SharedRendererState } from "@src/renderer/visuals/SharedRendererState";
import { AssetManager } from "@src/renderer/visuals/AssetManager";
import { GameState, CellType, UnitStyle } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  src: string = "";
  complete: boolean = true;
}
vi.stubGlobal("Image", MockImage);

describe("MapEntityLayer", () => {
  let layer: MapEntityLayer;
  let sharedState: SharedRendererState;
  let mockContext: Record<string, ReturnType<typeof vi.fn>>;

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

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    // Currently this will FAIL because it DOES render it.
    // We expect 0 calls to fillRect at (5*32, 5*32)
    const fillRectCalls = mockContext.fillRect.mock.calls;
    const extractionPointFill = fillRectCalls.find(
      (args: unknown[]) => args[0] === 5 * 32 && args[1] === 5 * 32,
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

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const fillRectCalls = mockContext.fillRect.mock.calls;
    const extractionPointFill = fillRectCalls.find(
      (args: unknown[]) => args[0] === 5 * 32 && args[1] === 5 * 32,
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

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const fillRectCalls = mockContext.fillRect.mock.calls;
    const extractionPointFill = fillRectCalls.find(
      (args: unknown[]) => args[0] === 5 * 32 && args[1] === 5 * 32,
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
        debugOverlayEnabled: true,
      } as any,
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const fillRectCalls = mockContext.fillRect.mock.calls;
    const extractionPointFill = fillRectCalls.find(
      (args: unknown[]) => args[0] === 5 * 32 && args[1] === 5 * 32,
    );

    expect(extractionPointFill).toBeDefined();
  });

  it("should render Loot using LootStar icon when UnitStyle is TacticalIcons", () => {
    sharedState.unitStyle = UnitStyle.TacticalIcons;

    const assetManager = AssetManager.getInstance();
    const mockLootStar = new MockImage() as unknown as HTMLImageElement;
    (mockLootStar as any).id = "LootStar";
    assetManager.iconImages.LootStar = mockLootStar;

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

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const drawImageCalls = mockContext.drawImage.mock.calls;
    const lootStarDraw = drawImageCalls.find(
      (args: unknown[]) => args[0] === mockLootStar,
    );

    expect(lootStarDraw).toBeDefined();
  });

  it("should render Loot using Crate sprite when UnitStyle is Sprites", () => {
    sharedState.unitStyle = UnitStyle.Sprites;

    const assetManager = AssetManager.getInstance();
    const mockCrate = new MockImage() as unknown as HTMLImageElement;
    (mockCrate as any).id = "Crate";
    assetManager.iconImages.Crate = mockCrate;

    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [
          { x: 5, y: 5, type: CellType.Floor },
          { x: 6, y: 6, type: CellType.Floor },
        ],
      },
      loot: [
        { id: "loot-1", pos: { x: 5, y: 5 }, itemId: "something_else" },
        { id: "loot-2", pos: { x: 6, y: 6 }, itemId: "scrap_crate" },
      ],
      visibleCells: ["5,5", "6,6"],
      discoveredCells: [],
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const drawImageCalls = mockContext.drawImage.mock.calls;
    const crateDraws = drawImageCalls.filter(
      (args: unknown[]) => args[0] === mockCrate,
    );

    expect(crateDraws.length).toBe(2);
  });

  it("should render Objective using Objective icon when UnitStyle is TacticalIcons", () => {
    sharedState.unitStyle = UnitStyle.TacticalIcons;

    const assetManager = AssetManager.getInstance();
    const mockObjective = new MockImage() as unknown as HTMLImageElement;
    (mockObjective as any).id = "Objective";
    assetManager.iconImages.Objective = mockObjective;

    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
      },
      objectives: [
        {
          id: "obj-1",
          kind: "Recover",
          state: "Pending",
          targetCell: { x: 5, y: 5 },
          visible: true,
        },
      ],
      visibleCells: ["5,5"],
      discoveredCells: [],
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const drawImageCalls = mockContext.drawImage.mock.calls;
    const objectiveDraw = drawImageCalls.find(
      (args: unknown[]) => args[0] === mockObjective,
    );

    expect(objectiveDraw).toBeDefined();
  });

  it("should render Objective using ObjectiveDisk sprite when UnitStyle is Sprites", () => {
    sharedState.unitStyle = UnitStyle.Sprites;

    const assetManager = AssetManager.getInstance();
    const mockObjectiveDisk = new MockImage() as unknown as HTMLImageElement;
    (mockObjectiveDisk as any).id = "ObjectiveDisk";
    assetManager.iconImages.ObjectiveDisk = mockObjectiveDisk;

    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
      },
      objectives: [
        {
          id: "obj-1",
          kind: "Recover",
          state: "Pending",
          targetCell: { x: 5, y: 5 },
          visible: true,
        },
      ],
      visibleCells: ["5,5"],
      discoveredCells: [],
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const drawImageCalls = mockContext.drawImage.mock.calls;
    const objectiveDiskDraw = drawImageCalls.find(
      (args: unknown[]) => args[0] === mockObjectiveDisk,
    );

    expect(objectiveDiskDraw).toBeDefined();
  });
});
