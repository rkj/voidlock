import { describe, it, expect, vi } from "vitest";

// Mock GameClient
vi.mock("@src/engine/GameClient", () => {
  return {
    GameClient: vi.fn().mockImplementation((_mapGeneratorFactory: any) => ({
      // Add _mapGeneratorFactory to constructor
      onStateUpdate: vi.fn(),
  queryState: vi.fn(),
      applyCommand: vi.fn(),
    })),
  };
});

import { BotHarness } from "@src/harness/BotHarness";
import { GameClient } from "@src/engine/GameClient";
import { Bot } from "@src/harness/Bot";
import { GameState, CommandType } from "@src/shared/types";
import { MapGenerator } from "@src/engine/MapGenerator";

describe("BotHarness", () => {
  it("should register listener and send commands", () => {
    const client = new GameClient((config) => new MapGenerator(config));
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
    expect(client.applyCommand).toHaveBeenCalled();
  });
});
