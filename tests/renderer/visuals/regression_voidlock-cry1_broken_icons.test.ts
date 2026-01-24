// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapEntityLayer } from "@src/renderer/visuals/MapEntityLayer";
import { SharedRendererState } from "@src/renderer/visuals/SharedRendererState";
import { AssetManager } from "@src/renderer/visuals/AssetManager";
import { GameState, CellType, UnitStyle } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

// NOTE: This test reproduces a bug where icons are missing in TacticalIcons mode.
// It conflicts with an existing test in `tests/renderer/visuals/MapEntityLayer.test.ts`
// ("should NOT call drawImage for loot...") which enforces the current buggy behavior.
// When fixing this bug, update or remove the conflicting test case in MapEntityLayer.test.ts.

describe("MapEntityLayer Regression (voidlock-cry1)", () => {
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
    
    // Ensure AssetManager has icons
    const assetManager = AssetManager.getInstance();
    assetManager.iconImages.Exit = new Image();
    assetManager.iconImages.Crate = new Image();
    assetManager.iconImages.Spawn = new Image();
  });

  it("should use icons for extraction in TacticalIcons mode", () => {
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

    layer.draw(mockContext, gameState);

    // This is EXPECTED TO FAIL currently because icons are disabled in TacticalIcons mode
    expect(mockContext.drawImage).toHaveBeenCalled();
  });

  it("should use icons for loot in TacticalIcons mode", () => {
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

    layer.draw(mockContext, gameState);

    // This is EXPECTED TO FAIL currently
    expect(mockContext.drawImage).toHaveBeenCalled();
  });

  it("should use icons for spawn points in TacticalIcons mode", () => {
    sharedState.unitStyle = UnitStyle.TacticalIcons;

    const gameState: GameState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, type: CellType.Floor }],
        spawnPoints: [{ pos: { x: 5, y: 5 } }],
      },
      visibleCells: ["5,5"],
      discoveredCells: [],
    });

    layer.draw(mockContext, gameState);

    // This is EXPECTED TO FAIL currently
    expect(mockContext.drawImage).toHaveBeenCalled();
  });
});
