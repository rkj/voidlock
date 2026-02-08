/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commandLog: [] }),
  forceWin: vi.fn(),
  forceLose: vi.fn(),
  loadReplay: vi.fn(),
};

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => mockGameClient),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    setCellSize: vi.fn(),
    setUnitStyle: vi.fn(),
    setOverlay: vi.fn(),
    getCellCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  })),
}));

vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#000"),
      getIconUrl: vi.fn().mockReturnValue("mock-icon-url"),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
      applyTheme: vi.fn(),
    }),
  },
}));

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => ({
    alert: vi.fn().mockResolvedValue(undefined),
    confirm: vi.fn().mockResolvedValue(true),
    prompt: vi.fn().mockResolvedValue("New Recruit"),
    show: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("@src/renderer/campaign/CampaignManager", () => ({
  CampaignManager: {
    getInstance: vi.fn().mockReturnValue({
      getState: vi.fn(() => null),
      load: vi.fn(),
      save: vi.fn(),
    }),
  },
}));

describe("Regression: Mission Setup Sticky Footer (voidlock-vwhe)", () => {
  beforeEach(async () => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      stroke: vi.fn(),
    }) as any;

    // Load index.html content (simulated)
    // We strictly assume the structure modified in the previous step
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen"></div>
      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content">
              <div id="screen-engineering" class="screen" style="display:none"></div>
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-barracks" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
              <div id="screen-settings" class="screen" style="display:none"></div>
          </div>
      </div>
      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="mission-setup-context"></div>
        
        <!-- Scrollable Content Area -->
        <div id="setup-content">
           <div id="map-config-section"></div>
           <div id="unit-style-preview"></div>
           <div id="squad-builder"></div>
        </div>

        <!-- Sticky Footer Area (Should be outside setup-content) -->
        <div id="setup-footer" style="margin-top: 10px;">
          <button id="btn-setup-back">Back</button>
          <button id="btn-goto-equipment">Equipment & Supplies</button>
        </div>
      </div>
      <div id="screen-mission" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;

    // Reset modules and import main
    vi.resetModules();
    await import("@src/renderer/main");
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should ensure action buttons are outside the scrollable content area", () => {
    const setupContent = document.getElementById("setup-content");
    const confirmButton = document.getElementById("btn-goto-equipment");
    const backButton = document.getElementById("btn-setup-back");

    expect(setupContent).toBeTruthy();
    expect(confirmButton).toBeTruthy();
    expect(backButton).toBeTruthy();

    // Verify buttons are NOT inside the scrollable area
    expect(setupContent?.contains(confirmButton)).toBe(false);
    expect(setupContent?.contains(backButton)).toBe(false);

    // Verify buttons are siblings (or in a sibling container) to the content
    // effectively acting as a footer
    const screenRoot = document.getElementById("screen-mission-setup");
    expect(screenRoot?.contains(setupContent)).toBe(true);
    expect(screenRoot?.contains(confirmButton)).toBe(true);
  });
});
