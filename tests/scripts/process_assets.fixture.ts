import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";

type AssetFixture = {
  rootDir: string;
  sourceDir: string;
  outputDir: string;
  cleanup: () => void;
};

async function createAssetFixture(sourceFiles: string[]): Promise<AssetFixture> {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "voidlock-process-assets-"),
  );
  const sourceDir = path.join(rootDir, "NanoBanana Assets");
  const outputDir = path.join(rootDir, "public", "assets");

  fs.mkdirSync(sourceDir, { recursive: true });

  for (const fileName of sourceFiles) {
    await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 4,
        background: { r: 0, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toFile(path.join(sourceDir, fileName));
  }

  return {
    rootDir,
    sourceDir,
    outputDir,
    cleanup: () => {
      fs.rmSync(rootDir, { recursive: true, force: true });
    },
  };
}

export { createAssetFixture };
