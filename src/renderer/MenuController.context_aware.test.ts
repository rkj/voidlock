import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "./MenuController";
import { CommandType, GameState, UnitState } from "../shared/types";

describe("MenuController Context Awareness", () => {
  let controller: MenuController;
  let mockClient: any;
  let mockState: GameState;

  beforeEach(() => {
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
    mockState = {
      t: 1000,
      map: { width: 10, height: 10, cells: [] },
      units: [{ id: "u1", state: UnitState.Idle } as any],
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      objectives: [],
      threatLevel: 0,
      aliensKilled: 0,
      casualties: 0,
      status: "Playing",
    };
  });

  it("should disable COLLECT when no visible objectives", () => {
    mockState.objectives = [];
    const renderState = controller.getRenderableState(mockState);
    const collectOption = renderState.options.find((o) =>
      o.label.includes("COLLECT"),
    );
    expect(collectOption?.disabled).toBe(true);
  });

  it("should enable COLLECT when visible objectives exist", () => {
    mockState.objectives = [
      {
        id: "obj1",
        kind: "Recover",
        state: "Pending",
        visible: true,
        targetCell: { x: 1, y: 1 },
      },
    ];
    const renderState = controller.getRenderableState(mockState);
    const collectOption = renderState.options.find((o) =>
      o.label.includes("COLLECT"),
    );
    expect(collectOption?.disabled).toBeFalsy();
  });

  it("should disable EXTRACT when no extraction point", () => {
    mockState.map.extraction = undefined;
    const renderState = controller.getRenderableState(mockState);
    const extractOption = renderState.options.find((o) =>
      o.label.includes("EXTRACT"),
    );
    expect(extractOption?.disabled).toBe(true);
  });

  it("should enable EXTRACT when extraction point exists", () => {
    mockState.map.extraction = { x: 5, y: 5 };
    const renderState = controller.getRenderableState(mockState);
    const extractOption = renderState.options.find((o) =>
      o.label.includes("EXTRACT"),
    );
    expect(extractOption?.disabled).toBeFalsy();
  });

  it("should not allow selecting disabled COLLECT option", () => {
    mockState.objectives = [];
    const renderState = controller.getRenderableState(mockState);
    const collectOption = renderState.options.find((o) =>
      o.label.includes("COLLECT"),
    );
    const key = parseInt(collectOption!.key);

    controller.handleMenuInput(key, mockState);

    // Should remain in ACTION_SELECT
    expect(controller.menuState).toBe("ACTION_SELECT");
  });
});
