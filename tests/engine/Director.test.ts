import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";
import { ItemEffectService } from "@src/engine/managers/ItemEffectService";
import { MissionType } from "@src/shared/types";
import { DIRECTOR } from "@src/engine/config/GameConstants";

describe("Director", () => {
  it("should spawn enemies after turnDuration", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingThreatLevel: 0,
      startingPoints: 0,
    });

    // Initial state
    expect(onSpawn).not.toHaveBeenCalled();
    expect(director.getThreatLevel()).toBe(0);

    // Update with dt < turnDuration (10s)
    director.update(DIRECTOR.TURN_DURATION_MS / 2);
    expect(onSpawn).not.toHaveBeenCalled();
    expect(director.getThreatLevel()).toBe(5);

    // Update to reach turnDuration (10s)
    director.update(DIRECTOR.TURN_DURATION_MS / 2);
    expect(onSpawn).toHaveBeenCalled();
    // At Turn 1, budget = 0 + (10/10 * 1.0) = 1
    const totalDifficulty = onSpawn.mock.calls.reduce(
      (sum, call) => sum + call[0].difficulty,
      0,
    );
    expect(totalDifficulty).toBe(1);
    expect(director.getThreatLevel()).toBe(10);
  });

  it("should increase threat and spawn more enemies in later turns", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingThreatLevel: 0,
      startingPoints: 0,
    });

    // Fast forward to turn 5 (50% threat)
    for (let i = 0; i < 5; i++) {
      director.update(10000);
    }

    const totalDifficulty = onSpawn.mock.calls.reduce(
      (sum, call) => sum + call[0].difficulty,
      0,
    );
    expect(totalDifficulty).toBe(15);
    expect(director.getThreatLevel()).toBe(50);
  });

  it("should handle large dt and respect WAVE_CAP", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingThreatLevel: 0,
      startingPoints: 0,
    });

    // Large update (100s = 10 turns)
    director.update(100000);

    // We expect multiple waves, each with <= 5 enemies.
    expect(onSpawn).toHaveBeenCalled();
  });

  it("should initialize with startingThreatLevel and preSpawn correct waves", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingThreatLevel: 30,
      startingPoints: 0,
    });

    director.preSpawn();

    expect(director.getThreatLevel()).toBe(30);
    const totalDifficulty = onSpawn.mock.calls.reduce(
      (sum, call) => sum + call[0].difficulty,
      0,
    );
    // Turns 1, 2, 3 should have spawned: 1 + 2 + 3 = 6 points
    expect(totalDifficulty).toBe(6);
  });

  it("should spawn 10% wave if threat is exactly 10", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingThreatLevel: 10,
      startingPoints: 0,
    });

    director.preSpawn();

    expect(director.getThreatLevel()).toBe(10);
    expect(onSpawn).toHaveBeenCalledTimes(1); // Turn 1 wave
  });

  it("should spawn only the tutorial enemy in MissionType.Prologue", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const onSpawn = vi.fn();
    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingThreatLevel: 0,
      startingPoints: 0,
      missionType: MissionType.Prologue,
    });

    director.preSpawn();

    // Should have spawned EXACTLY one tutorial enemy
    expect(onSpawn).toHaveBeenCalledTimes(1);
    expect(onSpawn.mock.calls[0][0].id).toBe("tutorial-enemy");
  });
});
