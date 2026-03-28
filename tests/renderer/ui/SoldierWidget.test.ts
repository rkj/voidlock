// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
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

describe("SoldierWidget", () => {
  const mockUnit: any = {
    id: "u1",
    name: "John Doe",
    archetypeId: "assault",
    hp: 100,
    maxHp: 100,
    state: "Idle",
    isDeployed: true,
    equipment: {},
    kills: 0,
    accuracy: 70,
    speed: 1.0,
    xp: 50,
    stats: {
      damage: 20,
      fireRate: 600,
      accuracy: 95,
      soldierAim: 90,
      attackRange: 10,
      speed: 20,
      equipmentAccuracyBonus: 0,
    },
  };

  const mockResult: any = {
    soldierId: "u1",
    name: "John Doe",
    xpBefore: 50,
    xpGained: 100,
    kills: 5,
    promoted: true,
    newLevel: 2,
    status: "Healthy",
  };

  it("should render tactical context correctly", () => {
    const options: any = { context: "tactical" };
    const el = SoldierWidget.render(mockUnit, options);

    expect(el.classList.contains("soldier-widget-tactical")).toBe(true);
    expect(el.textContent).toContain("John Doe");
    expect(el.textContent).toContain("100/100");
    // Check for icons or localized text in titles
    const speedDisplay = el.querySelector('.stat-display[title]');
    expect(speedDisplay?.getAttribute("title")).toBe(t(I18nKeys.hud.stat.speed));
  });

  it("should render debrief context correctly", () => {
    const options: any = { context: "debrief" };
    const el = SoldierWidget.render(mockResult, options);

    expect(el.classList.contains("soldier-widget-debrief")).toBe(true);
    expect(el.textContent).toContain("John Doe");
    expect(el.textContent).toContain(t(I18nKeys.units.lvl, { level: 1 }));
    expect(el.textContent).toContain("5"); // kills
    expect(el.textContent).toContain(t(I18nKeys.units.level_up));
  });

  it("should render roster context correctly", () => {
    const options: any = { context: "roster" };
    const el = SoldierWidget.render(mockUnit, options);

    expect(el.classList.contains("menu-item")).toBe(true);
    expect(el.textContent).toContain("John Doe");
    expect(el.textContent).toContain(t(I18nKeys.units.lvl, { level: 1 }));
    expect(el.textContent).toContain(t(I18nKeys.units.status.functional));
  });

  it("should render squad-builder context correctly", () => {
    const options: any = { context: "squad-builder" };
    const el = SoldierWidget.render(mockUnit, options);

    expect(el.classList.contains("soldier-card")).toBe(true);
    expect(el.textContent).toContain("John Doe");
    expect(el.textContent).toContain(t(I18nKeys.units.lvl, { level: 1 }));
    expect(el.textContent).toContain(t(I18nKeys.units.status.functional));
  });

  it("should handle double click if provided", () => {
    const onDoubleClick = vi.fn();
    const options: any = { context: "roster", onClick: vi.fn(), onDoubleClick };
    const el = SoldierWidget.render(mockUnit, options);

    // Double click only works if listeners are attached
    // We simulate it by dispatching the event
    el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(onDoubleClick).toHaveBeenCalled();
  });

  it("should handle click and keyboard activation", () => {
    const onClick = vi.fn();
    const options: any = { context: "roster", onClick };
    const el = SoldierWidget.render(mockUnit, options);

    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onClick).toHaveBeenCalledTimes(2);

    el.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("should render recovery time in debrief if wounded", () => {
    const woundedResult = { ...mockResult, status: "Wounded", recoveryTime: 3 };
    const options: any = { context: "debrief" };
    const el = SoldierWidget.render(woundedResult, options);

    expect(el.textContent).toContain(t(I18nKeys.units.recovery_missions, { missions: 3 }));
    expect(el.classList.contains("wounded")).toBe(true);
  });

  it("should render level up in debrief if promoted", () => {
    const promotedResult = { ...mockResult, promoted: true, newLevel: 3 };
    const options: any = { context: "debrief" };
    const el = SoldierWidget.render(promotedResult, options);

    expect(el.textContent).toContain(t(I18nKeys.units.level_up));
    expect(el.textContent).toContain(t(I18nKeys.units.lvl, { level: 3 }));
  });

  it("should render stats in squad-builder context", () => {
    const options: any = { context: "squad-builder" };
    const el = SoldierWidget.render(mockUnit, options);

    // Labels are now in titles of StatDisplay
    expect(el.querySelector(`.stat-display[title="${t(I18nKeys.hud.stat.speed)}"]`)).not.toBeNull();
    expect(el.querySelector(`.stat-display[title="${t(I18nKeys.hud.stat.accuracy)}"]`)).not.toBeNull();
  });
});
