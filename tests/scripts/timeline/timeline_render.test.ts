import { describe, expect, it } from "vitest";
import {
  buildFramePath,
  buildOverlayLabel,
  buildRenderCommand,
  type TimelineFrame,
} from "../../../scripts/timeline/render_timeline";

describe("timeline render helpers", () => {
  it("builds stable frame naming", () => {
    const out = buildFramePath("screenshots", {
      datetime: "2025-01-02T03:04:05Z",
      screenName: "main_menu",
      sha: "abc1234",
      filePath: "",
    });
    expect(out).toContain("screenshots/20250102T030405Z_main_menu_abc1234.png");
  });

  it("escapes overlay labels for ffmpeg drawtext", () => {
    const label = buildOverlayLabel("2025-01-02", "fix: menu/buttons", "abc1234");
    expect(label).toContain("2025-01-02");
    expect(label).toContain("abc1234");
    expect(label).toContain("fix\\: menu/buttons");
  });

  it("builds an ffmpeg command with concat input and drawtext", () => {
    const frames: TimelineFrame[] = [
      { imagePath: "a.png", date: "2025-01-01", subject: "main menu", sha: "a1" },
      { imagePath: "b.png", date: "2025-01-02", subject: "equipment", sha: "b1" },
    ];
    const cmd = buildRenderCommand(frames, "video/out.mp4", {
      fps: 30,
      secondsPerFrame: 1.5,
    });
    expect(cmd).toContain("ffmpeg");
    expect(cmd).toContain("-f concat");
    expect(cmd).toContain("drawtext");
    expect(cmd).toContain("video/out.mp4");
  });
});
