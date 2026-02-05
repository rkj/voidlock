import { describe, it, expect } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";
import { SpawnPoint, MapDefinition, CellType } from "@src/shared/types";
import { DIRECTOR } from "@src/engine/config/GameConstants";

describe("Director Spawning Logic (Regression 83pq)", () => {
  const mockSpawnPoints: SpawnPoint[] = [
    { id: "sp-1", pos: { x: 5, y: 5 }, radius: 1 },
  ];

  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: Array.from({ length: 100 }, (_, i) => ({
      x: i % 10,
      y: Math.floor(i / 10),
      type: CellType.Floor,
      roomId: i < 50 ? "room-1" : "room-2",
    })),
    walls: [],
    spawnPoints: mockSpawnPoints,
    squadSpawn: { x: 0, y: 0 },
    doors: [],
  };

  it("should enforce wave cap of 5 enemies", () => {
    let spawnCount = 0;
    const onSpawn = () => {
      spawnCount++;
    };
    const prng = new PRNG(123);

    // Turn 10 (threat 100)
    // Budget will be floor(10 * 1.0) = 10
    // Without wave cap, it would spawn 10 enemies (if they cost 1pt each)
    const director = new Director(
      mockSpawnPoints,
      prng,
      onSpawn,
      100, // startingThreatLevel = 100
      mockMap,
      20,
    );

    // Advance 10 seconds to trigger turn 11 wave
    director.update(DIRECTOR.TURN_DURATION_MS);

    // Turn 11 budget = 11. Wave cap = 5.
    expect(spawnCount).toBe(5);
  });

  it("should only spawn at 10% threat increments", () => {
    let spawnCount = 0;
    const onSpawn = () => {
      spawnCount++;
    };
    const prng = new PRNG(123);

    const director = new Director(
      mockSpawnPoints,
      prng,
      onSpawn,
      0,
      mockMap,
      20,
    );

    // 0 to 5% threat
    director.update(DIRECTOR.TURN_DURATION_MS / 2);
    expect(spawnCount).toBe(0);

    // 5 to 10% threat -> Trigger
    director.update(DIRECTOR.TURN_DURATION_MS / 2);
    expect(spawnCount).toBeGreaterThan(0);
    const firstWaveCount = spawnCount;

    // 10 to 15% threat
    director.update(DIRECTOR.TURN_DURATION_MS / 2);
    expect(spawnCount).toBe(firstWaveCount);

    // 15 to 20% threat -> Trigger
    director.update(DIRECTOR.TURN_DURATION_MS / 2);
    expect(spawnCount).toBeGreaterThan(firstWaveCount);
  });

  it("should not double-spawn at start (0% threat)", () => {
    let spawnCount = 0;
    const onSpawn = () => {
      spawnCount++;
    };
    const prng = new PRNG(123);

    // startingPoints = 20
    const director = new Director(
      mockSpawnPoints,
      prng,
      onSpawn,
      0,
      mockMap,
      20,
    );

    director.preSpawn();
    const initialCount = spawnCount;

    // threat is 0, turn is 0. spawnWave should not add more if it's called (e.g. by update 0)
    director.update(0);
    expect(spawnCount).toBe(initialCount);
  });
});
