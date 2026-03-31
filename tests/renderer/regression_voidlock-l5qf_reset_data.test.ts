import { InputDispatcher } from "@src/renderer/InputDispatcher";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Mock dependencies
vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    onObservation: vi.fn(),
    sendCommand: vi.fn(),
    onMessage: vi.fn(),
    freezeForDialog: vi.fn(),
    unfreezeAfterDialog: vi.fn(),
    addStateUpdateListener: vi.fn(),
    removeStateUpdateListener: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
  })),
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
      logLevel: "INFO",
      debugSnapshotInterval: 100,
      debugOverlayEnabled: false,
      fogOfWarEnabled: true,
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(null),
    loadCustom: vi.fn().mockReturnValue(null),
    saveCampaign: vi.fn(),
    saveCustom: vi.fn(),
    clearCampaign: vi.fn(),
    getDefault: vi.fn().mockReturnValue({
        fogOfWarEnabled: true,
        debugOverlayEnabled: false, squadConfig: { soldiers: [] } }),
  },
}));

// Mock MetaManager
vi.mock("@src/engine/campaign/MetaManager", () => {
  const mockInstance = {
    getStats: vi.fn().mockReturnValue({
      totalKills: 100,
      totalCampaignsStarted: 5,
      campaignsWon: 3,
      campaignsLost: 2,
      totalCasualties: 2,
      totalMissionsPlayed: 10,
      totalMissionsWon: 3,
      totalScrapEarned: 1000,
    }),
    addChangeListener: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return { MetaManager: mockConstructor };
});

describe("Reset Data Regression", () => {
  let app: GameApp;
  let reloadMock: any;

  beforeEach(async () => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-settings">Settings</button>
        </div>
        <div id="screen-settings" class="screen"></div>
        <div id="screen-campaign" class="screen"></div>
        <div id="screen-campaign-shell"></div>
        <div id="screen-debrief" class="screen"></div>
        <div id="screen-equipment" class="screen"></div>
        <div id="screen-mission-setup" class="screen"></div>
        <div id="screen-engineering" class="screen"></div>
        <div id="screen-campaign-summary" class="screen"></div>
        <div id="screen-statistics" class="screen"></div>
        <div id="screen-mission" class="screen">
            <div id="mission-body"></div>
            <canvas id="game-canvas"></canvas>
        </div>
      </div>
      <div id="modal-container"></div>
    `;

    // Mock window.location.reload
    reloadMock = vi.fn();
    delete (window as any).location;
    (window as any).location = { reload: reloadMock };

    // Mock localStorage
    vi.spyOn(Storage.prototype, "clear");

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      drawImage: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      setLineDash: vi.fn(),
    });

    app = new GameApp();
    await app.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should clear localStorage and reload page when Reset Data is clicked and confirmed", async () => {
    // 1. Go to Settings
    const settingsBtn = document.getElementById("btn-menu-settings");
    settingsBtn?.click();

    // 2. Find Reset Data button
    const resetBtn = Array.from(document.querySelectorAll("button")).find(
      (btn) =>
        btn.textContent === t(I18nKeys.screen.settings.reset_btn),
    );
    expect(resetBtn).toBeTruthy();

    // 3. Click Reset Data and Confirm
    const mockModalService = (app as any).registry.modalService;
    vi.spyOn(mockModalService, "show").mockResolvedValue(true);

    resetBtn?.click();

    // Small delay for async modal
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockModalService.show).toHaveBeenCalled();
    expect(Storage.prototype.clear).toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalled();
  });

  it("should do nothing when Reset Data is clicked but cancelled", async () => {
    // 1. Go to Settings
    const settingsBtn = document.getElementById("btn-menu-settings");
    settingsBtn?.click();

    // 2. Find Reset Data button
    const resetBtn = Array.from(document.querySelectorAll("button")).find(
      (btn) =>
        btn.textContent === t(I18nKeys.screen.settings.reset_btn),
    );

    // 3. Click Reset Data and Cancel
    const mockModalService = (app as any).registry.modalService;
    vi.spyOn(mockModalService, "show").mockResolvedValue(false);

    resetBtn?.click();

    // Small delay for async modal
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockModalService.show).toHaveBeenCalled();
    expect(Storage.prototype.clear).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
