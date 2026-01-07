/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScreenManager } from "../../src/renderer/ScreenManager";

describe("Regression: voidlock-7twz Campaign Transition", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-main-menu"></div>
      <div id="screen-campaign"></div>
      <div id="screen-mission-setup"></div>
      <div id="screen-equipment"></div>
      <div id="screen-mission"></div>
      <div id="screen-barracks"></div>
      <div id="screen-debrief"></div>
    `;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should allow campaign -> mission-setup transition", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // Transition path: main-menu -> campaign -> mission-setup
    sm.show("campaign");
    expect(sm.getCurrentScreen()).toBe("campaign");
    
    sm.show("mission-setup");
    expect(sm.getCurrentScreen()).toBe("mission-setup");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
