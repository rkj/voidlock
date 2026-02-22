import { describe, it, expect } from "vitest";
import { UnitSpawner } from "@src/engine/managers/UnitSpawner";
import { PRNG } from "@src/shared/PRNG";
import { 
  MapDefinition, 
  CellType, 
  SquadConfig, 
  ArchetypeLibrary, 
  ItemLibrary 
} from "@src/shared/types";
import { UnitUtils } from "@src/shared/utils/UnitUtils";

describe("HP Mismatch Repro", () => {
  const prng = new PRNG(123);
  const spawner = new UnitSpawner(prng);
  const map: MapDefinition = {
    width: 10,
    height: 10,
    cells: [{ x: 0, y: 0, type: CellType.Floor }],
    spawnPoints: [{ x: 0, y: 0 }],
  };

  it("should calculate correct HP with light_recon armor", () => {
    // 1. Verify item bonus
    const armor = ItemLibrary["light_recon"];
    expect(armor).toBeDefined();
    expect(armor.hpBonus).toBe(50);

    // 2. Setup squad config with assault (base 100) and light_recon
    const squadConfig: SquadConfig = {
      soldiers: [
        {
          archetypeId: "assault",
          body: "light_recon",
          name: "Test Soldier",
        },
      ],
      inventory: {},
    };

    // 3. Verify UnitUtils calculation (used by UI)
    const effectiveStats = UnitUtils.calculateEffectiveStats(squadConfig.soldiers[0]);
    expect(effectiveStats.maxHp).toBe(150); // 100 + 50

    // 4. Verify UnitSpawner calculation (used by Engine)
    const units = spawner.spawnSquad(map, squadConfig);
    const unit = units[0];
    
    expect(unit.hp).toBe(150);
    expect(unit.maxHp).toBe(150);
    expect(unit.innateMaxHp).toBe(100); // Should be base
  });

  it("should calculate correct HP for CampaignSoldier with levels", () => {
    // Simulate a campaign soldier
    // Level 2 (+20 HP from level, if hpPerLevel is 20)
    // Base 100 -> 120 innate.
    // + light_recon (+50) -> 170 total.

    const soldierConfig = {
      archetypeId: "assault",
      maxHp: 120, // Simulating level up effect
      hp: 120,
      body: "light_recon",
      name: "Level 2 Soldier",
    };

    // UI Calculation
    const effectiveStats = UnitUtils.calculateEffectiveStats(soldierConfig);
    expect(effectiveStats.maxHp).toBe(170); // 120 + 50

    // Engine Calculation
    const units = spawner.spawnSquad(map, { soldiers: [soldierConfig], inventory: {} });
    const unit = units[0];

    expect(unit.maxHp).toBe(170);
    expect(unit.innateMaxHp).toBe(120);
  });
});
