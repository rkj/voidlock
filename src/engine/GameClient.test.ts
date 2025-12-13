import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameClient } from './GameClient';
import { CommandType, MapDefinition } from '../shared/types';

// Mock Worker
const postMessageMock = vi.fn();
const terminateMock = vi.fn();

class MockWorker {
  onmessage: any = null;
  postMessage = postMessageMock;
  terminate = terminateMock;
}

vi.stubGlobal('Worker', MockWorker);

describe('GameClient', () => {
  let client: GameClient;
  const mockMap: MapDefinition = { width: 10, height: 10, cells: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new GameClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize and record seed/map', () => {
    const seed = 12345;
    client.init(seed, mockMap);

    expect(postMessageMock).toHaveBeenCalledWith({
      type: 'INIT',
      payload: { seed, map: mockMap }
    });

    const replay = client.getReplayData();
    expect(replay?.seed).toBe(seed);
    expect(replay?.map).toBe(mockMap);
    expect(replay?.commands).toEqual([]);
  });

  it('should record commands', () => {
    client.init(12345, mockMap);
    
    // Advance time
    vi.advanceTimersByTime(100);

    const cmd = { type: CommandType.MOVE_TO, unitIds: ['u1'], target: { x: 1, y: 1 } };
    client.sendCommand(cmd);

    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: 'COMMAND',
      payload: cmd
    });

    const replay = client.getReplayData();
    expect(replay?.commands.length).toBe(1);
    expect(replay?.commands[0].cmd).toEqual(cmd);
    expect(replay?.commands[0].t).toBe(100);
  });

  it('should replay commands', () => {
    // Setup replay data
    const replayData = {
      seed: 555,
      map: mockMap,
      commands: [
        { t: 100, cmd: { type: CommandType.MOVE_TO, unitIds: ['u1'], target: { x: 1, y: 1 } } },
        { t: 500, cmd: { type: CommandType.MOVE_TO, unitIds: ['u2'], target: { x: 2, y: 2 } } }
      ]
    };

    client.loadReplay(replayData);

    // Should verify init was called immediately
    expect(postMessageMock).toHaveBeenCalledWith({
      type: 'INIT',
      payload: { seed: 555, map: mockMap }
    });

    // Clear mocks to check subsequent calls
    postMessageMock.mockClear();

    // Advance time to 100ms
    vi.advanceTimersByTime(100);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      payload: replayData.commands[0].cmd
    });

    // Advance to 500ms (total)
    vi.advanceTimersByTime(400);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      payload: replayData.commands[1].cmd
    });
  });
});
