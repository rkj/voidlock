// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import {
  SquadConfig,
} from "@src/shared/types";

describe("EquipmentScreen Economics", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;
  let mockState: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    mockState = {
        scrap: 100,
        intel: 0,
        roster: [
            { id: "s1", archetypeId: "assault", equipment: { rightHand: "pulse_rifle", leftHand: "combat_knife" } }
        ]
    };

    initialConfig = {
      soldiers: [{ id: "s1", archetypeId: "assault", rightHand: "pulse_rifle", leftHand: "combat_knife" }],
      inventory: {},
    };

    mockManager = {
      getState: vi.fn(() => mockState),
      spendScrap: vi.fn((amount) => { mockState.scrap -= amount; }),
      assignEquipment: vi.fn()
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should not charge for items already in roster", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const armoryPanel = Array.from(container.querySelectorAll(".panel")).find(p => p.querySelector(".panel-title")?.textContent === "Armory & Supplies") as HTMLElement;

    // Re-select Pulse Rifle (already equipped and in roster)
    const pulseRifleBtn = Array.from(
      armoryPanel.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes("Pulse Rifle")) as HTMLElement;
    
    pulseRifleBtn?.click();

    expect(mockManager.spendScrap).not.toHaveBeenCalled();
    expect(mockState.scrap).toBe(100);
  });

  it("should charge for new items", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const armoryPanel = Array.from(container.querySelectorAll(".panel")).find(p => p.querySelector(".panel-title")?.textContent === "Armory & Supplies") as HTMLElement;

    // Select Pistol (cost 10)
    const pistolBtn = Array.from(
      armoryPanel.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes("Pistol")) as HTMLElement;
    
    pistolBtn?.click();

    expect(mockManager.spendScrap).toHaveBeenCalledWith(10);
    expect(mockState.scrap).toBe(90);
  });

  it("should prevent equipping items that cannot be afforded", () => {
    mockState.scrap = 5; // Cannot afford Pistol (10)
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const armoryPanel = Array.from(container.querySelectorAll(".panel")).find(p => p.querySelector(".panel-title")?.textContent === "Armory & Supplies") as HTMLElement;

    const pistolBtn = Array.from(
      armoryPanel.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes("Pistol")) as HTMLElement;
    
    // Check it's disabled or at least doesn't trigger spendScrap
    pistolBtn?.click();

    expect(mockManager.spendScrap).not.toHaveBeenCalled();
    expect(mockState.scrap).toBe(5);
  });

  it("should update Scrap display after purchase", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const armoryPanel = Array.from(container.querySelectorAll(".panel")).find(p => p.querySelector(".panel-title")?.textContent === "Armory & Supplies") as HTMLElement;

    // Find the stats overlay. We need to look inside container since it's added in render()
    const getScrapText = () => {
        const overlay = container.querySelector(".overlay-stats");
        return overlay?.textContent || "";
    };

    expect(getScrapText()).toContain("Scrap: 100");

    const pistolBtn = Array.from(
      armoryPanel.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes("Pistol")) as HTMLElement;
    pistolBtn?.click();

    expect(getScrapText()).toContain("Scrap: 90");
  });

  it("should not charge for unequipping", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    // Find the Right Hand slot remove button
    const slots = Array.from(container.querySelectorAll(".paper-doll-slot"));
    const rhSlot = slots.find(s => s.textContent?.includes("Right Hand")) as HTMLElement;
    const removeBtn = rhSlot.querySelector("div[style*='color: var(--color-danger)']") as HTMLElement;
    
    removeBtn?.click();

    expect(mockManager.spendScrap).not.toHaveBeenCalled();
    expect(mockState.scrap).toBe(100);
  });

  it("should allow re-equipping original roster items for free", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const armoryPanel = Array.from(container.querySelectorAll(".panel")).find(p => p.querySelector(".panel-title")?.textContent === "Armory & Supplies") as HTMLElement;

    // 1. Unequip Pulse Rifle
    const slots = Array.from(container.querySelectorAll(".paper-doll-slot"));
    const rhSlot = slots.find(s => s.textContent?.includes("Right Hand")) as HTMLElement;
    const removeBtn = rhSlot.querySelector("div[style*='color: var(--color-danger)']") as HTMLElement;
    removeBtn?.click();

    // 2. Re-equip Pulse Rifle from armory
    const pulseRifleBtn = Array.from(
      armoryPanel.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes("Pulse Rifle")) as HTMLElement;
    pulseRifleBtn?.click();

    expect(mockManager.spendScrap).not.toHaveBeenCalled();
    expect(mockState.scrap).toBe(100);
  });

  it("should show OWNED for items in roster", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    // Find the Armory panel
    const panels = Array.from(container.querySelectorAll(".panel"));
    const armoryPanel = panels.find(p => p.querySelector(".panel-title")?.textContent === "Armory & Supplies") as HTMLElement;

    const pulseRifleBtn = Array.from(
      armoryPanel.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes("Pulse Rifle")) as HTMLElement;
    
    expect(pulseRifleBtn.textContent).toContain("Owned");
  });
});
