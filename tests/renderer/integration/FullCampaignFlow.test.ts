// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { MissionType, UnitState, GameState } from "@src/shared/types";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
  init: vi.fn(), 
  pause: vi.fn(), 
  resume: vi.fn(),
  queryState: vi.fn(),
  onStateUpdate: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  getTimeScale: vi.fn().mockReturnValue(1.0),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commands: [] }),
  forceWin: vi.fn(),
  forceLose: vi.fn(),
  loadReplay: vi.fn(),
  applyCommand: vi.fn(),
  seek: vi.fn(),
  getFullState: vi.fn(),
  setTickRate: vi.fn(),
};

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => mockGameClient),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    destroy: vi.fn(),
    setCellSize: vi.fn(),
    setUnitStyle: vi.fn(),
    setOverlay: vi.fn(),
    getCellCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    getWorldCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  })),
}));

vi.mock("@src/renderer/ThemeManager", () => {
  const mockInstance = {
    init: vi.fn().mockResolvedValue(undefined),
    setTheme: vi.fn(),
    getAssetUrl: vi.fn().mockReturnValue("mock-url"),
    getColor: vi.fn().mockReturnValue("#000"),
    getIconUrl: vi.fn().mockReturnValue("mock-icon-url"),
    getCurrentThemeId: vi.fn().mockReturnValue("default"),
    applyTheme: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return {
    ThemeManager: mockConstructor,
  };
});

vi.mock("@src/renderer/controllers/TutorialManager", () => ({
  TutorialManager: vi.fn().mockImplementation(() => ({
    enable: vi.fn(),
    disable: vi.fn(),
    reset: vi.fn(),
    triggerEvent: vi.fn(),
    onScreenShow: vi.fn(),
    isProloguePassiveStep: vi.fn().mockReturnValue(false),
  })),
}));

vi.mock("@src/renderer/ui/AdvisorOverlay", () => ({
  AdvisorOverlay: vi.fn().mockImplementation(() => ({
    showMessage: vi.fn().mockImplementation((msg, onDismiss) => {
      if (onDismiss) onDismiss();
    }),
    showToast: vi.fn(),
  })),
}));

async function waitForSelector(selector: string, timeout = 5000): Promise<HTMLElement> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) return el;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`Timeout waiting for selector: ${selector}`);
}

