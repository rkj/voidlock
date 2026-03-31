/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { AssetManager } from "@src/renderer/visuals/AssetManager";
import { Icons } from "@src/renderer/Icons";
import { vi } from "vitest";

describe("voidlock-tgdk: Asset Registration", () => {
  let assetManager: AssetManager;

  beforeEach(() => {
    const mockTheme = {
      getAssetUrl: vi.fn(),
      getColor: vi.fn(),
    };
    assetManager = new AssetManager(mockTheme as any);
    // AssetManager.setInstance(assetManager);
  });

  it("should have LootStar and ObjectiveDisk registered in Icons", () => {
    expect(Icons.LootStar).toBeDefined();
    expect(Icons.ObjectiveDisk).toBeDefined();
    expect(Icons.LootStar).toContain("assets/icons/loot_star.svg");
    expect(Icons.ObjectiveDisk).toContain("assets/data_disk.webp");
  });

  it("should load LootStar and ObjectiveDisk in AssetManager", () => {
    expect(assetManager.iconImages["LootStar"]).toBeDefined();
    expect(assetManager.iconImages["ObjectiveDisk"]).toBeDefined();

    // Check if src is set correctly
    expect(assetManager.iconImages["LootStar"].src).toContain(Icons.LootStar);
    expect(assetManager.iconImages["ObjectiveDisk"].src).toContain(
      Icons.ObjectiveDisk,
    );
  });
});
