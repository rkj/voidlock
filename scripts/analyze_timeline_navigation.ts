import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

type Manifest = {
  milestones: Array<{
    milestoneDate: string;
    sourceCommit: string;
    subject: string;
  }>;
};

type CommitNavigationHints = {
  commit: string;
  htmlPath?: string;
  allIds: string[];
  screenIds: string[];
  actionIds: string[];
  targets: {
    main_menu: string[];
    mission_setup: string[];
    equipment: string[];
    mission: string[];
  };
};

type NavigationMap = {
  generatedAt: string;
  commits: Record<string, CommitNavigationHints>;
};

function ensureWorktree(sha: string, baseDir: string): string {
  const dir = path.join(baseDir, "analyzer");
  if (fs.existsSync(dir)) {
    execFileSync("git", ["-C", dir, "checkout", "--detach", "--force", sha], {
      stdio: "pipe",
    });
    return dir;
  }
  execFileSync("git", ["worktree", "prune"], { stdio: "pipe" });
  execFileSync("git", ["worktree", "add", "--detach", "-f", dir, sha], {
    stdio: "pipe",
  });
  return dir;
}

function freeWorktree(dir: string) {
  if (!fs.existsSync(dir)) return;
  execFileSync("git", ["worktree", "remove", "--force", dir], { stdio: "pipe" });
  execFileSync("git", ["worktree", "prune"], { stdio: "pipe" });
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

export function extractIdsFromHtml(html: string): string[] {
  const ids: string[] = [];
  const re = /\bid\s*=\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null = re.exec(html);
  while (m) {
    ids.push(m[1]);
    m = re.exec(html);
  }
  return uniq(ids);
}

export function extractActionIdsFromCode(code: string): string[] {
  const ids: string[] = [];
  const quoted = /["'](btn-[a-z0-9_-]+)["']/gi;
  let m: RegExpExecArray | null = quoted.exec(code);
  while (m) {
    ids.push(m[1]);
    m = quoted.exec(code);
  }
  return uniq(ids);
}

function pick(ids: string[], includesAny: string[]): string[] {
  const lowerNeedles = includesAny.map((s) => s.toLowerCase());
  return ids.filter((id) => {
    const lower = id.toLowerCase();
    return lowerNeedles.some((needle) => lower.includes(needle));
  });
}

export function inferTargets(allIds: string[]): CommitNavigationHints["targets"] {
  const screenish = allIds.filter((id) => id.startsWith("screen-") || id.includes("screen"));
  return {
    main_menu: uniq([
      ...pick(screenish, ["main-menu", "main_menu", "menu"]),
      ...pick(allIds, ["btn-menu", "btn-start"]),
    ]),
    mission_setup: uniq([
      ...pick(screenish, ["mission-setup", "setup"]),
      ...pick(allIds, ["btn-menu-custom", "btn-setup"]),
    ]),
    equipment: uniq([
      ...pick(screenish, ["equipment", "loadout"]),
      ...pick(allIds, ["btn-goto-equipment"]),
    ]),
    mission: uniq([
      ...pick(screenish, ["mission", "game"]),
      ...pick(allIds, ["btn-start-mission", "btn-start"]),
    ]),
  };
}

function readTextIfExists(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8");
}

function resolveHtmlPath(worktreeDir: string): string | undefined {
  const candidates = [
    "src/index.html",
    "index.html",
    "public/index.html",
  ];
  for (const relative of candidates) {
    const full = path.join(worktreeDir, relative);
    if (fs.existsSync(full)) return relative;
  }
  return undefined;
}

function collectCodeSnapshot(worktreeDir: string): string {
  const candidates = [
    "src/renderer/app/InputBinder.ts",
    "src/renderer/app/GameApp.ts",
    "src/renderer/ScreenManager.ts",
    "src/main.ts",
    "src/renderer/main.ts",
  ];
  return candidates.map((p) => readTextIfExists(path.join(worktreeDir, p))).join("\n");
}

function analyzeCommit(worktreeDir: string, sha: string): CommitNavigationHints {
  const htmlPath = resolveHtmlPath(worktreeDir);
  const html = htmlPath ? readTextIfExists(path.join(worktreeDir, htmlPath)) : "";
  const htmlIds = extractIdsFromHtml(html);
  const code = collectCodeSnapshot(worktreeDir);
  const actionIds = extractActionIdsFromCode(code);
  const allIds = uniq([...htmlIds, ...actionIds]);
  const screenIds = allIds.filter((id) => id.startsWith("screen-") || id.includes("screen"));

  return {
    commit: sha,
    htmlPath,
    allIds,
    screenIds,
    actionIds,
    targets: inferTargets(allIds),
  };
}

async function runCli() {
  const manifestPath = process.argv[2] || "timeline/manifest.json";
  const outPath = process.argv[3] || "timeline/navigation_map.json";
  const maxCount = Number(process.argv[4] || 0);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest;
  const milestones = maxCount > 0 ? manifest.milestones.slice(0, maxCount) : manifest.milestones;
  const worktreeBase = path.resolve(".timeline/worktrees");
  fs.mkdirSync(worktreeBase, { recursive: true });

  const commits: Record<string, CommitNavigationHints> = {};
  for (const milestone of milestones) {
    const sha = milestone.sourceCommit;
    const worktree = ensureWorktree(sha, worktreeBase);
    const hints = analyzeCommit(worktree, sha);
    commits[sha] = hints;
    // eslint-disable-next-line no-console
    console.log(
      `[analyze] ${sha.slice(0, 7)} ids=${hints.allIds.length} screens=${hints.screenIds.length}`,
    );
  }

  const payload: NavigationMap = {
    generatedAt: new Date().toISOString(),
    commits,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  try {
    freeWorktree(path.resolve(worktreeBase, "analyzer"));
  } catch {
    // ignore cleanup errors
  }
  // eslint-disable-next-line no-console
  console.log(`Wrote navigation hints for ${Object.keys(commits).length} commits to ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
