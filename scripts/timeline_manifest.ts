import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export type TimelineCommit = {
  sha: string;
  date: string;
  subject: string;
  files: string[];
};

export type ManifestMilestone = {
  milestoneDate: string;
  sourceCommit: string;
  subject: string;
  screenBucket: string;
};

const VISUAL_PATH_PATTERNS = [
  "src/index.html",
  "src/renderer/",
  "src/styles/",
  "public/styles/",
  "public/assets/",
  "src/content/",
];

const LOW_SIGNAL_WORDS = [
  "fix",
  "typo",
  "lint",
  "test",
  "refactor",
  "cleanup",
  "chore",
];

const HIGH_SIGNAL_WORDS = [
  "screen",
  "menu",
  "equipment",
  "mission",
  "campaign",
  "layout",
  "hud",
  "ui",
  "theme",
  "render",
  "first",
  "initial",
];

export function filterVisualCommits(commits: TimelineCommit[]): TimelineCommit[] {
  return commits.filter((commit) =>
    commit.files.some((file) =>
      VISUAL_PATH_PATTERNS.some((prefix) => file.startsWith(prefix)),
    ),
  );
}

function parseTimestamp(date: string): number {
  const ts = Date.parse(date);
  return Number.isNaN(ts) ? 0 : ts;
}

function toScreenBucket(commit: TimelineCommit): string {
  const haystack = `${commit.subject.toLowerCase()} ${commit.files.join(" ").toLowerCase()}`;
  if (haystack.includes("equipment")) return "equipment";
  if (haystack.includes("mission-setup") || haystack.includes("setup"))
    return "mission_setup";
  if (haystack.includes("mission") || haystack.includes("hud")) return "mission";
  if (haystack.includes("campaign")) return "campaign";
  if (haystack.includes("menu")) return "main_menu";
  if (haystack.includes("setting")) return "settings";
  return "general";
}

function scoreCommit(commit: TimelineCommit): number {
  const subject = commit.subject.toLowerCase();
  let score = 0;
  for (const token of HIGH_SIGNAL_WORDS) {
    if (subject.includes(token)) score += 2;
  }
  for (const token of LOW_SIGNAL_WORDS) {
    if (subject.includes(token)) score -= 2;
  }
  return score;
}

function dayKey(date: string): string {
  const ts = parseTimestamp(date);
  if (!ts) return "unknown";
  return new Date(ts).toISOString().slice(0, 10);
}

function isLowSignal(subject: string): boolean {
  const lower = subject.toLowerCase();
  return LOW_SIGNAL_WORDS.some((token) => lower.includes(token));
}

function sampleEvenly<T>(items: T[], maxCount: number): T[] {
  if (items.length <= maxCount) return items;
  if (maxCount <= 1) return [items[0]];
  const out: T[] = [];
  const used = new Set<number>();
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.round((i * (items.length - 1)) / (maxCount - 1));
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(items[idx]);
  }
  if (out[0] !== items[0]) out.unshift(items[0]);
  if (out[out.length - 1] !== items[items.length - 1]) out.push(items[items.length - 1]);
  return out.slice(0, maxCount);
}

export function selectMilestoneCommits(
  commits: TimelineCommit[],
  opts?: {
    minHoursBetween?: number;
    maxCount?: number;
  },
): TimelineCommit[] {
  const minHours = opts?.minHoursBetween ?? 24;
  const maxCount = opts?.maxCount ?? 200;
  const sorted = [...commits].sort(
    (a, b) => parseTimestamp(a.date) - parseTimestamp(b.date),
  );

  const selected: TimelineCommit[] = [];
  let lastTs = 0;
  let lastBucket = "";
  let lastDay = "";
  let currentDay = "";

  for (const commit of sorted) {
    const ts = parseTimestamp(commit.date);
    const bucket = toScreenBucket(commit);
    const score = scoreCommit(commit);
    const day = dayKey(commit.date);

    if (day !== currentDay) {
      currentDay = day;
    }

    if (selected.length === 0) {
      selected.push(commit);
      lastTs = ts;
      lastBucket = bucket;
      lastDay = day;
      continue;
    }

    const elapsedHours = (ts - lastTs) / (1000 * 60 * 60);
    const sameBucket = bucket === lastBucket && bucket !== "general";
    const sameDay = day === lastDay;
    const lowSignal = isLowSignal(commit.subject);
    const keepForDistance = elapsedHours >= minHours && !lowSignal;
    const keepForBucketShift = bucket !== lastBucket && bucket !== "general";
    const keepForSignal = score >= 2;
    const keepByDefault = !sameBucket && !sameDay;

    if (keepForDistance || keepForBucketShift || keepForSignal || keepByDefault) {
      selected.push(commit);
      lastTs = ts;
      lastBucket = bucket;
      lastDay = day;
    }
  }

  return selected.length > maxCount ? sampleEvenly(selected, maxCount) : selected;
}

export function getGitCommits(limit = 2500): TimelineCommit[] {
  const raw = execFileSync(
    "git",
    [
      "log",
      "--date=iso-strict",
      "--name-only",
      "--pretty=format:__COMMIT__%n%H%n%cI%n%s",
      "-n",
      String(limit),
    ],
    { encoding: "utf-8" },
  );

  const blocks = raw.split("__COMMIT__").map((b) => b.trim()).filter(Boolean);
  const commits: TimelineCommit[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const [sha, date, subject, ...files] = lines;
    commits.push({ sha, date, subject, files });
  }

  return commits.reverse();
}

export function buildManifest(
  commits: TimelineCommit[],
  opts?: {
    minHoursBetween?: number;
    maxCount?: number;
  },
): ManifestMilestone[] {
  const visual = filterVisualCommits(commits);
  const selected = selectMilestoneCommits(visual, opts);
  return selected.map((commit) => ({
    milestoneDate: new Date(parseTimestamp(commit.date)).toISOString(),
    sourceCommit: commit.sha,
    subject: commit.subject,
    screenBucket: toScreenBucket(commit),
  }));
}

function runCli() {
  const outPath = process.argv[2] || "timeline/manifest.json";
  const mode = (process.argv[3] || "all").toLowerCase();
  const maxCount = Number(process.argv[4] || 0);
  const minHours = Number(process.argv[5] || 8);
  const commits = getGitCommits();
  const effectiveMax = maxCount > 0 ? maxCount : commits.length;
  const selectedCommits =
    mode === "visual"
      ? selectMilestoneCommits(filterVisualCommits(commits), {
          minHoursBetween: minHours,
          maxCount: effectiveMax,
        })
      : commits.slice(0, effectiveMax);
  const milestones = selectedCommits.map((commit) => ({
    milestoneDate: new Date(parseTimestamp(commit.date)).toISOString(),
    sourceCommit: commit.sha,
    subject: commit.subject,
    screenBucket: toScreenBucket(commit),
  }));
  const payload = {
    generatedAt: new Date().toISOString(),
    mode,
    minHoursBetween: minHours,
    maxCount: maxCount > 0 ? maxCount : 0,
    totalGitCommits: commits.length,
    milestones,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${milestones.length} milestones to ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
