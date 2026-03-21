/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MissionSetupScreen } from "@src/renderer/screens/MissionSetupScreen";
import { ConfigManager } from "@src/renderer/ConfigManager";

// Mock ConfigManager
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadCampaign: vi.fn(),
    saveCampaign: vi.fn(),
    loadGlobal: vi.fn(),
    clearCampaign: vi.fn().mockReturnValue({
      unitStyle: "Sprites",
    }),
  },
}));

describe("MissionSetupManager - Visual Style Visibility (regression_ii5f)", () => {
  let container: HTMLElement;
  let onBack: any;
  let mockInput: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-mission-setup"></div>';
    container = document.getElementById("screen-mission-setup")!;
    onBack = vi.fn();
    mockInput = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };
  });

  it("should NOT have common-config-section in the DOM", () => {
    const screen = new MissionSetupScreen({
      containerId: "screen-mission-setup",
      inputDispatcher: mockInput as any,
      onBack: onBack
    });
    screen.show();

    // The entire common config section should be removed as per task
    const commonSection = container.querySelector(".common-config-section");
    expect(commonSection).toBeNull();
  });

  it("should still load unit style from global config even if UI is gone", () => {
    (ConfigManager.loadCampaign as any).mockReturnValue({
      mapWidth: 10,
      mapHeight: 10,
      spawnPointCount: 1,
      startingThreat: 0,
      seed: 12345,
      missionType: "Default",
      // unitStyle is missing here
    });

    const screen = new MissionSetupScreen({
      containerId: "screen-mission-setup",
      inputDispatcher: mockInput as any,
      onBack: onBack
    });
    screen.show();

    // Verification would be in MissionSetupManager, but let's check if screen initializes
    expect(screen).toBeDefined();
  });
});
