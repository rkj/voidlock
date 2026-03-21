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
    mockAssetManager = {
      iconImages: {
        LootStar: new MockImage(),
        Loot: new MockImage(),
        Crate: new MockImage(),
        Objective: new MockImage(),
        ObjectiveDisk: new MockImage(),
        Exit: new MockImage(),
        Spawn: new MockImage(),
      },
      unitSprites: {},
      enemySprites: {},
      getMiscSprite: vi.fn(),
      getIcon: vi.fn(),
    };

    sharedState = new SharedRendererState(mockTheme as any, mockAssetManager as any);
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

    const fillRectCalls = mockContext.fillRect.mock.calls;
    const extractionPointFill = fillRectCalls.find(
      (args: unknown[]) => args[0] === 5 * 32 && args[1] === 5 * 32,
    );

    expect(extractionPointFill).toBeUndefined();
  });

  it("should render extraction point if cell is discovered even if NOT visible", () => {
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

  it("should render extraction point if cell is visible even if NOT discovered", () => {
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
        debugSnapshots: false,
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
      (args: any[]) => args[0] === mockAssetManager.iconImages.LootStar,
    );

    expect(lootStarDraw).toBeDefined();
  });

  it("should render Loot using Crate or Loot sprite when UnitStyle is Sprites", () => {
    sharedState.unitStyle = UnitStyle.Sprites;

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
        { id: "l1", pos: { x: 5, y: 5 }, itemId: "scrap_crate" },
        { id: "l2", pos: { x: 6, y: 6 }, itemId: "medkit" },
      ],
      visibleCells: ["5,5", "6,6"],
      discoveredCells: [],
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const drawImageCalls = mockContext.drawImage.mock.calls;
    const crateDraws = drawImageCalls.filter(
      (args: any[]) => args[0] === mockAssetManager.iconImages.Loot,
    );
    const lootDraws = drawImageCalls.filter(
      (args: any[]) => args[0] === mockAssetManager.iconImages.Crate,
    );

    expect(crateDraws.length).toBe(1);
    expect(lootDraws.length).toBe(1);
  });

  it("should render Objective using Objective icon when UnitStyle is TacticalIcons", () => {
    sharedState.unitStyle = UnitStyle.TacticalIcons;

    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
      },
      objectives: [
        {
          id: "obj-1",
          type: "RecoverIntel",
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
      (args: any[]) => args[0] === mockAssetManager.iconImages.Objective,
    );

    expect(objectiveDraw).toBeDefined();
  });

  it("should render Objective using ObjectiveDisk sprite when UnitStyle is Sprites", () => {
    sharedState.unitStyle = UnitStyle.Sprites;

    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
      },
      objectives: [
        {
          id: "obj-1",
          type: "RecoverIntel",
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
      (args: any[]) => args[0] === mockAssetManager.iconImages.ObjectiveDisk,
    );

    expect(objectiveDiskDraw).toBeDefined();
  });

  it("should render Extraction using Waypoint sprite when UnitStyle is Sprites", () => {
    sharedState.unitStyle = UnitStyle.Sprites;

    const mockWaypoint = mockAssetManager.iconImages.Exit; // reuse for simplicity
    mockAssetManager.getMiscSprite.mockReturnValue(mockWaypoint);

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
      (args: any[]) => args[0] === mockWaypoint,
    );

    expect(waypointDraw).toBeDefined();
  });

  it("should render Extraction using Exit icon when UnitStyle is TacticalIcons", () => {
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

    const drawImageCalls = mockContext.drawImage.mock.calls;
    const exitDraw = drawImageCalls.find((args: any[]) => args[0] === mockAssetManager.iconImages.Exit);

    expect(exitDraw).toBeDefined();
  });

  it("should render SpawnPoint using Spawn sprite when UnitStyle is Sprites", () => {
    sharedState.unitStyle = UnitStyle.Sprites;

    const mockSpawn = mockAssetManager.iconImages.Spawn;
    mockAssetManager.getMiscSprite.mockReturnValue(mockSpawn);

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
      (args: any[]) => args[0] === mockSpawn,
    );

    expect(spawnDraw).toBeDefined();
  });

  it("should render SpawnPoint using Spawn icon when UnitStyle is TacticalIcons", () => {
    sharedState.unitStyle = UnitStyle.TacticalIcons;

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
      (args: any[]) => args[0] === mockAssetManager.iconImages.Spawn,
    );

    expect(spawnDraw).toBeDefined();
  });
});
