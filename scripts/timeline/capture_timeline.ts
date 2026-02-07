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

type PlaybookDoc = {
  playbooks: Array<{
    startCommit: string;
    endCommit: string;
    actions: Array<{
      target: "mission" | "main_menu" | "config" | "campaign";
      steps: string[];
    }>;
  }>;
};

type NavigationMap = {
  commits: Record<
    string,
    {
      actionIds?: string[];
      targets?: {
        mission?: string[];
        main_menu?: string[];
        config?: string[];
        campaign?: string[];
      };
    }
  >;
};

type RootProbe = {
  ok: boolean;
  reason: string;
  status?: number;
  bodySnippet?: string;
};

type ProcessLogs = {
  stdoutTail: string[];
  stderrTail: string[];
};

type ServerState = {
  proc: ChildProcess | null;
  logs: ProcessLogs | null;
  commitsServed: number;
};

const SCREEN_TARGETS: Array<{
  quadrant: 1 | 2 | 3 | 4;
  screenName: "mission" | "main_menu" | "config" | "campaign";
  required: boolean;
  ids: string[];
}> = [
  { quadrant: 1, screenName: "mission", required: false, ids: ["screen-mission", "mission-screen", "screen-game"] },
  { quadrant: 2, screenName: "main_menu", required: false, ids: ["screen-main-menu", "main-menu", "screen-menu"] },
  {
    quadrant: 3,
    screenName: "config",
    required: false,
    ids: ["screen-mission-setup", "mission-setup", "screen-setup", "screen-equipment", "equipment-screen", "screen-loadout"],
  },
  {
    quadrant: 4,
    screenName: "campaign",
    required: false,
    ids: ["screen-campaign", "campaign-screen", "screen-campaign-shell"],
  },
];

export function classifyRootResponse(status: number, bodyText: string): RootProbe {
  const lower = bodyText.toLowerCase();
  if (status !== 200) {
    return {
      ok: false,
      reason: `Root probe failed with HTTP ${status}`,
      status,
      bodySnippet: bodyText.slice(0, 300),
    };
  }
  const knownErrorPage =
    lower.includes("404 not found") ||
    lower.includes("internal server error") ||
    lower.includes("failed to resolve import") ||
    lower.includes("pre-transform error") ||
    lower.includes("cannot find module");
  if (knownErrorPage) {
    return {
      ok: false,
      reason: "Root probe returned an error page",
      status,
      bodySnippet: bodyText.slice(0, 300),
    };
  }
  const looksLikeHtml = lower.includes("<html") && lower.includes("<body");
  if (!looksLikeHtml) {
    return {
      ok: false,
      reason: "Root probe did not return HTML document",
      status,
      bodySnippet: bodyText.slice(0, 300),
    };
  }
  return { ok: true, reason: "ok", status };
}

export function shouldAbortForConsecutiveFailures(
  consecutiveFailures: number,
  threshold: number,
): boolean {
  return consecutiveFailures >= threshold;
}

export function shouldRotateServer(commitsServed: number, restartEvery: number): boolean {
  return restartEvery > 0 && commitsServed >= restartEvery;
}

export function buildBootstrapClickOrder(actionIds: string[] = []): string[] {
  const preferred = [
    "btn-menu-custom",
    "btn-custom-mission",
    "btn-menu-skirmish",
    "btn-start-mission",
    "btn-start",
    "btn-begin",
    "btn-deploy",
    "btn-confirm-loadout",
  ];
  const actionSet = new Set(actionIds.map((id) => id.toLowerCase()));
  const selected = preferred.filter((id) => actionSet.has(id.toLowerCase()));
  for (const id of preferred) {
    if (!selected.includes(id)) selected.push(id);
  }
  return selected;
}

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

function isProcessAlive(proc: ChildProcess): boolean {
  return proc.exitCode === null && !proc.killed;
}

