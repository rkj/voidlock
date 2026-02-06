/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigManager } from "../../src/renderer/ConfigManager";
import { UnitStyle } from "../../src/shared/types";

describe("ConfigManager - unitStyle", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should have default unitStyle as TacticalIcons in loadGlobal", () => {
    const global = ConfigManager.loadGlobal();
    expect(global.unitStyle).toBe(UnitStyle.TacticalIcons);
  });

  it("should persist and load unitStyle via loadGlobal", () => {
    ConfigManager.saveGlobal({
      ...ConfigManager.loadGlobal(),
      unitStyle: UnitStyle.Sprites,
      themeId: "industrial",
    });

    const global = ConfigManager.loadGlobal();
    expect(global.unitStyle).toBe(UnitStyle.Sprites);
    expect(global.themeId).toBe("industrial");
  });

  it("should return default global if no global config exists", () => {
    const global = ConfigManager.loadGlobal();
    expect(global.unitStyle).toBe(UnitStyle.TacticalIcons);
    expect(global.themeId).toBe("default");
  });
});
