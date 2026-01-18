// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BarracksScreen } from "@src/renderer/screens/BarracksScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { ArchetypeLibrary } from "@src/shared/types";

describe("Regression: Recruit Speed Display (voidlock-95y7.5)", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let mockModalService: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-barracks"></div>';
    container = document.getElementById("screen-barracks")!;

    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(new MockStorageProvider());
    manager.startNewCampaign(12345, "normal");

    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      prompt: vi.fn().mockResolvedValue("Bob"),
      show: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("should display the raw speed stat in the recruitment card", () => {
    const screen = new BarracksScreen("screen-barracks", manager, mockModalService);
    screen.show();

    // Find the Assault recruitment card
    const assaultArch = ArchetypeLibrary["assault"];
    const cards = Array.from(container.querySelectorAll(".card"));
    const assaultCard = cards.find(card => card.textContent?.includes("Assault")) as HTMLElement;

    expect(assaultCard).toBeDefined();
    
    // The raw speed for assault is 20.
    // The current buggy code displays speed/10, which would be 2.
    // We expect it to be 20.
    expect(assaultCard.textContent).toContain(`Spd: ${assaultArch.speed}`);
    expect(assaultCard.textContent).not.toMatch(/Spd:\s*[0-9](\s|$)/);
  });

  it("should display the raw speed stat for Scout in the recruitment card", () => {
    const screen = new BarracksScreen("screen-barracks", manager, mockModalService);
    screen.show();

    // Find the Scout recruitment card
    const scoutArch = ArchetypeLibrary["scout"];
    const cards = Array.from(container.querySelectorAll(".card"));
    const scoutCard = cards.find(card => card.textContent?.includes("Scout")) as HTMLElement;

    expect(scoutCard).toBeDefined();
    
    // The raw speed for scout is 30.
    // The current buggy code displays speed/10, which would be 3.
    expect(scoutCard.textContent).toContain(`Spd: ${scoutArch.speed}`);
    expect(scoutCard.textContent).not.toMatch(/Spd:\s*[0-9](\s|$)/);
  });
});
