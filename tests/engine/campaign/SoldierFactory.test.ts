import { describe, it, expect, vi } from "vitest";
import { SoldierFactory } from "../../../src/engine/campaign/SoldierFactory";
import { ArchetypeLibrary } from "../../../src/shared/types";
import { PRNG } from "../../../src/shared/PRNG";

describe("SoldierFactory", () => {
  it("should create a soldier with default values from archetype", () => {
    const archetypeId = "assault";
    const arch = ArchetypeLibrary[archetypeId];
    const soldier = SoldierFactory.createSoldier(archetypeId);

    expect(soldier.archetypeId).toBe(archetypeId);
    expect(soldier.hp).toBe(arch.baseHp);
    expect(soldier.maxHp).toBe(arch.baseHp);
    expect(soldier.soldierAim).toBe(arch.soldierAim);
    expect(soldier.level).toBe(1);
    expect(soldier.xp).toBe(0);
    expect(soldier.status).toBe("Healthy");
    expect(soldier.equipment.rightHand).toBe(arch.rightHand);
    expect(soldier.equipment.leftHand).toBe(arch.leftHand);
    expect(soldier.equipment.body).toBe(arch.body);
    expect(soldier.equipment.feet).toBe(arch.feet);
    expect(soldier.name).toBeDefined();
    expect(soldier.id).toBeDefined();
  });

  it("should use provided name and id", () => {
    const options = {
      id: "custom_id",
      name: "Custom Name",
    };
    const soldier = SoldierFactory.createSoldier("assault", [], options);

    expect(soldier.id).toBe(options.id);
    expect(soldier.name).toBe(options.name);
  });

  it("should use PRNG for random values if provided", () => {
    const prng = new PRNG(12345);
    const soldier = SoldierFactory.createSoldier("assault", [], { prng });

    const prng2 = new PRNG(12345);
    // Mimic factory logic: ID then Name
    // ID uses one prng.next() if not provided
    // Name uses one prng.next() via RosterUtils if not provided
    const expectedIdPart = Math.floor(prng2.next() * 1000);
    
    expect(soldier.id).toContain(expectedIdPart.toString());
  });

  it("should avoid duplicate names from existing roster", () => {
    // This is more of a test for RosterUtils, but good to verify integration
    const existingRoster = [
      { name: "John Doe" },
      // ... more soldiers if needed, but RosterUtils handles the logic
    ] as any;
    
    const soldier = SoldierFactory.createSoldier("assault", existingRoster);
    expect(soldier.name).not.toBe("John Doe");
  });

  it("should throw error for invalid archetype", () => {
    expect(() => SoldierFactory.createSoldier("invalid")).toThrow("Invalid archetype ID");
  });
});
