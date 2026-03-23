// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("SquadBuilder - Move Logic", () => {
  let context: any;
  let container: HTMLElement;
  let squad: SquadConfig;

  beforeEach(() => {
    document.body.innerHTML = '<div id="squad-builder"></div>';
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
              status: "Healthy",
              archetypeId: "assault",
              equipment: {},
            },
            {
              id: "s2",
              name: "Soldier 2",
              status: "Healthy",
              archetypeId: "medic",
              equipment: {},
            },
          ],
          scrap: 100,
          unlockedArchetypes: ["assault", "medic"],
        }),
      },
      modalService: {
        alert: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
  });

  it("should remove soldier from roster list when assigned to squad (Campaign)", () => {
    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: context.campaignManager as any,
      campaignShell: {} as any,
      modalService: context.modalService as any,
      initialSquad: squad,
      missionType: MissionType.Default,
      isCampaign: true,
      onSquadUpdated: () => {},
    });
    builder.render();

    // Initially both in roster
    expect(container.querySelectorAll(".roster-panel .soldier-card").length).toBe(
      2,
    );

    // Assign s1
    squad.soldiers = [
      {
        id: "s1",
        name: "Soldier 1",
        archetypeId: "assault",
      },
    ];
    builder.render();

    // Only s2 left in roster
    const rosterCards = container.querySelectorAll(".roster-panel .soldier-card");
    expect(rosterCards.length).toBe(1);
    expect(rosterCards[0].textContent).toContain("Soldier 2");
  });

  it("should remove soldier from roster list when assigned to squad (Campaign, with ID check)", () => {
    squad.soldiers = [
      {
        id: "s1",
        name: "Soldier 1",
        archetypeId: "assault",
      },
    ];
    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: context.campaignManager as any,
      campaignShell: {} as any,
      modalService: context.modalService as any,
      initialSquad: squad,
      missionType: MissionType.Default,
      isCampaign: true,
      onSquadUpdated: () => {},
    });
    builder.render();

    // Initially s2 in roster, s1 in squad
    const rosterCards = container.querySelectorAll(".roster-panel .soldier-card");
    expect(rosterCards.length).toBe(1);
    expect(rosterCards[0].textContent).toContain("Soldier 2");
  });

  it("should remove archetype from roster list when assigned to squad (Custom)", () => {
    const allArchetypes = ["scout", "assault", "medic", "heavy", "sniper", "engineer", "test"];
    context.campaignManager.getState.mockReturnValue({
      roster: [],
      scrap: 1000,
      unlockedArchetypes: allArchetypes,
      rules: { deathRule: "Simulation" }
    });

    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: context.campaignManager as any,
      campaignShell: {} as any,
      modalService: context.modalService as any,
      initialSquad: squad,
      missionType: MissionType.Default,
      isCampaign: false,
      onSquadUpdated: () => {},
    });
    builder.render();

    // Roster should have archetypes (Assault, Medic, Scout, Heavy, VIP - though VIP might be filtered)
    // Actually, in Custom mode, all archetypes are listed.
    const initialCount = container.querySelectorAll(
      ".roster-panel .soldier-card",
    ).length;

    // Assign an assault
    squad.soldiers = [
      {
        archetypeId: "assault",
      },
    ];
    builder.render();

    // In Custom mode, we DON'T remove from roster because you can have multiple of same archetype
    expect(container.querySelectorAll(".roster-panel .soldier-card").length).toBe(
      initialCount,
    );
  });
});
