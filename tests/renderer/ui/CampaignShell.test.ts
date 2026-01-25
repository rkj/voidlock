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

    expect(container.innerHTML).toContain("Campaign Mode");
    expect(container.innerHTML).toContain("Sector 2");
    expect(container.innerHTML).toContain("SCRAP:");
    expect(container.innerHTML).toContain("500");
    expect(container.innerHTML).toContain("INTEL:");
    expect(container.innerHTML).toContain("10");

    // Check tabs
    expect(container.innerHTML).toContain("Sector Map");
    expect(container.innerHTML).toContain("Barracks");
    expect(container.innerHTML).toContain("Service Record");
  });

  it("should render statistics info in statistics mode", () => {
    shell.show("statistics", "stats");

    expect(container.innerHTML).toContain("Service Record");
    expect(container.innerHTML).toContain("Global Statistics");
    expect(container.innerHTML).not.toContain("SCRAP:");
    expect(container.innerHTML).not.toContain("Sector Map");
  });

  it("should render custom mission info in custom mode", () => {
    shell.show("custom");

    expect(container.innerHTML).toContain("Custom Mission");
    expect(container.innerHTML).toContain("Simulation Setup");
    expect(container.innerHTML).not.toContain("SCRAP:");
  });

  it("should call onTabChange when a tab is clicked", () => {
    shell.show("campaign", "sector-map");

    const barracksBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Barracks",
    );
    expect(barracksBtn).toBeDefined();

    barracksBtn?.click();
    expect(onTabChange).toHaveBeenCalledWith("barracks");
  });

  it("should call onMenu when Main Menu button is clicked", () => {
    shell.show("campaign");

    const menuBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Main Menu",
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
