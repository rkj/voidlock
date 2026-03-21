/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";

describe("CampaignShell", () => {
  let container: HTMLElement;
  let shell: CampaignShell;
  let onTabChange: any;
  let onBack: any;
  let mockManager: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-campaign-shell"></div>';
    container = document.getElementById("screen-campaign-shell")!;
    onTabChange = vi.fn();
    onBack = vi.fn();

    mockManager = {
      getState: vi.fn(() => ({
        currentSector: 2,
        scrap: 500,
        intel: 10,
        totalKills: 100,
        totalMissions: 5,
        missionsWon: 20,
      })),
      getSyncStatus: vi.fn(() => "synced"),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
    };

    const mockMetaManager = {
      getStats: vi.fn(() => ({
        totalKills: 100,
        totalCampaignsStarted: 5,
        totalMissionsWon: 20,
      })),
    };

    shell = new CampaignShell({ containerId: "screen-campaign-shell",
      manager: mockManager,
      metaManager: mockMetaManager as any,
      onTabChange: onTabChange,
      onMenu: onBack,
      inputDispatcher: { pushContext: vi.fn(), popContext: vi.fn() } as any });
  });

  it("should render correctly when shown", () => {
    shell.show("campaign", "sector-map");
    expect(container.style.display).toBe("flex");
    expect(container.innerHTML).not.toBe("");
  });

  it("should render campaign info in campaign mode", () => {
    shell.show("campaign", "sector-map");

    expect(container.innerHTML).toContain("Active Contract");
    expect(container.innerHTML).toContain("Sector 2");
    expect(container.innerHTML).toContain("Credits:");
    expect(container.innerHTML).toContain("500");
    expect(container.innerHTML).toContain("Intel:");
    expect(container.innerHTML).toContain("10");

    // Check tabs
    expect(container.innerHTML).toContain("Operational Map");
    expect(container.innerHTML).toContain("Asset Management Hub");
  });

  it("should render statistics info in statistics mode", () => {
    shell.show("statistics", "stats");

    expect(container.innerHTML).toContain("Operational Logs");
    expect(container.innerHTML).toContain("Asset Statistics");
    expect(container.innerHTML).not.toContain("Credits:");
  });

  it("should render custom mission info in custom mode", () => {
    shell.show("custom");

    expect(container.innerHTML).toContain("Simulated Operation");
    expect(container.innerHTML).toContain("Simulation Protocol");
    expect(container.innerHTML).not.toContain("Credits:");
  });

  it("should call onTabChange when a tab is clicked", () => {
    shell.show("campaign", "sector-map");

    const buttons = Array.from(container.querySelectorAll(".tab-button"));
    const readyRoomBtn = buttons.find(
      (b) => b.textContent === "Asset Management Hub",
    );
    expect(readyRoomBtn).toBeDefined();

    readyRoomBtn?.click();
    expect(onTabChange).toHaveBeenCalledWith("ready-room");
  });

  it("should call onTabChange when Settings tab is clicked", () => {
    shell.show("campaign", "sector-map");

    const buttons = Array.from(container.querySelectorAll(".tab-button"));
    const settingsBtn = buttons.find(
      (b) => b.textContent === "Terminal",
    );
    expect(settingsBtn).toBeDefined();

    settingsBtn?.click();
    expect(onTabChange).toHaveBeenCalledWith("settings");
  });

  it("should call onBack when back button is clicked", () => {
    shell.show("campaign");
    const backBtn = container.querySelector(".back-button") as HTMLElement;
    backBtn.click();
    expect(onBack).toHaveBeenCalled();
  });

  it("should hide when hide is called", () => {
    shell.show("campaign");
    expect(container.style.display).toBe("flex");

    shell.hide();
    expect(container.style.display).toBe("none");
  });
});
