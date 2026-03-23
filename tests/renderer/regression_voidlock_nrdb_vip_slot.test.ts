// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("Regression voidlock-nrdb: VIP Slot and Member Limit", () => {
  let context: any;
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
          roster: [
            { id: "s1", archetypeId: "assault", status: "Healthy" },
            { id: "s2", archetypeId: "medic", status: "Healthy" },
            { id: "s3", archetypeId: "scout", status: "Healthy" },
            { id: "s4", archetypeId: "heavy", status: "Healthy" },
            { id: "s5", archetypeId: "assault", status: "Healthy" },
          ],
          scrap: 100,
          unlockedArchetypes: ["assault", "medic", "scout", "heavy"],
        }),
      },
      modalService: {
        alert: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
  });

  it("should allow 4 soldiers IN ADDITION to the VIP in Escort VIP missions", () => {
    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: context.campaignManager as any,
      campaignShell: {} as any,
      modalService: context.modalService as any,
      initialSquad: squad,
      missionType: MissionType.EscortVIP,
      isCampaign: false,
      onSquadUpdated: () => {},
    });
    builder.render();

    // Check that we have 5 slots (1 VIP + 4 soldiers)
    expect(container.querySelectorAll(".deployment-slot").length).toBe(5);

    // Add 4 regular soldiers
    squad.soldiers = [
      { id: "s1", archetypeId: "assault" },
      { id: "s2", archetypeId: "medic" },
      { id: "s3", archetypeId: "scout" },
      { id: "s4", archetypeId: "heavy" },
    ];

    builder.render();

    // The count should show 4/4 assigned assets (excluding VIP)
    const countDiv = document.getElementById("squad-total-count");
    expect(countDiv?.textContent).toContain("Assigned Assets: 4/4");

    // Launch button should be enabled (VIP is auto-assigned)
    const launchBtn = document.getElementById(
      "btn-launch-mission",
    ) as HTMLButtonElement;
    expect(launchBtn.disabled).toBe(false);
  });

  it("should not count manually added VIP towards the 4-soldier limit in Default missions", () => {
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

    // Add 4 regular soldiers first
    squad.soldiers = [
      { id: "s1", archetypeId: "assault" },
      { id: "s2", archetypeId: "medic" },
      { id: "s3", archetypeId: "scout" },
      { id: "s4", archetypeId: "heavy" },
    ];

    builder.render();
    let countDiv = document.getElementById("squad-total-count");
    expect(countDiv?.textContent).toContain("Assigned Assets: 4/4");

    // Now manually add a VIP
    squad.soldiers.push({ id: "v1", archetypeId: "vip" });

    builder.render();
    countDiv = document.getElementById("squad-total-count");
    // Should STILL be 4/4 because VIP is extra
    expect(countDiv?.textContent).toContain("Assigned Assets: 4/4");

    // Launch button should be enabled
    const launchBtn = document.getElementById(
      "btn-launch-mission",
    ) as HTMLButtonElement;
    expect(launchBtn.disabled).toBe(false);
  });
});
