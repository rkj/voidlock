/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";
import { SquadConfig } from "@src/shared/types";

describe("Regression: voidlock-5zjs - Scrap Balance in Equipment Screen", () => {
  let container: HTMLElement;
  let shellContainer: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;
  let shell: CampaignShell;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-campaign-shell">
        <div id="campaign-shell-top-bar"></div>
        <div id="screen-equipment"></div>
      </div>
    `;
    container = document.getElementById("screen-equipment")!;
    shellContainer = document.getElementById("screen-campaign-shell")!;

    initialConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should display Scrap and Intel balance when campaign is active", () => {
    mockManager = {
      getState: vi.fn().mockReturnValue({
        scrap: 450,
        intel: 120,
        currentSector: 1,
      }),
    };

    shell = new CampaignShell(
      "screen-campaign-shell",
      mockManager,
      vi.fn(),
      vi.fn(),
    );

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      () => shell.refresh(),
    );

    shell.show("campaign");
    screen.show();

    // Stats should now be in the shell top bar
    const topBar = document.getElementById("campaign-shell-top-bar")!;
    expect(topBar.textContent).toContain("SCRAP:");
    expect(topBar.textContent).toContain("450");
    expect(topBar.textContent).toContain("INTEL:");
    expect(topBar.textContent).toContain("120");
  });

  it("should not display stats overlay when campaign is NOT active", () => {
    mockManager = {
      getState: vi.fn().mockReturnValue(null),
    };

    shell = new CampaignShell(
      "screen-campaign-shell",
      mockManager,
      vi.fn(),
      vi.fn(),
    );

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      () => shell.refresh(),
    );

    shell.show("custom");
    screen.show();

    const topBar = document.getElementById("campaign-shell-top-bar")!;
    expect(topBar.textContent).not.toContain("SCRAP:");
  });
});
