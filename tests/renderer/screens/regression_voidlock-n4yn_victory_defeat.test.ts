import { InputDispatcher } from "@src/renderer/InputDispatcher";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignSummaryScreen } from "@src/renderer/screens/CampaignSummaryScreen";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

describe("CampaignSummaryScreen Victory/Defeat Screens", () => {
  let container: HTMLElement;
  let onMainMenu: any;
  let mockInputDispatcher: any;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "campaign-summary-container";
    document.body.appendChild(container);

    onMainMenu = vi.fn();
    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should render Victory screen when campaign status is Victory", () => {
    const screen = new CampaignSummaryScreen(
      "campaign-summary-container",
      mockInputDispatcher,
      onMainMenu,
    );

    const mockState: any = {
      status: "Victory",
      roster: [
        { name: "Saru", archetypeId: "assault", status: "Healthy", xp: 0 },
        { name: "Burnham", archetypeId: "medic", status: "Healthy", xp: 0 },
      ],
      history: [
        {
          aliensKilled: 10,
          scrapGained: 100,
        },
      ],
    };

    screen.show(mockState);

    expect(container.textContent).toContain(t(I18nKeys.screen.summary.contract_success));
    expect(container.textContent).toContain(t(I18nKeys.screen.summary.victory_confirmed));
    expect(container.textContent).toContain(t(I18nKeys.screen.summary.status_functional));

    const menuBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === t(I18nKeys.screen.summary.retire_main_menu),
    );
    expect(menuBtn).toBeDefined();

    menuBtn?.click();
    expect(onMainMenu).toHaveBeenCalled();
  });

  it("should render Defeat screen when campaign status is Defeat (Mission Failure)", () => {
    const screen = new CampaignSummaryScreen(
      "campaign-summary-container",
      mockInputDispatcher,
      onMainMenu,
    );

    const mockState: any = {
      status: "Defeat",
      roster: [
        { name: "Saru", archetypeId: "assault", status: "Healthy", xp: 0 },
        { name: "Stamets", archetypeId: "medic", status: "Healthy", xp: 0 },
        { name: "Roslin", archetypeId: "scout", status: "Healthy", xp: 0 },
        { name: "Crowe", archetypeId: "assault", status: "Healthy", xp: 0 },
      ],
      history: [
        {
          aliensKilled: 5,
          scrapGained: 0,
        },
      ],
      scrap: 50, // Cannot afford recruit (100)
    };

    screen.show(mockState);

    expect(container.textContent).toContain(t(I18nKeys.screen.summary.contract_terminated));
    expect(container.textContent).toContain(`${t(I18nKeys.screen.summary.cause)} ${t(I18nKeys.screen.summary.cause_squad_wiped)}`);
    expect(container.textContent).toContain(t(I18nKeys.screen.summary.status_functional));

    const menuBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === t(I18nKeys.screen.summary.abandon_expedition),
    );
    expect(menuBtn).toBeDefined();
  });

  it("should render Defeat screen when campaign status is Defeat (Bankruptcy)", () => {
    const screen = new CampaignSummaryScreen(
      "campaign-summary-container",
      mockInputDispatcher,
      onMainMenu,
    );

    const mockState: any = {
      status: "Defeat",
      roster: [
        { name: "Sato", archetypeId: "assault", status: "Dead", xp: 0 },
        { name: "Tilly", archetypeId: "medic", status: "Dead", xp: 0 },
        { name: "Havelock", archetypeId: "scout", status: "Dead", xp: 0 },
        { name: "Voq", archetypeId: "assault", status: "Dead", xp: 0 },
      ],
      history: [],
      scrap: 50, // Cannot afford recruit
    };

    screen.show(mockState);

    expect(container.textContent).toContain(t(I18nKeys.screen.summary.contract_terminated));
    expect(container.textContent).toContain(`${t(I18nKeys.screen.summary.cause)} ${t(I18nKeys.screen.summary.cause_bankruptcy)}`);
    expect(container.textContent).toContain(t(I18nKeys.screen.summary.status_integrity_failure));
  });
});
