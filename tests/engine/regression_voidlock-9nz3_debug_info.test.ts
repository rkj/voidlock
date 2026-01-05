import { describe, it, expect } from "vitest";
import { MapGenerator } from "@src/engine/MapGenerator";
import { MapGeneratorType } from "@src/shared/types";

describe("Regression voidlock-9nz3: Map Generator Name", () => {
  it("should set generatorName on generated map", () => {
    const generator = new MapGenerator(123);
    const map = generator.generate(16, 16, MapGeneratorType.TreeShip);

    expect(map.generatorName).toBe(MapGeneratorType.TreeShip);
  });

  it("should set generatorName on loaded map", () => {
    const generator = new MapGenerator(123);
    const map = generator.load({
      width: 10,
      height: 10,
      cells: [],
    });

    expect(map.generatorName).toBe(MapGeneratorType.Static);
  });
});
