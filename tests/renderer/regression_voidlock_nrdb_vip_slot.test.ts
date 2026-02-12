// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { AppContext } from "@src/renderer/app/AppContext";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("SquadBuilder VIP Slot Logic (voidlock-nrdb)", () => {
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
          roster: [],
          scrap: 100,
          unlockedArchetypes: ["assault", "medic"],
        }),
      },
      modalService: {
        alert: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
  });

  it("should allow 4 soldiers IN ADDITION to the VIP in Escort VIP missions", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context,
      squad,
      MissionType.EscortVIP,
      false,
      () => {},
    );
    builder.render();

    // Check that we have 5 slots (1 VIP + 4 soldiers)
    const slots = container.querySelectorAll(".deployment-slot");
    expect(slots.length).toBe(5);

    // Try to add 4 soldiers
    const cards = container.querySelectorAll(".roster-panel .soldier-card");
    let assaultCard: HTMLElement | null = null;
    cards.forEach((card) => {
      if (card.textContent?.includes("ASSAULT")) {
        assaultCard = card as HTMLElement;
      }
    });
    expect(assaultCard).not.toBeNull();

    for (let i = 0; i < 4; i++) {
      assaultCard!.dispatchEvent(new MouseEvent("dblclick"));
    }

    expect(squad.soldiers.length).toBe(4);
  });

  it("should not count manually added VIP towards the 4-soldier limit in Default missions", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context,
      squad,
      MissionType.Default,
      false,
      () => {},
    );
    builder.render();

    // Add 4 regular soldiers first
    const cards = container.querySelectorAll(".roster-panel .soldier-card");
    let assaultCard: HTMLElement | null = null;
    let vipCard: HTMLElement | null = null;
    cards.forEach((card) => {
      if (card.textContent?.includes("ASSAULT"))
        assaultCard = card as HTMLElement;
      if (card.textContent?.includes("VIP")) vipCard = card as HTMLElement;
    });

    expect(assaultCard).not.toBeNull();
    expect(vipCard).not.toBeNull();

    for (let i = 0; i < 4; i++) {
      assaultCard!.dispatchEvent(new MouseEvent("dblclick"));
    }
    expect(squad.soldiers.length).toBe(4);

    // Now try to add a VIP
    vipCard!.dispatchEvent(new MouseEvent("dblclick"));

    // It should allow it, total non-VIP should still be 4.
    expect(squad.soldiers.length).toBe(5);

    // And it should render 5 slots now
    const slots = container.querySelectorAll(".deployment-slot");
    expect(slots.length).toBe(5);
  });
});
