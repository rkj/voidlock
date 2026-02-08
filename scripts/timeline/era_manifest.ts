import fs from "node:fs";
import path from "node:path";

type Manifest = {
  generatedAt?: string;
  mode?: string;
  milestones: Array<{
    milestoneDate: string;
    sourceCommit: string;
    subject: string;
    actualCommitUsed?: string;
    captureStatus?: "ok" | "skipped";
    captureReason?: string;
  }>;
};

type TopologyReport = {
  eras: Array<{
    startCommit: string;
    endCommit: string;
    screenSet: string[];
    commitCount: number;
  }>;
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

export function buildEraValidationManifest(
  manifest: Manifest,
  topology: TopologyReport,
): Manifest {
  const starts = new Set(topology.eras.map((era) => era.startCommit));
  const monthFirstAnchors = new Set<string>();
  const monthLastByKey = new Map<string, string>();
  const seenMonths = new Set<string>();
  for (const row of manifest.milestones) {
    const monthKey = row.milestoneDate.slice(0, 7);
    if (!seenMonths.has(monthKey)) {
      seenMonths.add(monthKey);
      monthFirstAnchors.add(row.sourceCommit);
    }
    monthLastByKey.set(monthKey, row.sourceCommit);
  }
  const monthLastAnchors = new Set<string>(monthLastByKey.values());
  const keep = new Set<string>([...starts, ...monthFirstAnchors, ...monthLastAnchors]);
  return {
    ...manifest,
    milestones: manifest.milestones.filter((row) => keep.has(row.sourceCommit)),
  };
}

async function runCli() {
  const argv = process.argv.slice(2);
  const manifestPath = readNamedArg(argv, ["--manifest"]) || "timeline/manifest.json";
  const topologyPath =
    readNamedArg(argv, ["--topology"]) || "timeline/screen_topology_changes.json";
  const outPath = readNamedArg(argv, ["--out"]) || "/tmp/manifest_eras.json";

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest;
  const topology = JSON.parse(fs.readFileSync(topologyPath, "utf-8")) as TopologyReport;
  const eraManifest = buildEraValidationManifest(manifest, topology);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(eraManifest, null, 2)}\n`, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${eraManifest.milestones.length} era milestones to ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
