// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import {
  SoldierWidget,
  SoldierWidgetOptions,
} from "@src/renderer/ui/SoldierWidget";
import { UnitState } from "@src/shared/types";
import {
  CampaignSoldier,
  SoldierMissionResult,
} from "@src/shared/campaign_types";

describe("SoldierWidget", () => {
  const mockUnit = {
    id: "s1",
    name: "John Doe",
    tacticalNumber: 1,
    hp: 100,
    maxHp: 100,
    state: UnitState.Idle,
    stats: {
      speed: 10,
      soldierAim: 80,
      equipmentAccuracyBonus: 0,
    },
    engagementPolicy: "ENGAGE",
    activeWeaponId: "rifle",
    leftHand: "rifle",
    rightHand: null,
  } as any;

  const mockCampaignSoldier: CampaignSoldier = {
    id: "s1",
    name: "John Doe",
    archetypeId: "Scout",
    hp: 100,
    maxHp: 100,
    xp: 50,
    level: 1,
    status: "Healthy",
    equipment: {},
    kills: 0,
    missions: 0,
  };

  const mockMissionResult: SoldierMissionResult = {
    soldierId: "s1",
    name: "John Doe",
    status: "Healthy",
    kills: 5,
    xpGained: 100,
    xpBefore: 50,
    promoted: true,
    newLevel: 2,
  };

  it("should render tactical context correctly", () => {
    const options: SoldierWidgetOptions = { context: "tactical" };
    const el = SoldierWidget.render(mockUnit, options);

    expect(el.classList.contains("soldier-widget-tactical")).toBe(true);
    expect(el.querySelector(".u-id")?.textContent).toBe("John Doe (1)");
    expect(el.querySelector(".u-hp")?.textContent).toBe("100/100");
    expect(el.querySelector(".u-status-text")?.textContent).toBe("Idle");
  });

  it("should render weapon stats in tactical context", () => {
    const unitWithWeapons = {
      ...mockUnit,
      leftHand: "pulse_rifle",
      rightHand: "combat_knife",
      activeWeaponId: "pulse_rifle",
      stats: {
        ...mockUnit.stats,
        speed: 20, // 2.0 tiles/s
        soldierAim: 80,
        equipmentAccuracyBonus: 5,
      },
    };
    const options: SoldierWidgetOptions = { context: "tactical" };
    const el = SoldierWidget.render(unitWithWeapons, options);

    // Pulse Rifle: dmg 20, acc 5, range 10, fireRate 600
    // Calculated Accuracy: 80 + 5 + 5 = 90
    // Calculated Fire Rate: fireRate * (10 / speed) = 600 * (10 / 20) = 300ms -> 1000/300 = 3.3

    const lhStats = el.querySelector(".u-lh-stats");
    expect(lhStats?.textContent).toContain("20"); // Damage
    expect(lhStats?.textContent).toContain("90"); // Accuracy
    expect(lhStats?.textContent).toContain("3.3"); // Fire Rate
    expect(lhStats?.textContent).toContain("10"); // Range

    // Check highlighting
    const lhRow = el.querySelector(".u-lh-row") as HTMLElement;
    const rhRow = el.querySelector(".u-rh-row") as HTMLElement;
    expect(lhRow.classList.contains("active-weapon")).toBe(true);
    expect(rhRow.classList.contains("active-weapon")).toBe(false);
  });

  it("should render debrief context correctly", () => {
    const options: SoldierWidgetOptions = { context: "debrief" };
    const el = SoldierWidget.render(mockMissionResult, options);

    expect(el.classList.contains("soldier-widget-debrief")).toBe(true);
    expect(el.classList.contains("debrief-item")).toBe(true);
    expect(el.textContent).toContain("John Doe");
    expect(el.textContent).toContain("LVL 1");
    expect(el.textContent).toContain("Kills: 5");
    expect(el.textContent).toContain("Level Up!");
  });

  it("should render roster context correctly", () => {
    const options: SoldierWidgetOptions = { context: "roster" };
    const el = SoldierWidget.render(mockCampaignSoldier, options);

    expect(el.classList.contains("soldier-widget-roster")).toBe(true);
    expect(el.classList.contains("menu-item")).toBe(true);
    expect(el.textContent).toContain("John Doe");
    expect(el.textContent).toContain("LVL 1");
    expect(el.textContent).toContain("Healthy");
  });

  it("should render squad-builder context correctly", () => {
    const options: SoldierWidgetOptions = { context: "squad-builder" };
    const el = SoldierWidget.render(mockCampaignSoldier, options);

    expect(el.classList.contains("soldier-widget-squad-builder")).toBe(true);
    expect(el.classList.contains("soldier-card")).toBe(true);
    expect(el.textContent).toContain("John Doe");
    expect(el.textContent).toContain("Lvl 1");
    expect(el.textContent).toContain("Status: Healthy");
  });

  it("should reflect selected state", () => {
    const options: SoldierWidgetOptions = {
      context: "tactical",
      selected: true,
    };
    const el = SoldierWidget.render(mockUnit, options);

    expect(el.classList.contains("selected")).toBe(true);
  });

  it("should handle clicks if onClick is provided", () => {
    const onClick = vi.fn();
    const options: SoldierWidgetOptions = { context: "tactical", onClick };
    const el = SoldierWidget.render(mockUnit, options);

    expect(el.classList.contains("clickable")).toBe(true);
    el.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("should reflect dead status visually", () => {
    const deadUnit = { ...mockUnit, state: UnitState.Dead, hp: 0 };
    const options: SoldierWidgetOptions = { context: "tactical" };
    const el = SoldierWidget.render(deadUnit, options);

    expect(el.classList.contains("dead")).toBe(true);
    const hpFill = el.querySelector(".hp-fill") as HTMLElement;
    expect(hpFill.style.width).toBe("0%");
  });

  it("should reflect extracted status visually", () => {
    const extractedUnit = {
      ...mockUnit,
      state: "Extracted",
      status: "Extracted",
    };
    const options: SoldierWidgetOptions = { context: "tactical" };
    const el = SoldierWidget.render(extractedUnit, options);

    expect(el.classList.contains("extracted")).toBe(true);
  });

  it("should render recovery time in debrief if wounded", () => {
    const woundedResult: SoldierMissionResult = {
      ...mockMissionResult,
      status: "Wounded",
      recoveryTime: 3,
    };
    const options: SoldierWidgetOptions = { context: "debrief" };
    const el = SoldierWidget.render(woundedResult, options);

    expect(el.textContent).toContain("Recovery: 3 Missions");
    expect(el.classList.contains("wounded")).toBe(true);
  });

  it("should render level up in debrief if promoted", () => {
    const promotedResult: SoldierMissionResult = {
      ...mockMissionResult,
      promoted: true,
      newLevel: 3,
    };
    const options: SoldierWidgetOptions = { context: "debrief" };
    const el = SoldierWidget.render(promotedResult, options);

    expect(el.textContent).toContain("Level Up! (LVL 3)");
  });

  it("should render archetype name in roster context", () => {
    const options: SoldierWidgetOptions = { context: "roster" };
    const el = SoldierWidget.render(mockCampaignSoldier, options);

    expect(el.textContent).toContain("Scout");
  });

  it("should render stats in squad-builder context", () => {
    const options: SoldierWidgetOptions = { context: "squad-builder" };
    const el = SoldierWidget.render(mockCampaignSoldier, options);

    // StatDisplay.render generates icons and values. Labels are in titles.
    expect(el.querySelector('.stat-display[title="Speed"]')).not.toBeNull();
    expect(el.querySelector('.stat-display[title="Accuracy"]')).not.toBeNull();
  });

  it("should reflect wounded status in squad-builder", () => {
    const woundedSoldier = { ...mockCampaignSoldier, status: "Wounded" };
    const options: SoldierWidgetOptions = { context: "squad-builder" };
    const el = SoldierWidget.render(woundedSoldier, options);

    expect(el.classList.contains("wounded")).toBe(true);
    expect(el.classList.contains("disabled")).toBe(true);
  });

  it("should reflect deployed status in squad-builder", () => {
    const options: SoldierWidgetOptions = {
      context: "squad-builder",
      isDeployed: true,
    };
    const el = SoldierWidget.render(mockCampaignSoldier, options);

    expect(el.classList.contains("deployed")).toBe(true);
  });
});
