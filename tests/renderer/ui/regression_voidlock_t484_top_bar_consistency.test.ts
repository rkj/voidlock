/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";

describe("CampaignShell Consistency", () => {
  let container: HTMLElement;
  let manager: any;
  let onTabChange: any;
  let onMenu: any;
  let shell: CampaignShell;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-campaign-shell"></div>';
    container = document.getElementById("screen-campaign-shell")!;

    manager = {
      getState: vi.fn().mockReturnValue({
        scrap: 500,
        intel: 10,
        currentSector: 2,
        status: "Active",
      }),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
      getSyncStatus: vi.fn().mockReturnValue("local-only"),
      getStorage: vi.fn(),
    };

    onTabChange = vi.fn();
    onMenu = vi.fn();

    const mockMetaManager = {
      getStats: vi.fn().mockReturnValue({
        totalKills: 100,
        totalCampaignsStarted: 5,
        totalMissionsWon: 20,
      }),
    };

    shell = new CampaignShell(
      "screen-campaign-shell",
      manager as any,
      mockMetaManager as any,
      onTabChange,
      onMenu,
    );
  });

  it("should render Main Menu button in the far right and NOT in tabs during Statistics mode", () => {
    shell.show("statistics", "stats");

    const tabsContainer = container.querySelector(".shell-tabs");
    const rightControls = container.querySelector(".shell-controls-right");

    expect(tabsContainer).toBeDefined();
    expect(rightControls).toBeDefined();

    // Check tabs for Main Menu button
    const mainMenuInTabs = Array.from(
      tabsContainer!.querySelectorAll("button"),
    ).find((btn) => btn.textContent === "Main Menu");

    // This is EXPECTED TO FAIL currently because it is in tabs
    expect(
      mainMenuInTabs,
      "Main Menu should NOT be in the shell-tabs container",
    ).toBeUndefined();

    // Check right controls (excluding tabs) for Main Menu button
    // The button should be a direct child of rightControls or at least not in tabs
    const allButtonsInRight = Array.from(
      rightControls!.querySelectorAll("button"),
    );
    const mainMenuInRight = allButtonsInRight.find(
      (btn) => btn.textContent === "Main Menu",
    );

    expect(
      mainMenuInRight,
      "Main Menu button should be present in the right controls",
    ).toBeDefined();

    // Verify it's not the one in tabs (already checked above, but to be explicit)
    if (mainMenuInRight) {
      expect(
        mainMenuInRight.parentElement?.classList.contains("shell-tabs"),
        "Main Menu button should NOT be a child of shell-tabs",
      ).toBe(false);
    }
  });

  it("should render Main Menu button consistently in Campaign mode (Reference)", () => {
    shell.show("campaign", "sector-map");

    const tabsContainer = container.querySelector(".shell-tabs");
    const rightControls = container.querySelector(".shell-controls-right");

    // In campaign mode, Main Menu is outside tabs
    const mainMenuInTabs = Array.from(
      tabsContainer!.querySelectorAll("button"),
    ).find((btn) => btn.textContent === "Main Menu");
    expect(mainMenuInTabs).toBeUndefined();

    const allButtonsInRight = Array.from(
      rightControls!.querySelectorAll("button"),
    );
    const mainMenuInRight = allButtonsInRight.find(
      (btn) => btn.textContent === "Main Menu",
    );
    expect(mainMenuInRight).toBeDefined();
    expect(
      mainMenuInRight!.parentElement?.classList.contains("shell-tabs"),
    ).toBe(false);
  });
});
