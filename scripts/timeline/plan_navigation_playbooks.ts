import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

type TopologyReport = {
  eras: Array<{
    startCommit: string;
    endCommit: string;
    screenSet: string[];
    commitCount: number;
  }>;
};

type NavigationMap = {
  commits: Record<
    string,
    {
      allIds?: string[];
      actionIds?: string[];
      targets?: Record<string, string[]>;
      htmlPath?: string;
    }
  >;
};

type Playbook = {
  eraIndex: number;
  startCommit: string;
  endCommit: string;
  strategy: "dom_force" | "click_flow" | "hybrid";
  notes: string;
  actions: Array<{
    target: ScreenTarget;
    steps: string[];
  }>;
};

type ScreenTarget = "mission" | "main_menu" | "config" | "campaign";

type PlaybookDoc = {
  generatedAt: string;
  provider: string;
  playbooks: Playbook[];
};

type Manifest = {
  milestones: Array<{
    sourceCommit: string;
  }>;
};

export type CommitPlaybookRow = {
  commit: string;
  eraIndex: number;
  actions: Record<string, string[]>;
};

type EraFlowSignature = {
  actionIds: string[];
  buttonIds: string[];
  targets: Record<string, string[]>;
};

function readNamedArg(argv: string[], names: string[]): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    for (const name of names) {
      if (token === name) return argv[i + 1];
      if (token.startsWith(`${name}=`)) return token.slice(name.length + 1);
    }
  }
  return undefined;
}

function tokenizeCommand(command: string): string[] {
  const parts: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|[^\s]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(command)) !== null) {
    parts.push(match[1] ?? match[2] ?? match[0]);
  }
  return parts;
}

export function resolveAgentCommand(
  cmdTemplate: string,
  promptFile: string,
  outputFile: string,
): [string, string[]] {
  if (!cmdTemplate.includes("{PROMPT_FILE}") || !cmdTemplate.includes("{OUTPUT_FILE}")) {
    throw new Error("Agent command template must include {PROMPT_FILE} and {OUTPUT_FILE} placeholders");
  }
  const resolved = cmdTemplate
    .replaceAll("{PROMPT_FILE}", promptFile)
    .replaceAll("{OUTPUT_FILE}", outputFile)
    .trim();
  if (resolved.includes("{PROMPT_FILE") || resolved.includes("{OUTPUT_FILE")) {
    throw new Error("Malformed placeholder in agent command template");
  }
  const tokens = tokenizeCommand(resolved);
  if (tokens.length === 0) {
    throw new Error("Agent command template resolved to empty command");
  }
  const [bin, ...args] = tokens;
  return [bin, args];
}

function buildPrompt(
  era: TopologyReport["eras"][number],
  _navEntry: NavigationMap["commits"][string] | undefined,
): string {
  return [
    "You are generating browser-only automation playbook JSON for game timeline capture.",
    "Goal: produce stable click flows to reach: mission, main_menu, config, campaign(optional).",
    "Hard constraints:",
    "- Do not inspect source code or repository files.",
    "- Do not use DOM force-show or style manipulation.",
    "- Use only click/text/wait style steps.",
    "Return strict JSON only with keys: strategy, notes, actions[{target,steps[]}].",
    `Era commits: ${era.startCommit}..${era.endCommit}`,
    `Known screen labels: ${(era.screenSet || []).join(", ")}`,
    "Preferred approach: click known menu/setup/start buttons and text-matching fallbacks.",
    "main_menu is root capture; do not add click flow for main_menu.",
    "Allowed step patterns:",
    "- click:#<id>",
    "- wait:<N>ms",
    "- noop",
    "Do not mention markdown. JSON only.",
  ].join("\n");
}

