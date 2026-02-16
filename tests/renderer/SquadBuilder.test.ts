// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("SquadBuilder Component", () => {
  let context: AppContext;
  let container: HTMLElement;
  let squad: SquadConfig;

  beforeEach(() => {
    document.body.innerHTML =
      '<div id="squad-builder"></div><button id="btn-launch-mission"></button>';
    container = document.getElementById("squad-builder")!;

    squad = {
      soldiers: [],
      inventory: {},
    };

    context = {
      campaignManager: {
        getState: vi.fn().mockReturnValue({
          roster: [],
          scrap: 100,
          unlockedArchetypes: ["assault", "medic"],
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

  it("should render roster and deployment panels", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      context.campaignShell as any,
      context.modalService as any,
      squad,
      MissionType.Default,
      false,
      () => {},
    );
    builder.render();

    expect(container.querySelector(".roster-panel")).not.toBeNull();
    expect(container.querySelector(".deployment-panel")).not.toBeNull();
    // Default mission with no VIP should have 4 slots
    expect(container.querySelectorAll(".deployment-slot").length).toBe(4);
  });

  it("should show total soldiers count", () => {
    squad.soldiers = [{ archetypeId: "assault" }];
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      context.campaignShell as any,
      context.modalService as any,
      squad,
      MissionType.Default,
      false,
      () => {},
    );
    builder.render();

    const countDiv = document.getElementById("squad-total-count");
    expect(countDiv?.textContent).toContain("Total Soldiers: 1/4");
  });

  it("should disable launch button if squad is empty", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      context.campaignShell as any,
      context.modalService as any,
      squad,
      MissionType.Default,
      false,
      () => {},
    );
    builder.render();

    const launchBtn = document.getElementById(
      "btn-launch-mission",
    ) as HTMLButtonElement;
    expect(launchBtn.disabled).toBe(true);
  });

  it("should enable launch button if squad has members", () => {
    squad.soldiers = [{ archetypeId: "assault" }];
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      context.campaignShell as any,
      context.modalService as any,
      squad,
      MissionType.Default,
      false,
      () => {},
    );
    builder.render();

    const launchBtn = document.getElementById(
      "btn-launch-mission",
    ) as HTMLButtonElement;
    expect(launchBtn.disabled).toBe(false);
  });

  it("should lock first slot for Escort VIP mission", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      context.campaignShell as any,
      context.modalService as any,
      squad,
      MissionType.EscortVIP,
      false,
      () => {},
    );
    builder.render();

    expect(container.querySelectorAll(".deployment-slot").length).toBe(5);
    const firstSlot = container.querySelectorAll(".deployment-slot")[0];
    expect(firstSlot.classList.contains("locked")).toBe(true);
    expect(firstSlot.textContent).not.toContain("VIP (Auto-Assigned)");
    expect(firstSlot.textContent).toContain("VIP");
  });

  it("should not have visible slot labels but have aria-labels", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      context.campaignShell as any,
      context.modalService as any,
      squad,
      MissionType.Default,
      false,
      () => {},
    );
    builder.render();

    const slots = container.querySelectorAll(".deployment-slot");
    slots.forEach((slot, i) => {
      expect(slot.textContent).not.toContain(`Slot ${i + 1}`);
      expect(slot.getAttribute("aria-label")).toBe(`Deployment Slot ${i + 1}`);
    });
  });

  it("should allow adding to squad via dblclick on archetype card", () => {
    const onUpdate = vi.fn();
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      context.campaignShell as any,
      context.modalService as any,
      squad,
      MissionType.Default,
      false,
      onUpdate,
    );
    builder.render();

    const assaultCard = container.querySelector(
      ".roster-panel .soldier-card",
    ) as HTMLElement;
    assaultCard.dispatchEvent(new MouseEvent("dblclick"));

    expect(squad.soldiers.length).toBe(1);
    expect(squad.soldiers[0].archetypeId).toBe("assault");
    expect(onUpdate).toHaveBeenCalledWith(squad);
  });

  it("should render stats in archetype cards", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      context.campaignShell as any,
      context.modalService as any,
      squad,
      MissionType.Default,
      false,
      () => {},
    );
    builder.render();

    const assaultCard = container.querySelector(
      ".roster-panel .soldier-card",
    ) as HTMLElement;
    const stats = assaultCard.querySelectorAll(".stat-display");
    expect(stats.length).toBe(5); // Speed, Accuracy, Damage, Fire Rate, Range
  });

  it("should allow removing from squad via click on X", () => {
    squad.soldiers = [{ archetypeId: "assault" }];
    const onUpdate = vi.fn();
    const builder = new SquadBuilder(
      "squad-builder",
      context.campaignManager as any,
      context.campaignShell as any,
      context.modalService as any,
      squad,
      MissionType.Default,
      false,
      onUpdate,
    );
    builder.render();

    const removeBtn = container.querySelector(".slot-remove") as HTMLElement;
    removeBtn.click();

    expect(squad.soldiers.length).toBe(0);
    expect(onUpdate).toHaveBeenCalledWith(squad);
  });
});
