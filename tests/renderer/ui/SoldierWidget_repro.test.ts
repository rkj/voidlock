/**
 * @vitest-environment jsdom
 */
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

describe("SoldierWidget Repro", () => {
  it("should handle missing equipment in roster context", () => {
    const data: any = {
      name: "John Doe",
      archetypeId: "assault",
      xp: 50,
      hp: 100,
      status: "Healthy",
      // equipment is missing
    };
    const options: any = { context: "roster" };
    const el = SoldierWidget.render(data, options);

    expect(el.innerHTML).not.toContain("undefined");
    expect(el.textContent).toContain("John Doe");
    expect(el.textContent).toContain(t(I18nKeys.units.lvl, { level: 1 }));
  });

  it("should handle case-mismatched archetypeId in squad-builder", () => {
    // ArchetypeLibrary keys are usually lowercase, but let's test if it handles "Scout" vs "scout"
    const data: any = {
      name: "John Doe",
      id: "Scout", // Mismatched case
      maxHp: 100,
      soldierAim: 90,
      speed: 20,
    };
    const options: any = { context: "squad-builder" };
    const el = SoldierWidget.render(data, options);

    expect(el.innerHTML).not.toContain("undefined");
    // If it fails to find the archetype, it should show 0s or default values but not crash
    expect(el.textContent).toContain(t(I18nKeys.units.lvl, { level: 1 }));
  });
});
