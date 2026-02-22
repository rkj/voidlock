// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("EquipmentScreen Regression: Price Formatting", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [{ archetypeId: "assault" }, { archetypeId: "medic" }],
      inventory: { medkit: 1 },
    };

    mockManager = {
      getState: vi.fn().mockReturnValue({
        rules: { economyMode: "Open" },
        scrap: 1000,
        roster: [],
      }),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
      spendScrap: vi.fn(),
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should have width: 100% on price containers in Armory", () => {
    const mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    // Find a weapon button in the armory panel
    const armoryPanel = container.querySelector(".armory-panel")!;
    const weaponBtn = Array.from(
      armoryPanel.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes("Pulse Rifle"));
    expect(weaponBtn).not.toBeNull();

    // The price container should have width: 100%
    const priceContainer = weaponBtn?.querySelector(
      ".armory-item-header",
    ) as HTMLElement;
    expect(priceContainer).not.toBeNull();
    expect(priceContainer.style.width).toBe("100%");
  });

  it("should have width: 100% on price containers in Supplies", () => {
    const mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    // Find Frag Grenade row
    const rows = Array.from(container.querySelectorAll("div")).filter((el) =>
      el.textContent?.includes("Frag Grenade"),
    );
    const nameGroup = rows[0].closest(".flex-col") as HTMLElement;
    expect(nameGroup).not.toBeNull();

    const priceContainer = nameGroup.querySelector(
      ".supply-item-header",
    ) as HTMLElement;
    expect(priceContainer).not.toBeNull();
    expect(priceContainer.style.width).toBe("100%");
  });
});
