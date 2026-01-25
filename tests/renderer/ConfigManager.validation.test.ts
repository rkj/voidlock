/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigManager } from "@src/renderer/ConfigManager";

describe("ConfigManager Validation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should handle completely malformed JSON in LocalStorage", () => {
    localStorage.setItem("voidlock_custom_config", "not-json");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config = ConfigManager.loadCustom();

    expect(config).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("should handle partial/missing fields by using defaults", () => {
    const partialConfig = {
      mapWidth: 10,
      // missing mapHeight, unitStyle, etc.
    };
    localStorage.setItem(
      "voidlock_custom_config",
      JSON.stringify(partialConfig),
    );

    const config = ConfigManager.loadCustom();
    const defaults = ConfigManager.getDefault();

    expect(config).not.toBeNull();
    expect(config!.mapWidth).toBe(10);
    expect(config!.mapHeight).toBe(defaults.mapHeight);
    expect(config!.unitStyle).toBe(defaults.unitStyle);
    expect(config!.squadConfig).toEqual(defaults.squadConfig);
  });

  it("should handle invalid enum values by falling back to defaults", () => {
    const invalidConfig = {
      ...ConfigManager.getDefault(),
      unitStyle: "INVALID_STYLE",
      mapGeneratorType: "INVALID_GEN",
    };
    localStorage.setItem(
      "voidlock_custom_config",
      JSON.stringify(invalidConfig),
    );

    const config = ConfigManager.loadCustom();
    const defaults = ConfigManager.getDefault();

    expect(config!.unitStyle).toBe(defaults.unitStyle);
    expect(config!.mapGeneratorType).toBe(defaults.mapGeneratorType);
  });

  it("should handle invalid types for numeric fields", () => {
    const invalidConfig = {
      ...ConfigManager.getDefault(),
      mapWidth: "large",
      spawnPointCount: NaN,
    };
    localStorage.setItem(
      "voidlock_custom_config",
      JSON.stringify(invalidConfig),
    );

    const config = ConfigManager.loadCustom();
    const defaults = ConfigManager.getDefault();

    expect(config!.mapWidth).toBe(defaults.mapWidth);
    expect(config!.spawnPointCount).toBe(defaults.spawnPointCount);
  });
});
