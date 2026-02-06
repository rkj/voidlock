// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppContext } from "@src/renderer/app/AppContext";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { MissionType, SquadConfig } from "@src/shared/types";

describe("Roster Sorting Regression (voidlock-l7b8)", () => {
  let context: AppContext;
  let mockCampaignManager: any;
  let container: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="squad-builder"></div>';
    container = document.getElementById("squad-builder")!;

    mockCampaignManager = {
      getState: vi.fn(),
    };

    context = new AppContext();
    context.campaignManager = mockCampaignManager as any;
    context.modalService = {
      alert: vi.fn(),
      confirm: vi.fn(),
      prompt: vi.fn(),
    } as any;
  });

  it("should sort roster by status: Healthy > Wounded > Dead", async () => {
    const mockState = {
      roster: [
        { id: "1", name: "Dead Guy", status: "Dead", archetypeId: "assault", level: 1, equipment: {} },
        { id: "2", name: "Healthy Guy", status: "Healthy", archetypeId: "medic", level: 2, equipment: {} },
        { id: "3", name: "Wounded Guy", status: "Wounded", archetypeId: "heavy", level: 3, equipment: {} },
      ],
      rules: {
        difficulty: "Standard",
        themeId: "default",
      },
      history: [],
      currentSector: 1,
    };
    mockCampaignManager.getState.mockReturnValue(mockState);

    const initialSquad: SquadConfig = { soldiers: [], inventory: {} };
    const builder = new SquadBuilder(
      "squad-builder",
      context,
      initialSquad,
      MissionType.Default,
      true, // isCampaign
      vi.fn()
    );

    builder.render();

    const cards = document.querySelectorAll(".soldier-card");
    expect(cards.length).toBe(3);

    // Healthy should be first (sorted by weight: Healthy=0, Wounded=1, Dead=2)
    expect(cards[0].textContent).toContain("Healthy Guy");
    expect(cards[0].classList.contains("dead")).toBe(false);
    expect(cards[0].classList.contains("wounded")).toBe(false);

    // Wounded should be second
    expect(cards[1].textContent).toContain("Wounded Guy");
    expect(cards[1].classList.contains("wounded")).toBe(true);

    // Dead should be last
    expect(cards[2].textContent).toContain("Dead Guy");
    expect(cards[2].classList.contains("dead")).toBe(true);
  });

  it("should remove soldier from roster list when assigned to squad", () => {
    const mockState = {
      roster: [
        { id: "1", name: "In Squad", status: "Healthy", archetypeId: "assault", level: 1, equipment: {} },
        { id: "2", name: "Out of Squad", status: "Healthy", archetypeId: "medic", level: 2, equipment: {} },
      ],
      rules: { difficulty: "Standard" },
      history: [],
      currentSector: 1,
    };
    mockCampaignManager.getState.mockReturnValue(mockState);
    
    const initialSquad: SquadConfig = {
      soldiers: [{ id: "1", name: "In Squad", archetypeId: "assault" }],
      inventory: {}
    };

    const builder = new SquadBuilder(
      "squad-builder",
      context,
      initialSquad,
      MissionType.Default,
      true,
      vi.fn()
    );

    builder.render();

    // Only cards in roster list (those NOT in squad)
    const rosterCards = document.querySelectorAll(".roster-list .soldier-card");

    const card1 = Array.from(rosterCards).find((c) =>
      c.textContent?.includes("In Squad"),
    );
    const card2 = Array.from(rosterCards).find((c) =>
      c.textContent?.includes("Out of Squad"),
    );

    expect(card1).toBeUndefined();
    expect(card2).toBeDefined();

    // Verify it is in deployment panel
    const deploymentCards = document.querySelectorAll(
      ".deployment-panel .soldier-card",
    );
    const deployedCard1 = Array.from(deploymentCards).find((c) =>
      c.textContent?.includes("In Squad"),
    );
    expect(deployedCard1).toBeDefined();
  });
});