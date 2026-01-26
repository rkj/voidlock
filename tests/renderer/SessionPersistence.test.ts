/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ScreenManager } from "../../src/renderer/ScreenManager";
import { SessionManager } from "../../src/renderer/SessionManager";

describe("Session Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen"></div>
      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-barracks" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
          </div>
      </div>
      <div id="screen-mission-setup" class="screen" style="display:none"></div>
      <div id="screen-mission" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;
  });

  it("SessionManager should save and load state", () => {
    const sessionManager = new SessionManager();
    sessionManager.saveState("campaign");
    expect(sessionManager.loadState()).toBe("campaign");

    sessionManager.clearState();
    expect(sessionManager.loadState()).toBeNull();
  });

  it("ScreenManager should save state on show()", () => {
    const sm = new ScreenManager();
    sm.show("campaign");

    const sessionManager = new SessionManager();
    expect(sessionManager.loadState()).toBe("campaign");
  });

  it("ScreenManager should restore state via loadPersistedState()", () => {
    const sessionManager = new SessionManager();
    sessionManager.saveState("barracks");

    const sm = new ScreenManager();
    const restored = sm.loadPersistedState();

    expect(restored).toBe("barracks");
    expect(sm.getCurrentScreen()).toBe("barracks");
    expect(document.getElementById("screen-barracks")?.style.display).toBe(
      "flex",
    );
    expect(document.getElementById("screen-main-menu")?.style.display).toBe(
      "none",
    );
  });
});
