import { describe, expect, it } from "vitest";
import {
  buildBootstrapClickOrder,
  classifyRootResponse,
  normalizeMissionSettleMs,
  isAllowedByShaPrefix,
  isRiskyNavigationId,
  isLikelyBlackFrame,
  isLikelyGameplayBlackFrame,
  isMissionUiReady,
  lineLooksReady,
  parseShaAllowlistContent,
  parseCommitPlaybookJsonlContent,
  resolveOriginForStorage,
  resolvePlaybookActions,
  shouldAcceptMissionCapture,
  shouldAbortForConsecutiveFailures,
  shouldRotateServer,
} from "../../../scripts/timeline/capture_timeline";

describe("capture timeline readiness checks", () => {
  it("accepts healthy html root responses", () => {
    const result = classifyRootResponse(
      200,
      "<!doctype html><html><head></head><body><div id=\"app\"></div></body></html>",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects 404 root responses", () => {
    const result = classifyRootResponse(404, "<html><body>404 Not Found</body></html>");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("HTTP 404");
  });

  it("rejects known error pages", () => {
    const result = classifyRootResponse(
      200,
      "<html><body>Internal Server Error - failed to resolve import</body></html>",
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("error page");
  });
});

describe("capture timeline failure escalation", () => {
  it("does not abort before threshold", () => {
    expect(shouldAbortForConsecutiveFailures(1, 3)).toBe(false);
    expect(shouldAbortForConsecutiveFailures(2, 3)).toBe(false);
  });

  it("aborts at threshold and beyond", () => {
    expect(shouldAbortForConsecutiveFailures(3, 3)).toBe(true);
    expect(shouldAbortForConsecutiveFailures(4, 3)).toBe(true);
  });
});

describe("capture timeline restart cadence", () => {
  it("rotates server at configured commit interval", () => {
    expect(shouldRotateServer(99, 100)).toBe(false);
    expect(shouldRotateServer(100, 100)).toBe(true);
    expect(shouldRotateServer(101, 100)).toBe(true);
  });

  it("disables cadence-based rotation when set to zero", () => {
    expect(shouldRotateServer(1000, 0)).toBe(false);
  });
});

describe("capture timeline bootstrap click order", () => {
  it("prioritizes known action ids when available", () => {
    const order = buildBootstrapClickOrder(["btn-start-mission", "btn-menu-custom"]);
    expect(order[0]).toBe("btn-menu-custom");
    expect(order[1]).toBe("btn-start-mission");
  });

  it("still includes default bootstrap fallbacks", () => {
    const order = buildBootstrapClickOrder([]);
    expect(order).toContain("btn-menu-custom");
    expect(order).toContain("btn-start-mission");
    expect(order).toContain("btn-deploy");
    expect(order).toContain("btn-confirm-squad");
  });
});

describe("capture timeline mission darkness detection", () => {
  it("flags black-like frames", () => {
    expect(isLikelyBlackFrame(6.0, 14.8)).toBe(true);
    expect(isLikelyBlackFrame(9.9, 10)).toBe(true);
  });

  it("keeps non-black frames", () => {
    expect(isLikelyBlackFrame(17.6, 17.6)).toBe(false);
    expect(isLikelyBlackFrame(25, 30)).toBe(false);
  });

  it("flags gameplay-area black frames more aggressively", () => {
    expect(isLikelyGameplayBlackFrame(8.5, 12)).toBe(true);
    expect(isLikelyGameplayBlackFrame(15, 20)).toBe(false);
  });

  it("accepts mission capture when mission UI is ready even if dark", () => {
    expect(shouldAcceptMissionCapture(true, true)).toBe(true);
    expect(shouldAcceptMissionCapture(false, false)).toBe(false);
  });
});

describe("capture timeline mission settle delay", () => {
  it("normalizes invalid values to zero", () => {
    expect(normalizeMissionSettleMs(Number.NaN)).toBe(0);
    expect(normalizeMissionSettleMs(-100)).toBe(0);
  });

  it("keeps positive values as rounded milliseconds", () => {
    expect(normalizeMissionSettleMs(10000)).toBe(10000);
    expect(normalizeMissionSettleMs(2500.7)).toBe(2501);
  });
});

describe("capture timeline readiness watcher", () => {
  it("detects vite ready lines", () => {
    expect(lineLooksReady("VITE v7.2.4  ready in 312 ms")).toBe(true);
    expect(lineLooksReady("Local:   http://127.0.0.1:6080/")).toBe(true);
    expect(lineLooksReady("listening on http://0.0.0.0:5173")).toBe(true);
  });

  it("ignores unrelated lines", () => {
    expect(lineLooksReady("building modules...")).toBe(false);
    expect(lineLooksReady("error: cannot resolve import")).toBe(false);
  });
});

describe("capture timeline mission readiness guard", () => {
  it("accepts mission ui signals", () => {
    expect(
      isMissionUiReady({
        hasCanvas: true,
        hasMissionTokens: true,
        hasMissionUiStructure: false,
        hasSetupTokens: false,
        hasCampaignTokens: false,
        hasMainMenuTokens: false,
      }),
    ).toBe(true);
  });

  it("accepts mission HUD structure with canvas even without token match", () => {
    expect(
      isMissionUiReady({
        hasCanvas: true,
        hasMissionTokens: false,
        hasMissionUiStructure: true,
        hasSetupTokens: false,
        hasCampaignTokens: false,
        hasMainMenuTokens: false,
      }),
    ).toBe(true);
  });

  it("rejects setup/config ui", () => {
    expect(
      isMissionUiReady({
        hasCanvas: true,
        hasMissionTokens: false,
        hasMissionUiStructure: false,
        hasSetupTokens: true,
        hasCampaignTokens: false,
        hasMainMenuTokens: false,
      }),
    ).toBe(false);
  });

  it("accepts mission ui even when setup text is still present", () => {
    expect(
      isMissionUiReady({
        hasCanvas: true,
        hasMissionTokens: true,
        hasMissionUiStructure: false,
        hasSetupTokens: true,
        hasCampaignTokens: false,
        hasMainMenuTokens: false,
      }),
    ).toBe(true);
  });

  it("accepts mission ui even if campaign-shell tokens are also present", () => {
    expect(
      isMissionUiReady({
        hasCanvas: true,
        hasMissionTokens: true,
        hasMissionUiStructure: false,
        hasSetupTokens: false,
        hasCampaignTokens: true,
        hasMainMenuTokens: false,
      }),
    ).toBe(true);
  });

  it("rejects campaign-only ui", () => {
    expect(
      isMissionUiReady({
        hasCanvas: true,
        hasMissionTokens: false,
        hasMissionUiStructure: false,
        hasSetupTokens: false,
        hasCampaignTokens: true,
        hasMainMenuTokens: false,
      }),
    ).toBe(false);
  });

  it("rejects main-menu-only ui", () => {
    expect(
      isMissionUiReady({
        hasCanvas: true,
        hasMissionTokens: false,
        hasMissionUiStructure: false,
        hasSetupTokens: false,
        hasCampaignTokens: false,
        hasMainMenuTokens: true,
      }),
    ).toBe(false);
  });
});

describe("capture timeline risky navigation guard", () => {
  it("flags give-up/abort style ids as risky", () => {
    expect(isRiskyNavigationId("btn-give-up")).toBe(true);
    expect(isRiskyNavigationId("btn-mission-abort")).toBe(true);
    expect(isRiskyNavigationId("btn-abandon-run")).toBe(true);
    expect(isRiskyNavigationId("btn-menu-reset")).toBe(true);
  });

  it("keeps normal navigation ids as safe", () => {
    expect(isRiskyNavigationId("btn-menu-custom")).toBe(false);
    expect(isRiskyNavigationId("btn-launch-mission")).toBe(false);
  });
});

describe("capture timeline mission allowlist", () => {
  it("parses sha allowlist with comments and blanks", () => {
    const set = parseShaAllowlistContent(
      ["# known broken commits", "65143e6", "", "c3020bf"].join("\n"),
    );
    expect(set.has("65143e6")).toBe(true);
    expect(set.has("c3020bf")).toBe(true);
    expect(set.has("# known broken commits")).toBe(false);
  });

  it("matches by sha prefix", () => {
    const set = new Set(["65143e6", "c3020bf"]);
    expect(isAllowedByShaPrefix("65143e63b506893990c80658fe65ea0fd01b9b81", set)).toBe(true);
    expect(isAllowedByShaPrefix("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", set)).toBe(false);
  });
});

describe("capture timeline storage origin resolution", () => {
  it("extracts origin for valid urls", () => {
    expect(resolveOriginForStorage("http://127.0.0.1:6080/")).toBe("http://127.0.0.1:6080");
    expect(resolveOriginForStorage("https://example.com/path")).toBe("https://example.com");
  });

  it("returns empty string for invalid urls", () => {
    expect(resolveOriginForStorage("not-a-url")).toBe("");
  });
});

describe("capture timeline playbook resolution", () => {
  it("prefers exact commit playbook entries over era ranges", () => {
    const commitIndex = new Map<string, number>([
      ["a1", 0],
      ["a2", 1],
      ["a3", 2],
    ]);
    const actions = resolvePlaybookActions(
      "a2",
      commitIndex,
      {
        playbooks: [
          {
            startCommit: "a1",
            endCommit: "a3",
            actions: [{ target: "mission", steps: ["click:#btn-start"] }],
          },
        ],
      },
      new Map([
        [
          "a2",
          {
            mission: ["click:#btn-launch-mission"],
            config: ["click:#btn-custom-mission"],
          },
        ],
      ]),
    );
    expect(actions?.mission).toEqual(["click:#btn-launch-mission"]);
    expect(actions?.config).toEqual(["click:#btn-custom-mission"]);
  });

  it("ignores non-string steps from era playbooks without crashing", () => {
    const commitIndex = new Map<string, number>([
      ["a1", 0],
      ["a2", 1],
    ]);
    const actions = resolvePlaybookActions(
      "a2",
      commitIndex,
      {
        playbooks: [
          {
            startCommit: "a1",
            endCommit: "a2",
            actions: [
              {
                target: "mission",
                steps: [{ op: "click", id: "btn-launch-mission" }] as unknown as string[],
              },
            ],
          },
        ],
      },
    );
    expect(actions?.mission).toEqual(["noop"]);
  });

  it("parses commit playbook JSONL and ignores invalid rows", () => {
    const parsed = parseCommitPlaybookJsonlContent(
      [
        JSON.stringify({
          commit: "abc1234",
          actions: { mission: ["click:#btn-start"] },
        }),
        "{bad json",
        JSON.stringify({ commit: "def5678", actions: { main_menu: ["wait:500ms"] } }),
      ].join("\n"),
    );
    expect(parsed.get("abc1234")?.mission).toEqual(["click:#btn-start"]);
    expect(parsed.get("def5678")?.main_menu).toEqual(["wait:500ms"]);
  });
});
