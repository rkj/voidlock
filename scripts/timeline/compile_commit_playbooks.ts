import fs from "node:fs";
import path from "node:path";
import { compileCommitPlaybookRows } from "./plan_navigation_playbooks.ts";

type Manifest = {
  milestones: Array<{
    sourceCommit: string;
  }>;
};

type PlaybookDoc = {
  playbooks: Array<{
    eraIndex: number;
    startCommit: string;
    endCommit: string;
    actions: Array<{
      target: "mission" | "main_menu" | "config" | "campaign";
      steps: string[];
    }>;
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

async function runCli() {
  const argv = process.argv.slice(2);
  const manifestPath =
    readNamedArg(argv, ["--manifest"]) || "timeline/manifest.json";
  const playbooksPath =
    readNamedArg(argv, ["--playbooks"]) || "timeline/navigation_playbooks.json";
  const outPath =
    readNamedArg(argv, ["--commit-playbooks-jsonl"]) || "timeline/commit_playbooks.jsonl";

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest;
  const playbooksDoc = JSON.parse(fs.readFileSync(playbooksPath, "utf-8")) as PlaybookDoc;
  const rows = compileCommitPlaybookRows(
    manifest as Parameters<typeof compileCommitPlaybookRows>[0],
    playbooksDoc.playbooks as Parameters<typeof compileCommitPlaybookRows>[1],
  );
  const lines = rows.map((row) => JSON.stringify(row));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${rows.length} commit playbook rows to ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
