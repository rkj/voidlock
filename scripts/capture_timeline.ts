import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import puppeteer from "puppeteer";

type Manifest = {
  milestones: Array<{
    milestoneDate: string;
    sourceCommit: string;
    subject: string;
    actualCommitUsed?: string;
    captureStatus?: "ok" | "skipped";
    captureReason?: string;
  }>;
};

type NavigationMap = {
  commits: Record<
    string,
    {
      targets?: {
        mission?: string[];
        main_menu?: string[];
        config?: string[];
        campaign?: string[];
      };
    }
  >;
};

const SCREEN_TARGETS: Array<{
  quadrant: 1 | 2 | 3 | 4;
  screenName: "mission" | "main_menu" | "config" | "campaign";
  required: boolean;
  ids: string[];
}> = [
  { quadrant: 1, screenName: "mission", required: true, ids: ["screen-mission", "mission-screen", "screen-game"] },
  { quadrant: 2, screenName: "main_menu", required: true, ids: ["screen-main-menu", "main-menu", "screen-menu"] },
  {
    quadrant: 3,
    screenName: "config",
    required: true,
    ids: ["screen-mission-setup", "mission-setup", "screen-setup", "screen-equipment", "equipment-screen", "screen-loadout"],
  },
  {
    quadrant: 4,
    screenName: "campaign",
    required: false,
    ids: ["screen-campaign", "campaign-screen", "screen-campaign-shell"],
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureWorktree(sha: string, baseDir: string): string {
  const dir = path.join(baseDir, "runner");
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
  const sourceNodeModules = path.resolve("node_modules");
  const targetNodeModules = path.join(dir, "node_modules");
  if (!fs.existsSync(targetNodeModules) && fs.existsSync(sourceNodeModules)) {
    fs.symlinkSync(sourceNodeModules, targetNodeModules, "dir");
  }
  return dir;
}

function freeWorktree(dir: string) {
  if (!fs.existsSync(dir)) return;
  execFileSync("git", ["worktree", "remove", "--force", dir], {
    stdio: "pipe",
  });
  execFileSync("git", ["worktree", "prune"], { stdio: "pipe" });
}

async function waitForPort(port: number, timeoutMs = 8_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ port, host: "127.0.0.1" });
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for dev server on port ${port}`);
}

function startDevServer(worktreeDir: string, port: number): ChildProcess {
  return spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: worktreeDir,
      stdio: "pipe",
      env: {
        ...process.env,
        CI: "1",
      },
    },
  );
}

async function stopProcess(proc: ChildProcess): Promise<void> {
  if (!proc.pid) return;
  if (proc.killed) return;
  proc.kill("SIGTERM");
  try {
    await Promise.race([once(proc, "exit"), new Promise((r) => setTimeout(r, 2_000))]);
  } catch {
    // Ignore listener race errors and force kill below.
  }
  if (!proc.killed) {
    proc.kill("SIGKILL");
  }
}

function timestampFromIso(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function screenshotPath(baseDir: string, iso: string, screen: string, sha: string): string {
  return path.join(baseDir, `${timestampFromIso(iso)}_${screen}_${sha.slice(0, 7)}.png`);
}

function hasRequiredScreenshots(baseDir: string, iso: string, sha: string): boolean {
  return SCREEN_TARGETS.filter((target) => target.required).every((target) =>
    fs.existsSync(screenshotPath(baseDir, iso, target.screenName, sha)),
  );
}

async function assertHealthyPage(page: import("puppeteer").Page): Promise<void> {
  const state = await page.evaluate(() => {
    const text = (document.body?.innerText || "").toLowerCase();
    const title = (document.title || "").toLowerCase();
    const viteOverlay = !!document.querySelector("#vite-error-overlay");
    const hasKnownError =
      text.includes("internal server error") ||
      text.includes("failed to resolve import") ||
      text.includes("pre-transform error") ||
      text.includes("cannot find module") ||
      title.includes("error");
    return { viteOverlay, hasKnownError };
  });
  if (state.viteOverlay || state.hasKnownError) {
    throw new Error("Detected browser/vite error page");
  }
}

async function captureScreensForCommit(
  url: string,
  isoDate: string,
  sha: string,
  outDir: string,
  navMap: NavigationMap | null,
): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12_000 });
    await page.waitForSelector("body", { timeout: 4_000 });
    await sleep(1200);
    await assertHealthyPage(page);

    const hints = navMap?.commits?.[sha]?.targets;
    const dynamicTargets = SCREEN_TARGETS.map((target) => {
      const hinted = hints?.[target.screenName as keyof NonNullable<typeof hints>] || [];
      return { screenName: target.screenName, ids: [...hinted, ...target.ids] };
    });

    for (const target of dynamicTargets) {
      const activated = await page.evaluate((ids) => {
        const screens = Array.from(document.querySelectorAll<HTMLElement>(".screen"));
        for (const screen of screens) {
          screen.style.display = "none";
          screen.style.visibility = "hidden";
          screen.style.opacity = "0";
        }
        for (const id of ids) {
          const el = document.getElementById(id) as HTMLElement | null;
          if (!el) continue;
          el.style.display = "flex";
          el.style.visibility = "visible";
          el.style.opacity = "1";
          el.style.position = "absolute";
          el.style.inset = "0";
          return id;
        }
        return "";
      }, target.ids);
      if (!activated) {
        if (target.required) {
          throw new Error(`Required screen missing: ${target.screenName}`);
        }
        // eslint-disable-next-line no-console
        console.log(`[screen-skip] optional ${target.screenName} missing for ${sha.slice(0, 7)}`);
        continue;
      }
      await sleep(500);
      await assertHealthyPage(page);
      const filePath = screenshotPath(outDir, isoDate, target.screenName, sha);
      await page.screenshot({ path: filePath });
    }
  } finally {
    await browser.close();
  }
}

async function captureMilestone(
  milestone: Manifest["milestones"][number],
  opts: {
    basePort: number;
    worktreeBase: string;
    screenshotDir: string;
    navMap: NavigationMap | null;
  },
): Promise<{ usedSha?: string; reason?: string }> {
  const commit = milestone.sourceCommit;
  const port = opts.basePort;
  const worktree = ensureWorktree(commit, opts.worktreeBase);
  const devServer = startDevServer(worktree, port);
  // eslint-disable-next-line no-console
  console.log(`[candidate] ${commit.slice(0, 7)} on :${port}`);
  try {
    await waitForPort(port, 8_000);
    await captureScreensForCommit(
      `http://127.0.0.1:${port}/`,
      milestone.milestoneDate,
      commit,
      opts.screenshotDir,
      opts.navMap,
    );
    await stopProcess(devServer);
    return { usedSha: commit };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.log(`[candidate-fail] ${commit.slice(0, 7)} ${message}`);
    await stopProcess(devServer);
    return { reason: message };
  }
}

