// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import {
  SquadConfig,
} from "@src/shared/types";

describe("EquipmentScreen Consumable Cap Regression (rfw4)", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };

    mockManager = {
      getState: vi.fn().mockReturnValue({ scrap: 1000, intel: 0 }),
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should limit consumable items to a maximum of 2", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const getPlusBtn = () => {
      const rows = Array.from(container.querySelectorAll("div")).filter((el) =>
        el.textContent?.includes("Frag Grenade"),
      );
      const row = rows[0].parentElement!;
      return Array.from(row.querySelectorAll("button")).find(
        (btn) => btn.textContent === "+",
      ) as HTMLButtonElement;
    };

    const getCount = () => {
      const rows = Array.from(container.querySelectorAll("div")).filter((el) =>
        el.textContent?.includes("Frag Grenade"),
      );
      const row = rows[0].parentElement!;
      const controls = row.querySelector(".gap-10") as HTMLElement;
      const countDisplay = controls.querySelector("span") as HTMLElement;
      return countDisplay.textContent;
    };

    let plusBtn = getPlusBtn();
    expect(plusBtn).toBeDefined();
    expect(plusBtn.disabled).toBe(false);

    // Click plus twice
    plusBtn.click();
    plusBtn = getPlusBtn();
    plusBtn.click();

    // Now it should have 2
    expect(getCount()).toBe("2");

    // The plus button should now be disabled
    plusBtn = getPlusBtn();
    expect(plusBtn.disabled).toBe(true);
    expect(plusBtn.title).toBe("Maximum 2 per mission reached");

    // Try to click it again (it shouldn't do anything because it's disabled)
    plusBtn.click();
    expect(getCount()).toBe("2");
  });

  it("should disable plus button if initial config already has 2 items", () => {
    initialConfig.inventory = { frag_grenade: 2 };
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const rows = Array.from(container.querySelectorAll("div")).filter((el) =>
      el.textContent?.includes("Frag Grenade"),
    );
    const row = rows[0].parentElement!;
    const plusBtn = Array.from(row.querySelectorAll("button")).find(
      (btn) => btn.textContent === "+",
    ) as HTMLButtonElement;

    expect(plusBtn.disabled).toBe(true);
    expect(plusBtn.title).toBe("Maximum 2 per mission reached");
  });
});
