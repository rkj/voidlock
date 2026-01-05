// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("Regression: voidlock-eneu - Friendly Weapon Names in Soldier List", () => {
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

  it("should show 'Pulse Rifle' instead of 'pulse_rifle' in the soldier list", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const soldierListTexts = Array.from(
      container.querySelectorAll(".menu-item.clickable div"),
    ).map((el) => el.textContent?.trim());

    // It should NOT contain 'pulse_rifle' (internal ID)
    expect(
      soldierListTexts.some((text) => text === "pulse_rifle / combat_knife"),
    ).toBe(false);

    // It SHOULD contain 'Pulse Rifle' and 'Combat Knife'
    expect(soldierListTexts.some((text) => text?.includes("Pulse Rifle"))).toBe(
      true,
    );
    expect(
      soldierListTexts.some((text) => text?.includes("Combat Knife")),
    ).toBe(true);
  });
});
