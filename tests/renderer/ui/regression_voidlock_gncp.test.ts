// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Mock dependencies
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
    }),
  },
}));

describe("Regression GNCP: 'undefined' in soldier card", () => {
  it("should not render 'undefined' when using SquadSoldierConfig in roster context", () => {
    const data: any = {
      name: "Test Scout",
      id: "scout",
      hp: 80,
      maxHp: 80,
      rightHand: "pistol",
      leftHand: "combat_knife",
    };
    const options: any = { context: "roster" };
    const el = SoldierWidget.render(data, options);

    expect(el.innerHTML).not.toContain("undefined");
    expect(el.textContent).toContain("Test Scout");
    expect(el.textContent).toContain(t("units.archetype.scout"));
    expect(el.textContent).toContain(t("units.item.pistol"));
    expect(el.textContent).toContain(t("units.item.combat_knife"));
  });
});
