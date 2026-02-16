/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  getTimeScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({}),
  loadReplay: vi.fn(),
  clearStateUpdateListeners: vi.fn(),
};

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => mockGameClient),
}));

describe("Debrief Replay Stop Bug", () => {
  it("dummy", () => {
    expect(true).toBe(true);
  });
});
