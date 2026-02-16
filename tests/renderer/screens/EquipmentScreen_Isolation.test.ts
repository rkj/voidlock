// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { MapGeneratorType, MissionType } from "@src/shared/types";
import { ModalService } from "@src/renderer/ui/ModalService";
import { InputDispatcher } from "@src/renderer/InputDispatcher";

describe("EquipmentScreen Isolation", () => {
  let manager: CampaignManager;
  let container: HTMLElement;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="screen-equipment"></div><div id="modal-container"></div>';
    container = document.getElementById("screen-equipment")!;
    
    const storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(storage);
    
    // Start a campaign with some scrap and a dead soldier
    manager.startNewCampaign(123, "Clone");
    const state = manager.getState()!;
    state.scrap = 500;
    state.roster[0].status = "Dead";
    manager.save();

    // Mock InputDispatcher
    vi.spyOn(InputDispatcher.getInstance(), "pushContext").mockImplementation(() => {});
    vi.spyOn(InputDispatcher.getInstance(), "popContext").mockImplementation(() => {});
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

    const screen = new EquipmentScreen(
      "screen-equipment",
      manager,
      squadConfig,
      () => {},
      () => {},
      undefined,
      false, // isShop
      true  // isCampaign
    );

    screen.show();

    // Find the '+' button for frag_grenade (cost 50)
    const plusButtons = Array.from(container.querySelectorAll("button")).filter(b => b.textContent === "+");
    const grenadePlus = plusButtons[0]; // First one is usually frag_grenade
    
    expect(manager.getState()!.scrap).toBe(500);
    
    grenadePlus.click();
    
    expect(manager.getState()!.scrap).toBe(485);
  });

  it("should NOT spend campaign scrap when in CUSTOM mode", () => {
    // This is the failing test case
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

    // We need a way to tell EquipmentScreen it's NOT a campaign.
    // Currently it doesn't have such a flag, it just checks manager.getState()
    const screen = new EquipmentScreen(
      "screen-equipment",
      manager,
      squadConfig,
      () => {},
      () => {},
      undefined,
      false, // isShop
      false // isCampaign
    );

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

    const screen = new EquipmentScreen(
      "screen-equipment",
      manager,
      squadConfig,
      () => {},
      () => {},
      undefined,
      false
    );

    screen.show();

    // Click "Revive Personnel" if it exists, or check if dead soldiers are visible
    // In current implementation, if manager.getState() exists, it shows them.
    
    const revivePersonnelBtn = Array.from(container.querySelectorAll("h2")).find(h => h.textContent === "Revive Personnel");
    // Wait, the title is dynamic. 
    // Let's just look for "btn-revive" or similar
    const reviveBtns = container.querySelectorAll(".btn-revive");
    
    // In CUSTOM mode, we shouldn't even see campaign-related actions if they affect campaign state
    expect(reviveBtns.length).toBe(0);
  });
});
