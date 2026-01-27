import { PRNG } from "@src/shared/PRNG";
import { describe, it, expect } from "vitest";
import { MissionManager } from "@src/engine/managers/MissionManager";
import {
  MapDefinition,
  CellType,
  MissionType,
  GameState,
} from "@src/shared/types";
import { EnemyManager } from "@src/engine/managers/EnemyManager";

describe("Regression voidlock-uvkz: Mission objective overlap", () => {
  it("should not place dynamic objectives on top of enemy spawn points", () => {
    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: [],
      walls: [],
      doors: [],
      spawnPoints: [{ id: "sp-1", pos: { x: 5, y: 5 }, radius: 1 }],
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 0, y: 0 },
      objectives: [],
    };

    // Fill all cells as floor
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.cells.push({ x, y, type: CellType.Floor, roomId: "room-1" });
      }
    }

    const enemyManager = new EnemyManager();
    const state: GameState = {
      status: "InProgress",
      tick: 0,
      units: [],
      enemies: [],
      loot: [],
      objectives: [],
      discoveredCells: [],
      stats: {
        kills: 0,
        casualties: 0,
        scrapGained: 0,
        timeElapsed: 0,
      },
      mapWidth: 10,
      mapHeight: 10,
    } as any;

    // We want to force it to pick (5, 5) if it doesn't know it's occupied.
    // Since it's shuffled, if we have enough candidates and few spawn points,
    // it might eventually hit it.
    // Or we can just mock candidates or use a specific seed.

    // Actually, MissionManager.setupMission picks candidates:
    // const candidates = floors.filter((c) => {
    //   const dx = c.x - extraction.x;
    //   const dy = c.y - extraction.y;
    //   return Math.sqrt(dx * dx + dy * dy) > map.width * 0.4;
    // });

    // extraction is at (0, 0). map.width is 10. distance > 4.
    // (5, 5) distance is sqrt(50) approx 7.07 > 4. So (5, 5) is a candidate.

    // Run setup multiple times with different seeds to see if we ever hit (5, 5)
    let overlapFound = false;
    for (let s = 0; s < 100; s++) {
      const p = new PRNG(s);
      const mm = new MissionManager(MissionType.RecoverIntel, p);
      const st: GameState = JSON.parse(JSON.stringify(state));
      mm.setupMission(st, map, enemyManager);

      if (
        st.objectives.some(
          (o) => o.targetCell?.x === 5 && o.targetCell?.y === 5,
        )
      ) {
        overlapFound = true;
        break;
      }
    }

    expect(
      overlapFound,
      "Dynamic objective should not overlap with EnemySpawn even across many runs",
    ).toBe(false);
  });
});
