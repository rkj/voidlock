import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import puppeteer from "puppeteer";
import sharp from "sharp";

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

type CommitPlaybookActions = Record<string, string[]>;

type RootProbe = {
  ok: boolean;
  reason: string;
  status?: number;
  bodySnippet?: string;
};

type ProcessLogs = {
  stdoutTail: string[];
  stderrTail: string[];
  readySeen: boolean;
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

export function isLikelyBlackFrame(meanRgb: number, stdevRgb: number): boolean {
  return meanRgb <= 10 && stdevRgb <= 18;
}

export function isLikelyGameplayBlackFrame(meanRgb: number, stdevRgb: number): boolean {
  return meanRgb <= 9 && stdevRgb <= 16;
}

export function shouldAcceptMissionCapture(ready: boolean, _dark: boolean): boolean {
  return ready;
}

export function parseShaAllowlistContent(content: string): Set<string> {
  return new Set(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => line.toLowerCase()),
  );
}

export function isAllowedByShaPrefix(sha: string, allowlist: Set<string>): boolean {
  const lower = sha.toLowerCase();
  for (const prefix of allowlist) {
    if (lower.startsWith(prefix)) return true;
  }
  return false;
}

export function isRiskyNavigationId(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.includes("give-up") ||
    lower.includes("abort") ||
    lower.includes("abandon") ||
    lower.includes("surrender") ||
    lower.includes("reset")
  );
}

function shouldSkipClickStep(step: string): boolean {
  if (!step.startsWith("click:#")) return false;
  const id = step.slice("click:#".length);
  return isRiskyNavigationId(id);
}

export function isMissionUiReady(signals: {
  hasCanvas: boolean;
  hasMissionTokens: boolean;
  hasMissionUiStructure: boolean;
  hasSetupTokens: boolean;
  hasCampaignTokens: boolean;
  hasMainMenuTokens: boolean;
}): boolean {
  // Mission is valid if gameplay canvas exists, setup/config cues are absent,
  // and mission HUD/tokens are present. Campaign shell can coexist with mission.
  const missionCoreReady = signals.hasMissionTokens || signals.hasMissionUiStructure;
  const setupOnly = signals.hasSetupTokens && !missionCoreReady;
  const campaignOnly = signals.hasCampaignTokens && !missionCoreReady;
  const mainMenuOnly = signals.hasMainMenuTokens && !missionCoreReady;
  return (
    signals.hasCanvas &&
    !setupOnly &&
    !campaignOnly &&
    !mainMenuOnly &&
    missionCoreReady
  );
}

function looksLikeMainMenuUi(signals: {
  hasMainMenuTokens: boolean;
  hasSetupTokens: boolean;
  hasMissionTokens: boolean;
}): boolean {
  return signals.hasMainMenuTokens && !signals.hasSetupTokens && !signals.hasMissionTokens;
}

