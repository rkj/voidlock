// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BarracksScreen } from "@src/renderer/screens/BarracksScreen";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { InputDispatcher } from "@src/renderer/InputDispatcher";
import { SquadConfig } from "@src/shared/types";
import { MainMenuScreen } from "@src/renderer/screens/MainMenuScreen";
import { MissionSetupScreen } from "@src/renderer/screens/MissionSetupScreen";

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe("Screen Keyboard Navigation Integration", () => {
  let dispatcher: InputDispatcher;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-barracks"></div>
      <div id="screen-campaign"></div>
      <div id="screen-equipment"></div>
      <div id="screen-main-menu"></div>
      <div id="screen-mission-setup"></div>
    `;
    dispatcher = InputDispatcher.getInstance();
    // @ts-ignore
    dispatcher.contextStack = [];
  });

  it("MainMenuScreen should push and pop input context", () => {
    const screen = new MainMenuScreen("screen-main-menu");

    // @ts-ignore
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
    const onBack = vi.fn();
    const screen = new MissionSetupScreen("screen-mission-setup", onBack);

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

  it("BarracksScreen should push and pop input context", () => {
    CampaignManager.resetInstance();
    const manager = CampaignManager.getInstance(new MockStorageProvider());
    const mockModalService = {} as any;
    const onBack = vi.fn();

    const screen = new BarracksScreen(
      "screen-barracks",
      manager,
      mockModalService,
      onBack,
    );

    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(0);

    screen.show();
    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(1);
    // @ts-ignore
    expect(dispatcher.contextStack[0].id).toBe("barracks");

    screen.hide();
    // @ts-ignore
    expect(dispatcher.contextStack.length).toBe(0);
  });

  it("CampaignScreen should push and pop input context", () => {
    CampaignManager.resetInstance();
    const manager = CampaignManager.getInstance(new MockStorageProvider());
    manager.startNewCampaign(12345, "normal");

    const onNodeSelect = vi.fn();
    const mockModalService = {} as any;

    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      mockModalService,
      onNodeSelect,
      () => {},
    );

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
    CampaignManager.resetInstance();
    const manager = CampaignManager.getInstance(new MockStorageProvider());
    const onBack = vi.fn();
    const onSave = vi.fn();
    const mockConfig: SquadConfig = {
      soldiers: [],
      items: [],
      inventory: {},
      missionsCompleted: 0,
      totalScrap: 0,
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      manager,
      mockConfig,
      onSave,
      onBack,
    );

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