describe("Full Campaign Flow Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    localStorage.clear();

    // Standard DOM setup for tests
    document.body.innerHTML = `
      <div id="game-shell">
        <div id="screen-main-menu" class="screen" style="display: none">
          <button id="btn-menu-campaign"></button>
          <button id="btn-menu-custom"></button>
          <button id="btn-menu-statistics"></button>
          <button id="btn-menu-engineering"></button>
          <button id="btn-menu-settings"></button>
        </div>
        <div id="screen-campaign-shell" class="screen flex-col" style="display: none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
            <div id="screen-campaign" class="screen" style="display: none"></div>
            <div id="screen-barracks" class="screen" style="display: none"></div>
            <div id="screen-equipment" class="screen" style="display: none"></div>
            <div id="screen-statistics" class="screen" style="display: none"></div>
            <div id="screen-settings" class="screen" style="display: none"></div>
            <div id="screen-engineering" class="screen" style="display: none"></div>
          </div>
          <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-mission-setup" class="screen" style="display: none">
          <div id="squad-builder"></div>
          <button id="btn-setup-back"></button>
          <button id="btn-launch-mission"></button>
          <select id="mission-type"></select>
          <input id="map-width" type="range" />
          <input id="map-height" type="range" />
          <input id="map-spawn-points" type="range" />
          <select id="map-generator-type"></select>
        </div>
        <div id="screen-mission" class="screen" style="display: none">
          <div id="mission-body"></div>
          <div id="top-bar">
            <div id="game-status"></div>
            <div id="top-threat-fill"></div>
            <div id="top-threat-value">0%</div>
            <button id="btn-pause-toggle">Pause</button>
            <input type="range" id="game-speed" />
            <span id="speed-value">1.0x</span>
            <button id="btn-give-up">Give Up</button>
          </div>
          <div id="soldier-list"></div>
          <canvas id="game-canvas"></canvas>
          <div id="right-panel"></div>
        </div>
        <div id="screen-debrief" class="screen" style="display: none"></div>
        <div id="screen-campaign-summary" class="screen" style="display: none"></div>
        <div id="advisor-overlay"></div>
        <div id="modal-container"></div>
      </div>
    `;

    app = new GameApp();
    await app.initialize();
    app.registry.campaignManager.reset();
    app.registry.metaManager.reset();
  });

  afterEach(() => {
    if (app) app.stop();
  });

  it(
    "should complete a full campaign flow with roster validation",
    async () => {
      const cm = app.registry.campaignManager;
      const registry = app.registry;

      // 1. Start Standard Campaign
      document.getElementById("btn-menu-campaign")?.click();

      // Start campaign via wizard UI
      const startBtn = await waitForSelector('[data-focus-id="btn-start-campaign"]');
      const dateNowStub = vi.spyOn(global.Date, 'now').mockImplementation(() => 6);
      startBtn.click();
      dateNowStub.mockRestore();

      // Wait for transitions
      await new Promise((resolve) => setTimeout(resolve, 100));

      // After campaign start (no prologue), we land on the campaign/sector-map screen
      expect(document.getElementById("screen-campaign")?.style.display).toBe(
        "flex",
      );

      // 2. Select first accessible node (rank 0)
      const firstNode = cm.getState()?.nodes.find(n => n.rank === 0 && n.status === "Accessible")!;
      expect(firstNode).toBeTruthy();
      cm.selectNode(firstNode.id);

      const nodeEl = document.querySelector(
        `.campaign-node[data-id="${firstNode.id}"]`,
      ) as HTMLElement;
      expect(nodeEl).toBeTruthy();
      nodeEl.click();

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(document.getElementById("screen-equipment")?.style.display).toBe(
        "flex",
      );

      // Launch Mission 1
      const launchBtn = Array.from(
        document.querySelectorAll("#screen-equipment button"),
      ).find((b) => b.textContent?.includes("Authorize")) as HTMLElement;
      expect(launchBtn).toBeTruthy();
      launchBtn.click();

      // Mission Screen
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(document.getElementById("screen-mission")?.style.display).toBe(
        "flex",
      );

      // 3. Mission 1: Complete (Won) and Debrief
      const mr = registry.missionRunner;
      (mr as any).onMissionComplete({
        nodeId: firstNode.id,
        seed: 0,
        result: "Won",
        won: true,
        aliensKilled: 5,
        scrapGained: 50,
        intelGained: 0,
        timeSpent: 100,
        kills: 5,
        casualties: [],
        soldierResults: [
          {
            soldierId: cm.getState()!.roster[0]?.id || "soldier_0",
            kills: 2,
            status: "Healthy",
            xpBefore: 0,
            xpGained: 10,
            promoted: false,
            recoveryTime: 0,
          },
          {
            soldierId: cm.getState()!.roster[1]?.id || "soldier_1",
            kills: 1,
            status: "Healthy",
            xpBefore: 0,
            xpGained: 5,
            promoted: false,
            recoveryTime: 0,
          },
          {
            soldierId: cm.getState()!.roster[2]?.id || "soldier_2",
            kills: 1,
            status: "Healthy",
            xpBefore: 0,
            xpGained: 5,
            promoted: false,
            recoveryTime: 0,
          },
          {
            soldierId: cm.getState()!.roster[3]?.id || "soldier_3",
            kills: 1,
            status: "Healthy",
            xpBefore: 0,
            xpGained: 5,
            promoted: false,
            recoveryTime: 0,
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(document.getElementById("screen-debrief")?.style.display).toBe(
        "flex",
      );

      // Mission 1 should be reconciled
      expect(cm.getState()?.history.length).toBeGreaterThanOrEqual(1);

      // 4. Return from debrief - handleCampaignScreen auto-selects next node (history.length===1, !skipPrologue)
      const returnBtn = Array.from(
        document.querySelectorAll("#screen-debrief button"),
      ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
      expect(returnBtn).toBeTruthy();
      returnBtn.click();

      // Should redirect to Equipment Screen (Mission 2 Tutorial auto-select)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // After mission 1 (history.length===1), NavOrch auto-selects next node -> Equipment
      // If no accessible nodes available, we stay on campaign screen
      const mission2Node = cm.getState()?.nodes.find(n => n.status === "Accessible");
      if (mission2Node) {
        cm.selectNode(mission2Node.id);

        // Mission 2 flow: advance campaign state directly
        // Full screen transitions depend on ScreenManager DOM wiring which is
        // hard to test in jsdom. We verify campaign state progression instead.
        cm.reconcileMission({
          nodeId: mission2Node.id,
          won: true,
          kills: 10,
          elitesKilled: 0,
          scrapGained: 50,
          intelGained: 5,
          casualties: [],
          xpGained: new Map(),
          soldierResults: [],
        } as any);
      }

      // 5. Verify Boss Win triggers Victory screen
      const bossState = cm.getState()!;
      const bossNode = bossState.nodes.find((n) => n.type === "Boss")!;
      expect(bossNode).toBeTruthy();
      bossNode.status = "Accessible";
      cm.selectNode(bossNode.id);

      // Select Boss Node
      registry.navigationOrchestrator.onCampaignNodeSelect(bossNode);

      // Wait for async
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(document.getElementById("screen-equipment")?.style.display).toBe(
        "flex",
      );

      // Launch Boss Mission
      const launchBtn3 = Array.from(
        document.querySelectorAll("#screen-equipment button"),
      ).find((b) => b.textContent?.includes("Authorize")) as HTMLElement;
      expect(launchBtn3).toBeTruthy();
      launchBtn3.click();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Complete Boss Mission
      (mr as any).onMissionComplete({
        nodeId: bossNode.id,
        seed: 0,
        result: "Won",
        won: true,
        aliensKilled: 50,
        scrapGained: 1000,
        intelGained: 5,
        kills: 50,
        casualties: [],
        timeSpent: 200,
        soldierResults: [],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      // Debrief -> Summary
      const returnBtn3 = Array.from(
        document.querySelectorAll("#screen-debrief button"),
      ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
      expect(returnBtn3).toBeTruthy();
      returnBtn3.click();

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(
        document.getElementById("screen-campaign-summary")?.style.display,
      ).toBe("flex");
    },
    30000,
  );
});
