/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";

describe("CampaignShell", () => {
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
      getSyncStatus: vi.fn().mockReturnValue("synced"),
    };

    onTabChange = vi.fn();
    onMenu = vi.fn();

    shell = new CampaignShell(
      "screen-campaign-shell",
      manager as any,
      onTabChange,
      onMenu,
    );
  });

  it("should render campaign info in campaign mode", () => {
    shell.show("campaign", "sector-map");

    expect(container.innerHTML).toContain("CAMPAIGN MODE");
    expect(container.innerHTML).toContain("SECTOR 2");
    expect(container.innerHTML).toContain("SCRAP:");
    expect(container.innerHTML).toContain("500");
    expect(container.innerHTML).toContain("INTEL:");
    expect(container.innerHTML).toContain("10");

    // Check tabs
    expect(container.innerHTML).toContain("SECTOR MAP");
    expect(container.innerHTML).toContain("BARRACKS");
    expect(container.innerHTML).toContain("SERVICE RECORD");
    expect(container.innerHTML).toContain("SETTINGS");
  });

  it("should render statistics info in statistics mode", () => {
    shell.show("statistics", "stats");

    expect(container.innerHTML).toContain("SERVICE RECORD");
    expect(container.innerHTML).toContain("GLOBAL STATISTICS");
    expect(container.innerHTML).not.toContain("SCRAP:");

    // Check for specific tabs
    const buttons = Array.from(container.querySelectorAll("button"));
    const labels = buttons.map((b) => b.textContent);

    expect(labels).toContain("SERVICE RECORD");
    expect(labels).toContain("MAIN MENU");
    expect(labels).not.toContain("SECTOR MAP");
  });

  it("should handle Main Menu tab click in statistics mode", () => {
    shell.show("statistics", "stats");

    const menuBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "MAIN MENU",
    );
    expect(menuBtn).toBeDefined();

    menuBtn?.click();
    expect(onMenu).toHaveBeenCalled();
  });

  it("should render custom mission info in custom mode", () => {
    shell.show("custom");

    expect(container.innerHTML).toContain("CUSTOM MISSION");
    expect(container.innerHTML).toContain("SIMULATION SETUP");
    expect(container.innerHTML).not.toContain("SCRAP:");
  });

  it("should call onTabChange when a tab is clicked", () => {
    shell.show("campaign", "sector-map");

    const barracksBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "BARRACKS",
    );
    expect(barracksBtn).toBeDefined();

    barracksBtn?.click();
    expect(onTabChange).toHaveBeenCalledWith("barracks");
  });

  it("should call onTabChange when Settings tab is clicked", () => {
    shell.show("campaign", "sector-map");

    const settingsBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "SETTINGS",
    );
    expect(settingsBtn).toBeDefined();

    settingsBtn?.click();
    expect(onTabChange).toHaveBeenCalledWith("settings");
  });

  it("should call onMenu when Main Menu button is clicked", () => {
    shell.show("campaign");

    const menuBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "MAIN MENU",
    );
    expect(menuBtn).toBeDefined();

    menuBtn?.click();
    expect(onMenu).toHaveBeenCalled();
  });

  it("should hide when hide is called", () => {
    shell.show("campaign");
    expect(container.style.display).toBe("flex");

    shell.hide();
    expect(container.style.display).toBe("none");
  });
});
