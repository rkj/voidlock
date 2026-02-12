// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { StatisticsScreen } from "@src/renderer/screens/StatisticsScreen";
import { MetaManager } from "@src/engine/managers/MetaManager";

describe("StatisticsScreen", () => {
  let container: HTMLElement;

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
  });

  it("should render correctly with default stats", () => {
    const screen = new StatisticsScreen("screen-statistics");
    screen.show();

    expect(container.textContent).toContain("SERVICE RECORD");
    expect(container.textContent).toContain("CAMPAIGNS");
    expect(container.textContent).toContain("COMBAT");
    expect(container.textContent).toContain("ECONOMY");

    expect(container.textContent).toContain("TOTAL XENO KILLS");
    expect(container.textContent).toContain("0"); // Default value
  });

  it("should render correctly with updated stats", () => {
    const meta = MetaManager.getInstance();
    meta.recordCampaignStarted();
    meta.recordMissionResult(10, 2, true, 500);
    meta.recordCampaignResult(true);

    const screen = new StatisticsScreen("screen-statistics");
    screen.show();

    expect(container.textContent).toContain("TOTAL XENO KILLS");
    expect(container.textContent).toContain("10");
    expect(container.textContent).toContain("TOTAL CASUALTIES");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("CAMPAIGNS WON");
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("TOTAL SCRAP EARNED");
    expect(container.textContent).toContain("500");
  });
});
