import { describe, expect, it } from "vitest";
import { heuristicPlaybook } from "../../../scripts/timeline/plan_navigation_playbooks";

describe("timeline playbook planner", () => {
  it("prefers dom_force when screen containers are known", () => {
    const playbook = heuristicPlaybook(
      0,
      {
        startCommit: "a1",
        endCommit: "a2",
        screenSet: ["screen-main-menu", "screen-mission"],
        commitCount: 2,
      },
      {
        actionIds: ["btn-start-mission"],
      },
    );
    expect(playbook.strategy).toBe("dom_force");
    expect(playbook.actions[0].steps[0]).toContain("show:#screen-mission");
  });

  it("falls back to click_flow when no screen containers exist", () => {
    const playbook = heuristicPlaybook(
      1,
      {
        startCommit: "b1",
        endCommit: "b2",
        screenSet: [],
        commitCount: 2,
      },
      {
        actionIds: ["btn-start-mission", "btn-menu-custom"],
      },
    );
    expect(playbook.strategy).toBe("click_flow");
    expect(playbook.actions.find((a) => a.target === "mission")?.steps[0]).toContain("click:#btn-start-mission");
  });
});
