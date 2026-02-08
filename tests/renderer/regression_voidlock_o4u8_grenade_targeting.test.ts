import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState, MissionType } from "@src/shared/types";

describe("MenuController Grenade Targeting Regression (voidlock-o4u8)", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    map: {
      width: 10,
      height: 10,
      cells: [
        { x: 0, y: 0, type: 1 } as any, // Floor
        { x: 1, y: 1, type: 1 } as any, // Floor
      ],
      extraction: { x: 9, y: 9 },
    },
    units: [
      { id: "u1", pos: { x: 0.5, y: 0.5 }, state: UnitState.Idle } as any,
    ],
    enemies: [
      { id: "e1", pos: { x: 1.5, y: 1.5 }, type: "Drone", hp: 100 } as any,
      { id: "e2", pos: { x: 2.5, y: 2.5 }, type: "Guard", hp: 100 } as any,
    ],
    visibleCells: ["0,0", "1,1", "2,2"], // Visible cells include enemy pos
    discoveredCells: ["0,0", "1,1", "2,2", "9,9"], // Extraction discovered
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
    squadInventory: {
      frag_grenade: 1,
    },
  };

  beforeEach(() => {
    mockClient = {
      applyCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should target enemies instead of extraction point when using frag grenade", () => {
    // 1. Select "Use Item" (Action 3)
    controller.handleMenuInput("3", mockState);
    expect(controller.menuState).toBe("ITEM_SELECT");

    // 2. Select "Frag Grenade" (Item 1)
    controller.handleMenuInput("1", mockState);
    expect(controller.menuState).toBe("TARGET_SELECT");

    // Check overlay options
    const renderableState = controller.getRenderableState(mockState);
    const options = renderableState.options;

    // BUG: Currently it likely includes "Extraction" (as it uses "CELL" type)
    // and might NOT include the enemy if it's not a POI.

    const extractionOption = options.find((o) =>
      o.label.includes("Extraction"),
    );
    const enemyOption1 = options.find((o) => o.label.includes("Drone"));
    const enemyOption2 = options.find((o) => o.label.includes("Guard"));

    expect(
      extractionOption,
      "Extraction should NOT be a target for grenades",
    ).toBeUndefined();
    expect(
      enemyOption1,
      "Enemy Drone SHOULD be a target for grenades",
    ).toBeDefined();
    expect(enemyOption1?.key).toBe("1");
    expect(
      enemyOption2,
      "Enemy Guard SHOULD be a target for grenades",
    ).toBeDefined();
    expect(enemyOption2?.key).toBe("2");
  });
});
