import { describe, it, expect } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  MissionType,
  ArchetypeLibrary,
} from "../../../shared/types";

describe("Escort VIP Mission", () => {
  const map: MapDefinition = {
    width: 5,
    height: 5,
    cells: Array.from({ length: 25 }, (_, i) => ({
      x: i % 5,
      y: Math.floor(i / 5),
      type: CellType.Floor,
    })),
    squadSpawn: { x: 0, y: 0 },
    extraction: { x: 4, y: 4 },
  };

  it("should spawn a VIP with 50% HP and no damage", () => {
    const engine = new CoreEngine(
      map,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
      MissionType.EscortVIP,
    );
    const state = engine.getState();
    const vip = state.units.find((u) => u.id.startsWith("vip-"));

    expect(vip).toBeDefined();
    expect(vip!.hp).toBe(ArchetypeLibrary["vip"].baseHp * 0.5);
    expect(vip!.maxHp).toBe(ArchetypeLibrary["vip"].baseHp);
    expect(vip!.stats.damage).toBe(0);
  });

  it("should win when VIP reaches extraction", () => {
    const squadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };
    const engine = new CoreEngine(
      map,
      123,
      squadConfig,
      true,
      false,
      MissionType.EscortVIP,
    );
    const vip = (engine as any).state.units.find((u: any) =>
      u.id.startsWith("vip-"),
    );

    // Move VIP to extraction
    vip.pos = { x: 4.5, y: 4.5 };
    vip.aiEnabled = true;

    // Update multiple times to trigger extraction channeling
    // Extraction takes 5 seconds (5000ms)
    // Plus some extra ticks for state transitions
    for (let i = 0; i < 70; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const vipFinal = state.units.find((u) => u.id.startsWith("vip-"));
    expect(vipFinal!.state).toBe(UnitState.Extracted);
    expect(state.status).toBe("Won");
  });

  it("should lose when VIP dies", () => {
    const engine = new CoreEngine(
      map,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
      MissionType.EscortVIP,
    );
    const vip = (engine as any).state.units.find((u: any) =>
      u.id.startsWith("vip-"),
    );

    // Kill VIP
    vip.hp = 0;
    engine.update(100);

    const state = engine.getState();
    expect(state.status).toBe("Lost");
  });

  it("should lose when all other units die even if VIP is alive", () => {
    const squadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };
    const engine = new CoreEngine(
      map,
      123,
      squadConfig,
      true,
      false,
      MissionType.EscortVIP,
    );

    const assault = (engine as any).state.units.find((u: any) =>
      u.id.startsWith("assault-"),
    );
    expect(assault).toBeDefined();

    // Kill assault unit
    assault.hp = 0;
    engine.update(100);

    const state = engine.getState();
    expect(state.status).toBe("Lost");
  });
});
