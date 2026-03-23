// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("Regression voidlock-l7b8: Roster Sorting", () => {
  let mockCampaignManager: any;
  let mockCampaignShell: any;
  let mockModalService: any;
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="squad-builder"></div>';
    container = document.getElementById("squad-builder")!;

    mockCampaignManager = {
      getState: vi.fn(),
      recruitSoldier: vi.fn(),
      reviveSoldier: vi.fn(),
    };

    mockCampaignShell = {
      refresh: vi.fn(),
    };

    mockModalService = {
      alert: vi.fn(),
      confirm: vi.fn(),
      prompt: vi.fn(),
    };
  });

  it("should sort roster: Healthy > Wounded > Dead", () => {
    const mockState = {
      roster: [
        {
          id: "s1",
          name: "Dead Guy",
          status: "Dead",
          archetypeId: "assault",
          equipment: {},
        },
        {
          id: "s2",
          name: "Healthy Guy",
          status: "Healthy",
          archetypeId: "scout",
          equipment: {},
        },
        {
          id: "s3",
          name: "Wounded Guy",
          status: "Wounded",
          archetypeId: "heavy",
          equipment: {},
        },
      ],
      scrap: 1000,
      unlockedArchetypes: ["assault", "scout", "heavy"],
      rules: { deathRule: "Clone" },
    };

    mockCampaignManager.getState.mockReturnValue(mockState);

    const initialSquad: SquadConfig = { soldiers: [], inventory: {} };
    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: mockCampaignManager as any,
      campaignShell: mockCampaignShell as any,
      modalService: mockModalService as any,
      initialSquad,
      missionType: MissionType.Default,
      isCampaign: true,
      onSquadUpdated: vi.fn(),
    });

    builder.render();

    const rosterNames = Array.from(
      container.querySelectorAll(".roster-panel .soldier-card strong"),
    ).map((el) => el.textContent);

    // Expected order: Healthy > Wounded > Dead
    expect(rosterNames).toEqual(["Healthy Guy", "Wounded Guy", "Dead Guy"]);
  });

  it("should sort alphabetically within same status", () => {
    const mockState = {
      roster: [
        {
          id: "s1",
          name: "Zack",
          status: "Healthy",
          archetypeId: "assault",
          equipment: {},
        },
        {
          id: "s2",
          name: "Adam",
          status: "Healthy",
          archetypeId: "scout",
          equipment: {},
        },
        {
          id: "s3",
          name: "Ben",
          status: "Wounded",
          archetypeId: "heavy",
          equipment: {},
        },
      ],
      scrap: 1000,
      unlockedArchetypes: ["assault", "scout", "heavy"],
      rules: { deathRule: "Clone" },
    };

    mockCampaignManager.getState.mockReturnValue(mockState);

    const initialSquad: SquadConfig = {
      soldiers: [],
      inventory: {},
    };

    const builder = new SquadBuilder({
      containerId: "squad-builder",
      campaignManager: mockCampaignManager as any,
      campaignShell: mockCampaignShell as any,
      modalService: mockModalService as any,
      initialSquad,
      missionType: MissionType.Default,
      isCampaign: true,
      onSquadUpdated: vi.fn(),
    });

    builder.render();

    const rosterNames = Array.from(
      container.querySelectorAll(".roster-panel .soldier-card strong"),
    ).map((el) => el.textContent);

    // Expected order: Adam (Healthy), Zack (Healthy), Ben (Wounded)
    expect(rosterNames).toEqual(["Adam", "Zack", "Ben"]);
  });
});
