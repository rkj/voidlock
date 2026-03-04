// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/engine/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { MissionType, UnitState, GameState } from "@src/shared/types";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
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

vi.mock("@src/renderer/controllers/TutorialManager", () => ({
  TutorialManager: vi.fn().mockImplementation(() => ({
    enable: vi.fn(),
    disable: vi.fn(),
    reset: vi.fn(),
    triggerEvent: vi.fn(),
    onScreenShow: vi.fn(),
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
    // Reset singleton instances
    (CampaignManager as any).instance = null;
    (MetaManager as any).instance = null;

    // Standard DOM setup for tests
    document.body.innerHTML = `
      <div id="game-shell">
        <div id="screen-campaign-shell" style="display: none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content"></div>
          <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-main-menu" class="screen" style="display: none">
          <button id="btn-menu-campaign"></button>
          <button id="btn-menu-custom"></button>
          <button id="btn-menu-statistics"></button>
          <button id="btn-menu-engineering"></button>
          <button id="btn-menu-settings"></button>
        </div>
        <div id="screen-campaign" class="screen" style="display: none"></div>
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
        <div id="screen-equipment" class="screen" style="display: none">
           <div class="soldier-list-panel"></div>
           <div class="roster-picker-panel"></div>
           <div class="inspector-panel"></div>
           <button id="btn-equipment-back"></button>
           <button id="btn-launch-from-equipment"></button>
        </div>
        <div id="screen-mission" class="screen" style="display: none">
          <div id="mission-body"></div>
          <div id="hud-top-bar"></div>
          <div id="hud-soldier-panel"></div>
          <div id="hud-right-panel"></div>
          <div id="hud-mobile-action-panel"></div>
          <div id="game-container">
            <canvas id="game-canvas"></canvas>
          </div>
        </div>
        <div id="screen-debrief" class="screen" style="display: none"></div>
        <div id="screen-campaign-summary" class="screen" style="display: none"></div>
        <div id="screen-statistics" class="screen" style="display: none"></div>
        <div id="screen-engineering" class="screen" style="display: none"></div>
        <div id="screen-settings" class="screen" style="display: none"></div>
        <div id="advisor-overlay"></div>
        <div id="modal-container"></div>
      </div>
    `;

    // Mock storage to ensure clean slate
    CampaignManager.getInstance(new MockStorageProvider());
    MetaManager.getInstance(new MockStorageProvider());
    
    CampaignManager.getInstance().reset();
    MetaManager.getInstance().reset();

    app = new GameApp();
    await app.initialize();
  });

  afterEach(() => {
    if (app) app.stop();
  });

  it(
    "should complete a full campaign flow with roster validation",
    async () => {
      const cm = CampaignManager.getInstance();

      // 1. Start Standard Campaign
      document.getElementById("btn-menu-campaign")?.click();
      
      // Start campaign via wizard UI
      const startBtn = await waitForSelector('[data-focus-id="btn-start-campaign"]');
      startBtn.click();

      // Wait for transitions
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The onCampaignStart callback in GameApp will automatically select the Prologue node
      // and transition to the Equipment Screen.
      expect(document.getElementById("screen-equipment")?.style.display).toBe(
        "flex",
      );

      const registry = (app as any).registry;
      // Launch Mission 1
      const launchBtn = Array.from(
        document.querySelectorAll("#screen-equipment button"),
      ).find((b) => b.textContent?.includes("Launch")) as HTMLElement;
      expect(launchBtn).toBeTruthy();
      launchBtn.click();

      // Mission Screen
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(document.getElementById("screen-mission")?.style.display).toBe(
        "flex",
      );

      // 2. Mission 1: Complete and Debrief
      const mr = registry.missionRunner;
      const deadSoldierId = "soldier_0";
      const prologueNode = cm.getState()?.nodes.find(n => n.rank === 0)!;
      (mr as any).onMissionComplete({
        nodeId: prologueNode.id,
        seed: 0,
        result: "Lost",
        aliensKilled: 5,
        scrapGained: 50,
        intelGained: 0,
        timeSpent: 100,
        soldierResults: [
          {
            soldierId: "soldier_0",
            kills: 2,
            status: "Dead",
            xpBefore: 0,
            xpGained: 0,
            promoted: false,
            recoveryTime: 0,
          },
          {
            soldierId: "soldier_1",
            kills: 1,
            status: "Wounded",
            xpBefore: 0,
            xpGained: 0,
            promoted: false,
            recoveryTime: 0,
          },
          {
            soldierId: "soldier_2",
            kills: 1,
            status: "Healthy",
            xpBefore: 0,
            xpGained: 0,
            promoted: false,
            recoveryTime: 0,
          },
          {
            soldierId: "soldier_3",
            kills: 1,
            status: "Healthy",
            xpBefore: 0,
            xpGained: 0,
            promoted: false,
            recoveryTime: 0,
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(document.getElementById("screen-debrief")?.style.display).toBe(
        "flex",
      );
      expect(
        cm.getState()?.roster.find((s) => s.id === deadSoldierId)?.status,
      ).toBe("Dead");

      // 3. Verify Ready Room redirect after Mission 1 (Tutorial Step)
      const returnBtn = Array.from(
        document.querySelectorAll("#screen-debrief button"),
      ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
      expect(returnBtn).toBeTruthy();
      returnBtn.click();

      // Should redirect to Equipment Screen (Mission 2 Tutorial)
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(document.getElementById("screen-equipment")?.style.display).toBe(
        "flex",
      );

      // Launch Mission 2 from Equipment Screen
      const launchBtn2 = Array.from(
        document.querySelectorAll("#screen-equipment button"),
      ).find((b) => b.textContent?.includes("Launch")) as HTMLElement;
      expect(launchBtn2).toBeTruthy();
      launchBtn2.click();

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(document.getElementById("screen-mission")?.style.display).toBe(
        "flex",
      );

      // Complete Mission 2
      const mr2 = registry.missionRunner;
      const mission2Node = cm.getState()?.nodes.find(n => n.status === "Accessible")!;
      (mr2 as any).onMissionComplete({
        nodeId: mission2Node.id,
        seed: 0,
        result: "Won",
        aliensKilled: 0,
        scrapGained: 50,
        intelGained: 5,
        timeSpent: 200,
        soldierResults: [],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      const returnBtn2 = Array.from(
        document.querySelectorAll("#screen-debrief button"),
      ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
      expect(returnBtn2).toBeTruthy();
      returnBtn2.click();

      // Wait for DOM update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now we should be in the Sector Map (Mission 3 intro)
      expect(document.getElementById("screen-campaign")?.style.display).toBe(
        "flex",
      );

      const nextCombatNode = cm.getState()?.nodes.find(
        (n) =>
          n.status === "Accessible" &&
          (n.type === "Combat" || n.type === "Elite" || n.type === "Boss"),
      )!;

      const nextNode = document.querySelector(
        `.campaign-node[data-id="${nextCombatNode.id}"]`,
      ) as HTMLElement;
      expect(nextNode).toBeTruthy();
      nextNode.click();

      // Wait for transitions
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(document.getElementById("screen-equipment")?.style.display).toBe(
        "flex",
      );

      // In equipment screen, check that the dead soldier is not in the list
      const selectedSoldiers = Array.from(
        document.querySelectorAll(".soldier-list-panel .soldier-item"),
      );
      const isDeadPresent = selectedSoldiers.some((s) =>
        s.textContent?.includes("Dead"),
      );
      expect(isDeadPresent).toBe(false);

      // 4. Verify Boss Win triggers Victory screen
      const bossState = cm.getState()!;
      const bossNode = bossState.nodes.find((n) => n.type === "Boss")!;
      bossNode.status = "Accessible";
      cm.save();

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
      ).find((b) => b.textContent?.includes("Launch")) as HTMLElement;
      expect(launchBtn3).toBeTruthy();
      launchBtn3.click();

      // Complete Boss Mission
      const mr3 = registry.missionRunner;
      (mr3 as any).onMissionComplete({
        nodeId: bossNode.id,
        seed: 0,
        result: "Won",
        aliensKilled: 50,
        scrapGained: 1000,
        intelGained: 5,
        timeSpent: 200,
        soldierResults: [
          {
            soldierId: "soldier_1",
            kills: 20,
            status: "Healthy",
            xpBefore: 0,
            xpGained: 0,
            promoted: false,
            recoveryTime: 0,
          },
        ],
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

      // Summary -> Main Menu
      const menuBtn = Array.from(
        document.querySelectorAll("#screen-campaign-summary button"),
      ).find((b) => b.textContent?.includes("Menu")) as HTMLElement;
      expect(menuBtn).toBeTruthy();
      menuBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(document.getElementById("screen-main-menu")?.style.display).toBe(
        "flex",
      );
      expect(cm.getState()).toBeNull(); // State cleared after victory

      // 5. Verify Ironman Casualties trigger Defeat
      document.getElementById("btn-menu-campaign")?.click();
      
      // Start Ironman via wizard UI
      await new Promise((resolve) => setTimeout(resolve, 100));
      const ironmanCard = Array.from(document.querySelectorAll(".difficulty-card")).find(c => c.textContent?.includes("Ironman")) as HTMLElement;
      expect(ironmanCard).toBeTruthy();
      ironmanCard.click();
      
      const startBtnIM = await waitForSelector('[data-focus-id="btn-start-campaign"]');
      startBtnIM.click();

      // Wait for transitions
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Skip setup and go to equipment because it's rank 0 (Ironman flow)
      expect(document.getElementById("screen-equipment")?.style.display).toBe(
        "flex",
      );

      const launchBtnIM = Array.from(
        document.querySelectorAll("#screen-equipment button"),
      ).find((b) => b.textContent?.includes("Launch")) as HTMLElement;
      expect(launchBtnIM).toBeTruthy();
      launchBtnIM.click();

      // Wait for transition to mission screen
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fail Mission 1
      const mrIM = registry.missionRunner;
      (mrIM as any).onMissionComplete({
        nodeId: cm.getState()?.nodes.find(n => n.rank === 0)?.id || "",
        seed: 0,
        result: "Lost",
        aliensKilled: 0,
        scrapGained: 0,
        intelGained: 0,
        timeSpent: 10,
        soldierResults: [],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      const returnBtnIM = Array.from(
        document.querySelectorAll("#screen-debrief button"),
      ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
      expect(returnBtnIM).toBeTruthy();
      returnBtnIM.click();

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(
        document.getElementById("screen-campaign-summary")?.style.display,
      ).toBe("flex");
      expect(
        document.querySelector("#screen-campaign-summary h1")?.textContent,
      ).toContain("Campaign Defeat");
    },
    30000,
  );
});
