// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { MapGeneratorType, MissionType } from "@src/shared/types";
import { ModalService } from "@src/renderer/ui/ModalService";
import { InputDispatcher } from "@src/renderer/InputDispatcher";

describe("EquipmentScreen Isolation", () => {
  let mockInputDispatcher: any;
  let manager: CampaignManager;
  let container: HTMLElement;

  beforeEach(async () => {
    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };
    document.body.innerHTML = '<div id="screen-equipment"></div><div id="modal-container"></div>';
    container = document.getElementById("screen-equipment")!;
    
    const storage = new MockStorageProvider();
    
    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
    
    // Start a campaign with some scrap and a dead soldier
    manager.startNewCampaign(123, "Clone");
    const state = manager.getState()!;
    state.scrap = 500;
    state.roster[0].status = "Dead";
    manager.save();

    // Mock InputDispatcher
    
    
  });

  it("should spend campaign scrap when in campaign mode", () => {
    const squadConfig = {
      soldiers: [
        { 
          id: manager.getState()!.roster[1].id,
          archetypeId: "assault",
          name: "Test",
          hp: 100,
          maxHp: 100,
          soldierAim: 60,
        }
      ],
      inventory: {}
    };

    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: manager,
      modalService: new ModalService() as any,
      currentSquad: squadConfig,
      onBack: () => {},
      onUpdate: () => {},
      onLaunch: undefined,
      isShop: false,
      isCampaign: true  // isCampaign
    });

    screen.show();

    // Find the '+' button for frag_grenade (cost 15)
    const plusButtons = Array.from(container.querySelectorAll("button")).filter(b => b.textContent === "+");
    const grenadePlus = plusButtons[0]; // First one is usually frag_grenade
    
    expect(manager.getState()!.scrap).toBe(500);
    
    grenadePlus.click();
    
    expect(manager.getState()!.scrap).toBe(485);
  });

  it("should NOT spend campaign scrap when in CUSTOM mode", () => {
    const squadConfig = {
      soldiers: [
        { 
          archetypeId: "assault",
          name: "Custom Hero",
          hp: 100,
          maxHp: 100,
          soldierAim: 60,
        }
      ],
      inventory: {}
    };

    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: manager,
      modalService: new ModalService() as any,
      currentSquad: squadConfig,
      onBack: () => {},
      onUpdate: () => {},
      onLaunch: undefined,
      isShop: false,
      isCampaign: false // isCampaign
    });

    screen.show();

    const plusButtons = Array.from(container.querySelectorAll("button")).filter(b => b.textContent === "+");
    const grenadePlus = plusButtons[0];
    
    expect(manager.getState()!.scrap).toBe(500);
    
    grenadePlus.click();
    
    // IF isolated, scrap should STILL be 500
    expect(manager.getState()!.scrap).toBe(500);
  });

  it("should NOT allow reviving campaign soldiers when in CUSTOM mode", () => {
    const squadConfig = {
      soldiers: [], // Empty slot selected
      inventory: {}
    };

    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: manager,
      modalService: new ModalService() as any,
      currentSquad: squadConfig,
      onBack: () => {},
      onUpdate: () => {},
      onLaunch: undefined,
      isShop: false,
      isCampaign: false // isCampaign
    });

    screen.show();

    const revivePersonnelBtn = Array.from(container.querySelectorAll("h2")).find(h => h.textContent === "Revive Personnel");
    const reviveBtns = container.querySelectorAll(".revive-btn-large");
    
    expect(reviveBtns.length).toBe(0);
  });
});
