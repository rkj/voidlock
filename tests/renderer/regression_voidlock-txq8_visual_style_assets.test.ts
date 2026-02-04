/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnitStyle } from "@src/shared/types";
import { UnitStyleSelector } from "@src/renderer/components/UnitStyleSelector";
import { AssetManager } from "@src/renderer/visuals/AssetManager";
import { AppContext } from "@src/renderer/app/AppContext";

vi.mock("@src/renderer/visuals/AssetManager", () => ({
  AssetManager: {
    getInstance: vi.fn(),
  },
}));

describe("UnitStyleSelector - Asset Loading & Missing Placeholders (voidlock-txq8)", () => {
  let context: AppContext;
  let container: HTMLElement;
  let mockAssets: any;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    container.id = "unit-style-preview";
    document.body.appendChild(container);

    mockAssets = {
      getUnitSprite: vi.fn(),
      getEnemySprite: vi.fn(),
      getIcon: vi.fn(),
      getMiscSprite: vi.fn(),
    };
    (AssetManager.getInstance as any).mockReturnValue(mockAssets);

    context = {
      themeManager: {
        getColor: vi.fn().mockReturnValue("#000"),
      },
    } as any;

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      drawImage: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
    });
  });

  it("should draw '...' when assets are loading", () => {
    const loadingSprite = { complete: false, onload: null, addEventListener: vi.fn() };
    mockAssets.getUnitSprite.mockReturnValue(loadingSprite);
    mockAssets.getEnemySprite.mockReturnValue(loadingSprite);
    mockAssets.getIcon.mockReturnValue(loadingSprite);
    mockAssets.getMiscSprite.mockReturnValue(loadingSprite);

    const selector = new UnitStyleSelector(container, context, UnitStyle.Sprites, () => {});
    selector.render();

    const spritesCanvas = container.querySelector("#preview-canvas-sprites") as HTMLCanvasElement;
    const ctx = spritesCanvas.getContext("2d");

    expect(ctx?.fillText).toHaveBeenCalledWith("LOADING", expect.any(Number), expect.any(Number));
    expect(loadingSprite.addEventListener).toHaveBeenCalledWith("load", expect.any(Function));
  });

  it("should draw missing placeholder when assets are null", () => {
    mockAssets.getUnitSprite.mockReturnValue(null);
    mockAssets.getEnemySprite.mockReturnValue(null);
    mockAssets.getIcon.mockReturnValue(null);
    mockAssets.getMiscSprite.mockReturnValue(null);

    const selector = new UnitStyleSelector(container, context, UnitStyle.Sprites, () => {});
    selector.render();

    const spritesCanvas = container.querySelector("#preview-canvas-sprites") as HTMLCanvasElement;
    const ctx = spritesCanvas.getContext("2d");

    // Missing placeholder uses strokeRect and moveTo/lineTo for the X
    expect(ctx?.strokeStyle).toBe("#f0f"); // Magenta
    expect(ctx?.strokeRect).toHaveBeenCalled();
    expect(ctx?.moveTo).toHaveBeenCalled();
    expect(ctx?.lineTo).toHaveBeenCalled();
  });

  it("should draw sprites when they are complete", () => {
    const completeSprite = { complete: true, naturalWidth: 128 };
    mockAssets.getUnitSprite.mockReturnValue(completeSprite);
    mockAssets.getEnemySprite.mockReturnValue(completeSprite);
    mockAssets.getIcon.mockReturnValue(completeSprite);
    mockAssets.getMiscSprite.mockReturnValue(completeSprite);

    const selector = new UnitStyleSelector(container, context, UnitStyle.Sprites, () => {});
    selector.render();

    const spritesCanvas = container.querySelector("#preview-canvas-sprites") as HTMLCanvasElement;
    const ctx = spritesCanvas.getContext("2d");

    expect(ctx?.drawImage).toHaveBeenCalledTimes(4);
  });
});
