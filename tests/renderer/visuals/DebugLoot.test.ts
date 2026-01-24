import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapEntityLayer } from "@src/renderer/visuals/MapEntityLayer";
import { SharedRendererState } from "@src/renderer/visuals/SharedRendererState";
import { GameState, UnitStyle } from "@src/shared/types";
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
  let mockContext: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      setLineDash: vi.fn(),
      drawImage: vi.fn(),
    };

    sharedState = new SharedRendererState();
    sharedState.unitStyle = UnitStyle.Sprites;
    sharedState.cellSize = 32;
    layer = new MapEntityLayer(sharedState);
  });

  it("should NOT render loot when NOT discovered, NOT visible, and debug is OFF", () => {
    const gameState: GameState = createMockGameState({
      loot: [{ id: "loot-1", pos: { x: 2, y: 2 }, itemId: "scrap_crate" }],
      visibleCells: [],
      discoveredCells: [],
      settings: {
        debugOverlayEnabled: false,
      } as any,
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    expect(mockContext.drawImage).not.toHaveBeenCalled();
    expect(mockContext.fillRect).not.toHaveBeenCalled();
  });

  it("should render loot when NOT discovered/visible but debug is ON", () => {
    const gameState: GameState = createMockGameState({
      loot: [{ id: "loot-1", pos: { x: 2, y: 2 }, itemId: "scrap_crate" }],
      visibleCells: [],
      discoveredCells: [],
      settings: {
        debugOverlayEnabled: true,
      } as any,
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    // It should call drawImage with the Crate icon
    expect(mockContext.drawImage).toHaveBeenCalled();
    const [icon] = mockContext.drawImage.mock.calls[0];
    expect(icon.src).toContain("crate.webp");
  });

  it("should render loot when visible even if debug is OFF", () => {
    const gameState: GameState = createMockGameState({
      loot: [{ id: "loot-1", pos: { x: 2, y: 2 }, itemId: "scrap_crate" }],
      visibleCells: ["2,2"],
      discoveredCells: [],
      settings: {
        debugOverlayEnabled: false,
      } as any,
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const called =
      mockContext.drawImage.mock.calls.length > 0 ||
      mockContext.fillRect.mock.calls.length > 0;
    expect(called).toBe(true);
  });

  it("should render loot when discovered even if debug is OFF", () => {
    const gameState: GameState = createMockGameState({
      loot: [{ id: "loot-1", pos: { x: 2, y: 2 }, itemId: "scrap_crate" }],
      visibleCells: [],
      discoveredCells: ["2,2"],
      settings: {
        debugOverlayEnabled: false,
      } as any,
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const called =
      mockContext.drawImage.mock.calls.length > 0 ||
      mockContext.fillRect.mock.calls.length > 0;
    expect(called).toBe(true);
  });

  it("should NOT render objective when NOT visible and debug is OFF", () => {
    const gameState: GameState = createMockGameState({
      objectives: [
        {
          id: "obj-1",
          kind: "Recover",
          state: "Pending",
          targetCell: { x: 3, y: 3 },
          visible: false,
        } as any,
      ],
      settings: {
        debugOverlayEnabled: false,
      } as any,
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    expect(mockContext.drawImage).not.toHaveBeenCalled();
    expect(mockContext.fillRect).not.toHaveBeenCalled();
  });

  it("should render objective when NOT visible but debug is ON", () => {
    const gameState: GameState = createMockGameState({
      objectives: [
        {
          id: "obj-1",
          kind: "Recover",
          state: "Pending",
          targetCell: { x: 3, y: 3 },
          visible: false,
        } as any,
      ],
      settings: {
        debugOverlayEnabled: true,
      } as any,
    });

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    expect(mockContext.drawImage).toHaveBeenCalled();
    const [icon] = mockContext.drawImage.mock.calls[0];
    expect(icon.src).toContain("objective.svg");
  });
});
