// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BarracksScreen } from "@src/renderer/screens/BarracksScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("BarracksScreen", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let onBack: any;
  let mockModalService: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-barracks"></div>';
    container = document.getElementById("screen-barracks")!;

    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(new MockStorageProvider());
    manager.startNewCampaign(12345, "normal");

    onBack = vi.fn();
    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      prompt: vi.fn().mockResolvedValue("Bob"),
      show: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("should render roster and recruitment on show", () => {
    const screen = new BarracksScreen(
      "screen-barracks",
      manager,
      mockModalService,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("ROSTER");
    expect(container.textContent).toContain("Recruitment"); // Tab name is still mixed case
    expect(container.textContent).toContain("SOLDIER DETAILS");

    // Initial roster has 4 soldiers
    const state = manager.getState()!;
    state.roster.forEach((s) => {
      expect(container.textContent).toContain(s.name);
    });
  });

  it("should call onBack when Back button is clicked", () => {
    const screen = new BarracksScreen(
      "screen-barracks",
      manager,
      mockModalService,
      onBack,
    );
    screen.show();

    const backBtn = container.querySelector(
      ".back-button",
    ) as HTMLButtonElement;
    expect(backBtn).toBeTruthy();
    backBtn.click();

    expect(onBack).toHaveBeenCalled();
  });

  it("should show soldier details when a soldier is selected", () => {
    const screen = new BarracksScreen(
      "screen-barracks",
      manager,
      mockModalService,
      onBack,
    );
    screen.show();

    const state = manager.getState()!;
    const firstSoldierName = state.roster[0].name;

    const soldierItem = Array.from(
      container.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes(firstSoldierName)) as HTMLElement;

    soldierItem.click();

    expect(container.textContent).toContain("SOLDIER DETAILS");
    expect(container.textContent).toContain("SOLDIER ATTRIBUTES");
    expect(container.textContent).toContain("EQUIPMENT PERFORMANCE");
    expect(container.textContent).toContain(firstSoldierName);
  });

  it("should show HEAL button for wounded soldiers", () => {
    const state = manager.getState()!;
    state.roster[0].status = "Wounded";
    state.roster[0].hp = 10;

    const screen = new BarracksScreen(
      "screen-barracks",
      manager,
      mockModalService,
      onBack,
    );
    screen.show();

    const soldierItem = Array.from(
      container.querySelectorAll(".menu-item.clickable"),
    ).find((el) =>
      el.textContent?.includes(state.roster[0].name),
    ) as HTMLElement;
    soldierItem.click();

    expect(container.textContent).toContain("Heal (50 Scrap)");
    const healBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Heal"),
    ) as HTMLButtonElement;

    expect(healBtn.disabled).toBe(false);
  });

  it("should show REVIVE button for dead soldiers in Clone mode", () => {
    const state = manager.getState()!;
    state.roster[0].status = "Dead";
    state.roster[0].hp = 0;
    state.rules.deathRule = "Clone";

    const screen = new BarracksScreen(
      "screen-barracks",
      manager,
      mockModalService,
      onBack,
    );
    screen.show();

    const soldierItem = Array.from(
      container.querySelectorAll(".menu-item.clickable"),
    ).find((el) =>
      el.textContent?.includes(state.roster[0].name),
    ) as HTMLElement;
    soldierItem.click();

    expect(container.textContent).toContain("Revive (250 Scrap)");
  });

  it("should allow recruiting a new soldier", async () => {
    const screen = new BarracksScreen(
      "screen-barracks",
      manager,
      mockModalService,
      onBack,
    );
    screen.show();

    const initialCount = manager.getState()?.roster.length || 0;

    const recruitBtns = Array.from(container.querySelectorAll("button")).filter(
      (btn) => btn.textContent === "Recruit",
    ) as HTMLButtonElement[];

    recruitBtns[0].click();

    // Give it a moment for any async updates
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockModalService.prompt).not.toHaveBeenCalled();
    const state = manager.getState()!;
    expect(state.roster.length).toBe(initialCount + 1);

    const newSoldier = state.roster[state.roster.length - 1];
    expect(container.textContent).toContain(newSoldier.name);
  });

  it("should allow renaming a soldier", async () => {
    mockModalService.prompt = vi.fn().mockResolvedValue("Renamed Soldier");

    const screen = new BarracksScreen(
      "screen-barracks",
      manager,
      mockModalService,
      onBack,
    );
    screen.show();

    const state = manager.getState()!;
    const originalName = state.roster[0].name;

    // Select the first soldier
    const soldierItem = Array.from(
      container.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes(originalName)) as HTMLElement;
    soldierItem.click();

    // Find and click the rename button (pencil icon)
    const renameBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.title === "RENAME SOLDIER",
    ) as HTMLButtonElement;
    expect(renameBtn).toBeTruthy();

    await renameBtn.click();

    expect(mockModalService.prompt).toHaveBeenCalledWith(
      expect.any(String),
      originalName,
      "RENAME SOLDIER",
    );

    // Give it a moment for any async updates
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state.roster[0].name).toBe("Renamed Soldier");
    expect(container.textContent).toContain("Renamed Soldier");
  });
});
