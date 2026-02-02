// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { MapGeneratorType } from "@src/shared/types";

describe("ConfigManager Defaults", () => {
  it("should have MapGeneratorType.DenseShip as default", () => {
    const defaults = ConfigManager.getDefault();
    expect(defaults.mapGeneratorType).toBe(MapGeneratorType.DenseShip);
  });
});
