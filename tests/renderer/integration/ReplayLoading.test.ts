// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Mock dependencies
vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    onObservation: vi.fn(),
    sendCommand: vi.fn(),
    replay: vi.fn(),
    forceObservation: vi.fn(),
    getMetadata: vi.fn().mockReturnValue({}),
    setMetadata: vi.fn(),
    onMessage: vi.fn(),
    onReplayProgress: vi.fn(),
    freezeForDialog: vi.fn(),
    unfreezeAfterDialog: vi.fn(),
    getReplayData: vi.fn().mockReturnValue({ timeline: [] }),
  })),
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(null),
    saveCampaign: vi.fn(),
    clearCampaign: vi.fn(),
  },
}));

// Mock MetaManager
vi.mock("@src/engine/campaign/MetaManager", () => {
  const mockInstance = {
    getStats: vi.fn().mockReturnValue({
      totalKills: 100,
      totalCampaignsStarted: 5,
      totalMissionsWon: 20,
    }),
    addChangeListener: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { MetaManager: mockConstructor };
});

describe("Replay Loading Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main" class="screen">
          <button id="import-replay">Import</button>
        </div>
        <div id="screen-debrief" class="screen"></div>
        <div id="screen-campaign" class="screen"></div>
        <div id="mission-body"></div>
        <div id="screen-mission"></div>
        <div id="screen-campaign-shell"></div>
      </div>
      <div id="modal-container"></div>
    `;

    app = new GameApp();
    await app.initialize();
  });

  it("should load a replay JSON and transition to Debrief Screen", async () => {
    const mockReplay = {
      version: "1.0",
      seed: 123,
      missionType: "Default",
      history: [
        {
          observation: {
            t: 120000,
            status: "Won",
            units: [{ id: "u1", name: "Alpha", archetypeId: "assault", hp: 100, maxHp: 100, kills: 10, xp: 0, status: "Healthy" }],
            enemies: [],
            visibleCells: [],
            stats: { aliensKilled: 25, casualties: 0, threatLevel: 0 },
            map: { width: 10, height: 10, cells: [] },
            objectives: [],
            settings: { allowTacticalPause: true, debugOverlayEnabled: false, isPaused: false, targetTimeScale: 1.0, timeScale: 1.0 },
          },
        },
      ],
      report: {
        victory: true,
        aliensKilled: 25,
        casualties: 0,
        scrapGained: 150,
        intelGained: 0,
        durationMs: 120000,
        rosterSnapshot: [{ id: "u1", name: "Alpha", archetypeId: "assault", hp: 100, maxHp: 100, kills: 10, xp: 0, xpGained: 0, status: "Healthy" }],
        timeline: [],
      },
    };

    // Simulate file import
    const json = JSON.stringify(mockReplay);
    await (app as any).handleReplayImport(json);

    // Verify screen transition
    const debriefScreen = document.getElementById("screen-debrief");
    expect(debriefScreen?.style.display).toBe("flex");

    // Verify Mission Stats on screen
    expect(debriefScreen?.innerHTML).toContain(t(I18nKeys.screen.debrief.header_success));
    expect(debriefScreen?.innerHTML).toContain("25"); // Aliens killed
    expect(debriefScreen?.innerHTML).toContain("150"); // Scrap
  });

  it("should load a replay-only JSON (no currentState) and still transition to Debrief Screen", async () => {
    const mockReplayOnly = {
      version: "1.0",
      seed: 456,
      history: [],
      report: {
        victory: true,
        aliensKilled: 0,
        casualties: 0,
        scrapGained: 0,
        intelGained: 0,
        durationMs: 5000,
        rosterSnapshot: [{ id: "u1", name: "Sarge", archetypeId: "assault", hp: 100, maxHp: 100, kills: 0, xp: 0, xpGained: 0, status: "Healthy" }],
        timeline: [],
      },
    };

    const json = JSON.stringify(mockReplayOnly);
    await (app as any).handleReplayImport(json);

    const debriefScreen = document.getElementById("screen-debrief");
    expect(debriefScreen?.style.display).toBe("flex");

    // Verify Mission Success (default)
    expect(debriefScreen?.innerHTML).toContain(t(I18nKeys.screen.debrief.header_success));
    expect(debriefScreen?.innerHTML).toContain("Sarge");
  });
});
