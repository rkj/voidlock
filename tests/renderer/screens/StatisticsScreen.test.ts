// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatisticsScreen } from "@src/renderer/screens/StatisticsScreen";
import { MetaManager } from "@src/engine/managers/MetaManager";

describe("StatisticsScreen", () => {
  let container: HTMLElement;
  let onBack: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-statistics"></div>';
    container = document.getElementById("screen-statistics")!;

    MetaManager.resetInstance();
    // Initialize MetaManager with a mock storage
    MetaManager.getInstance(
      new (class {
        save() {}
        load() {
          return null;
        }
        remove() {}
        clear() {}
      })(),
    );

    onBack = vi.fn();
  });

  it("should render correctly with default stats", () => {
    const screen = new StatisticsScreen("screen-statistics", onBack);
    screen.show();

    expect(container.textContent).toContain("Service Record");
    expect(container.textContent).toContain("Campaigns");
    expect(container.textContent).toContain("Combat");
    expect(container.textContent).toContain("Economy");
    
    expect(container.textContent).toContain("Total Xeno Kills");
    expect(container.textContent).toContain("0"); // Default value
  });

  it("should render correctly with updated stats", () => {
    const meta = MetaManager.getInstance();
    meta.recordCampaignStarted();
    meta.recordMissionResult(10, 2, true, 500);
    meta.recordCampaignResult(true);

    const screen = new StatisticsScreen("screen-statistics", onBack);
    screen.show();

    expect(container.textContent).toContain("Total Xeno Kills");
    expect(container.textContent).toContain("10");
    expect(container.textContent).toContain("Total Casualties");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("Campaigns Won");
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("Total Scrap Earned");
    expect(container.textContent).toContain("500");
  });

  it("should trigger onBack when back button is clicked", () => {
    const screen = new StatisticsScreen("screen-statistics", onBack);
    screen.show();

    const backBtn = container.querySelector(".back-button") as HTMLElement;
    expect(backBtn).not.toBeNull();
    backBtn.click();

    expect(onBack).toHaveBeenCalled();
  });
});
