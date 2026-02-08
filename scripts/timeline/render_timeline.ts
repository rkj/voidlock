import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export type TimelineFrame = {
  imagePath: string;
  date: string;
  subject: string;
  sha: string;
};

type FrameIndex = {
  keptFrames: Array<{
    date: string;
    sha: string;
    subject: string;
    compositePath: string;
    quadrants: [string, string, string, string];
  }>;
};

type RenderOptions = {
  fps: number;
  secondsPerFrame: number;
};

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

function escapeDrawtext(value: string): string {
  return value.replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export function buildTitleDrawtextFilter(title: string): string {
  const escaped = escapeDrawtext(title);
  return `drawtext=text='${escaped}':fontcolor=white:fontsize=28:x=(w-tw)/2:y=h-th-30:box=1:boxcolor=0x000000AA`;
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
  const titleFilter = `${buildTitleDrawtextFilter("Voidlock Development Timeline")},format=yuv420p`;
  writeConcatFile(frames, concatPath, opts.secondsPerFrame);
  return [
    "ffmpeg -y",
    "-f concat -safe 0",
    `-i ${shellQuote(concatPath)}`,
    `-vf ${shellQuote(titleFilter)}`,
    `-r ${opts.fps}`,
    `-pix_fmt yuv420p ${shellQuote(outputVideoPath)}`,
  ].join(" ");
}

function toRenderFrames(frameIndex: FrameIndex): TimelineFrame[] {
  return frameIndex.keptFrames.map((frame) => ({
    imagePath: frame.compositePath,
    date: frame.date,
    subject: frame.subject,
    sha: frame.sha,
  }));
}

async function runCli() {
  const argv = process.argv.slice(2);
  const frameIndexPath =
    readNamedArg(argv, ["--frame-index"]) || argv[0] || "timeline/frame_index.json";
  const outputVideoPath =
    readNamedArg(argv, ["--output"]) || argv[1] || "timeline/voidlock_timeline.mp4";

  const frameIndex = JSON.parse(fs.readFileSync(frameIndexPath, "utf-8")) as FrameIndex;
  const frames = toRenderFrames(frameIndex);
  if (frames.length === 0) {
    throw new Error("No frames in frame index. Run analyze_timeline_frames first.");
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
      `${buildTitleDrawtextFilter("Voidlock Development Timeline")},format=yuv420p`,
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
