import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  MissionType,
} from "@src/shared/types";
import { SCRAP_REWARDS } from "@src/engine/config/GameConstants";

describe("Regression: VIP Death Scrap Reward", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: Array.from({ length: 25 }, (_, i) => ({
        x: i % 5,
        y: Math.floor(i / 5),
        type: CellType.Floor
    })),
    squadSpawn: { x: 0, y: 0 },
    extraction: { x: 4, y: 0 },
    objectives: [],
  };

  const squadConfig: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }, { archetypeId: "vip" }],
    inventory: {},
  };

  const getInternalState = (engine: CoreEngine) => (engine as any).state;

  it("should reward consolation scrap when VIP dies", () => {
    const engine = new CoreEngine(mockMap, 123, squadConfig, true, false, MissionType.EscortVIP);
    
    expect(engine.getState().stats.scrapGained).toBe(0);

    // Kill the VIP
    const vips = getInternalState(engine).units.filter((u: any) => u.archetypeId === "vip");
    vips.forEach((v: any) => v.hp = 0);

    engine.update(100);

    const state = engine.getState();
    expect(state.status).toBe("Lost");
    // BUG: Currently this might be 0 if the logic I saw in MissionManager is correct
    expect(state.stats.scrapGained).toBe(SCRAP_REWARDS.MISSION_LOSS_CONSOLATION);
  });
});