export function heuristicPlaybook(
  eraIndex: number,
  era: TopologyReport["eras"][number],
  navEntry: NavigationMap["commits"][string] | undefined,
): Playbook {
  const ids = collectUiIds(navEntry);
  const configBtn = pickButtonId(ids, [
    "btn-menu-custom",
    "btn-custom-mission",
    "btn-custom",
    "btn-menu-skirmish",
    "btn-skirmish",
    "btn-mission-setup",
    "btn-setup",
  ]);
  const campaignBtn = pickButtonId(ids, [
    "btn-menu-campaign",
    "btn-campaign",
    "btn-open-campaign",
  ]);
  const missionLaunchBtn = pickButtonId(ids, [
    "btn-launch-mission",
    "btn-start-mission",
    "btn-start",
    "btn-deploy",
    "btn-begin-mission",
    "btn-begin",
  ]);
  const strategy: Playbook["strategy"] = "click_flow";
  const allowedIds = collectUiIds(navEntry);

  return {
    eraIndex,
    startCommit: era.startCommit,
    endCommit: era.endCommit,
    strategy,
    notes: "Click-only flow derived from commit-era button IDs extracted from source.",
    actions: [
      {
        target: "mission",
        steps: sanitizeTargetSteps("mission", buildMissionSteps(configBtn, missionLaunchBtn), allowedIds),
      },
      {
        target: "main_menu",
        steps: sanitizeTargetSteps("main_menu", ["wait:500ms"], allowedIds),
      },
      {
        target: "config",
        steps: sanitizeTargetSteps(
          "config",
          configBtn ? [`click:#${configBtn}`, "wait:900ms"] : ["noop"],
          allowedIds,
        ),
      },
      {
        target: "campaign",
        steps: sanitizeTargetSteps(
          "campaign",
          campaignBtn ? [`click:#${campaignBtn}`, "wait:900ms"] : ["noop"],
          allowedIds,
        ),
      },
    ],
  };
}

function normalizeIdList(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim().toLowerCase()).filter(Boolean))].sort();
}

function computeEraFlowSignature(
  navEntry: NavigationMap["commits"][string] | undefined,
): EraFlowSignature {
  const allIds = navEntry?.allIds || [];
  const actionIds = normalizeIdList(navEntry?.actionIds || []);
  const buttonIds = normalizeIdList(allIds.filter((id) => id.startsWith("btn-")));
  const rawTargets = navEntry?.targets || {};
  const targets: Record<string, string[]> = {};
  for (const [target, ids] of Object.entries(rawTargets)) {
    targets[target] = normalizeIdList(ids || []);
  }
  return { actionIds, buttonIds, targets };
}

function signaturesEqual(a: EraFlowSignature, b: EraFlowSignature): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function shouldReuseEraPlaybook(
  previousNavEntry: NavigationMap["commits"][string] | undefined,
  currentNavEntry: NavigationMap["commits"][string] | undefined,
): boolean {
  if (!previousNavEntry || !currentNavEntry) return false;
  return signaturesEqual(
    computeEraFlowSignature(previousNavEntry),
    computeEraFlowSignature(currentNavEntry),
  );
}

function buildMissionSteps(configBtn: string, launchBtn: string): string[] {
  if (configBtn && launchBtn) {
    return [`click:#${configBtn}`, "wait:700ms", `click:#${launchBtn}`, "wait:1500ms"];
  }
  if (launchBtn) {
    return [`click:#${launchBtn}`, "wait:1500ms"];
  }
  // Mission-first fallback: on older commits mission may be root/default
  // with no stable button IDs. Keep a settle wait so capture can detect
  // mission directly from "/" before trying click flows.
  return ["wait:3000ms"];
}

function collectUiIds(navEntry: NavigationMap["commits"][string] | undefined): string[] {
  if (!navEntry) return [];
  const targetIds = Object.values(navEntry.targets || {}).flat();
  const all = [
    ...(navEntry.actionIds || []),
    ...(navEntry.allIds || []),
    ...targetIds,
  ];
  return [...new Set(all.map((id) => id.trim()).filter(Boolean))];
}

function pickButtonId(ids: string[], preference: string[]): string {
  const lower = ids.map((id) => id.toLowerCase());
  for (const expected of preference) {
    const idx = lower.indexOf(expected.toLowerCase());
    if (idx >= 0) return ids[idx];
  }
  return "";
}

