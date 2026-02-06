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
      moveTo: vi.fn(),
      lineTo: vi.fn(),
    };

    sharedState = new SharedRendererState();
    sharedState.cellSize = 32;
    layer = new MapEntityLayer(sharedState);
  });

  it("should NOT render extraction point if cell is NOT discovered and NOT visible", () => {
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

    // Now it SHOULD NOT render. We check for either fillRect or drawImage at (5*32, 5*32)
    const fillRectCalls = mockContext.fillRect.mock.calls;
    const drawImageCalls = mockContext.drawImage.mock.calls;

    const drewSomething =
      fillRectCalls.some(
        (args: unknown[]) => args[0] === 5 * 32 && args[1] === 5 * 32,
      ) ||
      drawImageCalls.some(
        (args: unknown[]) => args[1] === 5 * 32 && args[2] === 5 * 32,
      );

    expect(drewSomething).toBe(false);
  });

  it("should NOT render spawn point if cell is NOT discovered and NOT visible", () => {
    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
        spawnPoints: [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
      },
      visibleCells: [],
      discoveredCells: [],
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const fillRectCalls = mockContext.fillRect.mock.calls;
    const drawImageCalls = mockContext.drawImage.mock.calls;

    const drewSomething =
      fillRectCalls.some(
        (args: unknown[]) => args[0] === 5 * 32 && args[1] === 5 * 32,
      ) ||
      drawImageCalls.some(
        (args: unknown[]) => args[1] === 5 * 32 && args[2] === 5 * 32,
      );

    expect(drewSomething).toBe(false);
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

  it("should render Loot using Crate or Loot sprite when UnitStyle is Sprites", () => {
    sharedState.unitStyle = UnitStyle.Sprites;

    const assetManager = AssetManager.getInstance();
    const mockCrate = new MockImage() as unknown as HTMLImageElement;
    (mockCrate as any).id = "Crate";
    assetManager.iconImages.Crate = mockCrate;

    const mockLoot = new MockImage() as unknown as HTMLImageElement;
    (mockLoot as any).id = "Loot";
    assetManager.iconImages.Loot = mockLoot;

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
    const lootDraws = drawImageCalls.filter(
      (args: unknown[]) => args[0] === mockLoot,
    );

    expect(crateDraws.length).toBe(1);
    expect(lootDraws.length).toBe(1);
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

  it("should render Extraction using Waypoint sprite when UnitStyle is Sprites", () => {
    sharedState.unitStyle = UnitStyle.Sprites;

    const assetManager = AssetManager.getInstance();
    const mockWaypoint = new MockImage() as unknown as HTMLImageElement;
    (mockWaypoint as any).id = "Waypoint";
    // Setup the mock to return this for "waypoint" misc sprite
    vi.spyOn(assetManager, "getMiscSprite").mockImplementation((key) => {
      if (key === "waypoint") return mockWaypoint;
      return null;
    });

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

    const drawImageCalls = mockContext.drawImage.mock.calls;
    const waypointDraw = drawImageCalls.find(
      (args: unknown[]) => args[0] === mockWaypoint,
    );

    expect(waypointDraw).toBeDefined();
  });

  it("should render Extraction using high-contrast overlay when UnitStyle is TacticalIcons", () => {
    sharedState.unitStyle = UnitStyle.TacticalIcons;

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

    // Should use moveTo/lineTo for crosshair
    expect(mockContext.moveTo).toHaveBeenCalled();
    expect(mockContext.lineTo).toHaveBeenCalled();
    // Should still use strokeRect for border
    expect(mockContext.strokeRect).toHaveBeenCalled();
  });

  it("should render SpawnPoint using Spawn sprite when UnitStyle is Sprites", () => {
    sharedState.unitStyle = UnitStyle.Sprites;

    const assetManager = AssetManager.getInstance();
    const mockSpawnSprite = new MockImage() as unknown as HTMLImageElement;
    (mockSpawnSprite as any).id = "SpawnSprite";
    vi.spyOn(assetManager, "getMiscSprite").mockImplementation((key) => {
      if (key === "spawn") return mockSpawnSprite;
      return null;
    });

    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
        spawnPoints: [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
      },
      visibleCells: ["5,5"],
      discoveredCells: [],
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const drawImageCalls = mockContext.drawImage.mock.calls;
    const spawnDraw = drawImageCalls.find(
      (args: unknown[]) => args[0] === mockSpawnSprite,
    );

    expect(spawnDraw).toBeDefined();
  });

  it("should render SpawnPoint using Spawn icon when UnitStyle is TacticalIcons", () => {
    sharedState.unitStyle = UnitStyle.TacticalIcons;

    const assetManager = AssetManager.getInstance();
    const mockSpawnIcon = new MockImage() as unknown as HTMLImageElement;
    (mockSpawnIcon as any).id = "SpawnIcon";
    assetManager.iconImages.Spawn = mockSpawnIcon;

    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
        spawnPoints: [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
      },
      visibleCells: ["5,5"],
      discoveredCells: [],
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const drawImageCalls = mockContext.drawImage.mock.calls;
    const spawnDraw = drawImageCalls.find(
      (args: unknown[]) => args[0] === mockSpawnIcon,
    );

    expect(spawnDraw).toBeDefined();
  });
});
