// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  SoldierWidget,
  SoldierWidgetOptions,
} from "@src/renderer/ui/SoldierWidget";
import { SquadSoldierConfig } from "@src/shared/types";

describe("Regression GNCP: 'undefined' in soldier card", () => {
  it("should not render 'undefined' when using SquadSoldierConfig in roster context", () => {
    const data: SquadSoldierConfig = {
      archetypeId: "scout",
      name: "Test Scout",
      hp: 80,
      maxHp: 80,
      rightHand: "pistol",
      leftHand: "combat_knife",
    };
    const options: SoldierWidgetOptions = { context: "roster" };

    // This used to throw "Cannot read properties of undefined (reading 'rightHand')"
    // because it expected data.equipment.rightHand
    const el = SoldierWidget.render(data, options);

    expect(el.innerHTML).not.toContain("undefined");
    expect(el.textContent).toContain("TEST SCOUT");
    expect(el.textContent).toContain("SCOUT");
    expect(el.textContent).toContain("PISTOL");
    expect(el.textContent).toContain("COMBAT KNIFE");
  });
});