async function probeRoot(port: number, timeoutMs = 4_000): Promise<RootProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: controller.signal,
      redirect: "follow",
    });
    const bodyText = await response.text();
    return classifyRootResponse(response.status, bodyText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: `Root probe request failed: ${message}`,
      bodySnippet: "",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForHealthyRoot(
  port: number,
  proc: ChildProcess,
  timeoutMs = 10_000,
): Promise<RootProbe> {
  const start = Date.now();
  let lastProbe: RootProbe = { ok: false, reason: "not-started" };
  while (Date.now() - start < timeoutMs) {
    if (!isProcessAlive(proc)) {
      return { ok: false, reason: "Dev server process exited before readiness" };
    }
    lastProbe = await probeRoot(port, 2_000);
    if (lastProbe.ok) return lastProbe;
    await sleep(300);
  }
  return {
    ok: false,
    reason: `Timed out waiting for healthy root: ${lastProbe.reason}`,
    status: lastProbe.status,
    bodySnippet: lastProbe.bodySnippet,
  };
}

function startDevServer(worktreeDir: string, port: number): ChildProcess {
  return spawn(
    "npm",
    ["run", "dev", "--", "--host", "--port", String(port), "--strictPort"],
    {
      cwd: worktreeDir,
      stdio: "pipe",
      detached: true,
      env: {
        ...process.env,
        CI: "1",
      },
    },
  );
}

function pidLabel(proc: ChildProcess | null | undefined): string {
  if (!proc) return "unknown";
  return proc.pid ? String(proc.pid) : "unknown";
}

function createProcessLogs(proc: ChildProcess, maxLines = 80): ProcessLogs {
  const logs: ProcessLogs = { stdoutTail: [], stderrTail: [] };
  proc.stdout?.on("data", (chunk: Buffer) => {
    const lines = chunk.toString("utf-8").split("\n").map((l) => l.trim()).filter(Boolean);
    logs.stdoutTail.push(...lines);
    if (logs.stdoutTail.length > maxLines) logs.stdoutTail.splice(0, logs.stdoutTail.length - maxLines);
  });
  proc.stderr?.on("data", (chunk: Buffer) => {
    const lines = chunk.toString("utf-8").split("\n").map((l) => l.trim()).filter(Boolean);
    logs.stderrTail.push(...lines);
    if (logs.stderrTail.length > maxLines) logs.stderrTail.splice(0, logs.stderrTail.length - maxLines);
  });
  return logs;
}

async function stopProcess(proc: ChildProcess): Promise<void> {
  if (!proc.pid) return;
  const groupPid = -proc.pid;
  try {
    process.kill(groupPid, "SIGTERM");
  } catch {
    if (!proc.killed) proc.kill("SIGTERM");
  }
  try {
    await Promise.race([once(proc, "exit"), new Promise((r) => setTimeout(r, 2_000))]);
  } catch {
    // Ignore listener race errors and force kill below.
  }
  if (isProcessAlive(proc)) {
    try {
      process.kill(groupPid, "SIGKILL");
    } catch {
      if (!proc.killed) proc.kill("SIGKILL");
    }
  }
}

function timestampFromIso(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function screenshotPath(baseDir: string, iso: string, screen: string, sha: string): string {
  return path.join(baseDir, `${timestampFromIso(iso)}_${screen}_${sha.slice(0, 7)}.png`);
}

function hasExistingScreenshots(baseDir: string, iso: string, sha: string): boolean {
  return SCREEN_TARGETS.some((target) =>
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
  playbookActions: Record<string, string[]> | null,
  postLoadWaitMs: number,
  missionCaptureWaitMs: number,
): Promise<number> {
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
    const hintActionIds = navMap?.commits?.[sha]?.actionIds || [];
    await runBootstrapFlow(page, hintActionIds, postLoadWaitMs);
    const dynamicTargets = SCREEN_TARGETS.map((target) => {
      const hinted = hints?.[target.screenName as keyof NonNullable<typeof hints>] || [];
      return {
        quadrant: target.quadrant,
        screenName: target.screenName,
        required: target.required,
        ids: [...hinted, ...target.ids],
      };
    });

    let writtenCount = 0;
    for (const target of dynamicTargets) {
      let activated = "";
      const steps = playbookActions?.[target.screenName] || [];
      if (steps.length > 0) {
        activated = await applyPlaybookSteps(page, steps);
      }
      if (!activated) {
        activated = await forceShowByIds(page, target.ids);
      }
      if (!activated) {
        if (target.required) {
          throw new Error(`Required screen missing: ${target.screenName}`);
        }
        // eslint-disable-next-line no-console
        console.log(`[screen-skip] optional ${target.screenName} missing for ${sha.slice(0, 7)}`);
        continue;
      }
      const settleMs = target.screenName === "mission" ? missionCaptureWaitMs : 500;
      await sleep(settleMs);
      await assertHealthyPage(page);
      const filePath = screenshotPath(outDir, isoDate, target.screenName, sha);
      await page.screenshot({ path: filePath });
      writtenCount += 1;
    }
    if (writtenCount === 0) {
      await assertHealthyPage(page);
      const fallbackPath = screenshotPath(outDir, isoDate, "mission", sha);
      await page.screenshot({ path: fallbackPath });
      // eslint-disable-next-line no-console
      console.log(`[screen-fallback] captured full page as mission for ${sha.slice(0, 7)}`);
      return 1;
    }
    return writtenCount;
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
    playbookActions: Record<string, string[]> | null;
    startupTimeoutMs: number;
    restartEvery: number;
    serverState: ServerState;
    postLoadWaitMs: number;
    missionCaptureWaitMs: number;
  },
): Promise<{ usedSha?: string; reason?: string; attempts: number; logs?: ProcessLogs }> {
  const commit = milestone.sourceCommit;
  const port = opts.basePort;
  const worktree = ensureWorktree(commit, opts.worktreeBase);
  // eslint-disable-next-line no-console
  console.log(`[candidate] ${commit.slice(0, 7)} on :${port}`);

  let lastReason = "Unknown capture failure.";
  let lastLogs: ProcessLogs | undefined;
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const mustRotate =
      !opts.serverState.proc ||
      !isProcessAlive(opts.serverState.proc) ||
      (attempt === 1 && shouldRotateServer(opts.serverState.commitsServed, opts.restartEvery));
    if (mustRotate) {
      if (opts.serverState.proc) {
        await stopProcess(opts.serverState.proc);
        // eslint-disable-next-line no-console
        console.log(
          `[dev-stop] ${commit.slice(0, 7)} attempt ${attempt}/${maxAttempts} pid=${pidLabel(opts.serverState.proc)} status=rotate`,
        );
      }
      const devServer = startDevServer(worktree, port);
      // eslint-disable-next-line no-console
      console.log(
        `[dev-start] ${commit.slice(0, 7)} attempt ${attempt}/${maxAttempts} pid=${pidLabel(devServer)} port=${port}`,
      );
      opts.serverState.proc = devServer;
      opts.serverState.logs = createProcessLogs(devServer);
      opts.serverState.commitsServed = 0;
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `[dev-reuse] ${commit.slice(0, 7)} attempt ${attempt}/${maxAttempts} pid=${pidLabel(opts.serverState.proc)} served=${opts.serverState.commitsServed}`,
      );
    }
    try {
      const devServer = opts.serverState.proc as ChildProcess;
      const procLogs = opts.serverState.logs as ProcessLogs;
      await waitForPort(port, opts.startupTimeoutMs);
      const readiness = await waitForHealthyRoot(port, devServer, opts.startupTimeoutMs);
      if (!readiness.ok) {
        throw new Error(readiness.reason);
      }
      const captured = await captureScreensForCommit(
        `http://127.0.0.1:${port}/`,
        milestone.milestoneDate,
        commit,
        opts.screenshotDir,
        opts.navMap,
        opts.playbookActions,
        opts.postLoadWaitMs,
        opts.missionCaptureWaitMs,
      );
      if (captured === 0) {
        throw new Error("No screenshots captured for this commit");
      }
      opts.serverState.commitsServed += 1;
      return { usedSha: commit, attempts: attempt, logs: procLogs };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastReason = message;
      lastLogs = opts.serverState.logs || undefined;
      if (opts.serverState.proc) {
        await stopProcess(opts.serverState.proc);
      }
      // eslint-disable-next-line no-console
      console.log(
        `[dev-stop] ${commit.slice(0, 7)} attempt ${attempt}/${maxAttempts} pid=${pidLabel(opts.serverState.proc)} status=fail reason=${message}`,
      );
      opts.serverState.proc = null;
      opts.serverState.logs = null;
      opts.serverState.commitsServed = 0;
      if (attempt < maxAttempts) {
        // eslint-disable-next-line no-console
        console.log(`[candidate-retry] ${commit.slice(0, 7)} attempt ${attempt + 1}/${maxAttempts}`);
        continue;
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[candidate-fail] ${commit.slice(0, 7)} ${lastReason}`);
  return { reason: lastReason, attempts: maxAttempts, logs: lastLogs };
}

async function runCli() {
  const argv = process.argv.slice(2);
  const manifestPath =
    readNamedArg(argv, ["--manifest"]) || argv[0] || "timeline/manifest.json";
  const screenshotDir =
    readNamedArg(argv, ["--screenshots"]) || argv[1] || "screenshots";
  const basePort = Number(readNamedArg(argv, ["--port"]) || argv[2] || 6080);
  const maxCount = Number(readNamedArg(argv, ["--max-count"]) || argv[3] || 0);
  const navigationPath =
    readNamedArg(argv, ["--navigation-map"]) || argv[4] || "timeline/navigation_map.json";
  const playbookPath =
    readNamedArg(argv, ["--playbooks"]) || argv[5] || "timeline/navigation_playbooks.json";
  const worktreeBase = path.resolve(
    readNamedArg(argv, ["--worktree-base"]) || ".timeline/worktrees",
  );
  const startupTimeoutMs = Number(
    readNamedArg(argv, ["--startup-timeout-ms"]) || 12_000,
  );
  const maxConsecutiveFailures = Number(
    readNamedArg(argv, ["--max-consecutive-failures"]) || 3,
  );
  const restartEvery = Number(readNamedArg(argv, ["--restart-every"]) || 100);
  const postLoadWaitMs = Number(readNamedArg(argv, ["--post-load-wait-ms"]) || 3000);
  const missionCaptureWaitMs = Number(
    readNamedArg(argv, ["--mission-capture-wait-ms"]) || 3000,
  );
  const debugLogPath =
    readNamedArg(argv, ["--debug-log"]) || "timeline/capture_debug.json";

  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync("timeline", { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest;
  const navMap =
    fs.existsSync(navigationPath) && fs.statSync(navigationPath).isFile()
      ? (JSON.parse(fs.readFileSync(navigationPath, "utf-8")) as NavigationMap)
      : null;
  const playbooks =
    fs.existsSync(playbookPath) && fs.statSync(playbookPath).isFile()
      ? (JSON.parse(fs.readFileSync(playbookPath, "utf-8")) as PlaybookDoc)
      : null;
  fs.mkdirSync(worktreeBase, { recursive: true });

  const effectiveMax = maxCount > 0 ? maxCount : manifest.milestones.length;
  const selected = manifest.milestones.slice(0, effectiveMax);
  const commitIndex = new Map<string, number>();
  manifest.milestones.forEach((m, idx) => commitIndex.set(m.sourceCommit, idx));
  const serverState: ServerState = { proc: null, logs: null, commitsServed: 0 };
  let consecutiveFailures = 0;
  const recentFailures: Array<{
    commit: string;
    date: string;
    subject: string;
    reason: string;
    attempts: number;
    stderrTail: string[];
    stdoutTail: string[];
  }> = [];

  try {
    for (const milestone of selected) {
      if (hasExistingScreenshots(screenshotDir, milestone.milestoneDate, milestone.sourceCommit)) {
        milestone.actualCommitUsed = milestone.sourceCommit;
        milestone.captureStatus = "ok";
        delete milestone.captureReason;
        fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
        // eslint-disable-next-line no-console
        console.log(`[capture-skip] ${milestone.sourceCommit.slice(0, 7)} already captured`);
        consecutiveFailures = 0;
        continue;
      }
      // eslint-disable-next-line no-console
      console.log(
        `[milestone] ${milestone.milestoneDate.slice(0, 10)} ${milestone.sourceCommit.slice(0, 7)} ${milestone.subject}`,
      );
      const playbookActions = resolvePlaybookActions(
        milestone.sourceCommit,
        commitIndex,
        playbooks,
      );
      const result = await captureMilestone(milestone, {
        basePort,
        worktreeBase,
        screenshotDir,
        navMap,
        playbookActions,
        startupTimeoutMs,
        restartEvery,
        serverState,
        postLoadWaitMs,
        missionCaptureWaitMs,
      });
      if (result.usedSha) {
        milestone.actualCommitUsed = result.usedSha;
        milestone.captureStatus = "ok";
        delete milestone.captureReason;
        consecutiveFailures = 0;
      } else {
        milestone.captureStatus = "skipped";
        milestone.captureReason = result.reason || "Unknown capture error.";
        consecutiveFailures += 1;
        recentFailures.push({
          commit: milestone.sourceCommit,
          date: milestone.milestoneDate,
          subject: milestone.subject,
          reason: milestone.captureReason,
          attempts: result.attempts,
          stderrTail: result.logs?.stderrTail || [],
          stdoutTail: result.logs?.stdoutTail || [],
        });
        if (recentFailures.length > maxConsecutiveFailures) recentFailures.shift();
      }
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
      // eslint-disable-next-line no-console
      console.log(
        `[capture] ${milestone.sourceCommit.slice(0, 7)} -> ${milestone.captureStatus} ${milestone.actualCommitUsed ? milestone.actualCommitUsed.slice(0, 7) : ""}`,
      );
      if (shouldAbortForConsecutiveFailures(consecutiveFailures, maxConsecutiveFailures)) {
        const debugPayload = {
          generatedAt: new Date().toISOString(),
          message: `Aborting after ${consecutiveFailures} consecutive capture failures.`,
          threshold: maxConsecutiveFailures,
          port: basePort,
          failures: recentFailures,
        };
        fs.mkdirSync(path.dirname(debugLogPath), { recursive: true });
        fs.writeFileSync(debugLogPath, `${JSON.stringify(debugPayload, null, 2)}\n`, "utf-8");
        throw new Error(
          `Aborting capture after ${consecutiveFailures} consecutive failures. See ${debugLogPath}`,
        );
      }
    }
  } finally {
    if (serverState.proc) {
      await stopProcess(serverState.proc);
      // eslint-disable-next-line no-console
      console.log(`[dev-stop] final pid=${pidLabel(serverState.proc)} status=finalize`);
    }
    try {
      freeWorktree(path.resolve(worktreeBase, "runner"));
    } catch {
      // ignore
    }
  }
}

async function runBootstrapFlow(
  page: import("puppeteer").Page,
  actionIds: string[],
  postLoadWaitMs: number,
): Promise<void> {
  if (postLoadWaitMs > 0) {
    await sleep(postLoadWaitMs);
  }
  const orderedIds = buildBootstrapClickOrder(actionIds);
  let clickedAny = false;
  for (const id of orderedIds) {
    const clicked = await clickIfPresent(page, `#${id}`);
    if (clicked) {
      clickedAny = true;
      await sleep(450);
    }
  }
  if (!clickedAny) {
    const textSteps: string[][] = [
      ["custom", "mission"],
      ["skirmish"],
      ["start", "mission"],
      ["deploy"],
      ["begin"],
    ];
    for (const terms of textSteps) {
      const clicked = await clickByText(page, terms);
      if (clicked) {
        await sleep(550);
      }
    }
  }
}

async function clickIfPresent(
  page: import("puppeteer").Page,
  selector: string,
): Promise<boolean> {
  try {
    const visible = await page.$eval(selector, (el) => {
      const target = el as HTMLElement;
      const style = window.getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    if (!visible) return false;
    await page.click(selector, { delay: 30 });
    return true;
  } catch {
    return false;
  }
}

async function clickByText(
  page: import("puppeteer").Page,
  terms: string[],
): Promise<boolean> {
  try {
    return await page.evaluate((needles) => {
      const lowered = needles.map((n) => n.toLowerCase());
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>("button, [role='button'], a, .btn"),
      );
      for (const el of candidates) {
        const text = (el.textContent || "").trim().toLowerCase();
        if (!text) continue;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
        if (!visible) continue;
        const match = lowered.every((needle) => text.includes(needle));
        if (!match) continue;
        el.click();
        return true;
      }
      return false;
    }, terms);
  } catch {
    return false;
  }
}

function resolvePlaybookActions(
  commit: string,
  commitIndex: Map<string, number>,
  playbooks: PlaybookDoc | null,
): Record<string, string[]> | null {
  if (!playbooks) return null;
  const idx = commitIndex.get(commit);
  if (idx === undefined) return null;
  for (const playbook of playbooks.playbooks) {
    const start = commitIndex.get(playbook.startCommit);
    const end = commitIndex.get(playbook.endCommit);
    if (start === undefined || end === undefined) continue;
    if (idx >= start && idx <= end) {
      const map: Record<string, string[]> = {};
      for (const action of playbook.actions) map[action.target] = action.steps;
      return map;
    }
  }
  return null;
}

async function forceShowByIds(
  page: import("puppeteer").Page,
  ids: string[],
): Promise<string> {
  return page.evaluate((targetIds) => {
    const screens = Array.from(document.querySelectorAll<HTMLElement>(".screen"));
    for (const screen of screens) {
      screen.style.display = "none";
      screen.style.visibility = "hidden";
      screen.style.opacity = "0";
    }
    for (const id of targetIds) {
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
  }, ids);
}

async function applyPlaybookSteps(
  page: import("puppeteer").Page,
  steps: string[],
): Promise<string> {
  let activated = "";
  for (const step of steps) {
    if (step.startsWith("show:#")) {
      const id = step.slice("show:#".length);
      const shown = await forceShowByIds(page, [id]);
      if (shown) activated = shown;
      continue;
    }
    if (step.startsWith("click:#")) {
      const selector = `#${step.slice("click:#".length)}`;
      try {
        await page.click(selector, { delay: 30 });
        activated = selector.slice(1);
      } catch {
        // ignore and continue fallback flow
      }
      continue;
    }
    if (step.startsWith("wait:")) {
      const n = Number(step.replace(/[^\d]/g, ""));
      if (Number.isFinite(n) && n > 0) await sleep(n);
      continue;
    }
  }
  return activated;
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

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
