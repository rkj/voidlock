/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";

describe("CampaignShell Custom Mode Tabs", () => {
  let container: HTMLElement;
  let manager: any;
  let onTabChange: any;
  let onMenu: any;
  let shell: CampaignShell;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-campaign-shell"></div>';
    container = document.getElementById("screen-campaign-shell")!;

    manager = {
      getState: vi.fn().mockReturnValue(null), // No campaign state in custom mode
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

  it("should render Setup, Settings and Service Record tabs in custom mode", () => {
    shell.show("custom");

    const buttons = Array.from(container.querySelectorAll("button"));
    const labels = buttons.map((b) => b.textContent);

    expect(labels).toContain("Setup");
    expect(labels).toContain("Settings");
    expect(labels).toContain("Service Record");
    expect(labels).toContain("Main Menu");
  });
});
