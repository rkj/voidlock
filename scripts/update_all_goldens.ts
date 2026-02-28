import { TreeShipGenerator } from "../src/engine/generators/TreeShipGenerator";
import { DenseShipGenerator } from "../src/engine/generators/DenseShipGenerator";
import { MapGenerator } from "../src/engine/MapGenerator";
import { MapGeneratorType } from "../src/shared/types";
import * as fs from "fs";
import * as path from "path";

async function run() {
  // 1. DenseShipGenerator Strict
  {
    const generator = new DenseShipGenerator(1766029929040, 12, 12);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    const debug = generator.toDebugString();
    fs.writeFileSync("./tests/engine/generators/snapshots/DenseShipGenerator.strict.12x12.golden.txt", ascii);
    fs.writeFileSync("./tests/engine/generators/snapshots/DenseShipGenerator.strict.12x12.debug.txt", debug);
    console.log("Updated DenseShipGenerator Strict goldens");
  }

  // 2. TreeShipGenerator Repro
  {
    const seed = 1766029929040;
    const generator = new TreeShipGenerator(seed, 16, 16);
    const map = generator.generate(); // Default spawnPointCount = 1
    const ascii = MapGenerator.toAscii(map);
    fs.writeFileSync("./tests/engine/generators/snapshots/TreeShipGenerator.repro_x0f.16x16.golden.txt", ascii);
    console.log("Updated TreeShipGenerator Repro golden");
  }

  // 3. LOS RealMap
  {
    const seed = 1766364915449;
    const width = 6;
    const height = 6;
    const mapGen = new MapGenerator({
      seed,
      width,
      height,
      type: MapGeneratorType.DenseShip,
      spawnPointCount: 1,
    });
    const mapDef = mapGen.generate();
    const ascii = MapGenerator.toAscii(mapDef);
    fs.writeFileSync("./tests/engine/repro/snapshots/LOS_RealMap.golden.txt", ascii);
    console.log("Updated LOS RealMap golden");
  }

  // 4. TreeShip 12x12 Seed 42
  {
    const generator = new TreeShipGenerator(42, 12, 12);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    fs.writeFileSync("./tests/engine/generators/snapshots/TreeShipGenerator.12x12.txt", ascii);
    console.log("Updated TreeShipGenerator 12x12 Seed 42");
  }

  // 5. TreeShip 9x9 Seed 42
  {
    const generator = new TreeShipGenerator(42, 9, 9);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    fs.writeFileSync("./tests/engine/generators/snapshots/TreeShipGenerator.9x9.txt", ascii);
    console.log("Updated TreeShipGenerator 9x9 Seed 42");
  }

  // 6. TreeShip 7x7 Seed 42
  {
    const generator = new TreeShipGenerator(42, 7, 7);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    fs.writeFileSync("./tests/engine/generators/snapshots/TreeShipGenerator.7x7.txt", ascii);
    console.log("Updated TreeShipGenerator 7x7 Seed 42");
  }

  // 7. Broken Map Golden (Regression)
  {
    const seed = 785411;
    const generator = new TreeShipGenerator(seed, 16, 16);
    const map = generator.generate(4);
    const ascii = MapGenerator.toAscii(map);
    fs.writeFileSync("./tests/data/goldens/broken_map_golden.txt", ascii);
    fs.writeFileSync("./tests/data/goldens/broken_map_golden.json", JSON.stringify(map, null, 2));
    console.log("Updated Broken Map Golden (regression)");
  }

  // 8. DenseShipGenerator Golden (the one that was skipped)
  {
    const seed = 1766364915449;
    const generator = new DenseShipGenerator(seed, 12, 12);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    const debug = generator.toDetailedDebugString();
    fs.writeFileSync("./tests/engine/generators/snapshots/DenseShipGenerator.12x12.golden.txt", ascii);
    fs.writeFileSync("./tests/engine/generators/snapshots/DenseShipGenerator.12x12.debug.txt", debug);
    console.log("Updated DenseShipGenerator Golden");
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
