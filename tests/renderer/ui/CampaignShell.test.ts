// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";
import { t, I18nKeys } from "@src/renderer/i18n";
import { useStandardLocale } from "../i18n/test_helpers";

describe("CampaignShell", () => {
  let container: HTMLElement;
  let mockCampaignManager: any;
  let mockMetaManager: any;
  let mockInputDispatcher: any;
  let onTabChange: any;
  let onMenu: any;
  let shell: CampaignShell;

  beforeEach(() => {
    useStandardLocale();
    container = document.createElement("div");
    container.id = "campaign-shell-container";
    document.body.appendChild(container);

    mockCampaignManager = {
      getState: vi.fn().mockReturnValue({
        scrap: 500,
        intel: 10,
        currentSector: 2,
        nodes: [],
        history: [],
      }),
      addChangeListener: vi.fn(),
      getSyncStatus: vi.fn().mockReturnValue("synced"),
    };

    mockMetaManager = {
      getStats: vi.fn().mockReturnValue({
        totalKills: 100,
        totalCampaignsStarted: 5,
        totalMissionsWon: 20,
      }),
    };

    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };

    onTabChange = vi.fn();
    onMenu = vi.fn();

    shell = new CampaignShell({
      containerId: "campaign-shell-container",
      manager: mockCampaignManager,
      metaManager: mockMetaManager,
      inputDispatcher: mockInputDispatcher,
      onTabChange,
      onMenu,
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should render campaign info in campaign mode", () => {
    shell.show("campaign", "sector-map");

    expect(container.innerHTML).toContain(t(I18nKeys.hud.shell.active_contract));
    expect(container.innerHTML).toContain(t(I18nKeys.hud.shell.sector, { sector: 2 }));

    // Check tabs
    expect(container.innerHTML).toContain(t(I18nKeys.hud.shell.operational_map));
    expect(container.innerHTML).toContain(t(I18nKeys.hud.shell.asset_management_hub));
  });

  it("should render statistics info in statistics mode", () => {
    shell.show("statistics", "stats");

    expect(container.innerHTML).toContain(t(I18nKeys.hud.shell.operational_logs));
    expect(container.innerHTML).toContain(t(I18nKeys.hud.shell.asset_performance_metrics ?? I18nKeys.hud.shell.asset_statistics));
    expect(container.innerHTML).not.toContain("Credits:");
  });

  it("should call onTabChange when Settings tab is clicked", () => {
    shell.show("campaign", "sector-map");

    const settingsBtn = Array.from(container.querySelectorAll(".shell-tab")).find(
      (b) => b.textContent === t(I18nKeys.hud.shell.terminal),
    ) as HTMLElement;
    expect(settingsBtn).toBeDefined();

    settingsBtn?.click();
    expect(onTabChange).toHaveBeenCalledWith("settings");
  });

  it("should call onMenu when Main Menu button is clicked", () => {
    shell.show("campaign", "sector-map");

    const menuBtn = container.querySelector(".back-button") as HTMLElement;
    expect(menuBtn).not.toBeNull();

    menuBtn?.click();
    expect(onMenu).toHaveBeenCalled();
  });
});
