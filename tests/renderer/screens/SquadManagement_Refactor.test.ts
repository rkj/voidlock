import { InputDispatcher } from "@src/renderer/InputDispatcher";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { ModalService } from "@src/renderer/ui/ModalService";
import { SquadConfig } from "@src/shared/types";

describe("EquipmentScreen - Squad Management Refactor", () => {
  let mockInputDispatcher: any;
  let container: HTMLElement;
  let manager: CampaignManager;
  let modalService: ModalService;
  let initialConfig: SquadConfig;
  let onBack: any;

  beforeEach(() => {
    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    
    manager = new CampaignManager(
      new MockStorageProvider(),
      new MetaManager(new MockStorageProvider())
    );

    modalService = {
      alert: vi.fn(),
      confirm: vi.fn(),
      prompt: vi.fn(),
    } as any;

    initialConfig = {
      soldiers: [
        {
          id: "s1",
          name: "Soldier 1",
          archetypeId: "assault",
          hp: 150,
          maxHp: 150,
          soldierAim: 80,
          equipment: { rightHand: "pulse_rifle" },
        },
      ],
      inventory: {},
    } as any;

    onBack = vi.fn();
  });

  it("should show 4 slots in the soldier list even if fewer soldiers are in squad", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: manager,
      modalService: modalService as any,
      currentSquad: initialConfig,
      onBack: onBack
    });
    screen.show();

    const slots = container.querySelectorAll(".soldier-item-container");
    // Wait, EquipmentScreen.tsx uses renderSoldierListItems which doesn't use .soldier-item-container
    // Ah! It uses .soldier-widget or .menu-item
    const items = container.querySelectorAll(".soldier-list-panel .menu-item, .soldier-list-panel .soldier-widget");
    expect(items.length).toBe(4);
  });

  it("should show Recruit/Revive options in the inspector when an empty slot is selected", () => {
    manager.startNewCampaign(123, "normal");
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: manager,
      modalService: modalService as any,
      currentSquad: initialConfig,
      onBack: onBack,
      onUpdate: undefined,
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    // Select an empty slot
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item, .soldier-list-panel .soldier-widget");
    (slots[1] as HTMLElement).click();

    const inspector = container.querySelector(".soldier-equipment-panel");
    expect(inspector?.textContent).toContain("Acquire New Asset");
    expect(inspector?.textContent).toContain("Restore Lost Asset");
  });

  it("should show available roster soldiers in the Right Panel when an empty slot is selected", () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    state.roster = [
      {
        id: "s1",
        name: "Soldier 1",
        archetypeId: "assault",
        hp: 150,
        maxHp: 150,
        soldierAim: 80,
        status: "Healthy",
        equipment: {},
        xp: 0,
        level: 1,
        kills: 0,
        missions: 0,
      },
      {
        id: "s2",
        name: "Soldier 2",
        archetypeId: "medic",
        hp: 100,
        maxHp: 100,
        soldierAim: 70,
        status: "Healthy",
        equipment: {},
        xp: 0,
        level: 1,
        kills: 0,
        missions: 0,
      },
    ];

    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: manager,
      modalService: modalService as any,
      currentSquad: { soldiers: [state.roster[0]], inventory: {} },
      onBack: onBack,
      onUpdate: undefined,
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    // Select an empty slot
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item, .soldier-list-panel .soldier-widget");
    (slots[1] as HTMLElement).click();

    const rightPanel = container.querySelector(".armory-panel");
    expect(rightPanel?.textContent).toContain("Asset Reserve");
    expect(rightPanel?.textContent).toContain("Soldier 2");
  });

  it("should allow adding a soldier from the roster to an empty slot", () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    state.roster = [
      { id: "s1", name: "Soldier 1", status: "Healthy", equipment: {}, xp: 0, level: 1, archetypeId: "assault", hp: 100, maxHp: 100, soldierAim: 80, kills: 0, missions: 0 },
      { id: "s2", name: "Soldier 2", status: "Healthy", equipment: {}, xp: 0, level: 1, archetypeId: "medic", hp: 100, maxHp: 100, soldierAim: 70, kills: 0, missions: 0 },
    ];

    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: manager,
      modalService: modalService as any,
      currentSquad: { soldiers: [state.roster[0]], inventory: {} },
      onBack: onBack,
      onUpdate: undefined,
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    // Select empty slot
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item, .soldier-list-panel .soldier-widget");
    (slots[1] as HTMLElement).click();

    // Find Soldier 2 in Asset Reserve
    const rosterItems = Array.from(
      container.querySelectorAll(".armory-panel .soldier-item"),
    );
    const soldier2Card = rosterItems.find((el) =>
      el.textContent?.includes("Soldier 2"),
    ) as HTMLElement;
    expect(soldier2Card).toBeTruthy();
    soldier2Card.click();

    const itemsAfter = container.querySelectorAll(".soldier-list-panel .soldier-widget");
    expect(itemsAfter.length).toBe(2);
    expect(itemsAfter[1].textContent).toContain("Soldier 2");
  });

  it("should allow removing a soldier from the squad", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: manager,
      modalService: modalService as any,
      currentSquad: initialConfig,
      onBack: onBack
    });
    screen.show();

    const removeBtn = container.querySelector(".slot-remove") as HTMLElement;
    expect(removeBtn).toBeTruthy();
    removeBtn.click();

    const itemsAfter = container.querySelectorAll(".soldier-list-panel .soldier-widget");
    expect(itemsAfter.length).toBe(0);
  });

  it("should show available archetypes in recruitment picker", () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    state.unlockedArchetypes = ["assault", "medic"];

    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: manager,
      modalService: modalService as any,
      currentSquad: { soldiers: [], inventory: {} },
      onBack: onBack,
      onUpdate: undefined,
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    // Select empty slot
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item, .soldier-list-panel .soldier-widget");
    (slots[0] as HTMLElement).click();

    // Click Acquire New Asset
    const recruitBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Acquire New Asset"),
    ) as HTMLElement;
    expect(recruitBtn).toBeTruthy();
    recruitBtn.click();

    const rightPanel = container.querySelector(".armory-panel");
    expect(rightPanel?.textContent).toContain("Procurement");
    expect(rightPanel?.textContent).toContain("Assault");
    expect(rightPanel?.textContent).toContain("Medic");
  });
});
