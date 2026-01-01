// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "./EquipmentScreen";
import { SquadConfig, ArchetypeLibrary, ItemLibrary, WeaponLibrary } from "../../shared/types";

describe("EquipmentScreen", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;
    
    initialConfig = {
      soldiers: [
        { archetypeId: "assault" },
        { archetypeId: "medic" }
      ],
      inventory: { medkit: 1 }
    };
    
    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should render soldier list on show", () => {
    const screen = new EquipmentScreen("screen-equipment", initialConfig, onSave, onBack);
    screen.show();
    
    const soldierItems = container.querySelectorAll(".menu-item.clickable");
    // Only looking at the left panel for now, it should have at least 2 items for 2 soldiers
    // Actually, we render many items (armory also has clickable items).
    // Let's be more specific.
    const soldierNames = Array.from(container.querySelectorAll("div")).map(el => el.textContent?.trim());
    expect(soldierNames.some(name => name?.includes("Assault"))).toBe(true);
    expect(soldierNames.some(name => name?.includes("Medic"))).toBe(true);
  });

  it("should allow selecting a soldier", () => {
    const screen = new EquipmentScreen("screen-equipment", initialConfig, onSave, onBack);
    screen.show();
    
    let soldierItems = Array.from(container.querySelectorAll(".menu-item.clickable")).filter(el => el.textContent?.includes("Medic"));
    let medicItem = soldierItems[0] as HTMLElement;
    medicItem.click();
    
    // After clicking, it re-renders. We need to find the new element.
    soldierItems = Array.from(container.querySelectorAll(".menu-item.clickable")).filter(el => el.textContent?.includes("Medic"));
    medicItem = soldierItems[0] as HTMLElement;
    
    // After clicking, Medic should be active
    expect(medicItem.classList.contains("active")).toBe(true);
  });

  it("should allow adding global items", () => {
    const screen = new EquipmentScreen("screen-equipment", initialConfig, onSave, onBack);
    screen.show();
    
    // Find Frag Grenade row in armory
    const rows = Array.from(container.querySelectorAll("div")).filter(el => el.textContent?.includes("Frag Grenade"));
    const row = rows[0].parentElement!; // The row containing "Frag Grenade" and buttons
    const plusBtn = Array.from(row.querySelectorAll("button")).find(btn => btn.textContent === "+");
    
    plusBtn?.click();
    
    const confirmBtn = Array.from(container.querySelectorAll("button")).find(btn => btn.textContent === "CONFIRM SQUAD");
    confirmBtn?.click();
    
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      inventory: expect.objectContaining({
        frag_grenade: 1,
        medkit: 1
      })
    }));
  });

  it("should allow assigning weapons to soldiers", () => {
    const screen = new EquipmentScreen("screen-equipment", initialConfig, onSave, onBack);
    screen.show();
    
    // Selected soldier is Assault (index 0)
    // Find "Pulse Rifle" in armory
    const pulseRifleBtn = Array.from(container.querySelectorAll(".menu-item.clickable")).find(el => el.textContent?.includes("Pulse Rifle")) as HTMLElement;
    pulseRifleBtn?.click();
    
    const confirmBtn = Array.from(container.querySelectorAll("button")).find(btn => btn.textContent === "CONFIRM SQUAD");
    confirmBtn?.click();
    
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      soldiers: expect.arrayContaining([
        expect.objectContaining({
          archetypeId: "assault",
          rightHand: "pulse_rifle"
        })
      ])
    }));
  });

  it("should calculate stats correctly", () => {
    const screen = new EquipmentScreen("screen-equipment", initialConfig, onSave, onBack);
    screen.show();
    
    // Default Assault HP is 100
    // Find Heavy Plate Armor in armory
    const armorBtn = Array.from(container.querySelectorAll(".menu-item.clickable")).find(el => el.textContent?.includes("Heavy Plate Armor")) as HTMLElement;
    armorBtn?.click();
    
    // Heavy Plate gives +150 HP
    const statsDiv = container.querySelector("div[style*='grid-template-columns: 1fr 1fr']");
    expect(statsDiv?.textContent).toContain("250"); // 100 + 150
  });

  it("should trigger onBack", () => {
    const screen = new EquipmentScreen("screen-equipment", initialConfig, onSave, onBack);
    screen.show();
    
    const backBtn = Array.from(container.querySelectorAll("button")).find(btn => btn.textContent === "BACK");
    backBtn?.click();
    
    expect(onBack).toHaveBeenCalled();
  });
});
