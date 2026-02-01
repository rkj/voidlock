import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MissionType,
  UnitState,
  CellType,
} from "@src/shared/types";


describe("Regression voidlock-9uzl: Escort mission failure when soldiers extract", () => {
  const map: any = {
    width: 5,
    height: 5,
    cells: [],
    spawnPoints: [{ id: "sp1", pos: { x: 1, y: 1 } }],
    extraction: { x: 4, y: 4 },
    doors: [],
  };

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      map.cells.push({ x, y, type: CellType.Floor, roomId: "room-1" });
    }
  }

  const squadConfig: any = {
    soldiers: [
      { id: "s1", name: "Soldier 1", archetypeId: "scout", tacticalNumber: 1, hp: 100, maxHp: 100, speed: 1, accuracy: 80, damage: 10, fireRate: 1000, attackRange: 5, visibilityRange: 10 },
    ],
  };

  it("should not lose if a soldier extracts but VIP is still active", () => {
    const engine = new CoreEngine(
      map,
      12345,
      squadConfig,
      false, // agentControlEnabled
      false, // debugOverlayEnabled
      MissionType.EscortVIP,
    );

    const state = engine.getState();
    const vips = state.units.filter(u => u.archetypeId === "vip");
    const soldiers = state.units.filter(u => u.archetypeId !== "vip");

    expect(vips.length).toBe(1);
    expect(soldiers.length).toBe(1);
    expect(state.status).toBe("Playing");

    // Extract the soldier
    soldiers[0].state = UnitState.Extracted;

    // Update the engine
    engine.update(16);

    const newState = engine.getState();
    expect(newState.status).toBe("Playing"); // Should still be playing because VIP is alive
  });

  it("should lose if the VIP dies", () => {
    const engine = new CoreEngine(
      map,
      12345,
      squadConfig,
      false,
      false,
      MissionType.EscortVIP,
    );

    const state = engine.getState();
    const vip = state.units.find(u => u.archetypeId === "vip")!;
    
    vip.hp = 0;
    engine.update(16);

    expect(engine.getState().status).toBe("Lost");
  });
});
