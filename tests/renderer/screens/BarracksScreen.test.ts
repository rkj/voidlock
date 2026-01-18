// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BarracksScreen } from "@src/renderer/screens/BarracksScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("BarracksScreen", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let onBack: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-barracks"></div>';
    container = document.getElementById("screen-barracks")!;

    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(new MockStorageProvider());
    manager.startNewCampaign(12345, "normal");

    onBack = vi.fn();
  });

  it("should render roster and recruitment on show", () => {
    const screen = new BarracksScreen("screen-barracks", manager, onBack);
    screen.show();

    expect(container.textContent).toContain("Roster");
    expect(container.textContent).toContain("Recruitment");
    expect(container.textContent).toContain("Soldier Details");
    
    // Initial roster has 4 soldiers
    const state = manager.getState()!;
    state.roster.forEach(s => {
      expect(container.textContent).toContain(s.name);
    });
  });

  it("should show soldier details when a soldier is selected", () => {
    const screen = new BarracksScreen("screen-barracks", manager, onBack);
    screen.show();

    const state = manager.getState()!;
    const firstSoldierName = state.roster[0].name;
    
    const soldierItem = Array.from(container.querySelectorAll(".menu-item.clickable"))
      .find(el => el.textContent?.includes(firstSoldierName)) as HTMLElement;
    
    soldierItem.click();

    expect(container.textContent).toContain("Soldier Details");
    expect(container.textContent).toContain("Soldier Attributes");
    expect(container.textContent).toContain("Equipment");
    expect(container.textContent).toContain(firstSoldierName);
  });

  it("should show HEAL button for wounded soldiers", () => {
    const state = manager.getState()!;
    state.roster[0].status = "Wounded";
    state.roster[0].hp = 10;

    const screen = new BarracksScreen("screen-barracks", manager, onBack);
    screen.show();

    const soldierItem = Array.from(container.querySelectorAll(".menu-item.clickable"))
      .find(el => el.textContent?.includes(state.roster[0].name)) as HTMLElement;
    soldierItem.click();

    expect(container.textContent).toContain("Heal (50 Scrap)");
    const healBtn = Array.from(container.querySelectorAll("button"))
      .find(btn => btn.textContent?.includes("Heal")) as HTMLButtonElement;
    
    expect(healBtn.disabled).toBe(false);
  });

  it("should show REVIVE button for dead soldiers in Clone mode", () => {
    const state = manager.getState()!;
    state.roster[0].status = "Dead";
    state.roster[0].hp = 0;
    state.rules.deathRule = "Clone";

    const screen = new BarracksScreen("screen-barracks", manager, onBack);
    screen.show();

    const soldierItem = Array.from(container.querySelectorAll(".menu-item.clickable"))
      .find(el => el.textContent?.includes(state.roster[0].name)) as HTMLElement;
    soldierItem.click();

    expect(container.textContent).toContain("Revive (250 Scrap)");
  });

  it("should allow recruiting a new soldier", () => {
    // Mock window.prompt
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue("Bob");
    
    const screen = new BarracksScreen("screen-barracks", manager, onBack);
    screen.show();

    const recruitBtns = Array.from(container.querySelectorAll("button"))
      .filter(btn => btn.textContent === "Recruit");
    
    recruitBtns[0].click();

    expect(promptSpy).toHaveBeenCalled();
    expect(manager.getState()?.roster.some(s => s.name === "Bob")).toBe(true);
    expect(container.textContent).toContain("Bob");
    
    promptSpy.mockRestore();
  });

  it("should trigger onBack", () => {
    const screen = new BarracksScreen("screen-barracks", manager, onBack);
    screen.show();

    const backBtn = Array.from(container.querySelectorAll("button"))
      .find(btn => btn.textContent === "Back to Sector Map");
    backBtn?.click();

    expect(onBack).toHaveBeenCalled();
  });
});
