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
  })),
}));

vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
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
let currentCampaignState: any = null;

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => currentCampaignState),
        load: vi.fn().mockReturnValue(true),
        reviveSoldier: vi.fn((id) => {
          const s = currentCampaignState.roster.find((r: any) => r.id === id);
          if (s) {
            s.status = "Healthy";
            currentCampaignState.scrap -= 250;
          }
        }),
        recruitSoldier: vi.fn((archId, name) => {
            const id = "new-s";
            currentCampaignState.roster.push({
                id, name, archetypeId: archId, status: "Healthy", level: 1, hp: 100, maxHp: 100, xp: 0, soldierAim: 80, equipment: {}
            });
            currentCampaignState.scrap -= 100;
            return id;
        }),
        spendScrap: vi.fn((amount) => { currentCampaignState.scrap -= amount; return true; }),
      }),
    },
  };
});

describe("Quick Revive in Mission Setup", () => {
  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
      </div>
      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-barracks" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
              <div id="screen-settings" class="screen" style="display:none"></div>
              <div id="screen-engineering" class="screen" style="display:none"></div>
          </div>
      </div>
      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="unit-style-preview"></div>
        <div id="squad-builder"></div>
        <button id="btn-goto-equipment">Equipment</button>
        <button id="btn-setup-back">Back</button>
      </div>
      <div id="screen-mission" class="screen" style="display:none">
        <div id="top-bar"></div>
        <div id="soldier-list"></div>
        <canvas id="game-canvas"></canvas>
        <div id="right-panel"></div>
      </div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;

    currentCampaignState = {
      status: "Active",
      scrap: 500,
      rules: {
        difficulty: "Clone",
        deathRule: "Clone",
        economyMode: "Open"
      },
      unlockedArchetypes: ["assault", "medic", "heavy", "scout"],
      unlockedItems: [],
      roster: [
        {
          id: "s1",
          name: "Dead Soldier",
          archetypeId: "assault",
          status: "Dead",
          level: 1,
          hp: 100,
          maxHp: 100,
          xp: 0,
          soldierAim: 80,
          equipment: {},
        },
      ],
      nodes: [
        {
          id: "node-1",
          type: "Combat",
          status: "Accessible",
          rank: 0,
          connections: [],
          position: { x: 0, y: 0 },
          mapSeed: 123,
          difficulty: 1,
        },
      ],
    };

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Import GameApp and initialize
    vi.resetModules();
    const { GameApp } = await import("@src/renderer/app/GameApp");
    const app = new GameApp();
    await app.initialize();
    app.start();
  });

  const goToEquipment = () => {
    document.getElementById("btn-menu-campaign")?.click();
    (document.querySelector(".campaign-node.accessible") as HTMLElement)?.click();
    document.getElementById("btn-goto-equipment")?.click();
  };

  it("should show Revive button for dead soldiers in Clone mode", async () => {
    goToEquipment();

    expect(document.getElementById("screen-equipment")?.style.display).toBe("flex");

    // Select an empty slot to see the roster/recruitment options
    const emptySlot = Array.from(document.querySelectorAll(".soldier-list-panel .menu-item")).find(
        el => el.textContent?.includes("Empty Slot")
    ) as HTMLElement;
    emptySlot?.click();

    // With the new refactor, Revive button is in the center inspector panel when an empty slot is selected
    // and there are dead soldiers in the roster.
    const reviveBtn = Array.from(document.querySelectorAll(".soldier-equipment-panel button")).find(
        btn => btn.textContent?.includes("Revive Fallen Soldier")
    ) as HTMLButtonElement;
    
    expect(reviveBtn).toBeTruthy();
    expect(reviveBtn.textContent).toContain("250 Scrap");
  });

  it("should disable Revive button if not enough scrap", async () => {
    currentCampaignState.scrap = 100;
    goToEquipment();

    const emptySlot = Array.from(document.querySelectorAll(".soldier-list-panel .menu-item")).find(
        el => el.textContent?.includes("Empty Slot")
    ) as HTMLElement;
    emptySlot?.click();

    const reviveBtn = Array.from(document.querySelectorAll(".soldier-equipment-panel button")).find(
        btn => btn.textContent?.includes("Revive Fallen Soldier")
    ) as HTMLButtonElement;
    
    expect(reviveBtn.classList.contains("disabled") || reviveBtn.disabled).toBe(true);
  });

  it("should call reviveSoldier and refresh UI when clicked", async () => {
    goToEquipment();

    const emptySlot = Array.from(document.querySelectorAll(".soldier-list-panel .menu-item")).find(
        el => el.textContent?.includes("Empty Slot")
    ) as HTMLElement;
    emptySlot?.click();

    const reviveBtn = Array.from(document.querySelectorAll(".soldier-equipment-panel button")).find(
        btn => btn.textContent?.includes("Revive Fallen Soldier")
    ) as HTMLButtonElement;

    reviveBtn.click();

    // After clicking RevivePersonnel, we should see the list of dead soldiers in the right panel
    const deadItem = Array.from(document.querySelectorAll(".armory-panel .soldier-card")).find(
        el => el.textContent?.includes("Dead Soldier")
    ) as HTMLElement;
    
    deadItem.click();

    expect(CampaignManager.getInstance().reviveSoldier).toHaveBeenCalled();
    // Soldier should now be in the squad config
  });

  it("should show Recruit button if less than 4 healthy/wounded soldiers", async () => {
    goToEquipment();

    const emptySlot = Array.from(document.querySelectorAll(".soldier-list-panel .menu-item")).find(
        el => el.textContent?.includes("Empty Slot")
    ) as HTMLElement;
    emptySlot?.click();

    const recruitBtn = Array.from(document.querySelectorAll(".soldier-equipment-panel button")).find(
        btn => btn.textContent?.includes("Recruit New Soldier")
    ) as HTMLButtonElement;
    
    expect(recruitBtn).toBeTruthy();
  });

  it("should NOT show Recruit button if 4 or more healthy/wounded soldiers", async () => {
    currentCampaignState.roster = [
      { id: "s1", name: "S1", archetypeId: "assault", status: "Healthy", level: 1, hp: 100, maxHp: 100, xp: 0, soldierAim: 80, equipment: {} },
      { id: "s2", name: "S2", archetypeId: "assault", status: "Healthy", level: 1, hp: 100, maxHp: 100, xp: 0, soldierAim: 80, equipment: {} },
      { id: "s3", name: "S3", archetypeId: "assault", status: "Healthy", level: 1, hp: 100, maxHp: 100, xp: 0, soldierAim: 80, equipment: {} },
      { id: "s4", name: "S4", archetypeId: "assault", status: "Wounded", level: 1, hp: 100, maxHp: 100, xp: 0, soldierAim: 80, equipment: {} },
    ];

    goToEquipment();

    const emptySlot = Array.from(document.querySelectorAll(".soldier-list-panel .menu-item")).find(
        el => el.textContent?.includes("Empty Slot")
    ) as HTMLElement;
    emptySlot?.click();

    const recruitBtn = Array.from(document.querySelectorAll(".soldier-equipment-panel button")).find(
        btn => btn.textContent?.includes("Recruit New Soldier")
    ) as HTMLButtonElement;
    
    expect(recruitBtn).toBeFalsy();
  });
});