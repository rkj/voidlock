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

function toRenderFrames(frameIndex: FrameIndex): TimelineFrame[] {
  return frameIndex.keptFrames.map((frame) => ({
    imagePath: frame.compositePath,
    date: frame.date,
    subject: frame.subject,
    sha: frame.sha,
  }));
}

async function runCli() {
  const frameIndexPath = process.argv[2] || "timeline/frame_index.json";
  const outputVideoPath = process.argv[3] || "timeline/voidlock_timeline.mp4";

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
