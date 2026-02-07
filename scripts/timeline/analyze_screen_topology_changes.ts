import fs from "node:fs";
import path from "node:path";

type NavigationMap = {
  generatedAt?: string;
  commits: Record<
    string,
    {
      screenIds?: string[];
      targets?: Record<string, string[]>;
      allIds?: string[];
    }
  >;
};

type Manifest = {
  milestones: Array<{
    milestoneDate: string;
    sourceCommit: string;
    subject: string;
  }>;
};

type TopologyChange = {
  commit: string;
  date: string;
  subject: string;
  addedScreens: string[];
  removedScreens: string[];
  screenCount: number;
};

type TopologyReport = {
  generatedAt: string;
  totalCommits: number;
  topologyChanges: TopologyChange[];
  eras: Array<{
    startCommit: string;
    endCommit: string;
    screenSet: string[];
    commitCount: number;
  }>;
};

function normalizeScreenId(id: string): string {
  return id.trim().toLowerCase();
}

export function extractScreenSet(entry: {
  screenIds?: string[];
  targets?: Record<string, string[]>;
  allIds?: string[];
}): string[] {
  const raw = [
    ...(entry.screenIds || []),
    ...Object.values(entry.targets || {}).flat(),
    ...(entry.allIds || []).filter((id) => id.includes("screen")),
  ];
  const normalized = raw.map(normalizeScreenId).filter(Boolean);
  return [...new Set(normalized)].sort();
}

function setDiff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((item) => !b.has(item)).sort();
}

export function detectTopologyChanges(
  manifest: Manifest,
  navMap: NavigationMap,
): TopologyReport {
  const changes: TopologyChange[] = [];
  const eras: TopologyReport["eras"] = [];
  let previousSet = new Set<string>();
  let currentEraStart: string | null = null;
  let currentEraScreens: string[] = [];
  let currentEraCount = 0;

  for (const milestone of manifest.milestones) {
    const entry = navMap.commits[milestone.sourceCommit] || {};
    const screens = extractScreenSet(entry);
    const currentSet = new Set(screens);

    const added = setDiff(currentSet, previousSet);
    const removed = setDiff(previousSet, currentSet);
    const hasChange = added.length > 0 || removed.length > 0;

    if (hasChange) {
      changes.push({
        commit: milestone.sourceCommit,
        date: milestone.milestoneDate,
        subject: milestone.subject,
        addedScreens: added,
        removedScreens: removed,
        screenCount: screens.length,
      });
      if (currentEraStart) {
        eras.push({
          startCommit: currentEraStart,
          endCommit: milestone.sourceCommit,
          screenSet: currentEraScreens,
          commitCount: currentEraCount,
        });
      }
      currentEraStart = milestone.sourceCommit;
      currentEraScreens = screens;
      currentEraCount = 1;
    } else if (!currentEraStart) {
      currentEraStart = milestone.sourceCommit;
      currentEraScreens = screens;
      currentEraCount = 1;
    } else {
      currentEraCount += 1;
    }

    previousSet = currentSet;
  }

  if (currentEraStart && manifest.milestones.length > 0) {
    eras.push({
      startCommit: currentEraStart,
      endCommit: manifest.milestones[manifest.milestones.length - 1].sourceCommit,
      screenSet: currentEraScreens,
      commitCount: currentEraCount,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalCommits: manifest.milestones.length,
    topologyChanges: changes,
    eras,
  };
}

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

async function runCli() {
  const argv = process.argv.slice(2);
  const manifestPath =
    readNamedArg(argv, ["--manifest"]) || argv[0] || "timeline/manifest.json";
  const navigationMapPath =
    readNamedArg(argv, ["--navigation-map"]) ||
    argv[1] ||
    "timeline/navigation_map.json";
  const outPath =
    readNamedArg(argv, ["--out", "--topology"]) ||
    argv[2] ||
    "timeline/screen_topology_changes.json";

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest;
  const navMap = JSON.parse(fs.readFileSync(navigationMapPath, "utf-8")) as NavigationMap;
  const report = detectTopologyChanges(manifest, navMap);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote topology report with ${report.topologyChanges.length} changes to ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
