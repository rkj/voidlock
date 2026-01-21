import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandHandler } from "@src/engine/managers/CommandHandler";
import {
  CommandType,
  GameState,
  UnitState,
  ItemLibrary,
  UseItemCommand,
} from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Regression umyc: Global Item Targeting", () => {
  let handler: CommandHandler;
  let mockDirector: any;
  let mockUnitManager: any;
  let state: GameState;

  beforeEach(() => {
    mockDirector = {
      handleUseItem: vi.fn(),
    };
    mockUnitManager = {
      executeCommand: vi.fn(),
    };
    handler = new CommandHandler(mockUnitManager, mockDirector);
    state = createMockGameState({
      squadInventory: { medkit: 1, frag_grenade: 1, scanner: 1 },
      units: [{ id: "u1", hp: 50, maxHp: 100, pos: { x: 1, y: 1 } } as any],
    });
  });

  it("should handle Medkit with empty unitIds as global commander ability", () => {
    const cmd: UseItemCommand = {
      type: CommandType.USE_ITEM,
      unitIds: [],
      itemId: "medkit",
      targetUnitId: "u1",
    };

    handler.applyCommand(state, cmd);

    expect(state.squadInventory["medkit"]).toBe(0);
    expect(mockDirector.handleUseItem).toHaveBeenCalledWith(state, cmd);
    expect(mockUnitManager.executeCommand).not.toHaveBeenCalled();
  });

  it("should handle Grenade with empty unitIds as global commander ability", () => {
    const cmd: UseItemCommand = {
      type: CommandType.USE_ITEM,
      unitIds: [],
      itemId: "frag_grenade",
      target: { x: 5, y: 5 },
    };

    handler.applyCommand(state, cmd);

    expect(state.squadInventory["frag_grenade"]).toBe(0);
    expect(mockDirector.handleUseItem).toHaveBeenCalledWith(state, cmd);
    expect(mockUnitManager.executeCommand).not.toHaveBeenCalled();
  });

  it("should handle Scanner with empty unitIds as global commander ability", () => {
    const cmd: UseItemCommand = {
      type: CommandType.USE_ITEM,
      unitIds: [],
      itemId: "scanner",
      target: { x: 5, y: 5 },
    };

    handler.applyCommand(state, cmd);

    expect(state.squadInventory["scanner"]).toBe(0);
    expect(mockDirector.handleUseItem).toHaveBeenCalledWith(state, cmd);
    expect(mockUnitManager.executeCommand).not.toHaveBeenCalled();
  });

  it("should NOT handle non-global items with empty unitIds", () => {
    state.squadInventory["mine"] = 1;
    const cmd: UseItemCommand = {
      type: CommandType.USE_ITEM,
      unitIds: [],
      itemId: "mine",
      target: { x: 5, y: 5 },
    };

    handler.applyCommand(state, cmd);

    expect(state.squadInventory["mine"]).toBe(1); // Not deducted
    expect(mockDirector.handleUseItem).not.toHaveBeenCalled();
  });
});
