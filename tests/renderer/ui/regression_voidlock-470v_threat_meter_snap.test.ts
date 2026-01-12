// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, UnitState } from "@src/shared/types";

describe("HUDManager Threat Meter Snap Regression", () => {
  let hud: HUDManager;
  let mockState: GameState;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="game-status"></div>
      <div id="top-threat-fill" class="threat-fill"></div>
      <div id="top-threat-value"></div>
      <input type="range" id="game-speed">
      <div id="speed-value"></div>
      <div id="right-panel"></div>
      <div id="soldier-list"></div>
    `;

    hud = new HUDManager(
      { 
        getRenderableState: vi.fn().mockReturnValue({ 
          title: "COMMANDS",
          options: [],
          footer: ""
        }) 
      } as any,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      "1.0.0"
    );

    mockState = {
      t: 0,
      status: "Playing",
      stats: { threatLevel: 50, aliensKilled: 0, casualties: 0, elitsKilled: 0, scrapGained: 0 },
      settings: { isPaused: false, timeScale: 1, allowTacticalPause: true, debugOverlayEnabled: false },
      units: [],
      enemies: [],
      objectives: [],
      visibleCells: [],
      map: { width: 10, height: 10, cells: {}, walls: [], doors: [], generatorName: "Test" },
      seed: "test-seed"
    } as unknown as GameState;
  });

  it("should apply no-transition class when t < 1000 and then remove it", () => {
    const topThreatFill = document.getElementById("top-threat-fill")!;
    
    // We need to spy on classList.add and classList.remove because the code
    // adds and removes it in the same call.
    const addSpy = vi.spyOn(topThreatFill.classList, "add");
    const removeSpy = vi.spyOn(topThreatFill.classList, "remove");

    mockState.t = 500;
    hud.update(mockState, null);

    expect(addSpy).toHaveBeenCalledWith("no-transition");
    expect(removeSpy).toHaveBeenCalledWith("no-transition");
    expect(topThreatFill.style.width).toBe("50%");
  });

  it("should NOT apply no-transition class when t >= 1000", () => {
    const topThreatFill = document.getElementById("top-threat-fill")!;
    const addSpy = vi.spyOn(topThreatFill.classList, "add");

    mockState.t = 1000;
    hud.update(mockState, null);

    expect(addSpy).not.toHaveBeenCalledWith("no-transition");
    expect(topThreatFill.style.width).toBe("50%");
  });
});
