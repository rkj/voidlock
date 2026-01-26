import { describe, it, expect } from "vitest";
import { MapFactory } from "@src/engine/map/MapFactory";
import { MapDefinition, CellType } from "@src/shared/types";

describe("Regression voidlock-uvkz: Loot overlap with EnemySpawn", () => {
  it("should not place loot on an enemy spawn point even if they share a room", () => {
    // Create a 5x5 map with a single room
    const map: MapDefinition = {
      width: 5,
      height: 5,
      cells: [],
      walls: [],
      doors: [],
      spawnPoints: [{ id: "sp-1", pos: { x: 2, y: 2 }, radius: 1 }],
      squadSpawn: { x: 1, y: 1 },
      extraction: { x: 4, y: 4 },
      objectives: [
        { id: "obj-1", kind: "Recover", targetCell: { x: 3, y: 3 } },
      ],
    };

    // Fill all cells as a single room
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        map.cells.push({ x, y, type: CellType.Floor, roomId: "room-1" });
      }
    }

    // Attempt to place bonus loot.
    // In the bug scenario, EnemySpawn at (2, 2) fails to occupy room-1 in validator
    // because SquadSpawn already occupied it (or something else).
    // Wait, let's check the order in MapFactory.placeBonusLoot

    // SquadSpawn occupies room-1.
    // EnemySpawn (2, 2) tries to occupy room-1 -> FAILS because room-1 is SquadSpawn.
    // (2, 2) is NOT marked as occupied.
    // placeBonusLoot picks (2, 2) for loot.

    // We need enough bonus loot to surely hit (2, 2) if it's available.
    const bonusLootCount = 20;

    // We use a fixed seed for reproducibility
    const seed = 12345;

    // MapFactory.placeBonusLoot is private, but MapFactory.generate calls it.
    // We can't easily use MapFactory.generate with a custom map,
    // but we can use MapFactory.assemble if we wanted to be fancy,
    // or we can just call placeBonusLoot if we make it public (or cast to any).

    (MapFactory as any).placeBonusLoot(map, bonusLootCount, seed);

    expect(map.bonusLoot).toBeDefined();
    const overlaps = map.bonusLoot!.some((l) => l.x === 2 && l.y === 2);

    expect(overlaps, "Loot should not overlap with EnemySpawn at (2, 2)").toBe(
      false,
    );
  });
});
