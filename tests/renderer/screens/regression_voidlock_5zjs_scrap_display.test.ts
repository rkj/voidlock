import { InputDispatcher } from "@src/renderer/InputDispatcher";
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";
import { SquadConfig } from "@src/shared/types";

describe("Regression: voidlock-5zjs - Scrap Balance in Equipment Screen", () => {
  let mockInputDispatcher: any;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;
  let shell: CampaignShell;

  beforeEach(() => {
    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };
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
        roster: [],
      }),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
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

    shell = new CampaignShell({containerId: "screen-campaign-shell",
      manager: mockManager,
      metaManager: mockMetaManager as any,
      onTabChange: vi.fn(),
      onMenu: vi.fn(),
      inputDispatcher: { pushContext: vi.fn(), popContext: vi.fn() } as any});

    const mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onSave,
      onUpdate: onBack,
      onLaunch: () => shell.refresh()
    });

    shell.show("campaign");
    screen.show();

    // Stats should now be in the shell top bar
    const topBar = document.getElementById("campaign-shell-top-bar")!;
    expect(topBar.textContent).toContain("Credits:");
    expect(topBar.textContent).toContain("450");
    expect(topBar.textContent).toContain("Intel:");
    expect(topBar.textContent).toContain("120");
  });

  it("should not display stats overlay when campaign is NOT active", () => {
    mockManager = {
      getState: vi.fn().mockReturnValue(null),
        getStorage: vi.fn(),
        addChangeListener: vi.fn(),
        removeChangeListener: vi.fn(),
        getSyncStatus: vi.fn().mockReturnValue("local-only"),
    };

    const mockMetaManager = {
      getStats: vi.fn().mockReturnValue({
        totalKills: 100,
        totalCampaignsStarted: 5,
        totalMissionsWon: 20,
      }),
    };

    shell = new CampaignShell({containerId: "screen-campaign-shell",
      manager: mockManager,
      metaManager: mockMetaManager as any,
      onTabChange: vi.fn(),
      onMenu: vi.fn(),
      inputDispatcher: { pushContext: vi.fn(), popContext: vi.fn() } as any});

    const mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onSave,
      onUpdate: onBack,
      onLaunch: () => shell.refresh()
    });

    shell.show("custom");
    screen.show();

    const topBar = document.getElementById("campaign-shell-top-bar")!;
    expect(topBar.textContent).not.toContain("Credits:");
  });
});
