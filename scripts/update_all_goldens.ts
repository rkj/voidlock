import { TreeShipGenerator } from "../src/engine/generators/TreeShipGenerator";
import { DenseShipGenerator } from "../src/engine/generators/DenseShipGenerator";
import { MapGenerator } from "../src/engine/MapGenerator";
import { MapGeneratorType, MissionType } from "../src/shared/types";
import * as fs from "fs";

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
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
