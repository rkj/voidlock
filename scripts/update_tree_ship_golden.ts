import { TreeShipGenerator } from "./src/engine/generators/TreeShipGenerator";
import { MapGenerator } from "./src/engine/MapGenerator";
import * as fs from "fs";
import * as path from "path";

const seed = 785411;
const width = 16;
const height = 16;
const generator = new TreeShipGenerator(seed, width, height);
const generatedMap = generator.generate(4);
const generatedAscii = MapGenerator.toAscii(generatedMap);

const asciiGoldenPath = "./tests/data/goldens/broken_map_golden.txt";
fs.writeFileSync(asciiGoldenPath, generatedAscii);
console.log(`Updated golden file: ${asciiGoldenPath}`);
