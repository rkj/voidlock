import { describe, it, expect, vi } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";
import { ItemEffectService } from "@src/engine/managers/ItemEffectService";
import { DIRECTOR } from "@src/engine/config/GameConstants";

describe("Director & Campaign Scaling Regression (xrlq)", () => {
  it("Director: wave budget should include startingPoints base", () => {
    const spawnPoints = [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }];
    const prng = new PRNG(123);
    const enemies: any[] = [];
    const onSpawn = (e: any) => enemies.push(e);

    const director = new Director({
      spawnPoints,
      prng,
      onSpawn,
      itemEffectService: new ItemEffectService(),
      startingPoints: 3,
    });

    // 10% threat (turn 1): budget = floor(1 * 1.0) = 1
    director.update(DIRECTOR.TURN_DURATION_MS);
    expect(enemies.length).toBe(1);

    // 20% threat (turn 2): budget = floor(2 * 1.0) = 2
    director.update(DIRECTOR.TURN_DURATION_MS);
    expect(enemies.length).toBe(1 + 2); // 3 total
  });
});
