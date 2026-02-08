import { describe, expect, it } from "vitest";
import {
  heuristicPlaybook,
  normalizeExternalPlaybook,
  resolveAgentCommand,
  shouldReuseEraPlaybook,
} from "../../../scripts/timeline/plan_navigation_playbooks";

describe("timeline playbook planner", () => {
  it("builds click-flow mission steps from known config + launch ids", () => {
    const playbook = heuristicPlaybook(
      0,
      {
        startCommit: "a1",
        endCommit: "a2",
        screenSet: ["screen-main-menu", "screen-mission"],
        commitCount: 2,
      },
      {
        actionIds: ["btn-menu-custom", "btn-launch-mission"],
      },
    );
    expect(playbook.strategy).toBe("click_flow");
    expect(playbook.actions.find((a) => a.target === "mission")?.steps).toEqual([
      "click:#btn-menu-custom",
      "wait:700ms",
      "click:#btn-launch-mission",
      "wait:1500ms",
    ]);
  });

  it("falls back to noop when no mission launch id is discoverable", () => {
    const playbook = heuristicPlaybook(
      1,
      {
        startCommit: "b1",
        endCommit: "b2",
        screenSet: [],
        commitCount: 2,
      },
      {
        actionIds: ["btn-menu-custom"],
      },
    );
    expect(playbook.strategy).toBe("click_flow");
    expect(playbook.actions.find((a) => a.target === "mission")?.steps[0]).toBe("noop");
  });

  it("resolves agent command placeholders safely", () => {
    const [bin, args] = resolveAgentCommand(
      "bash scripts/timeline/provider_codex.sh {PROMPT_FILE} {OUTPUT_FILE}",
      "/tmp/prompt.txt",
      "/tmp/out.json",
    );
    expect(bin).toBe("bash");
    expect(args).toEqual([
      "scripts/timeline/provider_codex.sh",
      "/tmp/prompt.txt",
      "/tmp/out.json",
    ]);
  });

  it("throws when placeholders are malformed or missing", () => {
    expect(() =>
      resolveAgentCommand(
        "bash scripts/timeline/provider_codex.sh {PROMPT_FILE {OUTPUT_FILE}}",
        "/tmp/prompt.txt",
        "/tmp/out.json",
      ),
    ).toThrow(/placeholder/i);
  });

  it("normalizes object-style external steps into string steps", () => {
    const normalized = normalizeExternalPlaybook(
      2,
      {
        startCommit: "c1",
        endCommit: "c2",
        screenSet: [],
        commitCount: 2,
      },
      {
        strategy: "hybrid",
        notes: "x",
        actions: [
          {
            target: "mission",
            steps: [
              { op: "clickIfExists", id: "btn-launch-mission" },
              { op: "wait", ms: 1500 },
            ] as unknown as string[],
          },
        ],
      },
    );
    expect(normalized.actions[0].steps).toEqual(["click:#btn-launch-mission", "wait:1500ms"]);
  });

  it("drops force-show object steps during normalization", () => {
    const normalized = normalizeExternalPlaybook(
      3,
      {
        startCommit: "d1",
        endCommit: "d2",
        screenSet: [],
        commitCount: 2,
      },
      {
        strategy: "hybrid",
        notes: "x",
        actions: [
          {
            target: "main_menu",
            steps: [{ op: "force_show", screenId: "screen-main-menu" }] as unknown as string[],
          },
        ],
      },
    );
    expect(normalized.actions[0].steps).toEqual(["noop"]);
  });

  it("reuses playbook when actionable ids and targets are unchanged", () => {
    const previous = {
      actionIds: ["btn-menu-custom", "btn-launch-mission"],
      allIds: ["btn-menu-custom", "btn-launch-mission", "screen-main-menu"],
      targets: { mission: ["screen-mission"] },
    };
    const current = {
      actionIds: ["btn-launch-mission", "btn-menu-custom"],
      allIds: ["screen-main-menu", "btn-menu-custom", "btn-launch-mission"],
      targets: { mission: ["screen-mission"] },
    };
    expect(shouldReuseEraPlaybook(previous, current)).toBe(true);
  });

  it("does not reuse playbook when actionable ids change", () => {
    const previous = {
      actionIds: ["btn-menu-custom", "btn-launch-mission"],
      allIds: ["btn-menu-custom", "btn-launch-mission"],
      targets: { mission: ["screen-mission"] },
    };
    const current = {
      actionIds: ["btn-menu-custom", "btn-start-mission"],
      allIds: ["btn-menu-custom", "btn-start-mission"],
      targets: { mission: ["screen-mission"] },
    };
    expect(shouldReuseEraPlaybook(previous, current)).toBe(false);
  });
});
