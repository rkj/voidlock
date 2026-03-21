/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnitStyle } from "@src/shared/types";
import { UnitStyleSelector } from "@src/renderer/components/UnitStyleSelector";
import { AssetManager } from "@src/renderer/visuals/AssetManager";

vi.mock("@src/renderer/visuals/AssetManager", () => {
  const mockInstance = {
    loadSprites: vi.fn(),
    getUnitSprite: vi.fn(),
    getEnemySprite: vi.fn(),
    getMiscSprite: vi.fn(),
    getIcon: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    AssetManager: mockConstructor,
  };
});

describe("UnitStyleSelector Asset Regression (voidlock-txq8)", () => {
  let container: HTMLElement;
  let mockAssets: any;
  let mockTheme: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="style-preview"></div>';
    container = document.getElementById("style-preview")!;
    mockAssets = new AssetManager({} as any);
    mockTheme = {
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#000"),
    };

    // Mock Canvas Context
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      drawImage: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      strokeText: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
    } as any);
  });

  it("should draw 'Loading...' when assets are loading", () => {
    const loadingSprite = {
      complete: false,
      onload: null,
      addEventListener: vi.fn(),
    };
    mockAssets.getUnitSprite.mockReturnValue(loadingSprite);
    mockAssets.getEnemySprite.mockReturnValue(loadingSprite);
    mockAssets.getIcon.mockReturnValue(loadingSprite);
    mockAssets.getMiscSprite.mockReturnValue(loadingSprite);

    const selector = new UnitStyleSelector(
      container,
      mockTheme,
      mockAssets,
      UnitStyle.Sprites,
      () => {},
    );
    selector.render();

    const spritesCanvas = container.querySelector(
      "#preview-canvas-sprites",
    ) as HTMLCanvasElement;
    const ctx = spritesCanvas.getContext("2d");

    expect(ctx?.fillText).toHaveBeenCalledWith(
      "Loading...",
      expect.any(Number),
      expect.any(Number),
    );
    expect(loadingSprite.addEventListener).toHaveBeenCalledWith(
      "load",
      expect.any(Function),
    );
  });

  it("should draw missing placeholder when assets are null", () => {
    mockAssets.getUnitSprite.mockReturnValue(null);
    mockAssets.getEnemySprite.mockReturnValue(null);
    mockAssets.getIcon.mockReturnValue(null);
    mockAssets.getMiscSprite.mockReturnValue(null);

    const selector = new UnitStyleSelector(
      container,
      mockTheme,
      mockAssets,
      UnitStyle.Sprites,
      () => {},
    );
    selector.render();

    const spritesCanvas = container.querySelector(
      "#preview-canvas-sprites",
    ) as HTMLCanvasElement;
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

    const selector = new UnitStyleSelector(
      container,
      mockTheme,
      mockAssets,
      UnitStyle.Sprites,
      () => {},
    );
    selector.render();

    const spritesCanvas = container.querySelector(
      "#preview-canvas-sprites",
    ) as HTMLCanvasElement;
    const ctx = spritesCanvas.getContext("2d");

    expect(ctx?.drawImage).toHaveBeenCalledTimes(4);
  });
});
