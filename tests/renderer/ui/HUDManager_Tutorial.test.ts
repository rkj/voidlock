// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, MissionType, UnitState } from "@src/shared/types";

describe("HUDManager Tutorial Dimming", () => {
  let hud: HUDManager;
  let mockMenuController: any;

  const createMockState = (missionType: MissionType, t: number, threatLevel: number = 0, aliensKilled: number = 0): GameState => ({
    t,
    seed: 12345,
    missionType,
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
    squadInventory: {},
    stats: {
      threatLevel,
      aliensKilled,
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
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-mission">
        <div id="top-bar">
            <div id="top-threat-container" data-bind-class="missionType|threatDimmed"></div>
            <div id="speed-control" data-bind-class="missionType|speedDimmed"></div>
        </div>
        <div id="soldier-panel" data-bind-class="missionType|soldierPanelDimmed"></div>
        <div id="mission-body">
            <div id="right-panel" data-bind-class="missionType|rightPanelDimmed"></div>
        </div>
        <div id="mobile-action-panel"></div>
      </div>
    `;

    mockMenuController = {
      getRenderableState: vi.fn(() => ({
        title: "Actions",
        options: [],
      })),
    };

    hud = new HUDManager(
      mockMenuController,
      { getCurrentStepId: () => null } as any,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
  });

  it("should dim elements in prologue with no contact", () => {
    const state = createMockState(MissionType.Prologue, 100, 0, 0);
    hud.update(state, null);

    const threat = document.getElementById("top-threat-container");
    const speed = document.getElementById("speed-control");
    const soldier = document.getElementById("soldier-panel");
    const right = document.getElementById("right-panel");

    expect(threat?.classList.contains("tutorial-dimmed")).toBe(true);
    expect(speed?.classList.contains("tutorial-dimmed")).toBe(true);
    expect(soldier?.classList.contains("tutorial-dimmed")).toBe(true);
    expect(right?.classList.contains("tutorial-dimmed")).toBe(true);
  });

  it("should undim threat and right panels when contact is made", () => {
    const state = createMockState(MissionType.Prologue, 1000, 10, 0);
    hud.update(state, null);

    const threat = document.getElementById("top-threat-container");
    const right = document.getElementById("right-panel");

    expect(threat?.classList.contains("tutorial-dimmed")).toBe(false);
    expect(right?.classList.contains("tutorial-dimmed")).toBe(false);
  });

  it("should undim soldier panel after initial delay", () => {
    const state = createMockState(MissionType.Prologue, 600, 0, 0);
    hud.update(state, null);

    const soldier = document.getElementById("soldier-panel");
    expect(soldier?.classList.contains("tutorial-dimmed")).toBe(false);
  });

  it("should update data-step attribute based on tutorial step", () => {
    const mockTutorial = {
        getCurrentStepId: vi.fn(() => "observe")
    };
    hud = new HUDManager(
      mockMenuController,
      mockTutorial as any,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    const state = createMockState(MissionType.Prologue, 100);
    hud.update(state, null);

    const directive = document.getElementById("tutorial-directive");
    expect(directive?.getAttribute("data-step")).toBe("observe");

    mockTutorial.getCurrentStepId.mockReturnValue("pause");
    hud.update(state, null);
    expect(directive?.getAttribute("data-step")).toBe("pause");
  });
});
