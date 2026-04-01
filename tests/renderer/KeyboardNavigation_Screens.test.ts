/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MainMenuScreen } from "@src/renderer/screens/MainMenuScreen";
import { MissionSetupScreen } from "@src/renderer/screens/MissionSetupScreen";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { InputDispatcher } from "@src/renderer/InputDispatcher";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { SquadConfig } from "@src/shared/types";

describe("Screen Keyboard Navigation Integration", () => {
  let dispatcher: InputDispatcher;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-main-menu"></div>
      <div id="screen-mission-setup"></div>
      <div id="screen-campaign"></div>
      <div id="screen-equipment"></div>
    `;
    dispatcher = new InputDispatcher();
  });

  it("MainMenuScreen should push and pop input context", () => {
    const screen = new MainMenuScreen("screen-main-menu", dispatcher);

    // @ts-ignore - access private for test
    expect(dispatcher.contextStack.length).toBe(0);

    screen.show();
    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(1);
    // @ts-ignore
    expect(dispatcher.contextStack[0].id).toBe("main-menu");

    screen.hide();
    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(0);
  });

  it("MissionSetupScreen should push and pop input context", () => {
    const screen = new MissionSetupScreen({
      containerId: "screen-mission-setup",
      inputDispatcher: dispatcher,
      onBack: () => {},
    });

    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(0);

    screen.show();
    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(1);
    // @ts-ignore
    expect(dispatcher.contextStack[0].id).toBe("mission-setup");

    screen.hide();
    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(0);
  });

  it("CampaignScreen should push and pop input context", () => {
    const manager = new CampaignManager(new MockStorageProvider(), new MetaManager(new MockStorageProvider()));
    manager.startNewCampaign(12345, "Standard");

    const screen = new CampaignScreen({
      metaManager: new MetaManager(new MockStorageProvider()),
      containerId: "screen-campaign",
      campaignManager: manager,
      themeManager: { getAssetUrl: vi.fn(), getColor: vi.fn()  } as any,
      inputDispatcher: dispatcher,
      modalService: {} as any,
      onNodeSelect: () => {},
      onMainMenu: () => {},
    });

    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(0);

    screen.show();
    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(1);
    // @ts-ignore
    expect(dispatcher.contextStack[0].id).toBe("campaign");

    screen.hide();
    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(0);
  });

  it("EquipmentScreen should push and pop input context", () => {
    const manager = new CampaignManager(new MockStorageProvider(), new MetaManager(new MockStorageProvider()));
    manager.startNewCampaign(12345, "Standard");

    const initialConfig: SquadConfig = {
      soldiers: [],
      inventory: {},
      allowTacticalPause: true,
    };

    const screen = new EquipmentScreen({
      containerId: "screen-equipment",
      campaignManager: manager,
      inputDispatcher: dispatcher,
      modalService: {} as any,
      currentSquad: initialConfig,
      onBack: () => {},
    });

    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(0);

    screen.show();
    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(1);
    // @ts-ignore
    expect(dispatcher.contextStack[0].id).toBe("equipment");

    screen.hide();
    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(0);
  });
});
