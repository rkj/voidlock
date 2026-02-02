/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScreenManager } from "@src/renderer/ScreenManager";

describe("ScreenManager URL Sync", () => {
  let screenManager: ScreenManager;
  let onExternalChange: any;

  beforeEach(() => {
    // Mock DOM elements for screens
    document.body.innerHTML = `
      <div id="screen-main-menu" style="display: none;"></div>
      <div id="screen-campaign" style="display: none;"></div>
      <div id="screen-barracks" style="display: none;"></div>
      <div id="screen-mission-setup" style="display: none;"></div>
      <div id="screen-equipment" style="display: none;"></div>
      <div id="screen-mission" style="display: none;"></div>
      <div id="screen-debrief" style="display: none;"></div>
      <div id="screen-campaign-summary" style="display: none;"></div>
      <div id="screen-statistics" style="display: none;"></div>
    `;

    // Clear hash
    window.location.hash = "";

    onExternalChange = vi.fn();
    screenManager = new ScreenManager(onExternalChange);
  });

  it("should update URL hash when showing a screen", () => {
    screenManager.show("campaign");
    expect(window.location.hash).toBe("#campaign");
  });

  it("should handle empty hash as main-menu", () => {
    screenManager.show("campaign");
    expect(window.location.hash).toBe("#campaign");

    screenManager.show("main-menu");
    expect(window.location.hash).toBe("");
  });

  it("should sync screen when hash changes", async () => {
    // Initial state is main-menu
    expect(screenManager.getCurrentScreen()).toBe("main-menu");

    // Simulate hash change
    window.location.hash = "barracks";

    // Manually trigger sync because hashchange event is async in JSDOM sometimes or needs a tick
    // In real browser it would trigger, but here we can call syncWithUrl if we make it public or wait

    // Let's use the event listener
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(screenManager.getCurrentScreen()).toBe("barracks");
    expect(onExternalChange).toHaveBeenCalledWith("barracks");
  });

  it("should load state from hash on initialization", () => {
    window.location.hash = "statistics";
    const sm = new ScreenManager();
    const state = sm.loadPersistedState();
    expect(state?.screenId).toBe("statistics");
    expect(sm.getCurrentScreen()).toBe("statistics");
  });

  it("should update URL when goBack is called", () => {
    screenManager.show("statistics");
    expect(window.location.hash).toBe("#statistics");

    screenManager.goBack();
    expect(window.location.hash).toBe("");
    expect(screenManager.getCurrentScreen()).toBe("main-menu");
  });
});
