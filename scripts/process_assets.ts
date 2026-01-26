import fs from "fs";
import path from "path";

const DEFAULT_OUTPUT_DIR = "public/assets";
const SOURCE_DIR = "NanoBanana Assets";

const MAPPING: Record<string, string> = {
  "floor.png": "floor.webp",
  "wall.png": "wall.webp",
  "door_closed.png": "door_closed.webp",
  "door_open.png": "door_open.webp",
  "soldier_heavy.png": "soldier_heavy.webp",
  "soldier_demolition.png": "soldier_demolition.webp",
  "soldier_medic.png": "soldier_medic.webp",
  "soldier_scout.png": "soldier_scout.webp",
  "crate.png": "crate.webp",
  "reticle.png": "reticle.webp",
  "selection_ring.png": "selection_ring.webp",
  "spawn_point.png": "spawn_point.webp",
  "spawn_point_2.png": "spawn_point_2.webp",
  "terminal.png": "terminal.webp",
  "void.png": "void.webp",
  "waypoint.png": "waypoint.webp",
  "xeno_drone_2.png": "xeno_drone_2.webp",
  "xeno_guard_3.png": "xeno_guard_3.webp",
  "xeno_spitter.png": "xeno_spitter.webp",
  "xeno_swarmer_1.png": "xeno_swarmer_1.webp",
  "credits.png": "loot_credits.webp",
  "data.png": "data_disk.webp",
};

async function processAssets(outputDir: string = DEFAULT_OUTPUT_DIR) {
  const manifestFile = path.join(outputDir, "assets.json");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const manifest: Record<string, string> = {};

  let sharp: any = null;
  try {
    // @ts-ignore - sharp might not be installed in all environments
    const sharpModule = await import("sharp");
    sharp = sharpModule.default;
  } catch (e) {
    throw new Error(
      "Sharp is required for asset processing. Please install it with `npm install sharp`.",
    );
  }

  for (const [sourceFile, targetFile] of Object.entries(MAPPING)) {
    const sourcePath = path.join(SOURCE_DIR, sourceFile);
    const targetPath = path.join(outputDir, targetFile);

    if (fs.existsSync(sourcePath)) {
      console.log(`Processing ${sourceFile} -> ${targetFile}...`);

      await sharp(sourcePath)
        .trim() // Trim transparency/Crop to content
        .resize(128, 128, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 90 })
        .toFile(targetPath);

      const logicalName = targetFile.replace(".webp", "");
      manifest[logicalName] = `assets/${targetFile}`;
    } else {
      console.warn(`Source file not found: ${sourcePath}`);
    }
  }

  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  console.log(`Manifest generated: ${manifestFile}`);
}

// Check if we are running as a script
const isMain =
  import.meta.url.endsWith(process.argv[1]) ||
  process.argv[1]?.includes("process_assets");

if (isMain) {
  processAssets().catch((err) => {
    console.error("Fatal error in asset pipeline:", err);
    process.exit(1);
  });
}

export { processAssets };
