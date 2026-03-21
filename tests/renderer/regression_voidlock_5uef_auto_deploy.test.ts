// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("SquadBuilder Auto-Deploy Regression", () => {
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
              name: "Existing",
              archetypeId: "assault",
              status: "Healthy",
              equipment: {},
            },
          ],
          scrap: 1000,
          unlockedArchetypes: ["assault"],
        }),
        recruitSoldier: vi.fn().mockReturnValue("new-soldier-id"),
        reviveSoldier: vi.fn(),
      },
      modalService: {
        alert: vi.fn().mockResolvedValue(undefined),
        confirm: vi.fn().mockResolvedValue(true),
        prompt: vi.fn().mockResolvedValue("New Recruit"),
      },
      campaignShell: {
        refresh: vi.fn(),
      },
    } as any;
  });

  it("should auto-deploy newly recruited soldier", async () => {
    const onUpdate = vi.fn();
    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: context.campaignManager as any as any,
      campaignShell: context.campaignShell as any as any,
      modalService: context.modalService as any as any,
      initialSquad: squad,
      missionType: MissionType.Default,
      isCampaign: true,
      onSquadUpdated: onUpdate
    });
    builder.render();

    // Mock that after recruitment, the roster contains the new soldier
    const updatedRoster = [
      {
        id: "s1",
        name: "Existing",
        archetypeId: "assault",
        status: "Healthy",
        equipment: {},
      },
      {
        id: "new-soldier-id",
        name: "New Recruit",
        archetypeId: "assault",
        status: "Healthy",
        equipment: { rightHand: "pistol" },
      },
    ];
    (context.campaignManager.getState as any).mockReturnValue({
      roster: updatedRoster,
      scrap: 900,
      unlockedArchetypes: ["assault"],
    });

    const recruitBtn = container.querySelector(
      ".btn-recruit",
    ) as HTMLButtonElement;
    recruitBtn.click();

    await vi.waitFor(() => {
      expect(context.campaignManager.recruitSoldier).toHaveBeenCalled();
      expect(squad.soldiers.length).toBe(1);
    });

    expect(squad.soldiers[0].id).toBe("new-soldier-id");
    expect(context.campaignShell.refresh).toHaveBeenCalled();
  });

  it("should auto-deploy newly revived soldier", async () => {
    const deadSoldier = {
      id: "dead1",
      name: "Dead",
      archetypeId: "assault",
      status: "Dead",
      equipment: {},
    };
    (context.campaignManager.getState as any).mockReturnValue({
      roster: [deadSoldier],
      scrap: 1000,
      unlockedArchetypes: ["assault"],
      rules: { deathRule: "Clone" },
    });

    const onUpdate = vi.fn();
    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: context.campaignManager as any as any,
      campaignShell: context.campaignShell as any as any,
      modalService: context.modalService as any as any,
      initialSquad: squad,
      missionType: MissionType.Default,
      isCampaign: true,
      onSquadUpdated: onUpdate
    });
    builder.render();

    // Mock that after revival, the soldier is healthy
    const revivedSoldier = {
      ...deadSoldier,
      status: "Healthy",
      equipment: { rightHand: "rifle" },
    };
    (context.campaignManager.getState as any).mockReturnValue({
      roster: [revivedSoldier],
      scrap: 750,
      unlockedArchetypes: ["assault"],
      rules: { deathRule: "Clone" },
    });

    const reviveBtn = container.querySelector(
      ".btn-revive",
    ) as HTMLButtonElement;
    reviveBtn.click();

    await vi.waitFor(() => {
      expect(context.campaignManager.reviveSoldier).toHaveBeenCalledWith("dead1");
      expect(squad.soldiers.length).toBe(1);
    });

    expect(squad.soldiers[0].id).toBe("dead1");
    expect(context.campaignShell.refresh).toHaveBeenCalled();
  });
});
