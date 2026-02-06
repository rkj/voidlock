// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, MissionType } from "@src/shared/types";

describe("HUDManager: Pause Constraints", () => {
  let hud: HUDManager;
  let mockMenuController: any;
  let onUnitClick: any;
  let onAbortMission: any;
  let onMenuInput: any;
  let onCopyWorldState: any;

  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    status: "Playing",
    settings: {
      mode: "Simulation" as any,
      debugOverlayEnabled: false, debugSnapshots: false,
      losOverlayEnabled: false,
      timeScale: 1.0,
      isPaused: false,
      isSlowMotion: false,
      allowTacticalPause: true,
    },
    squadInventory: {},
    stats: {
      threatLevel: 25,
      aliensKilled: 0,
      elitesKilled: 0,
      casualties: 0,
      scrapGained: 0,
    },
    map: { width: 10, height: 10, cells: [] },
    units: [],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    loot: [],
    mines: [],
    turrets: [],
    objectives: [],
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="top-bar">
        <div id="game-status"></div>
        <div id="version-display"></div>
        <div id="menu-version"></div>
        <div id="top-threat-fill"></div>
        <div id="top-threat-value"></div>
        <div id="speed-control">
          <input type="range" id="game-speed" min="0" max="100" value="50">
          <span id="speed-value">1.0x</span>
        </div>
      </div>
      <div id="right-panel"></div>
      <div id="soldier-list"></div>
    `;

    mockMenuController = {
      getRenderableState: vi.fn(() => ({
        title: "ACTIONS",
        options: [],
      })),
    };
    onUnitClick = vi.fn();
    onAbortMission = vi.fn();
    onMenuInput = vi.fn();
    onCopyWorldState = vi.fn();

    hud = new HUDManager(
      mockMenuController,
      onUnitClick,
      onAbortMission,
      onMenuInput,
      onCopyWorldState,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
  });

  it("should set slider min to 0 when allowTacticalPause is true", () => {
    const state = {
      ...mockState,
      settings: { ...mockState.settings, allowTacticalPause: true },
    };

    hud.update(state, null);

    const slider = document.getElementById("game-speed") as HTMLInputElement;
    expect(slider.min).toBe("0");
  });

  it("should set slider min to 50 when allowTacticalPause is false", () => {
    const state = {
      ...mockState,
      settings: { ...mockState.settings, allowTacticalPause: false },
    };

    hud.update(state, null);

    const slider = document.getElementById("game-speed") as HTMLInputElement;
    expect(slider.min).toBe("50");
  });

  it("should show '0.0x (Paused)' when allowTacticalPause is false and paused", () => {
    const state = {
      ...mockState,
      settings: {
        ...mockState.settings,
        allowTacticalPause: false,
        isPaused: true,
      },
    };

    hud.update(state, null);

    const speedValue = document.getElementById("speed-value");
    expect(speedValue?.textContent).toBe("0.0x (Paused)");
  });

  it("should show '0.05x (Active Pause)' when allowTacticalPause is true and paused", () => {
    const state = {
      ...mockState,
      settings: {
        ...mockState.settings,
        allowTacticalPause: true,
        isPaused: true,
      },
    };

    hud.update(state, null);

    const speedValue = document.getElementById("speed-value");
    expect(speedValue?.textContent).toBe("0.05x (Active Pause)");
  });
});
