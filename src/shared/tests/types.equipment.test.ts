import { describe, it, expect } from "vitest";
import { WeaponLibrary, ItemLibrary } from "../types";

describe("Equipment Definitions", () => {
  it("should have all required Melee Weapons with costs", () => {
    const melee = ["combat_knife", "power_sword", "thunder_hammer"];
    melee.forEach((id) => {
      expect(WeaponLibrary[id], `Missing weapon: ${id}`).toBeDefined();
      expect(WeaponLibrary[id].type).toBe("Melee");
      expect(WeaponLibrary[id].cost).toBeGreaterThanOrEqual(0);
    });
  });

  it("should have all required Ranged Weapons with costs", () => {
    const ranged = ["pistol", "pulse_rifle", "shotgun", "flamer"];
    ranged.forEach((id) => {
      expect(WeaponLibrary[id], `Missing weapon: ${id}`).toBeDefined();
      expect(WeaponLibrary[id].type).toBe("Ranged");
      expect(WeaponLibrary[id].cost).toBeGreaterThanOrEqual(0);
    });
  });

  it("should have all required Armor with costs", () => {
    const armor = ["light_recon", "heavy_plate"];
    armor.forEach((id) => {
      expect(ItemLibrary[id], `Missing armor: ${id}`).toBeDefined();
      expect(ItemLibrary[id].cost).toBeGreaterThanOrEqual(0);
    });

    expect(ItemLibrary["light_recon"].speedBonus).toBeGreaterThan(0);
    expect(ItemLibrary["heavy_plate"].speedBonus).toBeLessThan(0);
  });

  it("should have all required Shoes with costs", () => {
    const shoes = ["combat_boots", "mag_lev_boots"];
    shoes.forEach((id) => {
      expect(ItemLibrary[id], `Missing shoes: ${id}`).toBeDefined();
      expect(ItemLibrary[id].cost).toBeGreaterThanOrEqual(0);
    });

    expect(ItemLibrary["mag_lev_boots"].speedBonus).toBeGreaterThan(
      ItemLibrary["combat_boots"].speedBonus || 0,
    );
  });

  it("should have all required Squad Items with costs", () => {
    const items = ["medkit", "frag_grenade", "scanner"];
    items.forEach((id) => {
      expect(ItemLibrary[id], `Missing item: ${id}`).toBeDefined();
      expect(ItemLibrary[id].type).toBe("Active");
      expect(ItemLibrary[id].cost).toBeGreaterThanOrEqual(0);
    });

    expect(ItemLibrary["scanner"].action).toBe("Scanner");
  });
});