async function runCli() {
  const manifestPath = process.argv[2] || "timeline/manifest.json";
  const screenshotDir = process.argv[3] || "screenshots";
  const basePort = Number(process.argv[4] || 5178);
  const maxCount = Number(process.argv[5] || 0);
  const navigationPath = process.argv[6] || "timeline/navigation_map.json";

  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync("timeline", { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest;
  const navMap =
    fs.existsSync(navigationPath) && fs.statSync(navigationPath).isFile()
      ? (JSON.parse(fs.readFileSync(navigationPath, "utf-8")) as NavigationMap)
      : null;
  const worktreeBase = path.resolve(".timeline/worktrees");
  fs.mkdirSync(worktreeBase, { recursive: true });

  const effectiveMax = maxCount > 0 ? maxCount : manifest.milestones.length;
  const selected = manifest.milestones.slice(0, effectiveMax);
  for (const milestone of selected) {
    if (hasRequiredScreenshots(screenshotDir, milestone.milestoneDate, milestone.sourceCommit)) {
      milestone.actualCommitUsed = milestone.sourceCommit;
      milestone.captureStatus = "ok";
      delete milestone.captureReason;
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
      // eslint-disable-next-line no-console
      console.log(`[capture-skip] ${milestone.sourceCommit.slice(0, 7)} already captured`);
      continue;
    }
    // eslint-disable-next-line no-console
    console.log(
      `[milestone] ${milestone.milestoneDate.slice(0, 10)} ${milestone.sourceCommit.slice(0, 7)} ${milestone.subject}`,
    );
    const result = await captureMilestone(milestone, {
      basePort,
      worktreeBase,
      screenshotDir,
      navMap,
    });
    if (result.usedSha) {
      milestone.actualCommitUsed = result.usedSha;
      milestone.captureStatus = "ok";
      delete milestone.captureReason;
    } else {
      milestone.captureStatus = "skipped";
      milestone.captureReason = result.reason || "Unknown capture error.";
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
    // eslint-disable-next-line no-console
    console.log(
      `[capture] ${milestone.sourceCommit.slice(0, 7)} -> ${milestone.captureStatus} ${milestone.actualCommitUsed ? milestone.actualCommitUsed.slice(0, 7) : ""}`,
    );
  }
  try {
    freeWorktree(path.resolve(worktreeBase, "runner"));
  } catch {
    // ignore
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