export function buildBootstrapClickOrder(actionIds: string[] = []): string[] {
  const preferred = [
    "btn-menu-custom",
    "btn-goto-equipment",
    "btn-custom-mission",
    "btn-menu-skirmish",
    "btn-launch-mission",
    "btn-confirm-squad",
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

function prioritizeTargetIds(
  screenName: "mission" | "main_menu" | "config" | "campaign",
  ids: string[],
): string[] {
  if (screenName !== "mission") return ids;
  const exactMission = ids.filter(
    (id) => id.toLowerCase().includes("screen-mission") && !id.toLowerCase().includes("setup"),
  );
  const missionLike = ids.filter(
    (id) =>
      id.toLowerCase().includes("mission") &&
      !id.toLowerCase().includes("setup") &&
      !exactMission.includes(id),
  );
  const rest = ids.filter((id) => !exactMission.includes(id) && !missionLike.includes(id));
  return [...exactMission, ...missionLike, ...rest];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveOriginForStorage(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
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

export function lineLooksReady(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.includes("ready in") ||
    lower.includes("local:") ||
    lower.includes("listening on")
  );
}

async function waitForReadySignal(
  proc: ChildProcess,
  logs: ProcessLogs,
  timeoutMs = 12_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isProcessAlive(proc)) {
      throw new Error("Dev server process exited before readiness signal");
    }
    if (logs.readySeen) return;
    await sleep(120);
  }
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
  const logs: ProcessLogs = { stdoutTail: [], stderrTail: [], readySeen: false };
  proc.stdout?.on("data", (chunk: Buffer) => {
    const lines = chunk.toString("utf-8").split("\n").map((l) => l.trim()).filter(Boolean);
    logs.stdoutTail.push(...lines);
    if (lines.some((line) => lineLooksReady(line))) logs.readySeen = true;
    if (logs.stdoutTail.length > maxLines) logs.stdoutTail.splice(0, logs.stdoutTail.length - maxLines);
  });
  proc.stderr?.on("data", (chunk: Buffer) => {
    const lines = chunk.toString("utf-8").split("\n").map((l) => l.trim()).filter(Boolean);
    logs.stderrTail.push(...lines);
    if (lines.some((line) => lineLooksReady(line))) logs.readySeen = true;
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
  missionRequired: boolean,
): Promise<number> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const hintActionIds = navMap?.commits?.[sha]?.actionIds || [];
    let writtenCount = 0;

    // Main menu checkpoint
    await gotoRoot(page, url, postLoadWaitMs);
    const mainMenuPath = screenshotPath(outDir, isoDate, "main_menu", sha);
    if (await detectMainMenuUi(page)) {
      await captureViewport(page, mainMenuPath);
      writtenCount += 1;
    } else {
      // eslint-disable-next-line no-console
      console.log(`[screen-skip] optional main_menu missing for ${sha.slice(0, 7)}`);
    }

    // Config/custom mission checkpoint
    await gotoRoot(page, url, postLoadWaitMs);
    let configReached = await applyPlaybookTarget(
      page,
      playbookActions?.config || [],
      postLoadWaitMs,
    );
    if (!configReached) {
      configReached = await runTextClickFlow(page, [
      ["custom", "mission"],
      ["custom"],
      ["mission", "setup"],
      ["skirmish"],
      ]);
    }
    if (configReached) {
      await sleep(700);
      await assertHealthyPage(page);
      await captureViewport(page, screenshotPath(outDir, isoDate, "config", sha));
      writtenCount += 1;
    } else {
      // eslint-disable-next-line no-console
      console.log(`[screen-skip] optional config missing for ${sha.slice(0, 7)}`);
    }

    // Campaign checkpoint
    await gotoRoot(page, url, postLoadWaitMs);
    const campaignPath = screenshotPath(outDir, isoDate, "campaign", sha);
    let campaignReached = await applyPlaybookTarget(
      page,
      playbookActions?.campaign || [],
      postLoadWaitMs,
    );
    if (!campaignReached) {
      campaignReached = await runTextClickFlow(page, [["campaign"]]);
    }
    if (campaignReached) {
      await sleep(700);
      await assertHealthyPage(page);
      await captureViewport(page, campaignPath);
      writtenCount += 1;
    } else {
      // eslint-disable-next-line no-console
      console.log(`[screen-skip] optional campaign missing for ${sha.slice(0, 7)}`);
    }

    // Mission checkpoint (must be initialized by click flow, not DOM force-show)
    const missionPath = screenshotPath(outDir, isoDate, "mission", sha);
    const missionReady = await captureMissionByClicks(
      page,
      url,
      missionPath,
      postLoadWaitMs,
      missionCaptureWaitMs,
      sha,
      playbookActions?.mission || [],
      hintActionIds,
    );
    if (missionReady) {
      if (fs.existsSync(campaignPath) && areFilesIdentical(missionPath, campaignPath)) {
        fs.unlinkSync(missionPath);
        throw new Error(
          `Mission capture duplicated campaign frame for ${sha.slice(0, 7)}; likely wrong flow`,
        );
      }
      writtenCount += 1;
    } else {
      if (missionRequired) {
        throw new Error(`Required mission capture missing for ${sha.slice(0, 7)}`);
      }
      // eslint-disable-next-line no-console
      console.log(`[screen-skip] optional mission missing for ${sha.slice(0, 7)}`);
    }
    if (writtenCount === 0) {
      await gotoRoot(page, url, postLoadWaitMs);
      const fallbackPath = screenshotPath(outDir, isoDate, "main_menu", sha);
      await captureViewport(page, fallbackPath);
      // eslint-disable-next-line no-console
      console.log(`[screen-fallback] captured full page as main_menu for ${sha.slice(0, 7)}`);
      return 1;
    }
    return writtenCount;
  } finally {
    await browser.close();
  }
}

async function isScreenshotLikelyBlack(filePath: string): Promise<boolean> {
  const image = sharp(filePath);
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const fullStats = await image.stats();
  const fullMean = fullStats.channels.slice(0, 3).reduce((acc, ch) => acc + ch.mean, 0) / 3;
  const fullStdev = fullStats.channels.slice(0, 3).reduce((acc, ch) => acc + ch.stdev, 0) / 3;
  const fullBlack = isLikelyBlackFrame(fullMean, fullStdev);
  if (width <= 0 || height <= 0) return fullBlack;
  const gameplayWidth = Math.max(1, Math.floor(width * 0.72));
  const gameplayStats = await sharp(filePath)
    .extract({ left: 0, top: 0, width: gameplayWidth, height })
    .stats();
  const gameplayMean = gameplayStats.channels.slice(0, 3).reduce((acc, ch) => acc + ch.mean, 0) / 3;
  const gameplayStdev = gameplayStats.channels.slice(0, 3).reduce((acc, ch) => acc + ch.stdev, 0) / 3;
  const gameplayBlack = isLikelyGameplayBlackFrame(gameplayMean, gameplayStdev);
  return fullBlack || gameplayBlack;
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
    missionRequired: boolean;
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
      await Promise.all([
        waitForPort(port, opts.startupTimeoutMs),
        waitForReadySignal(devServer, procLogs, opts.startupTimeoutMs),
      ]);
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
        opts.missionRequired,
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
  const commitPlaybooksPath =
    readNamedArg(argv, ["--commit-playbooks-jsonl"]) || "timeline/commit_playbooks.jsonl";
  const worktreeBase = path.resolve(
    readNamedArg(argv, ["--worktree-base"]) || ".timeline/worktrees",
  );
  const startupTimeoutMs = Number(
    readNamedArg(argv, ["--startup-timeout-ms"]) || 30_000,
  );
  const maxConsecutiveFailures = Number(
    readNamedArg(argv, ["--max-consecutive-failures"]) || 3,
  );
  const restartEvery = Number(readNamedArg(argv, ["--restart-every"]) || 1);
  const postLoadWaitMs = Number(readNamedArg(argv, ["--post-load-wait-ms"]) || 3000);
  const missionCaptureWaitMs = Number(
    readNamedArg(argv, ["--mission-capture-wait-ms"]) || 3000,
  );
  const debugLogPath =
    readNamedArg(argv, ["--debug-log"]) || "timeline/capture_debug.json";
  const missionAllowlistPath =
    readNamedArg(argv, ["--mission-allowlist"]) || "timeline/mission_allowlist.txt";
  const missionRequiredDefault =
    (readNamedArg(argv, ["--mission-required"]) || "true").toLowerCase() !== "false";

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
  const commitPlaybooks =
    fs.existsSync(commitPlaybooksPath) && fs.statSync(commitPlaybooksPath).isFile()
      ? parseCommitPlaybookJsonlContent(fs.readFileSync(commitPlaybooksPath, "utf-8"))
      : new Map<string, CommitPlaybookActions>();
  const missionAllowlist =
    fs.existsSync(missionAllowlistPath) && fs.statSync(missionAllowlistPath).isFile()
      ? parseShaAllowlistContent(fs.readFileSync(missionAllowlistPath, "utf-8"))
      : new Set<string>();
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
        commitPlaybooks,
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
        missionRequired:
          missionRequiredDefault &&
          !isAllowedByShaPrefix(milestone.sourceCommit, missionAllowlist),
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
      ["equipment", "supplies"],
      ["confirm", "squad"],
      ["skirmish"],
      ["start", "mission"],
      ["launch", "mission"],
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

async function waitForMissionUi(
  page: import("puppeteer").Page,
  timeoutMs: number,
  pollMs = 350,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await detectMissionReadyUi(page)) return true;
    await sleep(pollMs);
  }
  return false;
}

