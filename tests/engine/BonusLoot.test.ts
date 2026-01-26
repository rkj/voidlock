import { describe, it, expect } from "vitest";
import { CoreEngine } from "../../src/engine/CoreEngine";
import {
  MapDefinition,
  MissionType,
  SquadConfig,
  CellType,
  CommandType,
} from "../../src/shared/types";
import { MapFactory } from "../../src/engine/map/MapFactory";

describe("Bonus Loot (Scrap Crates)", () => {
  const squadConfig: SquadConfig = {
    soldiers: [{ id: "s1", archetypeId: "scout" }],
    inventory: {},
  };

  it("should place bonus loot in the map definition when requested", () => {
    const config = {
      seed: 12345,
      width: 16,
      height: 16,
      type: "DenseShip" as any,
      bonusLootCount: 3,
    };

    const map = MapFactory.generate(config);
    expect(map.bonusLoot).toBeDefined();
    expect(map.bonusLoot?.length).toBe(3);
  });

  it("should spawn scrap crates as loot items in the game state", () => {
    const map: MapDefinition = {
      width: 5,
      height: 5,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, roomId: "room-1" },
        { x: 1, y: 0, type: CellType.Floor, roomId: "room-1" },
        { x: 2, y: 0, type: CellType.Floor, roomId: "room-1" },
        { x: 3, y: 0, type: CellType.Floor, roomId: "room-1" },
        { x: 4, y: 0, type: CellType.Floor, roomId: "room-1" },
      ],
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 4, y: 0 },
      bonusLoot: [{ x: 2, y: 0 }],
    };

    const engine = new CoreEngine(map, 12345, squadConfig, false, false);
    const state = engine.getState();

    expect(state.loot).toBeDefined();
    expect(
      state.loot?.some(
        (l) => l.itemId === "scrap_crate" && l.pos.x === 2 && l.pos.y === 0,
      ),
    ).toBe(true);
  });

  it("should award scrap when a scrap crate is picked up and not add it to inventory", () => {
    const map: MapDefinition = {
      width: 5,
      height: 5,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, roomId: "room-1" },
        { x: 1, y: 0, type: CellType.Floor, roomId: "room-1" },
        { x: 2, y: 0, type: CellType.Floor, roomId: "room-1" },
        { x: 3, y: 0, type: CellType.Floor, roomId: "room-1" },
        { x: 4, y: 0, type: CellType.Floor, roomId: "room-1" },
      ],
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 4, y: 0 },
      bonusLoot: [{ x: 1, y: 0 }],
      objectives: [{ id: "o1", kind: "Recover", targetCell: { x: 3, y: 0 } }],
    };

    const engine = new CoreEngine(map, 12345, squadConfig, false, false);

    // Initial scrap should be 0 (stats.scrapGained)
    expect(engine.getState().stats.scrapGained).toBe(0);

    const loot = engine
      .getState()
      .loot!.find((l) => l.itemId === "scrap_crate")!;

    // Command unit to pick up loot
    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["s1"],
      lootId: loot.id,
    });

    // Run engine until pickup is complete
    for (let i = 0; i < 300; i++) {
      engine.update(16);
    }

    const finalState = engine.getState();
    expect(finalState.stats.scrapGained).toBe(25); // 25 * 1 multiplier
    expect(finalState.squadInventory["scrap_crate"]).toBeUndefined();
    expect(finalState.loot?.length).toBe(0);
  });

  it("should apply multiplier for scrap crates on Elite/Boss nodes", () => {
    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: [],
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 9, y: 9 },
      bonusLoot: [{ x: 1, y: 0 }],
    };
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.cells.push({ x, y, type: CellType.Floor, roomId: "room-1" });
      }
    }

    const engine = new CoreEngine(
      map,
      12345,
      squadConfig,
      false,
      false,
      MissionType.Default,
      false,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Elite",
    );

    // Ensure there is an objective
    expect(engine.getState().objectives.length).toBeGreaterThan(0);
    expect(engine.getState().status).toBe("Playing");

    const loot = engine
      .getState()
      .loot!.find((l) => l.itemId === "scrap_crate")!;
    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["s1"],
      lootId: loot.id,
    });

    for (let i = 0; i < 300; i++) {
      engine.update(16);
    }

    expect(engine.getState().stats.scrapGained).toBe(50); // 25 * 2 multiplier for Elite
  });
});
