// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

describe("CampaignScreen Difficulty Cards", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let onNodeSelect: any;
  let onBarracks: any;
  let onBack: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-campaign"></div>';
    container = document.getElementById("screen-campaign")!;

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(
      new (class {
        save() {}
        load() {
          return null;
        }
        remove() {}
        clear() {}
      })(),
    );
    onNodeSelect = vi.fn();
    onBarracks = vi.fn();
    onBack = vi.fn();
  });

  it("should render 4 difficulty cards", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    const cards = container.querySelectorAll(".difficulty-card");
    expect(cards.length).toBe(4);
    
    expect(container.textContent).toContain("SIMULATION");
    expect(container.textContent).toContain("CLONE");
    expect(container.textContent).toContain("STANDARD");
    expect(container.textContent).toContain("IRONMAN");
  });

  it("should update selection and tactical pause checkbox when cards are clicked", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    const pauseCheck = container.querySelector("#campaign-tactical-pause") as HTMLInputElement;
    expect(pauseCheck.checked).toBe(true);
    expect(pauseCheck.disabled).toBe(false);

    const cards = container.querySelectorAll(".difficulty-card");
    const ironmanCard = Array.from(cards).find(card => card.textContent?.includes("IRONMAN")) as HTMLElement;
    const simulationCard = Array.from(cards).find(card => card.textContent?.includes("SIMULATION")) as HTMLElement;

    // Click Ironman
    ironmanCard.click();
    expect(ironmanCard.classList.contains("selected")).toBe(true);
    expect(pauseCheck.checked).toBe(false);
    expect(pauseCheck.disabled).toBe(true);

    // Click Simulation
    simulationCard.click();
    expect(simulationCard.classList.contains("selected")).toBe(true);
    expect(ironmanCard.classList.contains("selected")).toBe(false);
    expect(pauseCheck.checked).toBe(true);
    expect(pauseCheck.disabled).toBe(false);
  });
});