async function gotoRoot(
  page: import("puppeteer").Page,
  url: string,
  postLoadWaitMs: number,
): Promise<void> {
  await clearBrowserStateForUrl(page, url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12_000 });
  await page.waitForSelector("body", { timeout: 4_000 });
  await sleep(postLoadWaitMs > 0 ? postLoadWaitMs : 1000);
  await assertHealthyPage(page);
}

async function clearBrowserStateForUrl(
  page: import("puppeteer").Page,
  url: string,
): Promise<void> {
  const origin = resolveOriginForStorage(url);
  if (!origin) return;
  try {
    const client = await page.target().createCDPSession();
    await client.send("Storage.clearDataForOrigin", {
      origin,
      storageTypes: "all",
    });
    await client.detach();
  } catch {
    // best-effort fallback for older Chromium/CDP variants
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 8_000 });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch {
      // ignore; capture flow will validate readiness and fail loudly if state is bad
    }
  }
}

async function captureViewport(page: import("puppeteer").Page, filePath: string): Promise<void> {
  await page.screenshot({ path: filePath });
}

async function runTextClickFlow(
  page: import("puppeteer").Page,
  steps: string[][],
): Promise<boolean> {
  let clickedAny = false;
  for (const terms of steps) {
    const clicked = await clickByText(page, terms);
    if (clicked) {
      clickedAny = true;
      await sleep(550);
    }
  }
  return clickedAny;
}

