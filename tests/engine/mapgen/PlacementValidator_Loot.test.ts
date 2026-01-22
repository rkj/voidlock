import { describe, it, expect } from "vitest";
import { MapValidator } from "@src/engine/map/MapValidator";
import { MapDefinition } from "@src/shared/types";
import * as fs from "fs";
import * as path from "path";

describe("PlacementValidator - Loot in Corridors", () => {
  it("should fail validation if bonus loot is in a corridor", () => {
    const goldenPath = path.join(
      process.cwd(),
      "tests/data/goldens/2026-01-13-7x7_item_in_corridor.json",
    );
    const goldenData = JSON.parse(fs.readFileSync(goldenPath, "utf-8"));

    const map: MapDefinition = goldenData.replayData.map;

    // Manually add bonus loot in a corridor (1, 2)
    map.bonusLoot = [{ x: 1, y: 2 }];

    const result = MapValidator.validate(map);

    // This is expected to FAIL (result.isValid will be true) until we implement the check for bonusLoot
    expect(
      result.isValid,
      "Map should be invalid due to bonus loot in corridor",
    ).toBe(false);
    expect(
      result.issues.some((issue) =>
        issue.includes("Loot at (1, 2) must be in a room, not a corridor"),
      ),
    ).toBe(true);
  });

  it("should fail validation if an objective is in a corridor", () => {
    const goldenPath = path.join(
      process.cwd(),
      "tests/data/goldens/2026-01-13-7x7_item_in_corridor.json",
    );
    const goldenData = JSON.parse(fs.readFileSync(goldenPath, "utf-8"));

    const map: MapDefinition = goldenData.replayData.map;

    // Add objective in a corridor (1, 2)
    if (!map.objectives) map.objectives = [];
    map.objectives.push({
      id: "elite-0",
      kind: "Recover",
      targetCell: { x: 1, y: 2 },
    });

    const result = MapValidator.validate(map);

    // This should PASS its isValid check (result.isValid is false) because MapValidator already checks objectives
    expect(
      result.isValid,
      "Map should be invalid due to objective in corridor",
    ).toBe(false);
    expect(
      result.issues.some((issue) =>
        issue.includes(
          "Objective elite-0 at (1, 2) must be in a room, not a corridor",
        ),
      ),
    ).toBe(true);
  });

  it("should fail validation if bonus loot overlaps with squad spawn", () => {
    const goldenPath = path.join(
      process.cwd(),
      "tests/data/goldens/2026-01-13-7x7_item_in_corridor.json",
    );
    const goldenData = JSON.parse(fs.readFileSync(goldenPath, "utf-8"));
    const map: MapDefinition = goldenData.replayData.map;

    // Squad spawn is at (1, 1) in this map (usually)
    // Let's find it to be sure
    const ss = map.squadSpawn || (map.squadSpawns && map.squadSpawns[0]);
    if (!ss) throw new Error("Map has no squad spawn");

    map.bonusLoot = [{ x: ss.x, y: ss.y }];

    const result = MapValidator.validate(map);
    expect(
      result.isValid,
      "Map should be invalid due to loot overlapping with squad spawn",
    ).toBe(false);
    expect(
      result.issues.some((issue) =>
        issue.includes("overlaps with Squad spawn"),
      ),
    ).toBe(true);
  });
});

import {
  PlacementValidator,
  OccupantType,
} from "@src/engine/generators/PlacementValidator";

describe("PlacementValidator - Corridor Ban Enforcement", () => {
  it("should refuse to occupy a cell if no roomId is provided", () => {
    const validator = new PlacementValidator();
    const result = validator.occupy({ x: 1, y: 1 }, OccupantType.Loot);
    expect(result).toBe(false);
  });

  it("should refuse to occupy a cell if it is a corridor", () => {
    const validator = new PlacementValidator();
    const result = validator.occupy(
      { x: 1, y: 1 },
      OccupantType.Loot,
      "corridor-1",
    );
    expect(result).toBe(false);
  });

  it("should allow occupying a cell if it is a room", () => {
    const validator = new PlacementValidator();
    const result = validator.occupy(
      { x: 1, y: 1 },
      OccupantType.Loot,
      "room-1",
    );
    expect(result).toBe(true);
  });
});
