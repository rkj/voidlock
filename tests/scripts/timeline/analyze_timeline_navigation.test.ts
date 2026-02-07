import { describe, expect, it } from "vitest";
import {
  extractActionIdsFromCode,
  extractIdsFromHtml,
  inferTargets,
} from "../../../scripts/timeline/analyze_timeline_navigation";

describe("timeline navigation analyzer", () => {
  it("extracts ids from html", () => {
    const html = `
      <div id="screen-main-menu"></div>
      <button id="btn-menu-custom">Custom</button>
      <div id="screen-mission"></div>
    `;
    const ids = extractIdsFromHtml(html);
    expect(ids).toContain("screen-main-menu");
    expect(ids).toContain("btn-menu-custom");
    expect(ids).toContain("screen-mission");
  });

  it("extracts action ids from code literals", () => {
    const code = `
      this.addListener("btn-goto-equipment", "click", () => {});
      this.addListener('btn-start-mission', 'click', () => {});
    `;
    const ids = extractActionIdsFromCode(code);
    expect(ids).toEqual(["btn-goto-equipment", "btn-start-mission"]);
  });

  it("infers target ids per canonical screen", () => {
    const targets = inferTargets([
      "screen-main-menu",
      "screen-mission-setup",
      "screen-mission",
      "screen-campaign",
      "btn-goto-equipment",
      "btn-start-mission",
    ]);
    expect(targets.mission).toContain("screen-mission");
    expect(targets.main_menu).toContain("screen-main-menu");
    expect(targets.config).toContain("screen-mission-setup");
    expect(targets.campaign).toContain("screen-campaign");
  });
});