async function captureMissionByClicks(
  page: import("puppeteer").Page,
  url: string,
  missionPath: string,
  postLoadWaitMs: number,
  missionCaptureWaitMs: number,
  sha: string,
  playbookMissionSteps: string[],
  hintActionIds: string[],
): Promise<boolean> {
  const tempMissionPath = `${missionPath}.tmp`;
  const publishMission = () => {
    if (fs.existsSync(tempMissionPath)) fs.renameSync(tempMissionPath, missionPath);
  };
  const clearMissionArtifacts = () => {
    if (fs.existsSync(tempMissionPath)) fs.unlinkSync(tempMissionPath);
    if (fs.existsSync(missionPath)) fs.unlinkSync(missionPath);
  };

  // Mission-first fast path for commits where "/" already renders mission.
  await gotoRoot(page, url, postLoadWaitMs);
  const directWaitMs = Math.max(missionCaptureWaitMs, 1200);
  await waitForMissionUi(page, directWaitMs);
  await assertHealthyPage(page);
  await captureViewport(page, tempMissionPath);
  {
    const dark = await isScreenshotLikelyBlack(tempMissionPath);
    const ready = await detectMissionReadyUi(page);
    if (shouldAcceptMissionCapture(ready, dark)) {
      publishMission();
      return true;
    }
  }

  const safeMissionSteps = filterUnsafeMissionSteps(playbookMissionSteps);
  if (safeMissionSteps.length > 0) {
    await gotoRoot(page, url, postLoadWaitMs);
    const reached = await applyPlaybookTarget(page, safeMissionSteps, postLoadWaitMs);
    if (reached) {
      const waitMs = Math.max(missionCaptureWaitMs, 1200) + 5000;
      await waitForMissionUi(page, waitMs);
      await assertHealthyPage(page);
      await captureViewport(page, tempMissionPath);
      const dark = await isScreenshotLikelyBlack(tempMissionPath);
      const ready = await detectMissionReadyUi(page);
      if (shouldAcceptMissionCapture(ready, dark)) {
        publishMission();
        return true;
      }
      // eslint-disable-next-line no-console
      console.log(`[mission-retry] ${sha.slice(0, 7)} mission not ready after playbook path`);
    }
  }

  const missionFlows: string[][][] = [
    [["custom", "mission"], ["equipment", "supplies"], ["confirm", "squad"]],
    [["custom", "mission"], ["confirm", "squad"]],
    [["custom", "mission"], ["equipment", "supplies"], ["launch", "mission"]],
    [["custom", "mission"], ["equipment", "supplies"], ["start", "mission"]],
    [["custom", "mission"], ["launch", "mission"]],
    [["custom", "mission"], ["start", "mission"]],
    [["custom"], ["launch", "mission"]],
    [["custom"], ["deploy"]],
  ];
  for (let attempt = 0; attempt < missionFlows.length; attempt += 1) {
    await gotoRoot(page, url, postLoadWaitMs);
    await runBootstrapFlow(page, hintActionIds, 200);
    await runTextClickFlow(page, missionFlows[attempt]);
    const waitMs = Math.max(missionCaptureWaitMs, 1200) + 5000;
    await waitForMissionUi(page, waitMs);
    await assertHealthyPage(page);
    await captureViewport(page, tempMissionPath);
    const dark = await isScreenshotLikelyBlack(tempMissionPath);
    const ready = await detectMissionReadyUi(page);
    if (shouldAcceptMissionCapture(ready, dark)) {
      publishMission();
      return true;
    }
    // eslint-disable-next-line no-console
    console.log(`[mission-retry] ${sha.slice(0, 7)} mission not ready (retry ${attempt + 1}/${missionFlows.length})`);
  }
  clearMissionArtifacts();
  return false;
}

