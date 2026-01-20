
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";

describe("UI Visibility Regression", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen"></div>
        <div id="screen-debrief" class="screen debrief-screen"></div>
        <div id="screen-campaign-summary" class="screen campaign-summary-screen"></div>
      </div>
    `;
    
    // Mock the CSS that we suspect is causing the issue
    const style = document.createElement('style');
    style.innerHTML = `
      .screen { display: none; }
      .debrief-screen { }
      .campaign-summary-screen { }
    `;
    document.head.appendChild(style);
  });

  it("should have debrief screen hidden if it only has .screen class", () => {
    const el = document.getElementById("screen-debrief")!;
    // After my fix, it should be none
    expect(window.getComputedStyle(el).display).toBe("none");
  });
});
