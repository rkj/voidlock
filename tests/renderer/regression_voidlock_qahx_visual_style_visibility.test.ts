/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MissionSetupManager } from "@src/renderer/app/MissionSetupManager";
import { ConfigManager } from "@src/renderer/ConfigManager";

vi.mock("@src/renderer/ConfigManager", () => {
  const defaults = {
    mapWidth: 10,
    mapHeight: 10,
    spawnPointCount: 3,
    fogOfWarEnabled: true,
    debugOverlayEnabled: false,
    debugSnapshots: false,
    losOverlayEnabled: false,
    agentControlEnabled: true,
    allowTacticalPause: true,
    unitStyle: "TacticalIcons",
    mapGeneratorType: "DenseShip",
    missionType: "Default",
    lastSeed: 12345,
    themeId: "default",
    startingThreatLevel: 0,
    baseEnemyCount: 3,
    enemyGrowthPerMission: 1,
    bonusLootCount: 0,
    manualDeployment: true,
    squadConfig: { soldiers: [], inventory: {} },
  };
  return {
    ConfigManager: {
      getDefault: vi.fn().mockReturnValue(defaults),
      loadCustom: vi.fn().mockReturnValue(defaults),
      loadCampaign: vi.fn().mockReturnValue(defaults),
      loadGlobal: vi
        .fn()
        .mockReturnValue({ unitStyle: "TacticalIcons", themeId: "default" }),
      saveCustom: vi.fn(),
      saveCampaign: vi.fn(),
      saveGlobal: vi.fn(),
    },
  };
});

describe("MissionSetupManager - Visual Style Visibility (regression_voidlock_qahx)", () => {
  let context: any;
  let manager: MissionSetupManager;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="mission-setup-context"></div>
      <div id="setup-content">
        <div id="map-config-section"></div>
      </div>
    `;

    context = {
      campaignManager: {
        getState: vi.fn().mockReturnValue({
          rules: { difficulty: "Standard" },
          history: [],
          currentSector: 1,
          roster: [],
        }),
      },
      themeManager: {
        setTheme: vi.fn(),
      },
      modalService: {
        alert: vi.fn(),
      },
    } as any;

    manager = new MissionSetupManager(
      context.campaignManager,
      context.themeManager,
      context.modalService,
    );
  });

  it("should NOT have visual style group in the DOM in custom simulation mode", () => {
    manager.loadAndApplyConfig(false); // isCampaign = false

    const visualStyleGroup = document.getElementById(
      "setup-visual-style-group",
    );
    expect(visualStyleGroup).toBeNull();
  });

  it("should NOT have visual style group in the DOM in campaign mode", () => {
    manager.loadAndApplyConfig(true); // isCampaign = true

    const visualStyleGroup = document.getElementById(
      "setup-visual-style-group",
    );
    expect(visualStyleGroup).toBeNull();
  });
});
