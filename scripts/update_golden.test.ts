import { describe, it } from "vitest";
import { TreeShipGenerator } from "../src/engine/generators/TreeShipGenerator";
import * as fs from "fs";

describe("Update Golden", () => {
  it("should update the golden file", () => {
    const seed = 785411;
    const width = 16;
    const height = 16;
    const generator = new TreeShipGenerator(seed, width, height);
    const generatedMap = generator.generate(4);

    const jsonGoldenPath = "tests/data/goldens/broken_map_golden.json";
    fs.writeFileSync(jsonGoldenPath, JSON.stringify(generatedMap, null, 2));
    console.log(`Updated golden file: ${jsonGoldenPath}`);
  });
});
