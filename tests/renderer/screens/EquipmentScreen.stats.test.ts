// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("EquipmentScreen Stats and Tooltips", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;
  let mockModalService: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };

    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    mockManager = {
      getState: vi.fn().mockReturnValue({
        unlockedItems: ["heavy_plate"],
        roster: [],
        scrap: 1000,
        rules: { economyMode: "Open" },
        unlockedArchetypes: ["assault", "medic", "heavy", "scout"],
      }),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
      spendScrap: vi.fn(),
      assignEquipment: vi.fn(),
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should display compact stats for weapons in the armory", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      null as any,
      undefined, // onLaunch
      false, // isShop
      true // isCampaign
    );
    screen.show();

    // With the refactor, armory items are in .armory-panel
    const armoryItems = Array.from(
      container.querySelectorAll(".armory-panel .menu-item.clickable"),
    );
    const pulseRifle = armoryItems.find((el) =>
      el.textContent?.includes("Pulse Rifle"),
    );

    expect(pulseRifle).toBeDefined();
    // Pulse Rifle stats: damage 20, range 10, fireRate 600
    // Now using StatDisplay (Icons + Values). TextContent will contain values.
    // Armory shows base fire rate: 1000/600 = 1.7 RPS
    expect(pulseRifle?.textContent).toContain("20");
    expect(pulseRifle?.textContent).toContain("1.7");
    expect(pulseRifle?.textContent).toContain("10");
  });

  it("should display compact stats for items (armor/boots) in the armory", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      null as any,
      undefined, // onLaunch
      false, // isShop
      true // isCampaign
    );
    screen.show();

    const armoryItems = Array.from(
      container.querySelectorAll(".armory-panel .menu-item.clickable"),
    );
    const heavyPlate = armoryItems.find((el) =>
      el.textContent?.includes("Heavy Plate Armor"),
    );

    expect(heavyPlate).toBeDefined();
    // Heavy Plate: hpBonus 100, speedBonus -5, accuracyBonus -10
    // Speed bonus is now shown as raw value
    expect(heavyPlate?.textContent).toContain("100");
    expect(heavyPlate?.textContent).toContain("-5");
    expect(heavyPlate?.textContent).toContain("-10");
  });

  it("should have tooltips with descriptions and full stats for armory items", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      null as any,
      undefined, // onLaunch
      false, // isShop
      true // isCampaign
    );
    screen.show();

    const armoryItems = Array.from(
      container.querySelectorAll(".armory-panel .menu-item.clickable"),
    ) as HTMLElement[];
    const pulseRifle = armoryItems.find((el) =>
      el.textContent?.includes("Pulse Rifle"),
    ) as HTMLElement;

    expect(pulseRifle).toBeDefined();
    expect(pulseRifle.title).toContain("Pulse Rifle");
    expect(pulseRifle.title).toContain("Versatile assault rifle");
    expect(pulseRifle.title).toContain("Damage: 20");
    expect(pulseRifle.title).toContain("Range: 10");
    expect(pulseRifle.title).toContain("Rate of Fire: 1.7/s");
  });

  it("should have tooltips for global supply items", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      null as any,
      undefined, // onLaunch
      false, // isShop
      true // isCampaign
    );
    screen.show();

    // Global supplies are in rows with class 'card' in .armory-panel
    const supplyRows = Array.from(
      container.querySelectorAll(".armory-panel .card"),
    ).filter((el) => el.textContent?.includes("Medkit")) as HTMLElement[];

    expect(supplyRows.length).toBeGreaterThan(0);
    const medkitRow = supplyRows[0];
    expect(medkitRow.title).toContain("Medkit");
    expect(medkitRow.title).toContain("Portable medical supplies");
  });
});
