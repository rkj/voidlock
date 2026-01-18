// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { ConfigManager } from "@src/renderer/ConfigManager";

vi.mock("@src/renderer/campaign/CampaignManager", () => ({
  CampaignManager: {
    getInstance: vi.fn(() => ({
      getState: vi.fn(),
      load: vi.fn(),
    })),
  },
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    getDefault: vi.fn(() => ({
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      agentControlEnabled: false,
      unitStyle: "Sprites",
      mapWidth: 14,
      mapHeight: 14,
      lastSeed: 12345,
      mapGeneratorType: "Procedural",
      missionType: "Default",
      squadConfig: { soldiers: [] },
      spawnPointCount: 3,
    })),
    loadCustom: vi.fn(),
    loadCampaign: vi.fn(),
  },
}));

describe("Roster Sorting Regression (voidlock-l7b8)", () => {
  let app: GameApp;
  let mockCampaignManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="squad-builder"></div>
      <div id="mission-setup-context"></div>
      <div id="map-config-section"></div>
      <div id="map-seed"></div>
      <div id="map-generator-type"></div>
      <div id="map-width"></div>
      <div id="map-height"></div>
      <div id="map-spawn-points"></div>
      <div id="map-spawn-points-value"></div>
      <div id="toggle-fog-of-war"></div>
      <div id="toggle-debug-overlay"></div>
      <div id="toggle-los-overlay"></div>
      <div id="toggle-agent-control"></div>
      <div id="toggle-allow-tactical-pause"></div>
      <div id="select-unit-style"></div>
      <div id="mission-type"></div>
    `;

    mockCampaignManager = CampaignManager.getInstance();
    app = new GameApp();
    (app as any).context = {
      campaignManager: mockCampaignManager
    };
  });

  it("should sort roster by status: Healthy > Wounded > Dead", async () => {
    const mockState = {
      roster: [
        { id: "1", name: "Dead Guy", status: "Dead", archetypeId: "assault", level: 1 },
        { id: "2", name: "Healthy Guy", status: "Healthy", archetypeId: "medic", level: 2 },
        { id: "3", name: "Wounded Guy", status: "Wounded", archetypeId: "heavy", level: 3 },
      ],
      rules: {
        difficulty: "Standard",
        themeId: "default",
      },
      history: [],
      currentSector: 1,
    };
    mockCampaignManager.getState.mockReturnValue(mockState);
    
    // We need to trigger renderSquadBuilder(true)
    // GameApp.renderSquadBuilder is private, so we trigger it via loadAndApplyConfig(true)
    // which is also private... but it's called in onCampaignNodeSelected
    
    // Accessing private for testing
    (app as any).renderSquadBuilder(true);

    const cards = document.querySelectorAll(".soldier-card");
    expect(cards.length).toBe(3);
    
    // Healthy should be first
    expect(cards[0].textContent).toContain("Healthy Guy");
    expect(cards[0].classList.contains("dead")).toBe(false);
    expect(cards[0].classList.contains("wounded")).toBe(false);

    // Wounded should be second
    expect(cards[1].textContent).toContain("Wounded Guy");
    expect(cards[1].classList.contains("wounded")).toBe(true);

    // Dead should be last
    expect(cards[2].textContent).toContain("Dead Guy");
    expect(cards[2].classList.contains("dead")).toBe(true);
  });

  it("should add .deployed class to soldiers in squad", () => {
    const mockState = {
      roster: [
        { id: "1", name: "In Squad", status: "Healthy", archetypeId: "assault", level: 1 },
        { id: "2", name: "Out of Squad", status: "Healthy", archetypeId: "medic", level: 2 },
      ],
    };
    mockCampaignManager.getState.mockReturnValue(mockState);
    (app as any).currentSquad = {
        soldiers: [{ id: "1", archetypeId: "assault" }]
    };

    (app as any).renderSquadBuilder(true);

    const cards = document.querySelectorAll(".soldier-card");
    
    const card1 = Array.from(cards).find(c => c.textContent?.includes("In Squad"));
    const card2 = Array.from(cards).find(c => c.textContent?.includes("Out of Squad"));

    expect(card1?.classList.contains("deployed")).toBe(true);
    expect(card2?.classList.contains("deployed")).toBe(false);
  });
});
