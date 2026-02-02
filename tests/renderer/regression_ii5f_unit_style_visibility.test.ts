/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MissionSetupManager } from "@src/renderer/app/MissionSetupManager";
import { AppContext } from "@src/renderer/app/AppContext";
import { ConfigManager } from "@src/renderer/ConfigManager";

// Mock dependencies
vi.mock("@src/renderer/visuals/AssetManager", () => ({
  AssetManager: {
    getInstance: vi.fn().mockReturnValue({
      getUnitSprite: vi.fn().mockReturnValue({ complete: true, naturalWidth: 64 }),
      getIcon: vi.fn().mockReturnValue({ complete: true, naturalWidth: 64 }),
    }),
  },
}));

vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
      getColor: vi.fn().mockReturnValue("#000000"),
    }),
  },
}));

vi.mock("@src/renderer/ConfigManager", () => {
  const defaults = {
    mapWidth: 10,
    mapHeight: 10,
    spawnPointCount: 3,
    fogOfWarEnabled: true,
    debugOverlayEnabled: false,
    losOverlayEnabled: false,
    agentControlEnabled: true,
    allowTacticalPause: true,
    unitStyle: "TacticalIcons",
    mapGeneratorType: "DenseShip",
    missionType: "Default",
    lastSeed: 12345,
    themeId: "default",
    squadConfig: { soldiers: [], inventory: {} },
  };
  return {
    ConfigManager: {
      getDefault: vi.fn().mockReturnValue(defaults),
      loadCustom: vi.fn().mockReturnValue(null),
      loadCampaign: vi.fn().mockReturnValue(null),
      loadGlobal: vi.fn().mockReturnValue({ unitStyle: "TacticalIcons", themeId: "default" }),
      saveCustom: vi.fn(),
      saveCampaign: vi.fn(),
      saveGlobal: vi.fn(),
    },
  };
});

describe("MissionSetupManager - Visual Style Visibility (regression_ii5f)", () => {
  let context: AppContext;
  let manager: MissionSetupManager;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="mission-setup-context"></div>
      <div id="setup-content">
        <div id="common-config-section">
          <div id="unit-style-preview" class="style-preview-container"></div>
        </div>
        <div id="map-config-section">
          <select id="map-generator-type"></select>
          <select id="map-theme"></select>
          <input id="map-seed" />
          <input id="map-width" />
          <input id="map-height" />
          <input id="map-spawn-points" />
          <input id="map-starting-threat" />
          <input id="map-base-enemies" />
          <input id="map-enemy-growth" />
          <input type="checkbox" id="toggle-fog-of-war" />
          <input type="checkbox" id="toggle-debug-overlay" />
          <input type="checkbox" id="toggle-los-overlay" />
          <input type="checkbox" id="toggle-agent-control" />
          <input type="checkbox" id="toggle-allow-tactical-pause" />
        </div>
        <div id="squad-builder"></div>
      </div>
    `;

    context = {
      campaignManager: {
        getState: vi.fn().mockReturnValue({
          rules: {
            difficulty: "Standard",
            unitStyle: "TacticalIcons",
            allowTacticalPause: true,
            mapGeneratorType: "DenseShip",
          },
          history: [],
          currentSector: 1,
          roster: [],
        }),
      },
      themeManager: {
        setTheme: vi.fn(),
        getColor: vi.fn().mockReturnValue("#000"),
      },
      screenManager: {
        show: vi.fn(),
      },
      campaignShell: {
        show: vi.fn(),
      },
    } as any;

    manager = new MissionSetupManager(context);
    // Set a campaign node so it uses campaign config path
    manager.currentCampaignNode = { id: "node-1" } as any;
  });

  it("should NOT hide common-config-section in campaign mode", () => {
    manager.loadAndApplyConfig(true); // isCampaign = true

    const commonSection = document.getElementById("common-config-section");
    const mapSection = document.getElementById("map-config-section");

    expect(mapSection?.style.display).toBe("none");
    expect(commonSection?.style.display).not.toBe("none");
  });

  it("should allow changing unit style in campaign mode and persist it", () => {
    manager.loadAndApplyConfig(true);
    expect(manager.unitStyle).toBe("TacticalIcons");

    // Change style via card click
    const spriteCard = document.querySelector('.style-preview-item[data-style="Sprites"]') as HTMLElement;
    expect(spriteCard).not.toBeNull();
    spriteCard.click();
    
    expect(manager.unitStyle).toBe("Sprites");
    expect(ConfigManager.saveCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ mapWidth: 10 }),
      expect.objectContaining({ unitStyle: "Sprites" })
    );
  });

  it("should respect saved preference over campaign rule on reload", () => {
    // Mock saved config
    (ConfigManager.loadCampaign as any).mockReturnValue({
      mapWidth: 10,
      mapHeight: 10,
      lastSeed: 12345,
      squadConfig: { soldiers: [], inventory: {} }
    });

    // Mock loadGlobal to return Sprites
    (ConfigManager.loadGlobal as any).mockReturnValue({
      unitStyle: "Sprites",
      themeId: "default"
    });

    // Mock campaign rule having TacticalIcons
    (context.campaignManager.getState as any).mockReturnValue({
      rules: { 
        difficulty: "Standard" 
      },
      roster: [],
      history: [],
      currentSector: 1,
    });

    manager.loadAndApplyConfig(true);

    expect(manager.unitStyle).toBe("Sprites");
    const activeItem = document.querySelector(".style-preview-item.active");
    expect(activeItem?.getAttribute("data-style")).toBe("Sprites");
  });
});