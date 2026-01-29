import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import {
  CommandType,
  GameState,
  UnitState,
  MissionType,
} from "@src/shared/types";

describe("Regression 7zx6 - Healing Flow", () => {
  let controller: MenuController;
  let mockClient: any;
  let mockState: GameState;

  beforeEach(() => {
    mockState = {
      t: 1000,
      seed: 12345,
      missionType: MissionType.Default,
      map: { width: 10, height: 10, cells: [] },
      units: [
        {
          id: "u1",
          pos: { x: 0.5, y: 0.5 },
          state: UnitState.Idle,
          hp: 50,
          maxHp: 100,
        } as any,
        {
          id: "u2",
          pos: { x: 1.5, y: 0.5 },
          state: UnitState.Idle,
          hp: 100,
          maxHp: 100,
        } as any,
      ],
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      objectives: [],
      loot: [],
      mines: [], turrets: [],
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
      squadInventory: { medkit: 1 },
    };
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should transition to UNIT_SELECT after selecting Medkit", () => {
    // 1. Action Select -> Use Item (3)
    controller.handleMenuInput("3", mockState);
    expect(controller.menuState).toBe("ITEM_SELECT");

    // 2. Item Select -> Medkit (1)
    controller.handleMenuInput("1", mockState);
    expect(controller.menuState).toBe("UNIT_SELECT");
    expect(controller.pendingItemId).toBe("medkit");

    // 3. Unit Select -> Unit 1 (1)
    controller.handleMenuInput("1", mockState);

    // SHOULD EXECUTE
    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.USE_ITEM,
        itemId: "medkit",
        unitIds: ["u1"],
      }),
    );

    // Should return to ACTION_SELECT
    expect(controller.menuState).toBe("ACTION_SELECT");
  });

  it("should NOT transition to UNIT_SELECT after selecting a target for Grenade", () => {
    mockState.squadInventory = { frag_grenade: 1 };
    mockState.enemies = [
      {
        id: "e1",
        pos: { x: 5.5, y: 5.5 },
        hp: 100,
        maxHp: 100,
        type: "warrior-drone",
      } as any,
    ];
    mockState.visibleCells = ["5,5"];
    mockState.discoveredCells = ["5,5"];
    mockState.map.cells.push({
      x: 5,
      y: 5,
      type: "Floor" as any,
      roomId: "room-1",
    } as any);

    // 1. Action Select -> Use Item (3)
    controller.handleMenuInput("3", mockState);
    expect(controller.menuState).toBe("ITEM_SELECT");

    // 2. Item Select -> Frag Grenade (1)
    controller.handleMenuInput("1", mockState);
    expect(controller.menuState).toBe("TARGET_SELECT");
    expect(controller.pendingItemId).toBe("frag_grenade");

    // 3. Target Select -> Room 1 (1)
    controller.handleMenuInput("1", mockState);

    // Should EXECUTE IMMEDIATELY for grenades now
    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.USE_ITEM,
        itemId: "frag_grenade",
        unitIds: [],
      }),
    );
    expect(controller.menuState).toBe("ACTION_SELECT");
  });

  it("should transition to UNIT_SELECT when clicking on canvas for healing items", () => {
    // 1. Action Select -> Use Item (3)
    controller.handleMenuInput("3", mockState);

    // 2. Item Select -> Medkit (1)
    controller.handleMenuInput("1", mockState);
    expect(controller.menuState).toBe("UNIT_SELECT");

    // 3. Canvas Click on Unit 1 (0,0) - In UNIT_SELECT state, canvas click should select the unit
    controller.handleCanvasClick({ x: 0, y: 0 }, mockState);

    // SHOULD EXECUTE
    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.USE_ITEM,
        itemId: "medkit",
        unitIds: ["u1"],
      }),
    );

    // Should return to ACTION_SELECT
    expect(controller.menuState).toBe("ACTION_SELECT");
  });
});
