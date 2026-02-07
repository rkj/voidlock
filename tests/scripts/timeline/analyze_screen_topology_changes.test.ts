import { describe, expect, it } from "vitest";
import {
  detectTopologyChanges,
  extractScreenSet,
} from "../../../scripts/timeline/analyze_screen_topology_changes";

describe("screen topology analysis", () => {
  it("extracts normalized unique screen ids", () => {
    const set = extractScreenSet({
      screenIds: ["Screen-Main-Menu", "screen-main-menu"],
      targets: { mission: ["screen-mission"] },
      allIds: ["not-screen", "screen-campaign"],
    });
    expect(set).toContain("screen-main-menu");
    expect(set).toContain("screen-mission");
    expect(set).toContain("screen-campaign");
  });

  it("detects topology changes between commits", () => {
    const manifest = {
      milestones: [
        { milestoneDate: "2025-01-01T00:00:00Z", sourceCommit: "a", subject: "a" },
        { milestoneDate: "2025-01-02T00:00:00Z", sourceCommit: "b", subject: "b" },
      ],
    };
    const navMap = {
      commits: {
        a: { screenIds: ["screen-main-menu"] },
        b: { screenIds: ["screen-main-menu", "screen-mission"] },
      },
    };
    const report = detectTopologyChanges(manifest, navMap);
    expect(report.topologyChanges.length).toBeGreaterThan(0);
    expect(report.topologyChanges[1].addedScreens).toContain("screen-mission");
  });
});
