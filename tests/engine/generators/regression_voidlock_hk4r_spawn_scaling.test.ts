import { describe, it, expect } from "vitest";
import { calculateSpawnPoints } from "@src/shared/campaign_types";

describe("voidlock-hk4r: Spawn Point Scaling", () => {
  it("should calculate spawn points according to the formula: 1 + floor((size - 6) / 2)", () => {
    // 6x6 -> 1 + floor(0/2) = 1
    expect(calculateSpawnPoints(6)).toBe(1);
    
    // 7x7 -> 1 + floor(1/2) = 1
    expect(calculateSpawnPoints(7)).toBe(1);
    
    // 8x8 -> 1 + floor(2/2) = 2
    expect(calculateSpawnPoints(8)).toBe(2);
    
    // 9x9 -> 1 + floor(3/2) = 2
    expect(calculateSpawnPoints(9)).toBe(2);
    
    // 10x10 -> 1 + floor(4/2) = 3
    expect(calculateSpawnPoints(10)).toBe(3);
    
    // 11x11 -> 1 + floor(5/2) = 3
    expect(calculateSpawnPoints(11)).toBe(3);
    
    // 12x12 -> 1 + floor(6/2) = 4
    expect(calculateSpawnPoints(12)).toBe(4);
    
    // 14x14 -> 1 + floor(8/2) = 5 (Custom mission default)
    expect(calculateSpawnPoints(14)).toBe(5);
  });
});
