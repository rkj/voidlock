import { describe, it } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import { MapGenerator } from "@src/engine/MapGenerator";
import * as fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(TEST_DIR, "../../data/map_16x16.txt");

describe("TreeShipGenerator Dump", () => {
  it("should dump a 16x16 map to ascii file", () => {
    const generator = new TreeShipGenerator(42, 16, 16);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, ascii);
  });
});
