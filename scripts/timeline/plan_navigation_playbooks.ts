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
    target: "mission" | "main_menu" | "config" | "campaign";
    steps: string[];
  }>;
};

type PlaybookDoc = {
  generatedAt: string;
  provider: string;
  playbooks: Playbook[];
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

function buildPrompt(
  era: TopologyReport["eras"][number],
  navEntry: NavigationMap["commits"][string] | undefined,
): string {
  return [
    "You are generating browser automation playbook JSON for game timeline capture.",
    "Goal: produce stable steps to reach these targets in a commit era: mission, main_menu, config, campaign(optional).",
    "Return strict JSON only with keys: strategy, notes, actions[{target,steps[]}].",
    `Era commits: ${era.startCommit}..${era.endCommit}`,
    `Known screen ids: ${(era.screenSet || []).join(", ")}`,
    `Known action ids: ${(navEntry?.actionIds || []).join(", ")}`,
    "Preferred approach: use DOM force-show when screen container ids are present; otherwise use click flow using known button ids.",
    "Do not mention markdown. JSON only.",
  ].join("\n");
}

export function heuristicPlaybook(
  eraIndex: number,
  era: TopologyReport["eras"][number],
  navEntry: NavigationMap["commits"][string] | undefined,
): Playbook {
  const screens = new Set(era.screenSet.map((s) => s.toLowerCase()));
  const actions = new Set((navEntry?.actionIds || []).map((s) => s.toLowerCase()));
  const hasScreenContainers = [...screens].some((id) => id.includes("screen"));
  const strategy: Playbook["strategy"] = hasScreenContainers ? "dom_force" : "click_flow";

  return {
    eraIndex,
    startCommit: era.startCommit,
    endCommit: era.endCommit,
    strategy,
    notes:
      strategy === "dom_force"
        ? "Use screen container IDs first; fallback to clicks where missing."
        : "Use inferred button click flow from action IDs.",
    actions: [
      {
        target: "mission",
        steps:
          strategy === "dom_force"
            ? ["show:#screen-mission", "wait:500ms"]
            : actions.has("btn-start-mission")
              ? ["click:#btn-start-mission", "wait:1200ms"]
              : ["noop"],
      },
      {
        target: "main_menu",
        steps:
          strategy === "dom_force"
            ? ["show:#screen-main-menu", "wait:500ms"]
            : actions.has("btn-menu-back")
              ? ["click:#btn-menu-back", "wait:500ms"]
              : ["noop"],
      },
      {
        target: "config",
        steps:
          strategy === "dom_force"
            ? ["show:#screen-mission-setup", "wait:500ms"]
            : actions.has("btn-menu-custom")
              ? ["click:#btn-menu-custom", "wait:700ms"]
              : ["noop"],
      },
      {
        target: "campaign",
        steps:
          strategy === "dom_force"
            ? ["show:#screen-campaign", "wait:500ms"]
            : actions.has("btn-menu-campaign")
              ? ["click:#btn-menu-campaign", "wait:700ms"]
              : ["noop"],
      },
    ],
  };
}

function runExternalAgent(
  cmdTemplate: string,
  promptFile: string,
  outputFile: string,
): void {
  const resolved = cmdTemplate
    .replace("{PROMPT_FILE}", promptFile)
    .replace("{OUTPUT_FILE}", outputFile);
  const [bin, ...args] = resolved.split(" ");
  execFileSync(bin, args, { stdio: "inherit" });
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
  const provider = (readNamedArg(argv, ["--provider"]) || "heuristic").toLowerCase();
  const execute = (readNamedArg(argv, ["--execute"]) || "false").toLowerCase() === "true";
  const cmdTemplate = readNamedArg(argv, ["--agent-cmd"]) || process.env.TIMELINE_AGENT_CMD;

  const topology = JSON.parse(fs.readFileSync(topologyPath, "utf-8")) as TopologyReport;
  const navMap = JSON.parse(fs.readFileSync(navigationMapPath, "utf-8")) as NavigationMap;
  const promptsDir = path.resolve("timeline/playbook_prompts");
  const outputsDir = path.resolve("timeline/playbook_outputs");
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.mkdirSync(outputsDir, { recursive: true });

  const playbooks: Playbook[] = [];

  topology.eras.forEach((era, idx) => {
    const navEntry = navMap.commits[era.startCommit];
    const prompt = buildPrompt(era, navEntry);
    const promptFile = path.join(promptsDir, `era_${String(idx).padStart(4, "0")}.txt`);
    fs.writeFileSync(promptFile, `${prompt}\n`, "utf-8");

    if (provider !== "heuristic" && execute && cmdTemplate) {
      const outputFile = path.join(outputsDir, `era_${String(idx).padStart(4, "0")}.json`);
      runExternalAgent(cmdTemplate, promptFile, outputFile);
      if (fs.existsSync(outputFile)) {
        const parsed = JSON.parse(fs.readFileSync(outputFile, "utf-8")) as Omit<
          Playbook,
          "eraIndex" | "startCommit" | "endCommit"
        >;
        playbooks.push({
          eraIndex: idx,
          startCommit: era.startCommit,
          endCommit: era.endCommit,
          strategy: parsed.strategy,
          notes: parsed.notes,
          actions: parsed.actions,
        });
        return;
      }
    }

    playbooks.push(heuristicPlaybook(idx, era, navEntry));
  });

  const payload: PlaybookDoc = {
    generatedAt: new Date().toISOString(),
    provider,
    playbooks,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${playbooks.length} playbooks to ${outPath}`);
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
