// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { AppContext } from "@src/renderer/app/AppContext";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("SquadBuilder Move Logic", () => {
  let context: AppContext;
  let container: HTMLElement;
  let squad: SquadConfig;

  beforeEach(() => {
    document.body.innerHTML =
      '<div id="squad-builder"></div><button id="btn-goto-equipment"></button>';
    container = document.getElementById("squad-builder")!;

    squad = {
      soldiers: [],
      inventory: {},
    };

    context = {
      campaignManager: {
        getState: vi.fn().mockReturnValue({
          roster: [
            {
              id: "s1",
              name: "Soldier 1",
              archetypeId: "assault",
              status: "Healthy",
              equipment: {},
            },
            {
              id: "s2",
              name: "Soldier 2",
              archetypeId: "medic",
              status: "Healthy",
              equipment: {},
            },
          ],
          scrap: 100,
          unlockedArchetypes: ["assault", "medic"],
          rules: { deathRule: "Standard" },
        }),
        recruitSoldier: vi.fn(),
        reviveSoldier: vi.fn(),
      },
      modalService: {
        alert: vi.fn().mockResolvedValue(undefined),
        confirm: vi.fn().mockResolvedValue(true),
        prompt: vi.fn().mockResolvedValue("New Soldier"),
      },
    } as any;
  });

  it("should remove soldier from roster list when assigned to squad (Campaign)", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context,
      squad,
      MissionType.Default,
      true, // isCampaign
      () => {},
    );
    builder.render();

    // Initially both in roster
    expect(
      container.querySelectorAll(".roster-list .soldier-card").length,
    ).toBe(2);

    // Assign s1 to squad
    squad.soldiers.push({
      id: "s1",
      name: "Soldier 1",
      archetypeId: "assault",
    });
    builder.update(squad, MissionType.Default, true);

    // Now only s2 in roster
    const rosterCards = container.querySelectorAll(
      ".roster-list .soldier-card",
    );
    expect(rosterCards.length).toBe(1);
    expect(rosterCards[0].textContent).toContain("Soldier 2");
    expect(rosterCards[0].textContent).not.toContain("Soldier 1");
  });

  it("should return soldier to roster list when removed from squad (Campaign)", () => {
    squad.soldiers.push({
      id: "s1",
      name: "Soldier 1",
      archetypeId: "assault",
    });
    const builder = new SquadBuilder(
      "squad-builder",
      context,
      squad,
      MissionType.Default,
      true,
      () => {},
    );
    builder.render();

    // Initially s2 in roster, s1 in squad
    expect(
      container.querySelectorAll(".roster-list .soldier-card").length,
    ).toBe(1);
    expect(
      container.querySelector(".roster-list .soldier-card")?.textContent,
    ).toContain("Soldier 2");

    // Remove s1 from squad
    squad.soldiers = [];
    builder.update(squad, MissionType.Default, true);

    // Now both in roster
    expect(
      container.querySelectorAll(".roster-list .soldier-card").length,
    ).toBe(2);
  });

  it("should remove archetype from roster list when assigned to squad (Custom)", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context,
      squad,
      MissionType.Default,
      false, // isCampaign
      () => {},
    );
    builder.render();

    // Roster should have archetypes (Assault, Medic, Scout, Heavy, VIP - though VIP might be filtered)
    // Actually SquadBuilder.ts filters VIP if isEscortMission.
    // Let's count them.
    const initialCount = container.querySelectorAll(
      ".roster-list .soldier-card",
    ).length;
    expect(initialCount).toBeGreaterThan(0);

    // Assign 'assault' to squad
    squad.soldiers.push({ archetypeId: "assault", name: "Custom 1" });
    builder.update(squad, MissionType.Default, false);

    const newCount = container.querySelectorAll(
      ".roster-list .soldier-card",
    ).length;
    expect(newCount).toBe(initialCount - 1);
    expect(
      container.querySelector(".roster-list .soldier-card")?.textContent,
    ).not.toContain("Assault");
  });
});
