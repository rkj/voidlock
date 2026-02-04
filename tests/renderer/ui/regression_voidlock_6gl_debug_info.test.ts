// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, MissionType } from "@src/shared/types";

describe("HUDManager Debug Info Regression (voidlock-6gl)", () => {
  let hud: HUDManager;
  let mockMenuController: any;
  let mockState: GameState;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="game-status"></div>
      <div id="version-display"></div>
      <div id="menu-version"></div>
      <div id="top-threat-fill"></div>
      <div id="top-threat-value"></div>
      <div id="right-panel"></div>
      <div id="soldier-list"></div>
    `;

    mockMenuController = {
      getRenderableState: vi.fn(() => ({
        title: "ACTIONS",
        options: [],
      })),
    };

    hud = new HUDManager(
      mockMenuController,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    mockState = {
      t: 1000,
      seed: 98765,
      missionType: MissionType.EscortVIP,
      status: "Playing",
      settings: {
        mode: "Simulation" as any,
        debugOverlayEnabled: true,
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
      map: { width: 32, height: 24, cells: [] },
      units: [],
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
      mines: [],
      turrets: [],
      objectives: [],
    };
  });

  it("should display Map Info (with seed), Map Size, and Mission Type in debug tools", () => {
    hud.update(mockState, null);

    const debugDiv = document.querySelector(".debug-controls");
    expect(debugDiv).not.toBeNull();

    const text = debugDiv?.textContent || "";
    expect(text).toContain("Map: UnknownGenerator (98765)");
    expect(text).toContain("Size: 32x24");
    expect(text).toContain("Mission: EscortVIP");
  });
});
