import { describe, it, expect, vi } from "vitest";

// Mock GameClient
vi.mock("../../engine/GameClient", () => {
  return {
    GameClient: vi.fn().mockImplementation((mapGeneratorFactory: any) => ({
      // Add mapGeneratorFactory to constructor
      onStateUpdate: vi.fn(),
      sendCommand: vi.fn(),
    })),
  };
});

import { BotHarness } from "../BotHarness";
import { GameClient } from "../../engine/GameClient";
import { Bot } from "../Bot";
import { GameState, CommandType } from "../../shared/types";
import { MapGenerator } from "../../engine/MapGenerator";

describe("BotHarness", () => {
  it("should register listener and send commands", () => {
    const client = new GameClient(() => new MapGenerator(123));
    const bot: Bot = {
      act: vi.fn().mockReturnValue({
        type: CommandType.MOVE_TO,
        unitIds: ["u1"],
        target: { x: 0, y: 0 },
      }),
    };

    const harness = new BotHarness(client, bot);
    harness.start();

    // Verify listener registered
    expect(client.onStateUpdate).toHaveBeenCalled();
    const callback = (client.onStateUpdate as any).mock.calls[0][0];

    // Trigger callback
    const state = {} as GameState;
    callback(state);

    // Verify bot acted and command sent
    expect(bot.act).toHaveBeenCalledWith(state);
    expect(client.sendCommand).toHaveBeenCalled();
  });
});
