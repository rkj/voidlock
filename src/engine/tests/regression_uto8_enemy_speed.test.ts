import { describe, it, expect } from "vitest";
import {
  ArchetypeLibrary,
  EnemyArchetypeLibrary,
  EnemyType,
} from "@src/shared/types";

describe("Enemy Speed Tuning (uto8)", () => {
  it("should have enemy speeds that are 10-20% faster than corresponding soldier archetypes", () => {
    const assaultSpeed = ArchetypeLibrary.assault.speed;
    const medicSpeed = ArchetypeLibrary.medic.speed;
    const heavySpeed = ArchetypeLibrary.heavy.speed;

    const xenoMiteSpeed = EnemyArchetypeLibrary[EnemyType.XenoMite].speed;
    const warriorDroneSpeed =
      EnemyArchetypeLibrary[EnemyType.WarriorDrone].speed;
    const praetorianSpeed =
      EnemyArchetypeLibrary[EnemyType.PraetorianGuard].speed;
    const spitterSpeed = EnemyArchetypeLibrary[EnemyType.SpitterAcid].speed;

    // Xeno-Mite (Fast) vs Medic (Fastest soldier)
    // Target: 25 * 1.1 = 27.5 to 25 * 1.2 = 30
    expect(xenoMiteSpeed).toBeGreaterThanOrEqual(medicSpeed * 1.1);
    expect(xenoMiteSpeed).toBeLessThanOrEqual(medicSpeed * 1.2);

    // Warrior-Drone (Medium) vs Assault (Standard soldier)
    // Target: 20 * 1.1 = 22 to 20 * 1.2 = 24
    expect(warriorDroneSpeed).toBeGreaterThanOrEqual(assaultSpeed * 1.1);
    expect(warriorDroneSpeed).toBeLessThanOrEqual(assaultSpeed * 1.2);

    // Praetorian-Guard (Slow) vs Heavy (Slowest soldier)
    // Target: 15 * 1.1 = 16.5 to 15 * 1.2 = 18
    expect(praetorianSpeed).toBeGreaterThanOrEqual(heavySpeed * 1.1);
    expect(praetorianSpeed).toBeLessThanOrEqual(heavySpeed * 1.2);

    // Spitter-Acid (Ranged) - should also be in a reasonable range,
    // maybe compared to Medic since it needs to kite?
    // Target: 25 * 1.1 = 27.5 to 25 * 1.2 = 30
    expect(spitterSpeed).toBeGreaterThanOrEqual(medicSpeed * 1.1);
    expect(spitterSpeed).toBeLessThanOrEqual(medicSpeed * 1.2);
  });
});
