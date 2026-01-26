import { describe, it } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import { MapGenerator } from "@src/engine/MapGenerator";
import * as fs from "fs";
import * as path from "path";

describe("Snapshot Updater", () => {
  it("should update NestedRoomsSpecific snapshots", () => {
    const generator = new TreeShipGenerator(1766029929040, 8, 8);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    const json = JSON.stringify(map, null, 2);

    const asciiPath = path.join(
      __dirname,
      "snapshots",
      "NestedRoomsSpecific.ascii.txt",
    );
    const jsonPath = path.join(
      __dirname,
      "snapshots",
      "NestedRoomsSpecific.json",
    );

    fs.writeFileSync(asciiPath, ascii);
    fs.writeFileSync(jsonPath, json);
  });
});
