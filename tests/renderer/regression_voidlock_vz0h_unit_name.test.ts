import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import {
  GameState,
  UnitState,
  MissionType,
  AIProfile,
} from "@src/shared/types";

describe("MenuController - Unit Selection Names", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    map: { width: 10, height: 10, cells: [] },
    units: [
      {
        id: "soldier_172342343_1",
        name: "Recruit 5",
        tacticalNumber: 1,
        pos: { x: 0.5, y: 0.5 },
        state: UnitState.Idle,
        stats: { speed: 10 } as any,
        aiProfile: AIProfile.RUSH,
        commandQueue: [],
        kills: 0,
        damageDealt: 0,
        objectivesCompleted: 0,
        archetypeId: "assault",
      } as any,
    ],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [],
    loot: [],
    mines: [],
    turrets: [],
    stats: {
      threatLevel: 0,
      aliensKilled: 0,
      elitesKilled: 0,
      casualties: 0,
      scrapGained: 0,
    },
    status: "Playing",
    settings: {
      mode: "Simulation" as any,
      debugOverlayEnabled: false,
      debugSnapshots: false,
      losOverlayEnabled: false,
      timeScale: 1.0,
      isPaused: false,
      isSlowMotion: false,
      allowTacticalPause: true,
    },
    squadInventory: {},
  };

  beforeEach(() => {
    mockClient = {
      applyCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should display soldier name in UNIT_SELECT", () => {
    // Navigate to UNIT_SELECT via Hold command
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("5", mockState); // Hold

    const state = controller.getRenderableState(mockState);
    expect(state.title).toBe("Select Unit(s)");

    const unitOption = state.options.find((o) => o.key === "1");
    expect(unitOption).toBeDefined();
    expect(unitOption?.label).toBe("1. Recruit 5 (1)");
  });
});
