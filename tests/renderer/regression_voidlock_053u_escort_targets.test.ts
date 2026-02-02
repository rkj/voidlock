import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState, CellType } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Regression voidlock-053u: Escort Target Validity", () => {
  let controller: MenuController;
  let mockClient: any;
  let mockState: GameState;

  beforeEach(() => {
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
    mockState = createMockGameState({
      t: 1000,
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 0, y: 0, type: CellType.Floor, roomId: "room-1" }],
      },
      units: [
        {
          id: "soldier-1",
          name: "Soldier 1",
          archetypeId: "assault",
          pos: { x: 0.5, y: 0.5 },
          state: UnitState.Idle,
          stats: { speed: 20 },
        } as any,
        {
          id: "vip-1",
          name: "The VIP",
          archetypeId: "vip",
          pos: { x: 1.5, y: 1.5 },
          state: UnitState.Idle,
          stats: { speed: 20 },
        } as any,
        {
          id: "carrier-1",
          name: "Artifact Carrier",
          archetypeId: "scout",
          carriedObjectiveId: "obj-1",
          pos: { x: 2.5, y: 2.5 },
          state: UnitState.Idle,
          stats: { speed: 20 },
        } as any,
      ],
      enemies: [],
      visibleCells: ["0,0", "1,1", "2,2"],
      discoveredCells: ["0,0", "1,1", "2,2"],
      objectives: [],
      loot: [],
      squadInventory: {},
      status: "Playing",
    });
  });

  it("should only show VIPs and Artifact Carriers in TARGET_SELECT for ESCORT", () => {
    // Navigate to Orders -> Escort
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("4", mockState); // Escort (assuming key 4 as per existing tests)

    const renderState = controller.getRenderableState(mockState);

    // Valid targets
    const vipOption = renderState.options.find((o) =>
      o.label.includes("The VIP"),
    );
    const carrierOption = renderState.options.find((o) =>
      o.label.includes("Artifact Carrier"),
    );

    // Invalid target
    const soldierOption = renderState.options.find((o) =>
      o.label.includes("Soldier 1"),
    );

    expect(vipOption).toBeDefined();
    expect(carrierOption).toBeDefined();
    expect(soldierOption).toBeUndefined();
  });

  it("should disable ESCORT option if no valid targets exist", () => {
    // Modify state to have no VIPs or carriers
    mockState.units = [
      {
        id: "soldier-1",
        name: "Soldier 1",
        archetypeId: "assault",
        pos: { x: 0.5, y: 0.5 },
        state: UnitState.Idle,
        stats: { speed: 20 },
      } as any,
      {
        id: "soldier-2",
        name: "Soldier 2",
        archetypeId: "assault",
        pos: { x: 1.5, y: 1.5 },
        state: UnitState.Idle,
        stats: { speed: 20 },
      } as any,
    ];

    // Navigate to Orders
    controller.handleMenuInput("1", mockState); // Orders

    const renderState = controller.getRenderableState(mockState);
    const escortOption = renderState.options.find((o) =>
      o.label.includes("Escort"),
    );

    expect(escortOption).toBeDefined();
    expect(escortOption?.disabled).toBe(true);
  });

  it("should show ALL soldiers for Scanner target select", () => {
    // Add a scanner to inventory
    mockState.squadInventory = { scanner: 1 };

    // Navigate to Use Item -> Scanner
    controller.handleMenuInput("3", mockState); // Use Item
    controller.handleMenuInput("1", mockState); // Select Scanner (assuming it's first)

    expect(controller.menuState).toBe("TARGET_SELECT");

    const renderState = controller.getRenderableState(mockState);

    // Should show all 3 units from the original mockState setup in beforeEach
    const soldierOption = renderState.options.find((o) =>
      o.label.includes("Soldier 1"),
    );
    const vipOption = renderState.options.find((o) =>
      o.label.includes("The VIP"),
    );
    const carrierOption = renderState.options.find((o) =>
      o.label.includes("Artifact Carrier"),
    );

    expect(soldierOption).toBeDefined();
    expect(vipOption).toBeDefined();
    expect(carrierOption).toBeDefined();
  });
});
