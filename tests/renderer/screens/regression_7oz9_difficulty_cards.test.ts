// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { InputDispatcher } from "@src/renderer/InputDispatcher";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Mock MetaManager
vi.mock("@src/engine/campaign/MetaManager", () => {
  const mockInstance = {
    getStats: vi.fn().mockReturnValue({
      totalKills: 1000,
      totalCampaignsStarted: 5,
      totalMissionsWon: 3,
    }),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { MetaManager: mockConstructor };
});

// Mock ConfigManager
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    getDefault: vi.fn(() => ({
      allowTacticalPause: true,
      manualDeployment: true, squadConfig: { soldiers: [] } })),
    loadGlobal: vi.fn(() => ({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
    })),
  },
}));

describe("CampaignScreen Difficulty Cards", () => {
  let container: HTMLElement;
  let onNodeSelect: any;
  let onBack: any;
  let mockModalService: any;
  let manager: any;
  let themeManager: ThemeManager;
  let inputDispatcher: InputDispatcher;

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
    themeManager = new ThemeManager();
    vi.spyOn(themeManager, "init").mockResolvedValue(undefined);
    vi.spyOn(themeManager, "getAssetUrl").mockReturnValue("mock-url");
    inputDispatcher = new InputDispatcher();

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
    const screen = new CampaignScreen({
      containerId: "screen-campaign",
      campaignManager: manager,
      themeManager: themeManager as any,
      inputDispatcher: inputDispatcher as any,
      modalService: mockModalService as any,
      onNodeSelect: onNodeSelect,
      onMainMenu: onBack
    });
    screen.show();

    const cards = container.querySelectorAll(".difficulty-card");
    expect(cards.length).toBe(4);

    expect(container.textContent).toContain(t(I18nKeys.screen.campaign.wizard.diff_simulation).split(" (")[0]);
    expect(container.textContent).toContain(t(I18nKeys.screen.campaign.wizard.diff_clone).split(" (")[0]);
    expect(container.textContent).toContain(t(I18nKeys.screen.campaign.wizard.diff_standard).split(" (")[0]);
    expect(container.textContent).toContain(t(I18nKeys.screen.campaign.wizard.diff_ironman).split(" (")[0]);
  });

  it("should update selection and tactical pause checkbox when cards are clicked", () => {
    const screen = new CampaignScreen({
      containerId: "screen-campaign",
      campaignManager: manager,
      themeManager: themeManager as any,
      inputDispatcher: inputDispatcher as any,
      modalService: mockModalService as any,
      onNodeSelect: onNodeSelect,
      onMainMenu: onBack
    });
    screen.show();

    const cards = container.querySelectorAll(".difficulty-card");
    const tacticalPauseCheckbox = document.getElementById(
      "campaign-tactical-pause",
    ) as HTMLInputElement;

    // Default should be checked (from ConfigManager mock)
    expect(tacticalPauseCheckbox.checked).toBe(true);

    // Click Ironman card
    const ironmanCard = cards[3] as HTMLElement;
    ironmanCard.click();

    // Should now be unchecked (Ironman forces it off)
    expect(tacticalPauseCheckbox.checked).toBe(false);

    // Click Simulation card
    const simulationCard = cards[0] as HTMLElement;
    simulationCard.click();

    // Should be checked again
    expect(tacticalPauseCheckbox.checked).toBe(true);
  });
});
