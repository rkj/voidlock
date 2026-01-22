/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScreenManager } from "../../src/renderer/ScreenManager";

describe("Regression: voidlock-g50s - Equipment to Main Menu Transition", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen"></div>
      <div id="screen-campaign" class="screen" style="display:none"></div>
      <div id="screen-equipment" class="screen" style="display:none"></div>
    `;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should allow transition from equipment to main-menu directly", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // Navigate to equipment
    sm.show("campaign");
    sm.show("equipment");
    expect(sm.getCurrentScreen()).toBe("equipment");

    // Try to go to main-menu directly (e.g. from CampaignShell)
    sm.show("main-menu");

    // THIS IS EXPECTED TO FAIL BEFORE FIX
    expect(sm.getCurrentScreen()).toBe("main-menu");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should allow goBack from equipment to main-menu when history is empty", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // Manually set state to simulate refresh on equipment screen
    // We can't easily mock history because it's private,
    // but goBack calls show("main-menu") when history is empty.

    // Setup initial state as equipment with empty history
    // Since we can't easily set history, let's just use ScreenManager as is.
    // By default ScreenManager starts at main-menu.

    // We need to bypass validation for the "restoration" part if we want to simulate it properly,
    // but ScreenManager.loadPersistedState does exactly that.

    // Let's use loadPersistedState to simulate restoration
    localStorage.setItem(
      "voidlock_session_state",
      JSON.stringify({ screenId: "equipment" }),
    );
    sm.loadPersistedState();
    expect(sm.getCurrentScreen()).toBe("equipment");
    // History should be empty now.

    sm.goBack();

    // THIS IS EXPECTED TO FAIL BEFORE FIX because goBack calls show("main-menu")
    expect(sm.getCurrentScreen()).toBe("main-menu");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
