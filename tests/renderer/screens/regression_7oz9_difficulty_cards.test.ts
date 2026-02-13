// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

// Mock MetaManager
vi.mock("@src/engine/campaign/MetaManager", () => ({
  MetaManager: {
    getInstance: vi.fn().mockReturnValue({
      getStats: vi.fn().mockReturnValue({
        totalKills: 1000,
        totalCampaignsStarted: 5,
        totalMissionsWon: 3,
      }),
    }),
  },
}));

// Mock ConfigManager
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    getDefault: vi.fn(() => ({
      allowTacticalPause: true,
      manualDeployment: true,
    })),
    loadGlobal: vi.fn(() => ({
      unitStyle: "TacticalIcons",
      themeId: "default",
    })),
  },
}));

describe("CampaignScreen Difficulty Cards", () => {
  let container: HTMLElement;
  let onNodeSelect: any;
  let onBack: any;
  let mockModalService: any;
  let manager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    const storage = {
      load: vi.fn().mockReturnValue(null),
      save: vi.fn(),
      delete: vi.fn(),
    } as any;
    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(storage);

    container = document.createElement("div");
    container.id = "screen-campaign";
    document.body.appendChild(container);

    onNodeSelect = vi.fn();
    onBack = vi.fn();
    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
    };

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
  });

  it("should render 4 difficulty cards", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      {
        campaignManager: manager,
        modalService: mockModalService,
        themeManager: {
          getColor: vi.fn().mockReturnValue("#000"),
          setTheme: vi.fn(),
        },
      } as any,
      onNodeSelect,
      onBack,
    );
    screen.show();

    const cards = container.querySelectorAll(".difficulty-card");
    expect(cards.length).toBe(4);

    expect(container.textContent).toContain("Simulation");
    expect(container.textContent).toContain("Clone");
    expect(container.textContent).toContain("Standard");
    expect(container.textContent).toContain("Ironman");
  });

  it("should update selection and tactical pause checkbox when cards are clicked", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      {
        campaignManager: manager,
        modalService: mockModalService,
        themeManager: {
          getColor: vi.fn().mockReturnValue("#000"),
          setTheme: vi.fn(),
        },
      } as any,
      onNodeSelect,
      onBack,
    );
    screen.show();

    // Show Advanced Settings
    const buttons = container.querySelectorAll("button");
    const advancedToggle = Array.from(buttons).find((b) =>
      b.textContent?.includes("Show Advanced Settings"),
    );
    expect(advancedToggle).toBeTruthy();
    advancedToggle?.click();

    const pauseCheck = container.querySelector(
      "#campaign-tactical-pause",
    ) as HTMLInputElement;
    expect(pauseCheck).toBeTruthy();
    expect(pauseCheck.checked).toBe(true);
    expect(pauseCheck.disabled).toBe(false);

    const cards = container.querySelectorAll(".difficulty-card");
    const ironmanCard = Array.from(cards).find((card) =>
      card.textContent?.includes("Ironman"),
    ) as HTMLElement;
    const simulationCard = Array.from(cards).find((card) =>
      card.textContent?.includes("Simulation"),
    ) as HTMLElement;

    // Click Ironman
    ironmanCard.click();
    expect(ironmanCard.classList.contains("selected")).toBe(true);
    expect(pauseCheck.checked).toBe(false);
    expect(pauseCheck.disabled).toBe(true);

    // Click Simulation
    simulationCard.click();
    expect(simulationCard.classList.contains("selected")).toBe(true);
    expect(ironmanCard.classList.contains("selected")).toBe(false);
    expect(pauseCheck.checked).toBe(true);
    expect(pauseCheck.disabled).toBe(false);
  });
});
