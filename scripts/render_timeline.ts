import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

export type TimelineFrame = {
  imagePath: string;
  date: string;
  subject: string;
  sha: string;
};

type TimelineManifest = {
  milestones: Array<{
    milestoneDate: string;
    sourceCommit: string;
    actualCommitUsed?: string;
    subject: string;
  }>;
};

type RenderOptions = {
  fps: number;
  secondsPerFrame: number;
};

const SCREEN_ORDER = ["main_menu", "mission_setup", "equipment", "mission"];

export function buildFramePath(
  outputDir: string,
  entry: { datetime: string; screenName: string; sha: string; filePath: string },
): string {
  const stamp = entry.datetime.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const file = `${stamp}_${entry.screenName}_${entry.sha}.png`;
  return path.join(outputDir, file);
}

export function buildOverlayLabel(
  date: string,
  subject: string,
  sha: string,
): string {
  const raw = `${date} | ${sha} | ${subject}`;
  return raw.replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function writeConcatFile(
  frames: TimelineFrame[],
  concatFilePath: string,
  secondsPerFrame: number,
): void {
  fs.mkdirSync(path.dirname(concatFilePath), { recursive: true });
  const lines: string[] = [];
  for (const frame of frames) {
    lines.push(`file ${shellQuote(path.resolve(frame.imagePath))}`);
    lines.push(`duration ${secondsPerFrame.toFixed(3)}`);
  }
  if (frames.length > 0) {
    lines.push(`file ${shellQuote(path.resolve(frames[frames.length - 1].imagePath))}`);
  }
  fs.writeFileSync(concatFilePath, `${lines.join("\n")}\n`, "utf-8");
}

export function buildRenderCommand(
  frames: TimelineFrame[],
  outputVideoPath: string,
  opts: RenderOptions,
): string {
  const concatPath = "timeline/frames/frames.concat.txt";
  writeConcatFile(frames, concatPath, opts.secondsPerFrame);
  const title = "Voidlock Development Timeline".replace(/:/g, "\\:");
  return [
    "ffmpeg -y",
    "-f concat -safe 0",
    `-i ${shellQuote(concatPath)}`,
    `-vf "drawtext=text='${title}':fontcolor=white:fontsize=28:x=40:y=30:box=1:boxcolor=0x000000AA,format=yuv420p"`,
    `-r ${opts.fps}`,
    `-pix_fmt yuv420p ${shellQuote(outputVideoPath)}`,
  ].join(" ");
}

function scanScreenshots(screenshotDir: string): Map<string, Map<string, string>> {
  const byCommit = new Map<string, Map<string, string>>();
  if (!fs.existsSync(screenshotDir)) return byCommit;
  const files = fs.readdirSync(screenshotDir).filter((f) => f.endsWith(".png"));
  for (const file of files) {
    const stem = file.replace(/\.png$/, "");
    const match = stem.match(/^\d{8}T\d{6}Z_([a-z_]+)_([0-9a-f]{7,40})$/);
    if (!match) continue;
    const screenName = match[1];
    const sha = match[2];
    const map = byCommit.get(sha) || new Map<string, string>();
    map.set(screenName, path.join(screenshotDir, file));
    byCommit.set(sha, map);
  }
  return byCommit;
}

function svgOverlay(width: number, text: string): Buffer {
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg width="${width}" height="120" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111827" fill-opacity="0.85"/><text x="24" y="44" fill="#f9fafb" font-size="22" font-family="Arial, sans-serif">${safe}</text></svg>`;
  return Buffer.from(svg);
}

async function compositeGrid(
  imagePaths: string[],
  outPath: string,
  label: string,
): Promise<void> {
  const tileW = 960;
  const tileH = 540;
  const outW = tileW * 2;
  const outH = tileH * 2 + 120;

  const resizedBuffers = imagePaths.map((img) =>
    sharp(img).resize(tileW, tileH, { fit: "cover" }).png().toBuffer(),
  );
  const buffers = await Promise.all(resizedBuffers);
  await sharp({
    create: {
      width: outW,
      height: outH,
      channels: 4,
      background: { r: 10, g: 14, b: 20, alpha: 1 },
    },
  })
    .composite([
      { input: buffers[0], top: 120, left: 0 },
      { input: buffers[1], top: 120, left: tileW },
      { input: buffers[2], top: 120 + tileH, left: 0 },
      { input: buffers[3], top: 120 + tileH, left: tileW },
      { input: svgOverlay(outW, label), top: 0, left: 0 },
    ])
    .png()
    .toFile(outPath);
}

function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha1").update(content).digest("hex");
}

