// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("EquipmentScreen Stats and Tooltips", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should display compact stats for weapons in the armory", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const armoryItems = Array.from(
      container.querySelectorAll(".menu-item.clickable"),
    );
    const pulseRifle = armoryItems.find((el) =>
      el.textContent?.includes("Pulse Rifle"),
    );

    expect(pulseRifle).toBeDefined();
    // Pulse Rifle stats: damage 20, range 10, fireRate 600
    // Now using StatDisplay (Icons + Values). TextContent will contain values.
    // 1000/600 = 1.7 RPS
    expect(pulseRifle?.textContent).toContain("20");
    expect(pulseRifle?.textContent).toContain("1.7");
    expect(pulseRifle?.textContent).toContain("10");
  });

  it("should display compact stats for items (armor/boots) in the armory", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const armoryItems = Array.from(
      container.querySelectorAll(".menu-item.clickable"),
    );
    const heavyPlate = armoryItems.find((el) =>
      el.textContent?.includes("Heavy Plate Armor"),
    );

    expect(heavyPlate).toBeDefined();
    // Heavy Plate: hpBonus 150, speedBonus -5, accuracyBonus -10
    // Speed bonus is shown as speedBonus / 10 = -0.5
    expect(heavyPlate?.textContent).toContain("150");
    expect(heavyPlate?.textContent).toContain("-0.5");
    expect(heavyPlate?.textContent).toContain("-10");
  });

  it("should have tooltips with descriptions and full stats for armory items", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const armoryItems = Array.from(
      container.querySelectorAll(".menu-item.clickable"),
    );
    const pulseRifle = armoryItems.find((el) =>
      el.textContent?.includes("Pulse Rifle"),
    ) as HTMLElement;

    expect(pulseRifle).toBeDefined();
    expect(pulseRifle.title).toContain("Pulse Rifle");
    expect(pulseRifle.title).toContain("Versatile assault rifle");
    expect(pulseRifle.title).toContain("Damage: 20");
    expect(pulseRifle.title).toContain("Range: 10");
    expect(pulseRifle.title).toContain("Fire Rate: 600ms");
  });

  it("should have tooltips for global supply items", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    // Global supplies are in rows with border: 1px solid #333
    const supplyRows = Array.from(container.querySelectorAll("div")).filter(
      (el) =>
        el.style.border === "1px solid rgb(51, 51, 51)" &&
        el.textContent?.includes("Medkit"),
    );

    expect(supplyRows.length).toBeGreaterThan(0);
    const medkitRow = supplyRows[0] as HTMLElement;
    expect(medkitRow.title).toContain("Medkit");
    expect(medkitRow.title).toContain("Portable medical supplies");
    expect(medkitRow.title).toContain("Charges: 1");
  });
});
