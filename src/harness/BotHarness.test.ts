import { describe, it, expect, vi } from 'vitest';
import { BotHarness } from './BotHarness';
import { GameClient } from '../engine/GameClient';
import { Bot } from './Bot';
import { GameState, CommandType } from '../shared/types';

// Mock GameClient
vi.mock('../engine/GameClient', () => {
  return {
    GameClient: vi.fn().mockImplementation(() => ({
      onStateUpdate: vi.fn(),
      sendCommand: vi.fn()
    }))
  };
});

describe('BotHarness', () => {
  it('should register listener and send commands', () => {
    const client = new GameClient();
    const bot: Bot = {
      act: vi.fn().mockReturnValue({ type: CommandType.MOVE_TO, unitIds: ['u1'], target: { x: 0, y: 0 } })
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