function hammingDistance(a: string, b: string): number {
  let distance = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) distance += 1;
  }
  return distance + Math.abs(a.length - b.length);
}

async function computePerceptualHash(imagePath: string): Promise<string> {
  const size = 16;
  const data = await sharp(imagePath)
    .resize(size, size, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();
  let sum = 0;
  for (const value of data) sum += value;
  const avg = sum / data.length;
  return Array.from(data, (value) => (value >= avg ? "1" : "0")).join("");
}

async function dedupeFrames(frames: TimelineFrame[]): Promise<TimelineFrame[]> {
  const seenExact = new Set<string>();
  const out: TimelineFrame[] = [];
  const perceptual: string[] = [];
  const nearThreshold = 12;
  for (const frame of frames) {
    const exact = hashFile(frame.imagePath);
    if (seenExact.has(exact)) continue;
    const phash = await computePerceptualHash(frame.imagePath);
    const near = perceptual.some((existing) => hammingDistance(existing, phash) <= nearThreshold);
    if (near) continue;
    seenExact.add(exact);
    perceptual.push(phash);
    out.push(frame);
  }
  if (out.length === 0 && frames.length > 0) return [frames[0]];
  return out;
}

async function buildFramesFromManifest(
  manifestPath: string,
  screenshotDir: string,
  framesDir: string,
): Promise<TimelineFrame[]> {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as TimelineManifest;
  fs.mkdirSync(framesDir, { recursive: true });

  const screenshotMap = scanScreenshots(screenshotDir);
  const built: TimelineFrame[] = [];

  for (const milestone of manifest.milestones) {
    const sha = (milestone.actualCommitUsed || milestone.sourceCommit).slice(0, 7);
    const screens = screenshotMap.get(sha);
    if (!screens) continue;
    const imagePaths = SCREEN_ORDER.map((name) => screens.get(name)).filter(Boolean) as string[];
    if (imagePaths.length !== SCREEN_ORDER.length) continue;

    const date = milestone.milestoneDate.slice(0, 10);
    const framePath = path.join(framesDir, `${date}_${sha}.png`);
    const label = `${date}   ${sha}   ${milestone.subject}`;
    await compositeGrid(imagePaths, framePath, label);
    built.push({
      imagePath: framePath,
      date,
      subject: milestone.subject,
      sha,
    });
  }

  return dedupeFrames(built);
}

async function runCli() {
  const manifestPath = process.argv[2] || "timeline/manifest.json";
  const screenshotDir = process.argv[3] || "screenshots";
  const outputVideoPath = process.argv[4] || "timeline/voidlock_timeline.mp4";
  const framesDir = "timeline/frames";

  const frames = await buildFramesFromManifest(manifestPath, screenshotDir, framesDir);
  if (frames.length === 0) {
    throw new Error("No renderable frames found. Run capture script first.");
  }

  buildRenderCommand(frames, outputVideoPath, {
    fps: 30,
    secondsPerFrame: 1.5,
  });
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "timeline/frames/frames.concat.txt",
      "-vf",
      "drawtext=text='Voidlock Development Timeline':fontcolor=white:fontsize=28:x=40:y=30:box=1:boxcolor=0x000000AA,format=yuv420p",
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      outputVideoPath,
    ],
    { stdio: "inherit" },
  );
  // eslint-disable-next-line no-console
  console.log(`Rendered ${frames.length} frames to ${outputVideoPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
