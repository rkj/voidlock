/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ThemeManager } from "../../src/renderer/ThemeManager";
import { ThemeConfig } from "../../src/shared/types";

describe("ThemeManager", () => {
  let theme: ThemeManager;

  beforeEach(() => {
    theme = ThemeManager.getInstance();
    // @ts-ignore - access private for reset
    theme.colorCache.clear();
    document.body.style.cssText = "";
    document.body.className = "";
  });

  it("should return fallback color when CSS variable is not defined", () => {
    const color = theme.getColor("--color-wall");
    expect(color).toBe("#00ffff"); // Fallback value
  });

  it("should return value from CSS variable if defined", () => {
    document.body.style.setProperty("--color-wall", "#123456");
    
    const color = theme.getColor("--color-wall");
    expect(color.trim()).toBe("#123456");
  });

  it("should cache resolved colors", () => {
    document.body.style.setProperty("--color-primary", "#00ff00");
    const spy = vi.spyOn(window, "getComputedStyle");

    theme.getColor("--color-primary");
    theme.getColor("--color-primary");

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("should clear cache when setting theme class", () => {
    document.documentElement.style.setProperty("--color-primary", "#00ff00");
    theme.getColor("--color-primary");
    
    theme.setTheme("dark");
    expect(document.body.className).toBe("theme-dark");

    const spy = vi.spyOn(window, "getComputedStyle");
    theme.getColor("--color-primary");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("should apply theme config", () => {
    const config: ThemeConfig = {
      id: "alien",
      name: "Alien Hive",
      colors: {
        "--color-wall": "#ff00ff",
        "--color-floor": "#220022",
        "color-primary": "#00ffff" // Test without -- prefix
      }
    };

    theme.applyTheme(config);

    expect(theme.getColor("--color-wall")).toBe("#ff00ff");
    expect(theme.getColor("--color-floor")).toBe("#220022");
    expect(theme.getColor("--color-primary")).toBe("#00ffff");
  });

  it("should have all new required variables in fallbacks", () => {
    const required = [
      "--color-black",
      "--color-white",
      "--color-los-soldier-fade",
      "--color-los-enemy-fade",
      "--color-objective-bg",
      "--color-spawn-bg",
      "--color-extraction-bg",
      "--color-success-muted"
    ];

    required.forEach(v => {
      const color = theme.getColor(v);
      expect(color).toBeDefined();
      if (v === "--color-black") {
        expect(color).toBe("#000000");
      } else {
        expect(color).not.toBe("#000000");
      }
    });
    
    expect(theme.getColor("--color-black")).toBe("#000000");
    expect(theme.getColor("--color-white")).toBe("#ffffff");
  });

  describe("Assets", () => {
    it("should load assets from assets.json", async () => {
      const mockAssets = {
        "floor": "assets/floor.webp",
        "wall": "assets/wall.webp"
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAssets)
      });

      await theme.init();

      expect(theme.getAssetUrl("floor")).toBe("/assets/floor.webp");
      expect(theme.getAssetUrl("wall")).toBe("/assets/wall.webp");
      expect(theme.getAssetUrl("unknown")).toBeNull();
    });

    it("should handle fetch error gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await theme.init();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load assets.json"),
        expect.any(Error)
      );
      expect(theme.getAssetUrl("any")).toBeNull();
      consoleSpy.mockRestore();
    });

    it("should handle non-ok response gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Not Found"
      });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await theme.init();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load assets.json"),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
