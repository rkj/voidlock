import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import {
  CommandType,
  GameState,
  UnitState,
  MissionType,
} from "@src/shared/types";

describe("MenuController Shift Queueing", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    map: { width: 10, height: 10, cells: [] },
    units: [{ id: "u1", state: UnitState.Idle } as any],
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

  it("should set queue: true when isShiftHeld is true", () => {
    controller.isShiftHeld = true;

    // Select Order: EXPLORE (1 -> 3)
    controller.handleMenuInput("1", mockState); // ORDERS
    controller.handleMenuInput("3", mockState); // EXPLORE
    controller.handleMenuInput("2", mockState); // ALL UNITS (u1=1, ALL=2)

    expect(mockClient.applyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.EXPLORE,
        queue: true,
      }),
    );
  });

  it("should set queue: false (or undefined/false) when isShiftHeld is false", () => {
    controller.isShiftHeld = false;

    // Select Order: EXPLORE (1 -> 3)
    controller.handleMenuInput("1", mockState); // ORDERS
    controller.handleMenuInput("3", mockState); // EXPLORE
    controller.handleMenuInput("2", mockState); // ALL UNITS (u1=1, ALL=2)

    const call = mockClient.applyCommand.mock.calls[0][0];
    expect(call.queue).toBeFalsy();
  });
});
