// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "./HUDManager";
import { GameState, UnitState } from "../../shared/types";

describe("HUDManager Objective Regression PDXS", () => {
  let hud: HUDManager;
  let mockMenuController: any;

  const mockState: GameState = {
    t: 0,
    status: "Playing",
    settings: {
      mode: "Simulation" as any,
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
      timeScale: 1.0,
      isPaused: false,
      isSlowMotion: false,
    },
    squadInventory: {},
    stats: {
      threatLevel: 0,
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
    objectives: [
      { id: "o1", kind: "Kill", state: "Pending" },
      {
        id: "o2",
        kind: "Recover",
        state: "Completed",
        targetCell: { x: 5, y: 5 },
      },
    ],
  };

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
      getRenderableState: vi.fn(() => ({ title: "ACTIONS", options: [] })),
    };

    hud = new HUDManager(
      mockMenuController,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      "1.0.0",
    );
  });

  it("should NOT show status text (Pending/Completed)", () => {
    hud.update(mockState, null);
    const objectivesDiv = document.querySelector(".objectives-status");
    expect(objectivesDiv?.innerHTML).not.toContain("(Pending)");
    expect(objectivesDiv?.innerHTML).not.toContain("(Completed)");
  });

  it("should NOT show coordinates by default", () => {
    hud.update(mockState, null);
    const objectivesDiv = document.querySelector(".objectives-status");
    expect(objectivesDiv?.innerHTML).not.toContain("at (5,5)");
  });

  it("should SHOW coordinates when debugOverlayEnabled is true", () => {
    const debugState = {
      ...mockState,
      settings: { ...mockState.settings, debugOverlayEnabled: true },
    };
    hud.update(debugState, null);
    const objectivesDiv = document.querySelector(".objectives-status");
    expect(objectivesDiv?.innerHTML).toContain("at (5,5)");
  });

  it("should add title attribute to the icon span", () => {
    hud.update(mockState, null);
    const objectivesDiv = document.querySelector(".objectives-status");
    const icons = objectivesDiv?.querySelectorAll(
      "span[style*='font-weight:bold']",
    );
    expect(icons?.[0].getAttribute("title")).toBe("Pending");
    expect(icons?.[1].getAttribute("title")).toBe("Completed");
  });

  it("should handle extraction coordinates similarly", () => {
    const stateWithExtraction = {
      ...mockState,
      map: { ...mockState.map, extraction: { x: 8, y: 8 } },
      objectives: [], // Remove escort to show implicit extraction
    };

    // Default: no coords
    hud.update(stateWithExtraction, null);
    let objectivesDiv = document.querySelector(".objectives-status");
    expect(objectivesDiv?.innerHTML).toContain("Extraction");
    expect(objectivesDiv?.innerHTML).not.toContain("at (8,8)");

    // Debug: show coords
    const debugState = {
      ...stateWithExtraction,
      settings: { ...stateWithExtraction.settings, debugOverlayEnabled: true },
    };
    hud.update(debugState, null);
    objectivesDiv = document.querySelector(".objectives-status");
    expect(objectivesDiv?.innerHTML).toContain("at (8,8)");
  });
});
