import { describe, it, expect } from "vitest";
import { SpaceshipGenerator } from "@src/engine/generators/SpaceshipGenerator";
import { DenseShipGenerator } from "@src/engine/generators/DenseShipGenerator";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";

describe("Generator Spawn Point Limit", () => {
  const seed = 12345;
  const width = 16;
  const height = 16;

  it("SpaceshipGenerator should generate exactly 2 squad spawn points", () => {
    const gen = new SpaceshipGenerator(seed, width, height);
    const map = gen.generate(2);
    expect(map.squadSpawns?.length).toBe(2);
  });

  it("DenseShipGenerator should generate exactly 2 squad spawn points", () => {
    const gen = new DenseShipGenerator(seed, width, height);
    const map = gen.generate(2);
    expect(map.squadSpawns?.length).toBe(2);
  });

  it("TreeShipGenerator should generate exactly 2 squad spawn points", () => {
    const gen = new TreeShipGenerator(seed, width, height);
    const map = gen.generate(2);
    expect(map.squadSpawns?.length).toBe(2);
  });

  it("SpaceshipGenerator (tiny) should generate exactly 2 squad spawn points", () => {
    const gen = new SpaceshipGenerator(seed, 8, 8); // Tiny map
    const map = gen.generate(2);
    expect(map.squadSpawns?.length).toBe(2);
  });
});