async function detectMissionReadyUi(page: import("puppeteer").Page): Promise<boolean> {
  const signals = await page.evaluate(() => {
    const isVisible = (el: Element | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const visibleText = (document.body?.innerText || "").toLowerCase();
    const hasCanvas = Array.from(document.querySelectorAll("canvas")).some((c) => {
      return isVisible(c);
    });
    const missionTokens = [
      "mission control",
      "objectives",
      "threat",
      "give up",
      "abort mission",
      "time:",
      "status:",
      "commands",
      "move (m)",
    ];
    const setupTokens = [
      "mission configuration",
      "squad selection",
      "equipment & supplies",
      "generator type",
      "map seed",
    ];
    const campaignTokens = [
      "sector map",
      "scrap:",
      "intel:",
      "barracks",
      "back to menu",
    ];
    const mainMenuTokens = ["custom mission", "campaign", "load replay"];
    const hasMissionUiStructure =
      isVisible(document.getElementById("right-panel")) ||
      isVisible(document.getElementById("mission-body")) ||
      isVisible(document.getElementById("soldier-panel")) ||
      isVisible(document.getElementById("command-panel")) ||
      isVisible(document.getElementById("unit-panel"));

    return {
      hasCanvas,
      hasMissionTokens: missionTokens.some((token) => visibleText.includes(token)),
      hasMissionUiStructure,
      hasSetupTokens: setupTokens.some((token) => visibleText.includes(token)),
      hasCampaignTokens: campaignTokens.some((token) => visibleText.includes(token)),
      hasMainMenuTokens: mainMenuTokens.some((token) => visibleText.includes(token)),
    };
  });
  return isMissionUiReady(signals);
}

async function detectMainMenuUi(page: import("puppeteer").Page): Promise<boolean> {
  const signals = await page.evaluate(() => {
    const visibleText = (document.body?.innerText || "").toLowerCase();
    const mainMenuTokens = ["custom mission", "campaign", "load replay"];
    const setupTokens = ["mission configuration", "generator type", "squad selection"];
    const missionTokens = ["mission control", "objectives", "abort mission", "threat meter"];
    return {
      hasMainMenuTokens: mainMenuTokens.some((token) => visibleText.includes(token)),
      hasSetupTokens: setupTokens.some((token) => visibleText.includes(token)),
      hasMissionTokens: missionTokens.some((token) => visibleText.includes(token)),
    };
  });
  return looksLikeMainMenuUi(signals);
}

async function applyPlaybookTarget(
  page: import("puppeteer").Page,
  steps: string[],
  postLoadWaitMs: number,
): Promise<boolean> {
  if (steps.length === 0) return false;
  let clicked = false;
  for (const step of steps) {
    if (typeof step !== "string") continue;
    if (step === "noop") continue;
    if (step.startsWith("wait:")) {
      const n = Number(step.replace(/[^\d]/g, ""));
      await sleep(Number.isFinite(n) && n > 0 ? n : postLoadWaitMs);
      continue;
    }
    if (step.startsWith("click:#")) {
      if (shouldSkipClickStep(step)) continue;
      const selector = `#${step.slice("click:#".length)}`;
      const ok = await clickIfPresent(page, selector);
      if (ok) clicked = true;
      continue;
    }
  }
  return clicked;
}

async function clickIfPresent(
  page: import("puppeteer").Page,
  selector: string,
): Promise<boolean> {
  try {
    const visible = await page.$eval(selector, (el) => {
      const target = el as HTMLElement;
      target.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
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
  const loweredTerms = terms.map((term) => term.toLowerCase());
  if (
    loweredTerms.some((term) =>
      ["abort", "abandon", "give up", "surrender", "reset"].some((token) => term.includes(token)),
    )
  ) {
    return false;
  }
  try {
    return await page.evaluate((needles) => {
      const lowered = needles.map((n) => n.toLowerCase());
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>("button, [role='button'], a, .btn"),
      );
      for (const el of candidates) {
        const text = (el.textContent || "").trim().toLowerCase();
        if (!text) continue;
        if (
          text.includes("abort") ||
          text.includes("abandon") ||
          text.includes("give up") ||
          text.includes("surrender") ||
          text.includes("reset")
        ) {
          continue;
        }
        el.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
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

function filterUnsafeMissionSteps(steps: string[]): string[] {
  return steps.filter((step) => {
    if (typeof step !== "string") return false;
    if (!step.startsWith("click:#")) return true;
    const id = step.slice("click:#".length).toLowerCase();
    if (isRiskyNavigationId(id)) return false;
    return !id.includes("campaign");
  });
}

function areFilesIdentical(aPath: string, bPath: string): boolean {
  try {
    const a = fs.readFileSync(aPath);
    const b = fs.readFileSync(bPath);
    return a.length === b.length && a.equals(b);
  } catch {
    return false;
  }
}

function resolvePlaybookActionsInternal(
  commit: string,
  commitIndex: Map<string, number>,
  playbooks: PlaybookDoc | null,
  commitPlaybooks?: Map<string, CommitPlaybookActions>,
): Record<string, string[]> | null {
  const exact = commitPlaybooks?.get(commit);
  if (exact) return exact;
  if (!playbooks) return null;
  const idx = commitIndex.get(commit);
  if (idx === undefined) return null;
  for (const playbook of playbooks.playbooks) {
    const start = commitIndex.get(playbook.startCommit);
    const end = commitIndex.get(playbook.endCommit);
    if (start === undefined || end === undefined) continue;
    if (idx >= start && idx <= end) {
      const map: Record<string, string[]> = {};
      for (const action of playbook.actions) {
        const steps = (action.steps || []).filter((step) => typeof step === "string");
        map[action.target] = steps.length > 0 ? steps : ["noop"];
      }
      return map;
    }
  }
  return null;
}

export function parseCommitPlaybookJsonlContent(
  content: string,
): Map<string, CommitPlaybookActions> {
  const result = new Map<string, CommitPlaybookActions>();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as {
        commit?: string;
        actions?: Record<string, unknown>;
      };
      if (!row.commit || typeof row.commit !== "string") continue;
      if (!row.actions || typeof row.actions !== "object") continue;
      const actions: CommitPlaybookActions = {};
      for (const [key, value] of Object.entries(row.actions)) {
        if (Array.isArray(value) && value.every((step) => typeof step === "string")) {
          actions[key] = value;
        }
      }
      if (Object.keys(actions).length > 0) {
        result.set(row.commit, actions);
      }
    } catch {
      continue;
    }
  }
  return result;
}

export function resolvePlaybookActions(
  commit: string,
  commitIndex: Map<string, number>,
  playbooks: PlaybookDoc | null,
  commitPlaybooks?: Map<string, CommitPlaybookActions>,
): Record<string, string[]> | null {
  return resolvePlaybookActionsInternal(commit, commitIndex, playbooks, commitPlaybooks);
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
