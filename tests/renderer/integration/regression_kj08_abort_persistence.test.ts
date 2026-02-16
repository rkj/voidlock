/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

// Mock Worker
const postMessageMock = vi.fn();
const terminateMock = vi.fn();

class MockWorker {
  onmessage: any = null;
  postMessage = postMessageMock;
  terminate = terminateMock;
}

vi.stubGlobal("Worker", MockWorker);

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

const mockModalService = {
  alert: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn().mockResolvedValue(true),
  prompt: vi.fn().mockResolvedValue("New Recruit"),
  show: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { LocalStorageProvider } from "@src/engine/persistence/LocalStorageProvider";

describe("Regression kj08: Abort Persistence", () => {
  let cm: CampaignManager;

  beforeEach(async () => {
    localStorage.clear();
    CampaignManager.resetInstance();
    cm = CampaignManager.getInstance(new LocalStorageProvider());

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Mock getContext for canvas
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
    }) as any;

    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
      </div>
      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar">
             <button id="btn-shell-menu">Menu</button>
          </div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
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
        <div id="map-config-section">
           <input type="number" id="map-seed" />
           <input type="number" id="map-width" value="14" />
           <input type="number" id="map-height" value="14" />
           <input type="number" id="map-spawn-points" value="1" />
           <select id="map-generator-type"><option value="TreeShip">TreeShip</option></select>
           <select id="mission-type"><option value="Default">Default</option></select>
        </div>
        <div id="unit-style-preview"></div>
        <div id="squad-builder"></div>
        <button id="btn-launch-mission" class="primary-button">Launch Mission</button>
        <button id="btn-goto-equipment">Launch</button>
        <button id="btn-setup-back">Back</button>
      </div>
      <div id="screen-mission" class="screen" style="display:none">
        <button id="btn-give-up">Give Up</button>
        <div id="soldier-list"></div>
        <canvas id="game-canvas"></canvas>
        <div id="right-panel"></div>
        <div id="top-bar">
           <div id="game-status"></div>
           <div id="top-threat-fill"></div>
           <div id="top-threat-value"></div>
           <button id="btn-pause-toggle">Pause</button>
           <input type="range" id="game-speed" />
           <span id="speed-value"></span>
        </div>
      </div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
      <div id="screen-statistics" class="screen" style="display:none"></div>
    `;

    vi.resetModules();
    await import("@src/renderer/main");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // Give it a bit of time to initialize
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it("should clear mission persistence but currently FAILS to mark campaign node as cleared on abort", async () => {
    // 1. Start Campaign
    document.getElementById("btn-menu-campaign")?.click();

    await new Promise((resolve) => setTimeout(resolve, 50));
    (
      document.querySelector(
        ".campaign-setup-wizard .primary-button",
      ) as HTMLElement
    ).click();

    await new Promise((resolve) => setTimeout(resolve, 50));

    await cm.load(); // Sync with what wizard did
    const state = cm.getState();
    const combatNode = state!.nodes.find((n) => n.status === "Accessible")!;
    expect(combatNode).toBeDefined();

    // 2. Launch Mission
    (
      document.querySelector(
        `.campaign-node[data-id="${combatNode.id}"]`,
      ) as HTMLElement
    ).click();

    // Select squad member (double click on card)
    const soldierCard = document.querySelector(".soldier-card") as HTMLElement;
    soldierCard?.dispatchEvent(new Event("dblclick"));

    const launchBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Launch"),
    );
    launchBtn?.click();

    const confirmBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Confirm Squad")) as HTMLElement;
    confirmBtn?.click();

    // Click Launch in mission-setup
    document.getElementById("btn-launch-mission")?.click();

    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );

    // Verify session state in localStorage
    expect(localStorage.getItem("voidlock_session_state")).toContain("mission");
    expect(localStorage.getItem("voidlock_mission_config")).not.toBeNull();

    // 3. Abort Mission
    mockModalService.confirm.mockResolvedValue(true);
    document.getElementById("btn-give-up")?.click();

    // Wait for async ModalService.confirm AND potentially in-flight worker messages
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify we are on Debrief screen (per ADR 0004)
    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );
    expect(localStorage.getItem("voidlock_session_state")).toContain(
      "debrief",
    );

    // Verify mission config is cleared
    expect(localStorage.getItem("voidlock_mission_config")).toBeNull();

    // BUG 1: Mission node should be treated as LOST in CampaignManager
    await cm.load();
    const updatedState = cm.getState()!;
    const abortedNode = updatedState.nodes.find((n) => n.id === combatNode.id)!;

    // Spec 4.4: "Treated as a Defeat (Squad Wipe logic applies...)"
    // This implies the node should no longer be Accessible, but Cleared/Lost.
    expect(abortedNode.status).toBe("Cleared");
    expect(updatedState.history.length).toBe(1);
    expect(updatedState.history[0].result).toBe("Lost");

    // BUG 2: Tactical session state should be cleared
    expect(localStorage.getItem("voidlock_mission_tick")).toBeNull();
  });
});
