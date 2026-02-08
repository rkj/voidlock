import { describe, expect, it } from "vitest";
import {
  filterVisualCommits,
  sampleByStride,
  selectMilestoneCommits,
  type TimelineCommit,
} from "../../../scripts/timeline/timeline_manifest";

function c(
  sha: string,
  date: string,
  subject: string,
  files: string[],
): TimelineCommit {
  return { sha, date, subject, files };
}

describe("timeline manifest commit selection", () => {
  it("filters to visual commits", () => {
    const commits: TimelineCommit[] = [
      c("a1", "2025-01-01T10:00:00Z", "fix ai", ["src/engine/ai/EnemyAI.ts"]),
      c("b1", "2025-01-01T11:00:00Z", "menu polish", ["src/renderer/ui/MenuRenderer.ts"]),
      c("c1", "2025-01-01T12:00:00Z", "styles tweak", ["src/styles/main.css"]),
    ];
    const visual = filterVisualCommits(commits);
    expect(visual.map((v) => v.sha)).toEqual(["b1", "c1"]);
  });

  it("drops near-duplicate low-signal commits in same day", () => {
    const commits: TimelineCommit[] = [
      c("a1", "2025-01-01T10:00:00Z", "main menu first pass", ["src/renderer/ui/MenuRenderer.ts"]),
      c("a2", "2025-01-01T10:30:00Z", "fix typo", ["src/renderer/ui/MenuRenderer.ts"]),
      c("a3", "2025-01-01T11:00:00Z", "button padding", ["src/renderer/ui/MenuRenderer.ts"]),
      c("b1", "2025-01-02T12:00:00Z", "equipment screen", ["src/renderer/screens/EquipmentScreen.ts"]),
    ];
    const milestones = selectMilestoneCommits(commits, { minHoursBetween: 8 });
    expect(milestones.map((v) => v.sha)).toEqual(["a1", "b1"]);
  });

  it("keeps commits introducing different screen buckets despite time proximity", () => {
    const commits: TimelineCommit[] = [
      c("a1", "2025-01-01T10:00:00Z", "main menu", ["src/renderer/ui/MenuRenderer.ts"]),
      c("b1", "2025-01-01T11:00:00Z", "equipment layout", ["src/renderer/screens/EquipmentScreen.ts"]),
      c("c1", "2025-01-01T12:00:00Z", "mission hud", ["src/renderer/ui/HUDManager.ts"]),
    ];
    const milestones = selectMilestoneCommits(commits, { minHoursBetween: 8 });
    expect(milestones.map((v) => v.sha)).toEqual(["a1", "b1", "c1"]);
  });

  it("samples evenly and keeps first/last when limiting count", () => {
    const commits: TimelineCommit[] = [];
    for (let i = 0; i < 20; i += 1) {
      commits.push(
        c(
          `s${i}`,
          `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
          `menu update ${i}`,
          ["src/renderer/ui/MenuRenderer.ts"],
        ),
      );
    }
    const milestones = selectMilestoneCommits(commits, { maxCount: 5 });
    expect(milestones).toHaveLength(5);
    expect(milestones[0].sha).toBe("s0");
    expect(milestones[4].sha).toBe("s19");
  });

  it("samples commits by fixed stride", () => {
    const commits: TimelineCommit[] = [];
    for (let i = 0; i < 10; i += 1) {
      commits.push(
        c(
          `s${i}`,
          `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
          `commit ${i}`,
          ["src/renderer/ui/MenuRenderer.ts"],
        ),
      );
    }
    const sampled = sampleByStride(commits, 3, 0);
    expect(sampled.map((v) => v.sha)).toEqual(["s0", "s3", "s6", "s9"]);
  });

  it("supports stride offsets", () => {
    const commits: TimelineCommit[] = [];
    for (let i = 0; i < 10; i += 1) {
      commits.push(
        c(
          `s${i}`,
          `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
          `commit ${i}`,
          ["src/renderer/ui/MenuRenderer.ts"],
        ),
      );
    }
    const sampled = sampleByStride(commits, 3, 1);
    expect(sampled.map((v) => v.sha)).toEqual(["s1", "s4", "s7"]);
  });
});
