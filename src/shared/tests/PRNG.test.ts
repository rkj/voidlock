import { describe, it, expect } from "vitest";
import { PRNG } from "@src/shared/PRNG";

describe("PRNG", () => {
  it("should be deterministic with the same seed", () => {
    const prng1 = new PRNG(12345);
    const prng2 = new PRNG(12345);

    for (let i = 0; i < 100; i++) {
      expect(prng1.next()).toBe(prng2.next());
    }
  });

  it("should produce different sequences with different seeds", () => {
    const prng1 = new PRNG(12345);
    const prng2 = new PRNG(54321);

    let identicalCount = 0;
    for (let i = 0; i < 100; i++) {
      if (prng1.next() === prng2.next()) {
        identicalCount++;
      }
    }
    // It's statistically possible but extremely unlikely to have many identical values
    expect(identicalCount).toBeLessThan(5);
  });

  it("should produce values within [0, 1)", () => {
    const prng = new PRNG(123);
    for (let i = 0; i < 1000; i++) {
      const val = prng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("should produce integers in range [min, max]", () => {
    const prng = new PRNG(456);
    const min = 5;
    const max = 10;
    const results = new Set<number>();

    for (let i = 0; i < 1000; i++) {
      const val = prng.nextInt(min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
      results.add(val);
    }

    // Verify all possible values were hit
    expect(results.size).toBe(max - min + 1);
  });

  it("should shuffle arrays deterministically", () => {
    const prng1 = new PRNG(789);
    const prng2 = new PRNG(789);

    const arr1 = [1, 2, 3, 4, 5];
    const arr2 = [1, 2, 3, 4, 5];

    prng1.shuffle(arr1);
    prng2.shuffle(arr2);

    expect(arr1).toEqual(arr2);
  });

  it("should shuffle arrays in-place", () => {
    const prng = new PRNG(101);
    const arr = [1, 2, 3];
    const result = prng.shuffle(arr);
    expect(result).toBe(arr);
  });
});
