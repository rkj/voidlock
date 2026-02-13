// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { AppContext } from "@src/renderer/app/AppContext";
import { MissionType, SquadConfig, MapGeneratorType } from "@src/shared/types";

describe("Quick Revive in Mission Setup", () => {
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
              name: "Dead Guy",
              archetypeId: "assault",
              status: "Dead",
              equipment: {},
            },
            {
              id: "s2",
              name: "Healthy Guy",
              archetypeId: "medic",
              status: "Healthy",
              equipment: {},
            },
          ],
          scrap: 1000,
          rules: {
            deathRule: "Clone",
            mode: "Preset",
            difficulty: "Standard",
            allowTacticalPause: true,
            mapGeneratorType: MapGeneratorType.DenseShip,
            difficultyScaling: 1,
            resourceScarcity: 1,
            startingScrap: 100,
            mapGrowthRate: 1,
            baseEnemyCount: 3,
            enemyGrowthPerMission: 1,
            economyMode: "Open",
            themeId: "default",
          },
          unlockedArchetypes: ["assault", "medic"],
        }),
        reviveSoldier: vi.fn(),
        recruitSoldier: vi.fn().mockReturnValue("new-id"),
      },
      modalService: {
        alert: vi.fn().mockResolvedValue(undefined),
      },
      campaignShell: {
        refresh: vi.fn(),
      },
    } as any;
  });

  it("should show Revive button for dead soldiers in Clone mode", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context,
      squad,
      MissionType.Default,
      true, // isCampaign
      () => {},
    );
    builder.render();

    // Dead soldier card should have a Revive button
    const cards = container.querySelectorAll(".soldier-card");
    const deadCard = Array.from(cards).find((c) =>
      c.textContent?.includes("Dead Guy"),
    );
    expect(deadCard).toBeDefined();

    const reviveBtn = deadCard?.querySelector(".btn-revive") as HTMLButtonElement;
    expect(reviveBtn).toBeTruthy();
    expect(reviveBtn.textContent).toContain("250 Scrap");
  });

  it("should disable Revive button if not enough scrap", () => {
    // Set scrap low
    (context.campaignManager.getState as any).mockReturnValue({
      ...context.campaignManager.getState(),
      scrap: 50,
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

    const reviveBtn = container.querySelector(".btn-revive") as HTMLButtonElement;
    expect(reviveBtn.disabled).toBe(true);
  });

  it("should call reviveSoldier and refresh UI when clicked", async () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context,
      squad,
      MissionType.Default,
      true,
      () => {},
    );
    builder.render();

    const reviveBtn = container.querySelector(".btn-revive") as HTMLButtonElement;
    reviveBtn.click();

    // After clicking RevivePersonnel, we should see the list of dead available for revival
    expect(context.campaignManager.reviveSoldier).toHaveBeenCalledWith("s1");
    expect(context.campaignShell?.refresh).toHaveBeenCalled();
  });

  it("should show Recruit button if less than 4 healthy/wounded soldiers", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context,
      squad,
      MissionType.Default,
      true,
      () => {},
    );
    builder.render();

    // Roster has 1 healthy, 1 dead. Healthy is 1 < 4, so show Recruit.
    const recruitBtn = container.querySelector(".btn-recruit") as HTMLButtonElement;
    expect(recruitBtn).toBeTruthy();
    expect(recruitBtn.textContent).toContain("Recruit (100 Scrap)");
  });

  it("should show Recruit button if 4 or more healthy/wounded soldiers (up to 12)", () => {
    // Mock 4 healthy soldiers
    const roster = [];
    for (let i = 0; i < 4; i++) {
      roster.push({
        id: `s${i}`,
        name: `Soldier ${i}`,
        status: "Healthy",
        archetypeId: "assault",
        equipment: {},
      });
    }

    (context.campaignManager.getState as any).mockReturnValue({
      ...context.campaignManager.getState(),
      roster,
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

    const recruitBtn = container.querySelector(".btn-recruit") as HTMLButtonElement;
    expect(recruitBtn).toBeTruthy();
  });

  it("should NOT show Recruit button if 12 or more soldiers", () => {
    // Mock 12 healthy soldiers
    const roster = [];
    for (let i = 0; i < 12; i++) {
      roster.push({
        id: `s${i}`,
        name: `Soldier ${i}`,
        status: "Healthy",
        archetypeId: "assault",
        equipment: {},
      });
    }

    (context.campaignManager.getState as any).mockReturnValue({
      ...context.campaignManager.getState(),
      roster,
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

    const recruitBtn = container.querySelector(".btn-recruit") as HTMLButtonElement;
    expect(recruitBtn).toBeNull();
  });
});
