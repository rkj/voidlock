// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("Regression voidlock-33sa: Click-to-Place", () => {
  let context: any;
  let container: HTMLElement;
  let squad: SquadConfig;

  beforeEach(() => {
    document.body.innerHTML =
      '<div id="squad-builder"></div><button id="btn-goto-equipment"></button><button id="btn-launch-mission"></button>';
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
          rules: { deathRule: "Simulation" }
        }),
        recruitSoldier: vi.fn(),
        reviveSoldier: vi.fn(),
      },
      modalService: {
        alert: vi.fn().mockResolvedValue(undefined),
      },
      campaignShell: {
        refresh: vi.fn(),
      }
    } as any;
  });

  it("should auto-assign to first available slot on single click of roster card", () => {
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

    const rosterCards = container.querySelectorAll(
      ".roster-panel .soldier-card",
    );
    const s1Card = rosterCards[0] as HTMLElement;

    // Simulate single click
    s1Card.click();

    expect(squad.soldiers.length).toBe(1);
    expect(squad.soldiers[0].id).toBe("s1");
    expect(onUpdate).toHaveBeenCalledWith(squad);
  });

  it("should highlight the next available soldier after assignment", () => {
    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: context.campaignManager as any,
      campaignShell: context.campaignShell as any,
      modalService: context.modalService as any,
      initialSquad: squad,
      missionType: MissionType.Default,
      isCampaign: true,
      onSquadUpdated: () => {},
    });
    builder.render();

    const rosterCards = container.querySelectorAll(
      ".roster-panel .soldier-card",
    );
    const s1Card = rosterCards[0] as HTMLElement;
    const s2Card = rosterCards[1] as HTMLElement;

    // Click S1 to assign it
    s1Card.click();

    // S1 is assigned, it should be marked as selected in squad-builder context
    expect(s1Card.classList.contains("selected-for-deployment")).toBe(true);
    
    // The next available soldier (S2) should now be the new selection target if we clicked s1
    expect(builder.selectedId).toBe("s2");
  });

  it("should allow assigning highlighted soldier by clicking an empty slot", () => {
    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: context.campaignManager as any,
      campaignShell: context.campaignShell as any,
      modalService: context.modalService as any,
      initialSquad: squad,
      missionType: MissionType.Default,
      isCampaign: true,
      onSquadUpdated: () => {},
    });
    builder.render();

    // Select the first one (highlights it)
    const s1Card = container.querySelectorAll(
      ".roster-panel .soldier-card",
    )[0] as HTMLElement;
    s1Card.click();
    // After clicking S1, it gets assigned and selection moves to S2
    expect(builder.selectedId).toBe("s2");
    
    // Clear squad so we can test explicit slot assignment for s1
    squad.soldiers = [];
    builder.selectedId = "s1"; // Force select s1 again
    builder.render();

    // Click the second deployment slot.
    const slots = container.querySelectorAll(".deployment-slot");
    const secondSlot = slots[1] as HTMLElement;

    // Dispatch click on slot
    secondSlot.click();

    // S1 should now be in the second slot
    expect(squad.soldiers.length).toBe(1);
    expect(squad.soldiers[0].id).toBe("s1");
  });
});
