import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState, MissionType } from "@src/shared/types";

describe("MenuController - Extraction Discovery Regression", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    map: {
      width: 10,
      height: 10,
      cells: [],
      extraction: { x: 5, y: 5 },
    },
    units: [
      { id: "u1", pos: { x: 0.5, y: 0.5 }, state: UnitState.Idle } as any,
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
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should disable Extract option when extraction point is not discovered", () => {
    // Extraction point is at (5, 5), and discoveredCells is empty
    const state = controller.getRenderableState(mockState);
    const extractOption = state.options.find((o) =>
      o.label.includes("Extract"),
    );

    expect(extractOption).toBeDefined();
    // This is expected to fail initially (it will be false)
    expect(extractOption?.disabled).toBe(true);
  });

  it("should enable Extract option when extraction point is discovered", () => {
    const discoveredState = {
      ...mockState,
      discoveredCells: ["5,5"],
    };
    const state = controller.getRenderableState(discoveredState);
    const extractOption = state.options.find((o) =>
      o.label.includes("Extract"),
    );

    expect(extractOption).toBeDefined();
    expect(extractOption?.disabled).toBe(false);
  });

  it("should enable Extract option when extraction point is discovered via gridState bitset", () => {
    const gridState = new Uint8Array(100);
    const idx = 5 * 10 + 5;
    gridState[idx] = 2; // bit 1 = discovered

    const bitsetState = {
      ...mockState,
      gridState,
    };
    const state = controller.getRenderableState(bitsetState);
    const extractOption = state.options.find((o) =>
      o.label.includes("Extract"),
    );

    expect(extractOption).toBeDefined();
    expect(extractOption?.disabled).toBe(false);
  });

  it("should disable Extract option when extraction point is missing", () => {
    const noExtractionState = {
      ...mockState,
      map: {
        width: 10,
        height: 10,
        cells: [],
      },
    };
    const state = controller.getRenderableState(noExtractionState);
    const extractOption = state.options.find((o) =>
      o.label.includes("Extract"),
    );

    expect(extractOption).toBeDefined();
    expect(extractOption?.disabled).toBe(true);
  });
});
