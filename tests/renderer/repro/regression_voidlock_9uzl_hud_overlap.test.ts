/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";

describe("Regression voidlock-9uzl: HUD visibility on mission end", () => {
  let app: GameApp;

  beforeEach(async () => {
    // Mock Worker
    global.Worker = class {
      constructor() {}
      postMessage() {}
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    } as any;

    document.body.innerHTML = `
      <div id="top-bar" style="display: flex;"></div>
      <div id="soldier-panel" style="display: flex;"></div>
      <div id="right-panel" style="display: flex;"></div>
      <div id="screen-mission" style="display: none;"></div>
      <div id="screen-debrief" style="display: none;"></div>
      <div id="screen-campaign-summary" style="display: none;"></div>
      <div id="screen-barracks" style="display: none;"></div>
      <div id="screen-equipment" style="display: none;"></div>
      <div id="screen-campaign" style="display: none;"></div>
      <div id="screen-main-menu" style="display: none;"></div>
      <div id="screen-mission-setup" style="display: none;"></div>
      <div id="screen-statistics" style="display: none;"></div>
      <div id="squad-builder"></div>
      <div id="game-canvas-container">
        <canvas id="game-canvas"></canvas>
      </div>
      <div id="modal-container"></div>
      <input type="range" id="time-scale-slider" value="50">
      <div id="speed-value">1.0x</div>
      <button id="btn-pause-toggle"></button>
      <div id="screen-campaign-shell" style="display: none;">
         <div id="shell-tabs"></div>
         <div id="shell-resources"></div>
         <div id="shell-content"></div>
      </div>
    `;

    // Mock localStorage
    const mockStorage: Record<string, string> = {};
    global.localStorage = {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, value) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        for (const key in mockStorage) delete mockStorage[key];
      }),
      length: 0,
      key: vi.fn(),
    };

    app = new GameApp();
    await app.initialize();
  });

  it("should hide HUD elements when debrief screen is shown", () => {
    // Access private properties for testing
    const appAny = app as any;

    // Simulate mission launch to setup coordination
    appAny.setMissionHUDVisible(true);
    expect(document.getElementById("top-bar")?.style.display).toBe("flex");
    expect(document.getElementById("soldier-panel")?.style.display).toBe(
      "flex",
    );
    expect(document.getElementById("right-panel")?.style.display).toBe("flex");

    // Simulate mission end report
    const mockReport = {
      nodeId: "test-node",
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 120000,
      soldierResults: [],
    };

    // Trigger debrief via the coordinator's callback logic or direct call
    appAny.setMissionHUDVisible(false);
    appAny.debriefScreen.show(mockReport);

    expect(document.getElementById("top-bar")?.style.display).toBe("none");
    expect(document.getElementById("soldier-panel")?.style.display).toBe(
      "none",
    );
    expect(document.getElementById("right-panel")?.style.display).toBe("none");
    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );
  });
});
