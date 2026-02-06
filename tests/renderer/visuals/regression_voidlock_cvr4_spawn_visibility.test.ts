import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapEntityLayer } from "@src/renderer/visuals/MapEntityLayer";
import { SharedRendererState } from "@src/renderer/visuals/SharedRendererState";
import { GameState, CellType } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  src: string = "";
  complete: boolean = true;
}
vi.stubGlobal("Image", MockImage);

describe("Regression voidlock-cvr4: Spawn Point Visibility", () => {
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

  it("should NOT render spawn points if NOT discovered and NOT visible (FOW enforcement)", () => {
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

    // Check if anything was rendered at (5, 5)
    // In Standard mode it calls getMiscSprite("spawn") and then drawImage.
    // In Tactical mode it calls fillRect and then drawImage for the icon.

    const fillRectCalls = mockContext.fillRect.mock.calls;
    const drawImageCalls = mockContext.drawImage.mock.calls;

    const wasRendered =
      fillRectCalls.some((args) => args[0] === 5 * 32 && args[1] === 5 * 32) ||
      drawImageCalls.some((args) => args[1] === 5 * 32 && args[2] === 5 * 32);

    expect(wasRendered).toBe(false);
  });
});