function writeUiElementsJsonl(
  navMap: NavigationMap,
  outPath: string,
): void {
  const lines: string[] = [];
  for (const [commit, entry] of Object.entries(navMap.commits)) {
    const allIds = entry.allIds || [];
    const actionIds = entry.actionIds || [];
    const screenIds = allIds.filter((id) => id.toLowerCase().includes("screen"));
    const buttonIds = allIds.filter((id) => id.startsWith("btn-"));
    lines.push(
      JSON.stringify({
        commit,
        htmlPath: entry.htmlPath || null,
        screenIds,
        buttonIds,
        actionIds,
        targets: entry.targets || {},
      }),
    );
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf-8");
}

function runExternalAgent(
  cmdTemplate: string,
  promptFile: string,
  outputFile: string,
): void {
  const [bin, args] = resolveAgentCommand(cmdTemplate, promptFile, outputFile);
  execFileSync(bin, args, { stdio: "inherit" });
}

function mapObjectStepToString(step: Record<string, unknown>): string {
  const op = String(step.op || "").toLowerCase();
  const id = typeof step.id === "string" ? step.id : "";
  if (op.includes("click") && id) return `click:#${id}`;
  if (op.includes("wait")) {
    const ms = Number(step.ms);
    if (Number.isFinite(ms) && ms > 0) return `wait:${Math.round(ms)}ms`;
    return "wait:700ms";
  }
  return "";
}

function normalizeSteps(rawSteps: unknown): string[] {
  if (!Array.isArray(rawSteps)) return [];
  const normalized = rawSteps
    .map((step) => {
      if (typeof step === "string") return step;
      if (step && typeof step === "object") return mapObjectStepToString(step as Record<string, unknown>);
      return "";
    })
    .filter((step) => step.length > 0);
  return normalized;
}

function isRiskyActionId(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.includes("abort") ||
    lower.includes("abandon") ||
    lower.includes("give-up") ||
    lower.includes("surrender") ||
    lower.includes("reset")
  );
}

function sanitizeTargetSteps(
  target: ScreenTarget,
  rawSteps: string[],
  allowedIds: string[],
): string[] {
  if (target === "main_menu") return ["wait:500ms"];
  const allowed = new Set(allowedIds.map((id) => id.toLowerCase()));
  const out: string[] = [];
  for (const step of rawSteps) {
    if (step === "noop") continue;
    if (step.startsWith("wait:")) {
      const n = Number(step.replace(/[^\d]/g, ""));
      const ms = Number.isFinite(n) && n > 0 ? Math.round(n) : 700;
      out.push(`wait:${ms}ms`);
      continue;
    }
    if (!step.startsWith("click:#")) continue;
    const id = step.slice("click:#".length).trim();
    if (!id || isRiskyActionId(id)) continue;
    if (allowed.size > 0 && !allowed.has(id.toLowerCase())) continue;
    out.push(`click:#${id}`);
  }
  if (target === "mission") {
    return out.length > 0 ? out : ["wait:3000ms"];
  }
  return out.length > 0 ? out : ["noop"];
}

export function normalizeExternalPlaybook(
  eraIndex: number,
  era: TopologyReport["eras"][number],
  parsed: Omit<Playbook, "eraIndex" | "startCommit" | "endCommit">,
  navEntry?: NavigationMap["commits"][string],
): Playbook {
  const allowedIds = collectUiIds(navEntry);
  const actions: Playbook["actions"] = (parsed.actions || []).map((action) => {
    const target = action.target as ScreenTarget;
    return {
      target,
      steps: sanitizeTargetSteps(
        target,
        normalizeSteps((action as unknown as { steps?: unknown }).steps),
        allowedIds,
      ),
    };
  });
  return {
    eraIndex,
    startCommit: era.startCommit,
    endCommit: era.endCommit,
    strategy: (parsed.strategy || "hybrid") as Playbook["strategy"],
    notes: typeof parsed.notes === "string" ? parsed.notes : "External agent playbook (normalized)",
    actions,
  };
}

function resolveActionsMap(playbook: Playbook): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const action of playbook.actions) {
    map[action.target] = action.steps;
  }
  return map;
}

function writeCommitPlaybooksJsonl(
  manifest: Manifest | null,
  playbooks: Playbook[],
  outPath: string,
): void {
  const rows = compileCommitPlaybookRows(manifest, playbooks);
  if (rows.length === 0) return;
  const lines = rows.map((row) => JSON.stringify(row));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf-8");
}

export function compileCommitPlaybookRows(
  manifest: Manifest | null,
  playbooks: Playbook[],
): CommitPlaybookRow[] {
  if (!manifest) return [];
  const commitToIndex = new Map<string, number>();
  manifest.milestones.forEach((row, idx) => {
    commitToIndex.set(row.sourceCommit, idx);
  });
  const rows: CommitPlaybookRow[] = [];
  for (const row of manifest.milestones) {
    const commitIdx = commitToIndex.get(row.sourceCommit);
    if (commitIdx === undefined) continue;
    const resolved = playbooks.find((playbook) => {
      const start = commitToIndex.get(playbook.startCommit);
      const end = commitToIndex.get(playbook.endCommit);
      if (start === undefined || end === undefined) return false;
      return commitIdx >= start && commitIdx <= end;
    });
    if (!resolved) continue;
    rows.push({
      commit: row.sourceCommit,
      eraIndex: resolved.eraIndex,
      actions: resolveActionsMap(resolved),
    });
  }
  return rows;
}

