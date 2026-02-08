import { describe, expect, it } from "vitest";
import { buildEraValidationManifest } from "../../../scripts/timeline/era_manifest";

describe("era manifest builder", () => {
  it("keeps only era start commits in manifest order", () => {
    const manifest = {
      milestones: [
        { milestoneDate: "2026-01-01T00:00:00Z", sourceCommit: "a1", subject: "a1" },
        { milestoneDate: "2026-01-02T00:00:00Z", sourceCommit: "a2", subject: "a2" },
        { milestoneDate: "2026-01-03T00:00:00Z", sourceCommit: "a3", subject: "a3" },
        { milestoneDate: "2026-01-04T00:00:00Z", sourceCommit: "a4", subject: "a4" },
      ],
    };
    const topology = {
      eras: [
        { startCommit: "a1", endCommit: "a2", screenSet: [], commitCount: 2 },
        { startCommit: "a3", endCommit: "a4", screenSet: [], commitCount: 2 },
      ],
    };
    const out = buildEraValidationManifest(manifest, topology);
    expect(out.milestones.map((m) => m.sourceCommit)).toEqual(["a1", "a3", "a4"]);
  });

  it("ignores missing era starts and keeps monthly anchors", () => {
    const manifest = {
      milestones: [
        { milestoneDate: "2026-01-01T00:00:00Z", sourceCommit: "a1", subject: "a1" },
        { milestoneDate: "2026-01-02T00:00:00Z", sourceCommit: "a2", subject: "a2" },
      ],
    };
    const topology = {
      eras: [
        { startCommit: "zz", endCommit: "a1", screenSet: [], commitCount: 1 },
        { startCommit: "a2", endCommit: "a2", screenSet: [], commitCount: 1 },
      ],
    };
    const out = buildEraValidationManifest(manifest, topology);
    expect(out.milestones.map((m) => m.sourceCommit)).toEqual(["a1", "a2"]);
  });

  it("adds first and last commit of each month as validation anchors", () => {
    const manifest = {
      milestones: [
        { milestoneDate: "2025-12-13T00:00:00Z", sourceCommit: "d1", subject: "d1" },
        { milestoneDate: "2025-12-20T00:00:00Z", sourceCommit: "d2", subject: "d2" },
        { milestoneDate: "2026-01-03T00:00:00Z", sourceCommit: "j1", subject: "j1" },
        { milestoneDate: "2026-01-21T00:00:00Z", sourceCommit: "j2", subject: "j2" },
      ],
    };
    const topology = {
      eras: [{ startCommit: "d2", endCommit: "j2", screenSet: [], commitCount: 3 }],
    };
    const out = buildEraValidationManifest(manifest, topology);
    expect(out.milestones.map((m) => m.sourceCommit)).toEqual(["d1", "d2", "j1", "j2"]);
  });
});
