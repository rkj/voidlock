import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

type TimelineManifest = {
  milestones: Array<{
    milestoneDate: string;
    sourceCommit: string;
    actualCommitUsed?: string;
    subject: string;
    captureStatus?: "ok" | "skipped";
  }>;
};

type FrameIndex = {
  generatedAt: string;
  sourceScreenshotDir: string;
  keptFrames: Array<{
    date: string;
    sha: string;
    subject: string;
    compositePath: string;
    quadrants: [string, string, string, string];
  }>;
  droppedFrames: number;
};

const TILE_W = 960;
const TILE_H = 540;
const OUT_W = TILE_W * 2;
const OUT_H = TILE_H * 2 + 120;

function screenAliasList(quadrant: 1 | 2 | 3 | 4): string[] {
  if (quadrant === 1) return ["mission"];
  if (quadrant === 2) return ["main_menu"];
  if (quadrant === 3) return ["config", "mission_setup", "equipment"];
  return ["campaign"];
}

function parseScreenshotFile(fileName: string): { stamp: string; screen: string; sha: string } | null {
  const stem = fileName.replace(/\.png$/, "");
  const match = stem.match(/^(\d{8}T\d{6}Z)_([a-z_]+)_([0-9a-f]{7,40})$/);
  if (!match) return null;
  return {
    stamp: match[1],
    screen: match[2],
    sha: match[3],
  };
}

function buildScreenshotMap(
  screenshotDir: string,
): Map<string, Map<string, Map<string, string>>> {
  const bySha = new Map<string, Map<string, Map<string, string>>>();
  if (!fs.existsSync(screenshotDir)) return bySha;
  const files = fs.readdirSync(screenshotDir).filter((f) => f.endsWith(".png"));
  for (const file of files) {
    const parsed = parseScreenshotFile(file);
    if (!parsed) continue;
    const byScreen = bySha.get(parsed.sha) || new Map<string, Map<string, string>>();
    const byStamp = byScreen.get(parsed.screen) || new Map<string, string>();
    byStamp.set(parsed.stamp, path.join(screenshotDir, file));
    byScreen.set(parsed.screen, byStamp);
    bySha.set(parsed.sha, byScreen);
  }
  return bySha;
}

function toStamp(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function findQuadrantImage(
  map: Map<string, Map<string, Map<string, string>>>,
  sha: string,
  stamp: string,
  quadrant: 1 | 2 | 3 | 4,
): string | null {
  const byScreen = map.get(sha);
  if (!byScreen) return null;
  for (const alias of screenAliasList(quadrant)) {
    const byStamp = byScreen.get(alias);
    if (!byStamp) continue;
    const exact = byStamp.get(stamp);
    if (exact) return exact;
    // fallback: any stamp for this screen+sha
    const first = byStamp.values().next();
    if (!first.done) return first.value;
  }
  return null;
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

function svgOverlay(width: number, text: string): Buffer {
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg width="${width}" height="120" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111827" fill-opacity="0.85"/><text x="24" y="44" fill="#f9fafb" font-size="22" font-family="Arial, sans-serif">${safe}</text></svg>`;
  return Buffer.from(svg);
}

async function writeQuadrantImage(
  sourcePath: string | null,
  outPath: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  if (!sourcePath) {
    await sharp({
      create: {
        width: TILE_W,
        height: TILE_H,
        channels: 4,
        background: { r: 20, g: 22, b: 28, alpha: 1 },
      },
    })
      .png()
      .toFile(outPath);
    return;
  }
  await sharp(sourcePath).resize(TILE_W, TILE_H, { fit: "cover" }).png().toFile(outPath);
}

async function writeComposite(
  quadrants: [string, string, string, string],
  outPath: string,
  label: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp({
    create: {
      width: OUT_W,
      height: OUT_H,
      channels: 4,
      background: { r: 10, g: 14, b: 20, alpha: 1 },
    },
  })
    .composite([
      { input: quadrants[0], top: 120, left: 0 },
      { input: quadrants[1], top: 120, left: TILE_W },
      { input: quadrants[2], top: 120 + TILE_H, left: 0 },
      { input: quadrants[3], top: 120 + TILE_H, left: TILE_W },
      { input: svgOverlay(OUT_W, label), top: 0, left: 0 },
    ])
    .png()
    .toFile(outPath);
}

async function runCli() {
  const manifestPath = process.argv[2] || "timeline/manifest.json";
  const screenshotDir = process.argv[3] || "screenshots";
  const outIndexPath = process.argv[4] || "timeline/frame_index.json";

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as TimelineManifest;
  const screenshotMap = buildScreenshotMap(screenshotDir);
  const quadrantsDir = path.resolve("timeline/frames/quadrants");
  const compositeDir = path.resolve("timeline/frames/composite");

  const keptFrames: FrameIndex["keptFrames"] = [];
  const seenExact = new Set<string>();
  const seenPerceptual: string[] = [];
  let droppedFrames = 0;
  const nearThreshold = 12;

  for (const milestone of manifest.milestones) {
    if (milestone.captureStatus === "skipped") continue;
    const sha = (milestone.actualCommitUsed || milestone.sourceCommit).slice(0, 7);
    const date = milestone.milestoneDate.slice(0, 10);
    const stamp = toStamp(milestone.milestoneDate);

    const q1Source = findQuadrantImage(screenshotMap, sha, stamp, 1);
    const q2Source = findQuadrantImage(screenshotMap, sha, stamp, 2);
    const q3Source = findQuadrantImage(screenshotMap, sha, stamp, 3);
    const q4Source = findQuadrantImage(screenshotMap, sha, stamp, 4);
    if (!q1Source || !q2Source || !q3Source) continue;

    const q1Path = path.join(quadrantsDir, `${stamp}_${sha}_1.png`);
    const q2Path = path.join(quadrantsDir, `${stamp}_${sha}_2.png`);
    const q3Path = path.join(quadrantsDir, `${stamp}_${sha}_3.png`);
    const q4Path = path.join(quadrantsDir, `${stamp}_${sha}_4.png`);
    await writeQuadrantImage(q1Source, q1Path);
    await writeQuadrantImage(q2Source, q2Path);
    await writeQuadrantImage(q3Source, q3Path);
    await writeQuadrantImage(q4Source, q4Path);

    const compositePath = path.join(compositeDir, `${stamp}_${sha}.png`);
    const label = `${date}   ${sha}   ${milestone.subject}`;
    await writeComposite([q1Path, q2Path, q3Path, q4Path], compositePath, label);

    const exact = hashFile(compositePath);
    if (seenExact.has(exact)) {
      droppedFrames += 1;
      continue;
    }
    const phash = await computePerceptualHash(compositePath);
    const near = seenPerceptual.some((existing) => hammingDistance(existing, phash) <= nearThreshold);
    if (near) {
      droppedFrames += 1;
      continue;
    }

    seenExact.add(exact);
    seenPerceptual.push(phash);
    keptFrames.push({
      date,
      sha,
      subject: milestone.subject,
      compositePath,
      quadrants: [q1Path, q2Path, q3Path, q4Path],
    });
  }

  const payload: FrameIndex = {
    generatedAt: new Date().toISOString(),
    sourceScreenshotDir: path.resolve(screenshotDir),
    keptFrames,
    droppedFrames,
  };
  fs.mkdirSync(path.dirname(outIndexPath), { recursive: true });
  fs.writeFileSync(outIndexPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote frame index with ${keptFrames.length} kept frames to ${outIndexPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
