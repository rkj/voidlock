import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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
  id: string = ""; // Helper to identify the image in tests
  constructor(id: string) {
    this.id = id;
  }
}
// @ts-ignore
global.Image = MockImage;

describe("MapEntityLayer Visual Styles", () => {
  let layer: MapEntityLayer;
  let sharedState: SharedRendererState;
  let mockContext: Record<string, ReturnType<typeof vi.fn>>;
  let assetManager: AssetManager;

  // Mock images
  const mockCrate = new MockImage("Crate") as unknown as HTMLImageElement;
  const mockLoot = new MockImage("Loot") as unknown as HTMLImageElement;
  const mockLootStar = new MockImage("LootStar") as unknown as HTMLImageElement;
  const mockObjective = new MockImage("Objective") as unknown as HTMLImageElement;
  const mockObjectiveDisk = new MockImage("ObjectiveDisk") as unknown as HTMLImageElement;

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

    // Setup AssetManager mocks
    assetManager = AssetManager.getInstance();
    assetManager.iconImages.Crate = mockCrate;
    assetManager.iconImages.Loot = mockLoot;
    assetManager.iconImages.LootStar = mockLootStar;
    assetManager.iconImages.Objective = mockObjective;
    assetManager.iconImages.ObjectiveDisk = mockObjectiveDisk;
  });
  
  afterEach(() => {
     vi.restoreAllMocks();
  });

  describe("Standard Mode", () => {
    beforeEach(() => {
      sharedState.unitStyle = UnitStyle.Standard;
    });

    it("should render 'scrap_crate' loot using Loot (Credits) asset", () => {
      const gameState = createMockGameState({
        map: { width: 10, height: 10, cells: [] },
        loot: [{ id: "l1", pos: { x: 5, y: 5 }, itemId: "scrap_crate" }],
        visibleCells: ["5,5"],
      });

      layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

      const calls = mockContext.drawImage.mock.calls;
      const drawnImage = calls.find(args => (args[0] as any).id === "Loot");
      const drawnCrate = calls.find(args => (args[0] as any).id === "Crate");

      expect(drawnImage).toBeDefined();
      expect(drawnCrate).toBeUndefined();
    });

    it("should render other loot using Crate asset", () => {
      const gameState = createMockGameState({
        map: { width: 10, height: 10, cells: [] },
        loot: [{ id: "l2", pos: { x: 6, y: 6 }, itemId: "medkit" }],
        visibleCells: ["6,6"],
      });

      layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

      const calls = mockContext.drawImage.mock.calls;
      const drawnCrate = calls.find(args => (args[0] as any).id === "Crate");
      const drawnLoot = calls.find(args => (args[0] as any).id === "Loot");

      expect(drawnCrate).toBeDefined();
      expect(drawnLoot).toBeUndefined();
    });

    it("should render Objectives using ObjectiveDisk asset", () => {
      const gameState = createMockGameState({
        map: { width: 10, height: 10, cells: [] },
        objectives: [{ 
            id: "obj1", 
            targetCell: { x: 7, y: 7 }, 
            state: "Pending", 
            visible: true,
            type: "Recover"
        }],
        visibleCells: ["7,7"],
      });

      layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

      const calls = mockContext.drawImage.mock.calls;
      const drawnDisk = calls.find(args => (args[0] as any).id === "ObjectiveDisk");
      const drawnTactical = calls.find(args => (args[0] as any).id === "Objective");

      expect(drawnDisk).toBeDefined();
      expect(drawnTactical).toBeUndefined();
    });
  });

  describe("Tactical Mode", () => {
    beforeEach(() => {
      sharedState.unitStyle = UnitStyle.TacticalIcons;
    });

    it("should render any loot using LootStar asset", () => {
       const gameState = createMockGameState({
        map: { width: 10, height: 10, cells: [] },
        loot: [
            { id: "l1", pos: { x: 5, y: 5 }, itemId: "scrap_crate" },
            { id: "l2", pos: { x: 6, y: 6 }, itemId: "medkit" }
        ],
        visibleCells: ["5,5", "6,6"],
      });

      layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

      const calls = mockContext.drawImage.mock.calls;
      // Should be called twice with LootStar
      const lootStarCalls = calls.filter(args => (args[0] as any).id === "LootStar");
      
      expect(lootStarCalls.length).toBe(2);
      
      // Should NOT use standard assets
      const drawnLoot = calls.find(args => (args[0] as any).id === "Loot");
      const drawnCrate = calls.find(args => (args[0] as any).id === "Crate");
      expect(drawnLoot).toBeUndefined();
      expect(drawnCrate).toBeUndefined();
    });

    it("should render Objectives using Objective icon", () => {
      const gameState = createMockGameState({
        map: { width: 10, height: 10, cells: [] },
        objectives: [{ 
            id: "obj1", 
            targetCell: { x: 7, y: 7 }, 
            state: "Pending", 
            visible: true,
            type: "Recover"
        }],
        visibleCells: ["7,7"],
      });

      layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

      const calls = mockContext.drawImage.mock.calls;
      const drawnTactical = calls.find(args => (args[0] as any).id === "Objective");
      const drawnDisk = calls.find(args => (args[0] as any).id === "ObjectiveDisk");

      expect(drawnTactical).toBeDefined();
      expect(drawnDisk).toBeUndefined();
    });
  });
});
