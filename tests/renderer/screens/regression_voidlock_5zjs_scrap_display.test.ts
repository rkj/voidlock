/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";
import { SquadConfig } from "@src/shared/types";

describe("Regression: voidlock-5zjs - Scrap Balance in Equipment Screen", () => {
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
      getSyncStatus: vi.fn().mockReturnValue("local-only"),
      getStorage: vi.fn(),
    };

    const mockMetaManager = {
      getStats: vi.fn().mockReturnValue({
        totalKills: 100,
        totalCampaignsStarted: 5,
        totalMissionsWon: 20,
      }),
    };

    shell = new CampaignShell(
      "screen-campaign-shell",
      mockManager,
      mockMetaManager as any,
      vi.fn(),
      vi.fn(),
    );

    const mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      () => shell.refresh(),
    );

    shell.show("campaign");
    screen.show();

    // Stats should now be in the shell top bar
    const topBar = document.getElementById("campaign-shell-top-bar")!;
    expect(topBar.textContent).toContain("Scrap:");
    expect(topBar.textContent).toContain("450");
    expect(topBar.textContent).toContain("Intel:");
    expect(topBar.textContent).toContain("120");
  });

  it("should not display stats overlay when campaign is NOT active", () => {
    mockManager = {
      getState: vi.fn().mockReturnValue(null),
        getStorage: vi.fn(),
        getSyncStatus: vi.fn().mockReturnValue("local-only"),
    };

    const mockMetaManager = {
      getStats: vi.fn().mockReturnValue({
        totalKills: 100,
        totalCampaignsStarted: 5,
        totalMissionsWon: 20,
      }),
    };

    shell = new CampaignShell(
      "screen-campaign-shell",
      mockManager,
      mockMetaManager as any,
      vi.fn(),
      vi.fn(),
    );

    const mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      () => shell.refresh(),
    );

    shell.show("custom");
    screen.show();

    const topBar = document.getElementById("campaign-shell-top-bar")!;
    expect(topBar.textContent).not.toContain("Scrap:");
  });
});
