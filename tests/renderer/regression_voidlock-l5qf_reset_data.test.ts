/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocking needed for main.ts
vi.mock("../../package.json", () => ({
  default: { version: "1.0.0" }
}));

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    onStateUpdate: vi.fn(),
    init: vi.fn(),
    stop: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
  })),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
    }),
  },
}));

describe("Reset Data Button", () => {
  let reloadMock: any;

  beforeEach(async () => {
    // Set up DOM
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
        <button id="btn-menu-custom">Custom Mission</button>
        <button id="btn-menu-reset">Reset Data</button>
        <p id="menu-version"></p>
      </div>
      <div id="screen-campaign" class="screen" style="display:none"></div>
      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="map-config-section"></div>
        <div id="preset-map-controls"></div>
        <div id="squad-builder"></div>
      </div>
      <div id="screen-mission" class="screen" style="display:none">
        <canvas id="game-canvas"></canvas>
      </div>
      <div id="screen-equipment" class="screen" style="display:none"></div>
      <div id="screen-barracks" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
    `;

    // Mock window.confirm
    window.confirm = vi.fn().mockReturnValue(true);
    
    // Mock window.location.reload
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true
    });

    // Mock localStorage.clear
    vi.spyOn(Storage.prototype, 'clear');

    // Import main.ts
    vi.resetModules();
    await import("@src/renderer/main");
    
    // Trigger DOMContentLoaded
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should clear localStorage and reload page when Reset Data is clicked and confirmed", async () => {
    const resetBtn = document.getElementById("btn-menu-reset");
    expect(resetBtn).toBeTruthy();

    resetBtn?.click();

    expect(window.confirm).toHaveBeenCalledWith(
      "Are you sure? This will wipe all campaign progress and settings."
    );
    expect(Storage.prototype.clear).toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalled();
  });

  it("should do nothing when Reset Data is clicked but cancelled", async () => {
    (window.confirm as any).mockReturnValue(false);
    
    const resetBtn = document.getElementById("btn-menu-reset");
    resetBtn?.click();

    expect(window.confirm).toHaveBeenCalled();
    expect(Storage.prototype.clear).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