async function runCli() {
  const argv = process.argv.slice(2);
  const topologyPath =
    readNamedArg(argv, ["--topology"]) || argv[0] || "timeline/screen_topology_changes.json";
  const navigationMapPath =
    readNamedArg(argv, ["--navigation-map"]) ||
    argv[1] ||
    "timeline/navigation_map.json";
  const outPath =
    readNamedArg(argv, ["--out", "--playbooks"]) ||
    argv[2] ||
    "timeline/navigation_playbooks.json";
  const uiElementsPath =
    readNamedArg(argv, ["--ui-elements-jsonl"]) || "timeline/ui_elements.jsonl";
  const commitPlaybooksPath =
    readNamedArg(argv, ["--commit-playbooks-jsonl"]) || "timeline/commit_playbooks.jsonl";
  const manifestPath = readNamedArg(argv, ["--manifest"]) || "timeline/manifest.json";
  const provider = (readNamedArg(argv, ["--provider"]) || "heuristic").toLowerCase();
  const execute = (readNamedArg(argv, ["--execute"]) || "false").toLowerCase() === "true";
  const cmdTemplate = readNamedArg(argv, ["--agent-cmd"]) || process.env.TIMELINE_AGENT_CMD;

  const topology = JSON.parse(fs.readFileSync(topologyPath, "utf-8")) as TopologyReport;
  const navMap = JSON.parse(fs.readFileSync(navigationMapPath, "utf-8")) as NavigationMap;
  const manifest =
    fs.existsSync(manifestPath) && fs.statSync(manifestPath).isFile()
      ? (JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest)
      : null;
  const promptsDir = path.resolve("timeline/playbook_prompts");
  const outputsDir = path.resolve("timeline/playbook_outputs");
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.mkdirSync(outputsDir, { recursive: true });

  const playbooks: Playbook[] = [];
  let previousSignature: EraFlowSignature | null = null;
  let previousPlaybook: Playbook | null = null;

  topology.eras.forEach((era, idx) => {
    const navEntry = navMap.commits[era.startCommit];
    const signature = computeEraFlowSignature(navEntry);
    if (previousSignature && previousPlaybook && signaturesEqual(previousSignature, signature)) {
      playbooks.push({
        eraIndex: idx,
        startCommit: era.startCommit,
        endCommit: era.endCommit,
        strategy: previousPlaybook.strategy,
        notes: `${previousPlaybook.notes} (reused from previous era: unchanged flow signature)`,
        actions: previousPlaybook.actions,
      });
      previousSignature = signature;
      previousPlaybook = playbooks[playbooks.length - 1];
      return;
    }
    const prompt = buildPrompt(era, navEntry);
    const promptFile = path.join(promptsDir, `era_${String(idx).padStart(4, "0")}.txt`);
    fs.writeFileSync(promptFile, `${prompt}\n`, "utf-8");

    if (provider !== "heuristic" && execute && cmdTemplate) {
      const outputFile = path.join(outputsDir, `era_${String(idx).padStart(4, "0")}.json`);
      runExternalAgent(cmdTemplate, promptFile, outputFile);
      if (fs.existsSync(outputFile)) {
        const parsed = JSON.parse(fs.readFileSync(outputFile, "utf-8")) as Omit<Playbook, "eraIndex" | "startCommit" | "endCommit">;
        playbooks.push(normalizeExternalPlaybook(idx, era, parsed, navEntry));
        previousSignature = signature;
        previousPlaybook = playbooks[playbooks.length - 1];
        return;
      }
    }

    playbooks.push(heuristicPlaybook(idx, era, navEntry));
    previousSignature = signature;
    previousPlaybook = playbooks[playbooks.length - 1];
  });

  const payload: PlaybookDoc = {
    generatedAt: new Date().toISOString(),
    provider,
    playbooks,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  writeUiElementsJsonl(navMap, uiElementsPath);
  writeCommitPlaybooksJsonl(manifest, playbooks, commitPlaybooksPath);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${playbooks.length} playbooks to ${outPath}`);
  // eslint-disable-next-line no-console
  console.log(`Wrote UI elements JSONL to ${uiElementsPath}`);
  if (manifest) {
    // eslint-disable-next-line no-console
    console.log(`Wrote commit playbooks JSONL to ${commitPlaybooksPath}`);
  }
  if (provider !== "heuristic" && !cmdTemplate) {
    // eslint-disable-next-line no-console
    console.log("No --agent-cmd/TIMELINE_AGENT_CMD configured; prompts were generated only.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
