import fs from "fs";
import path from "path";

const DEFAULT_OUTPUT_DIR = "public/assets";
const SOURCE_DIR = "NanoBanana Assets";

const MAPPING: Record<string, string> = {
  "Floor Tile.png": "floor.webp",
  "Wall Divider.png": "wall.webp",
  "Door Closed.png": "door_closed.webp",
  "Door open.png": "door_open.webp",
  "Soldier Heavy.png": "soldier_heavy.webp",
  "Soldier Demolition.png": "soldier_demolition.webp",
  "Soldier Medic.png": "soldier_medic.webp",
  "Soldier Scout.png": "soldier_scout.webp",
  "Crate.png": "crate.webp",
  "Reticle.png": "reticle.webp",
  "Selection Ring.png": "selection_ring.webp",
  "Spawn Point.png": "spawn_point.webp",
  "Spawn Point 2.png": "spawn_point_2.webp",
  "Terminal.png": "terminal.webp",
  "Void.png": "void.webp",
  "Waypoint.png": "waypoint.webp",
  "Xeno Drone 2.png": "xeno_drone_2.webp",
  "Xeno Guard 3.png": "xeno_guard_3.webp",
  "Xeno Spitter.png": "xeno_spitter.webp",
  "Xeno Swarmer 1.png": "xeno_swarmer_1.webp",
};

async function processAssets(outputDir: string = DEFAULT_OUTPUT_DIR) {
  const manifestFile = path.join(outputDir, "assets.json");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const manifest: Record<string, string> = {};

  // Try to load sharp, but fall back gracefully if missing
  let sharp: any = null;
  try {
    // @ts-ignore - sharp might not be installed in all environments
    const sharpModule = await import("sharp");
    sharp = sharpModule.default;
  } catch (e) {
    console.warn(
      "Sharp not found. Falling back to simple file copy and maintaining PNG format.",
    );
  }

  for (const [sourceFile, targetFile] of Object.entries(MAPPING)) {
    const sourcePath = path.join(SOURCE_DIR, sourceFile);
    let finalTargetFile = targetFile;

    if (!sharp) {
      finalTargetFile = targetFile.replace(".webp", ".png");
    }

    const targetPath = path.join(outputDir, finalTargetFile);

    if (fs.existsSync(sourcePath)) {
      console.log(`Processing ${sourceFile} -> ${finalTargetFile}...`);

      try {
        if (sharp) {
          await sharp(sourcePath)
            .trim() // Trim transparency/Crop to content
            .resize(128, 128, {
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .webp({ quality: 90 })
            .toFile(targetPath);
        } else {
          fs.copyFileSync(sourcePath, targetPath);
        }

        const logicalName = targetFile.replace(".webp", "");
        manifest[logicalName] = `assets/${finalTargetFile}`;
      } catch (error) {
        console.error(`Error processing ${sourceFile}:`, error);
        if (sharp) throw error; // Only fail if sharp was supposed to work
      }
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
