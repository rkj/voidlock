/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ScreenManager } from "../../src/renderer/ScreenManager";
import { SessionManager } from "../../src/renderer/SessionManager";

describe("Session Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "";
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen"></div>
      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
              <div id="screen-engineering" class="screen" style="display:none"></div>
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
              <div id="screen-settings" class="screen" style="display:none"></div>
          </div>
      </div>
      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="unit-style-preview"></div>
      </div>
      <div id="screen-mission" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;
  });

  it("SessionManager should save and load state", () => {
    const sessionManager = new SessionManager();
    sessionManager.saveState("campaign");
    expect(sessionManager.loadState()?.screenId).toBe("campaign");

    sessionManager.clearState();
    expect(sessionManager.loadState()).toBeNull();
  });

  it("ScreenManager should save state on show()", () => {
    const sm = new ScreenManager();
    sm.show("campaign");

    const sessionManager = new SessionManager();
    expect(sessionManager.loadState()?.screenId).toBe("campaign");
  });

  it("ScreenManager should restore state via loadPersistedState()", () => {
    const sessionManager = new SessionManager();
    sessionManager.saveState("equipment");

    // Set hash to match persisted state, otherwise loadPersistedState returns null for empty hash
    window.location.hash = "equipment";

    const sm = new ScreenManager();
    const restored = sm.loadPersistedState();

    expect(restored?.screenId).toBe("equipment");
    expect(sm.getCurrentScreen()).toBe("equipment");
    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );
    expect(document.getElementById("screen-main-menu")?.style.display).toBe(
      "none",
    );
  });
});
