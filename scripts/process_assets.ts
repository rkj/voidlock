import fs from 'fs';
import path from 'path';

const DEFAULT_OUTPUT_DIR = 'public/assets';
const SOURCE_DIR = 'NanoBanana Assets';

const MAPPING: Record<string, string> = {
  'Floor Tile.png': 'floor.png',
  'Wall Divider.png': 'wall.png',
  'Door Closed.png': 'door_closed.png',
  'Door open.png': 'door_open.png',
  'Soldier Heavy.png': 'soldier_heavy.png',
  'Soldier Demolition.png': 'soldier_demolition.png',
  'Soldier Medic.png': 'soldier_medic.png',
  'Soldier Scout.png': 'soldier_scout.png',
  'Crate.png': 'crate.png',
  'Reticle.png': 'reticle.png',
  'Selection Ring.png': 'selection_ring.png',
  'Spawn Point.png': 'spawn_point.png',
  'Spawn Point 2.png': 'spawn_point_2.png',
  'Terminal.png': 'terminal.png',
  'Void.png': 'void.png',
  'Waypoint.png': 'waypoint.png',
  'Xeno Drone 2.png': 'xeno_drone_2.png',
  'Xeno Guard 3.png': 'xeno_guard_3.png',
  'Xeno Spitter.png': 'xeno_spitter.png',
  'Xeno Swarmer 1.png': 'xeno_swarmer_1.png',
};

async function processAssets(outputDir: string = DEFAULT_OUTPUT_DIR) {
  const manifestFile = path.join(outputDir, 'assets.json');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const manifest: Record<string, string> = {};
  
  let sharp: any;
  try {
    // Try to import sharp dynamically
    const sharpModule = await import('sharp' as string);
    sharp = sharpModule.default;
  } catch (error) {
    console.warn('Sharp library not found. Falling back to simple file copy (no resize/crop).');
  }

  for (const [sourceFile, targetFile] of Object.entries(MAPPING)) {
    const sourcePath = path.join(SOURCE_DIR, sourceFile);
    const targetPath = path.join(outputDir, targetFile);

    if (fs.existsSync(sourcePath)) {
      console.log(`Processing ${sourceFile} -> ${targetFile}...`);
      
      try {
        if (sharp) {
          await sharp(sourcePath)
            .resize(128, 128, {
              fit: 'cover',
              position: 'center'
            })
            .toFile(targetPath);
        } else {
          // Fallback: just copy the file
          fs.copyFileSync(sourcePath, targetPath);
        }

        const logicalName = targetFile.replace('.png', '');
        manifest[logicalName] = `assets/${targetFile}`;
      } catch (error) {
        console.error(`Error processing ${sourceFile}:`, error);
      }
    } else {
      console.warn(`Source file not found: ${sourcePath}`);
    }
  }

  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  console.log(`Manifest generated: ${manifestFile}`);
}

// Check if we are running as a script
if (import.meta.url.startsWith('file:')) {
    const modulePath = path.resolve(process.argv[1]);
    const currentPath = path.resolve(new URL(import.meta.url).pathname);
    if (modulePath === currentPath || process.argv[1]?.includes('process_assets')) {
        processAssets().catch(err => {
            console.error('Fatal error in asset pipeline:', err);
            process.exit(1);
        });
    }
}

export { processAssets };