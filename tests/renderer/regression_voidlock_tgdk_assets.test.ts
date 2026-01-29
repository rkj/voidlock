/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { AssetManager } from "@src/renderer/visuals/AssetManager";
import { Icons } from "@src/renderer/Icons";

describe("voidlock-tgdk: Asset Registration", () => {
  beforeEach(() => {
    // Reset singleton if possible, or just use the instance
    // AssetManager.instance is private, but we can access it via getInstance()
    // It loads icons in constructor
  });

  it("should have LootStar and ObjectiveDisk registered in Icons", () => {
    expect(Icons.LootStar).toBeDefined();
    expect(Icons.ObjectiveDisk).toBeDefined();
    expect(Icons.LootStar).toContain("assets/icons/loot_star.svg");
    expect(Icons.ObjectiveDisk).toContain("assets/data_disk.webp");
  });

  it("should load LootStar and ObjectiveDisk in AssetManager", () => {
    const assetManager = AssetManager.getInstance();
    expect(assetManager.iconImages["LootStar"]).toBeDefined();
    expect(assetManager.iconImages["ObjectiveDisk"]).toBeDefined();
    
    // Check if src is set correctly
    expect(assetManager.iconImages["LootStar"].src).toContain(Icons.LootStar);
    expect(assetManager.iconImages["ObjectiveDisk"].src).toContain(Icons.ObjectiveDisk);
  });
});
