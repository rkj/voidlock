// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  SoldierWidget,
  SoldierWidgetOptions,
} from "@src/renderer/ui/SoldierWidget";
import { Archetype, SquadSoldierConfig, AIProfile } from "@src/shared/types";
import { CampaignSoldier } from "@src/shared/campaign_types";

describe("SoldierWidget Repro", () => {
  it("should not render undefined in squad-builder context with missing archetype", () => {
    const data: SquadSoldierConfig = {
      archetypeId: "unknown_archetype",
      name: "Test Soldier",
      hp: 100,
      maxHp: 100,
    };
    const options: SoldierWidgetOptions = { context: "squad-builder" };
    const el = SoldierWidget.render(data, options);

    expect(el.innerHTML).not.toContain("undefined");
  });

  it("should not render undefined in squad-builder context with Archetype data", () => {
    const data: Archetype = {
      id: "assault",
      name: "Assault",
      baseHp: 100,
      damage: 20,
      fireRate: 600,
      accuracy: 95,
      soldierAim: 90,
      attackRange: 10,
      speed: 20,
      aiProfile: AIProfile.RUSH,
    };
    const options: SoldierWidgetOptions = { context: "squad-builder" };
    const el = SoldierWidget.render(data, options);

    expect(el.innerHTML).not.toContain("undefined");
  });

  it("should not render undefined in roster context with missing archetype", () => {
    const data: CampaignSoldier = {
      id: "s1",
      archetypeId: "unknown",
      name: "Test",
      hp: 100,
      maxHp: 100,
      xp: 0,
      level: 1,
      status: "Healthy",
      equipment: {},
      kills: 0,
      missions: 0,
    };
    const options: SoldierWidgetOptions = { context: "roster" };
    const el = SoldierWidget.render(data, options);

    expect(el.innerHTML).not.toContain("undefined");
  });

  it("should handle case-mismatched archetypeId in squad-builder", () => {
    const data: SquadSoldierConfig = {
      archetypeId: "Scout", // ArchetypeLibrary has "scout"
      name: "John Doe",
      hp: 100,
      maxHp: 100,
    };
    const options: SoldierWidgetOptions = { context: "squad-builder" };
    const el = SoldierWidget.render(data, options);

    expect(el.innerHTML).not.toContain("undefined");
    // If it fails to find the archetype, it should show 0s or defaults, not undefined
    expect(el.textContent).toContain("LVL 1");
  });
});
