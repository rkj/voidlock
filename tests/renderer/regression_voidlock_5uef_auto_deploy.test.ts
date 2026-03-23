// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("Regression voidlock-5uef: Auto-Deploy", () => {
  let context: any;
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
              status: "Healthy",
              archetypeId: "assault",
              equipment: {},
            },
          ],
          scrap: 1000,
          unlockedArchetypes: ["assault", "medic"],
        }),
        recruitSoldier: vi.fn(),
        reviveSoldier: vi.fn(),
      },
      campaignShell: {
        refresh: vi.fn(),
      },
      modalService: {
        alert: vi.fn().mockResolvedValue(undefined),
        confirm: vi.fn().mockResolvedValue(true),
        prompt: vi.fn().mockResolvedValue("New Soldier"),
      },
    } as any;
  });

  it("should auto-deploy newly recruited soldier", async () => {
    const onUpdate = vi.fn();
    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: context.campaignManager as any,
      campaignShell: context.campaignShell as any,
      modalService: context.modalService as any,
      initialSquad: squad,
      missionType: MissionType.Default,
      isCampaign: true,
      onSquadUpdated: onUpdate,
    });
    builder.render();

    // Mock that after recruitment, the roster contains the new soldier
    const newSoldierId = "new-s1";
    context.campaignManager.recruitSoldier.mockReturnValue(newSoldierId);
    
    context.campaignManager.getState.mockReturnValue({
      roster: [
        { id: "s1", name: "S1", status: "Healthy", archetypeId: "assault", equipment: {} },
        { id: newSoldierId, name: "New Guy", status: "Healthy", archetypeId: "medic", equipment: {} },
      ],
      scrap: 900,
      unlockedArchetypes: ["assault", "medic"],
      rules: { deathRule: "Simulation" }
    });

    // Simulate recruitment via button click
    const recruitBtn = container.querySelector(".btn-recruit") as HTMLElement;
    recruitBtn.click();

    // Verify recruitSoldier was called
    expect(context.campaignManager.recruitSoldier).toHaveBeenCalled();

    // Verify the new soldier was added to the squad
    expect(squad.soldiers.length).toBe(1);
    expect(squad.soldiers[0].id).toBe(newSoldierId);
    expect(onUpdate).toHaveBeenCalledWith(squad);
  });

  it("should auto-deploy newly revived soldier", async () => {
    // Roster has a dead soldier
    const deadSoldierId = "dead-s1";
    context.campaignManager.getState.mockReturnValue({
      roster: [
        {
          id: deadSoldierId,
          name: "Dead Guy",
          status: "Dead",
          archetypeId: "assault",
          equipment: {},
        },
      ],
      scrap: 1000,
      unlockedArchetypes: ["assault"],
      rules: { deathRule: "Clone" },
    });

    const onUpdate = vi.fn();
    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: context.campaignManager as any,
      campaignShell: context.campaignShell as any,
      modalService: context.modalService as any,
      initialSquad: squad,
      missionType: MissionType.Default,
      isCampaign: true,
      onSquadUpdated: onUpdate,
    });
    builder.render();

    // Mock that after revival, the soldier is healthy
    const reviveBtn = container.querySelector(".btn-revive") as HTMLElement;
    
    context.campaignManager.getState.mockReturnValue({
      roster: [
        {
          id: deadSoldierId,
          name: "Dead Guy",
          status: "Healthy",
          archetypeId: "assault",
          equipment: { rightHand: "pulse_rifle" },
        },
      ],
      scrap: 750,
      unlockedArchetypes: ["assault"],
      rules: { deathRule: "Clone" },
    });

    reviveBtn.click();

    // Verify reviveSoldier was called
    expect(context.campaignManager.reviveSoldier).toHaveBeenCalledWith(
      deadSoldierId,
    );

    // Verify the revived soldier was added to the squad
    expect(squad.soldiers.length).toBe(1);
    expect(squad.soldiers[0].id).toBe(deadSoldierId);
    expect(onUpdate).toHaveBeenCalledWith(squad);
  });
});
