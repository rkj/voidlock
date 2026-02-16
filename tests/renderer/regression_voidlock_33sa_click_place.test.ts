// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("SquadBuilder Click-to-Place", () => {
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
              name: "S1",
              archetypeId: "assault",
              status: "Healthy",
              equipment: {},
              hp: 100,
              maxHp: 100,
              soldierAim: 90,
            },
            {
              id: "s2",
              name: "S2",
              archetypeId: "medic",
              status: "Healthy",
              equipment: {},
              hp: 80,
              maxHp: 80,
              soldierAim: 80,
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

  it("should auto-assign to first available slot on single click of roster card", () => {
    const onUpdate = vi.fn();
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      {} as any, // mock campaignShell
      context.modalService as any,
      squad,
      MissionType.Default,
      true, // isCampaign
      onUpdate,
    );
    builder.render();

    const rosterCards = container.querySelectorAll(
      ".roster-panel .soldier-card",
    );
    expect(rosterCards.length).toBe(2);

    (rosterCards[1] as HTMLElement).click();

    expect(squad.soldiers.length).toBe(1);
    expect(squad.soldiers[0].id).toBe("s2");
    expect(onUpdate).toHaveBeenCalled();
  });

  it("should highlight the next available soldier after assignment", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      {} as any, // mock campaignShell
      context.modalService as any,
      squad,
      MissionType.Default,
      true,
      () => {},
    );
    builder.render();

    const rosterCards = container.querySelectorAll(
      ".roster-panel .soldier-card",
    );

    // Initially, maybe first one is highlighted or none. Spec says "Clicking ... marks as 'Selected'".
    // Let's assume clicking selects it.
    (rosterCards[0] as HTMLElement).click();

    // In our "auto-assign" interpretation, it's now in the squad and removed from roster list
    // (the current renderRoster filters out selected soldiers).

    // Wait, if it's removed from roster list, we can't see the highlight on it.
    // The spec says: "The highlight automatically advances to the next available soldier in the roster".

    const newRosterCards = container.querySelectorAll(
      ".roster-panel .soldier-card",
    );
    expect(newRosterCards.length).toBe(1);
    expect(
      newRosterCards[0].classList.contains("selected-for-deployment"),
    ).toBe(true);
  });

  it("should allow assigning highlighted soldier by clicking an empty slot", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      {} as any, // mock campaignShell
      context.modalService as any,
      squad,
      MissionType.Default,
      true,
      () => {},
    );
    builder.render();

    // Select the first one
    const rosterCards = container.querySelectorAll(
      ".roster-panel .soldier-card",
    );
    (rosterCards[0] as HTMLElement).click();

    // Now it's assigned and Roster Card 2 should be highlighted.
    const emptySlots = container.querySelectorAll(
      ".deployment-slot:not(.occupied)",
    );
    (emptySlots[0] as HTMLElement).click(); // Click Slot 2 (since Slot 1 is now occupied)

    expect(squad.soldiers.length).toBe(2);
    expect(squad.soldiers[1].id).toBe("s2");
  });

  it("should maintain or update selection when a soldier is removed from the squad", () => {
    // 1. Start with s1 in squad, s2 in roster (and highlighted)
    squad.soldiers = [
      {
        id: "s1",
        name: "S1",
        archetypeId: "assault",
        hp: 100,
        maxHp: 100,
        soldierAim: 90,
        rightHand: "pulse_rifle",
        leftHand: "combat_knife",
      },
    ];

    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      {} as any, // mock campaignShell
      context.modalService as any,
      squad,
      MissionType.Default,
      true,
      () => {},
    );
    builder.render();

    let rosterCards = container.querySelectorAll(".roster-panel .soldier-card");
    expect(rosterCards.length).toBe(1);
    expect(rosterCards[0].textContent).toContain("S2");
    expect(rosterCards[0].classList.contains("selected-for-deployment")).toBe(
      true,
    );

    // 2. Remove s1 from squad
    const removeBtn = container.querySelector(".slot-remove") as HTMLElement;
    removeBtn.click();

    // 3. Roster should now have s1 and s2.
    // s1 is first in sorted order (Assault vs Medic, or just id/order).
    // Selection should either stay on s2 or move to s1 if s1 is "better".
    // Our implementation currently picks the first available in the sorted list if the old selection is gone,
    // OR it keeps the old one if it's still available.
    rosterCards = container.querySelectorAll(".roster-panel .soldier-card");
    expect(rosterCards.length).toBe(2);

    // s2 was selected and is still available, so it should REMAIN selected.
    const s2Card = Array.from(rosterCards).find((c) =>
      c.textContent?.includes("S2"),
    );
    expect(s2Card?.classList.contains("selected-for-deployment")).toBe(true);
  });
});
