/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../package.json", () => ({
  default: { version: "1.0.0" },
}));

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    onStateUpdate: vi.fn(),
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
      getAssetUrl: vi.fn().mockReturnValue(""),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
    }),
  },
}));

vi.mock("@src/renderer/visuals/AssetManager", () => ({
  AssetManager: {
    getInstance: vi.fn().mockReturnValue({
      loadSprites: vi.fn(),
    }),
  },
}));

const mockModalService = {
  alert: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn().mockResolvedValue(true),
  show: vi.fn().mockResolvedValue(true),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

vi.mock("@src/services/firebase", () => ({
  db: {},
  auth: {
    onAuthStateChanged: vi.fn((cb) => {
      // Immediate callback with null user
      setTimeout(() => cb(null), 0);
      return vi.fn(); // Unsubscribe function
    }),
  },
  app: {},
  isFirebaseConfigured: false,
}));

describe("Reset Data Location", () => {
  let reloadMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockModalService.show.mockResolvedValue(true);

    // Set up DOM to match src/index.html (relevant parts)
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
          <button id="btn-menu-custom">Custom Mission</button>
          <button id="btn-menu-settings">Settings</button>
          <p id="menu-version"></p>
        </div>

        <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
            <div id="screen-campaign" class="screen" style="display:none"></div>
            <div id="screen-barracks" class="screen" style="display:none"></div>
            <div id="screen-equipment" class="screen" style="display:none"></div>
            <div id="screen-statistics" class="screen" style="display:none"></div>
            <div id="screen-engineering" class="screen" style="display:none"></div>
            <div id="screen-settings" class="screen" style="display:none"></div>
            <div id="screen-campaign-summary" class="screen" style="display:none"></div>
          </div>
        </div>

        <div id="screen-mission-setup" class="screen" style="display:none">
            <select id="map-generator-type"><option value="DenseShip">Dense Ship</option></select>
            <input type="checkbox" id="toggle-fog-of-war" />
            <input type="checkbox" id="toggle-debug-overlay" />
            <input type="checkbox" id="toggle-los-overlay" />
            <input type="checkbox" id="toggle-agent-control" />
            <input type="checkbox" id="toggle-manual-deployment" />
            <input type="checkbox" id="toggle-allow-tactical-pause" />
            <input type="number" id="map-seed" />
            <input type="number" id="map-width" />
            <input type="number" id="map-height" />
            <input type="range" id="map-spawn-points" />
            <span id="map-spawn-points-value"></span>
            <input type="range" id="map-starting-threat" />
            <span id="map-starting-threat-value"></span>
            <input type="range" id="map-base-enemies" />
            <span id="map-base-enemies-value"></span>
            <input type="range" id="map-enemy-growth" />
            <span id="map-enemy-growth-value"></span>
            <div id="setup-global-status"></div>
            <div id="mission-setup-context"></div>
        </div>
        <div id="screen-mission" class="screen" style="display:none">
            <canvas id="game-canvas"></canvas>
            <div id="top-threat-fill"></div>
            <div id="top-threat-value"></div>
            <button id="btn-pause-toggle"></button>
            <input type="range" id="game-speed" />
            <span id="speed-value"></span>
            <button id="btn-give-up"></button>
            <div id="game-status"></div>
            <div id="soldier-list"></div>
        </div>
        <div id="screen-debrief" class="screen" style="display:none"></div>
      </div>
      <div id="modal-container"></div>
    `;

    // Mock window.location.reload
    reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        reload: reloadMock,
      },
      configurable: true,
      writable: true,
    });

    // Mock localStorage.clear
    vi.spyOn(Storage.prototype, "clear");

    // Import main.ts to initialize the app
    vi.resetModules();
    await import("@src/renderer/main");

    // Trigger DOMContentLoaded
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should NOT have Reset Data button in the Main Menu", () => {
    const mainMenu = document.getElementById("screen-main-menu");
    expect(mainMenu).toBeTruthy();

    // Check for any button or element containing "Reset"
    const allButtons = mainMenu?.querySelectorAll("button");
    const resetBtn = Array.from(allButtons || []).find(
      (btn) =>
        btn.textContent?.toLowerCase().includes("reset") ||
        btn.id.includes("reset"),
    );

    expect(resetBtn).toBeFalsy();
  });

  it("should have Reset Data button in the Settings Screen and it should work", async () => {
    // 1. Navigate to Settings
    const settingsBtn = document.getElementById("btn-menu-settings");
    expect(settingsBtn).toBeTruthy();
    settingsBtn?.click();

    // Give some time for SettingsScreen to render
    await new Promise((resolve) => setTimeout(resolve, 50));

    const settingsScreen = document.getElementById("screen-settings");
    expect(settingsScreen).toBeTruthy();
    expect(settingsScreen?.style.display).toBe("flex");

    // 2. Look for Reset button in settings
    const allButtons = settingsScreen?.querySelectorAll("button");
    const resetBtn = Array.from(allButtons || []).find((btn) =>
      btn.textContent?.toLowerCase().includes("reset"),
    );

    expect(resetBtn).toBeTruthy();
    expect(resetBtn?.textContent).toMatch(/Reset/i);

    // 3. Test reset logic (Success)
    mockModalService.show.mockResolvedValue(true);
    resetBtn?.click();

    // Wait for async ModalService.show
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockModalService.show).toHaveBeenCalled();
    expect(Storage.prototype.clear).toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalled();
  });

  it("should do nothing when Reset Data is clicked but cancelled", async () => {
    // 1. Navigate to Settings
    document.getElementById("btn-menu-settings")?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const settingsScreen = document.getElementById("screen-settings");
    const allButtons = settingsScreen?.querySelectorAll("button");
    const resetBtn = Array.from(allButtons || []).find((btn) =>
      btn.textContent?.toLowerCase().includes("reset"),
    );

    // 2. Test reset logic (Cancel)
    mockModalService.show.mockResolvedValue(false);
    resetBtn?.click();

    // Wait for async ModalService.show
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockModalService.show).toHaveBeenCalled();
    expect(Storage.prototype.clear).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
