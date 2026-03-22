import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { processAssets } from "../../scripts/process_assets";
import { createAssetFixture } from "./process_assets.fixture";

describe("Asset Pipeline", () => {
  it("should process fixture assets and generate manifest", async () => {
    const fixture = await createAssetFixture(["floor.png", "soldier_heavy.png"]);

    try {
      await processAssets({
        outputDir: fixture.outputDir,
        sourceDir: fixture.sourceDir,
      });

      const manifestPath = path.join(fixture.outputDir, "assets.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      expect(manifest.floor).toBe("assets/floor.webp");
      expect(
        fs.existsSync(path.join(fixture.outputDir, "floor.webp")),
      ).toBe(true);

      expect(manifest.soldier_heavy).toBe("assets/soldier_heavy.webp");
      expect(
        fs.existsSync(path.join(fixture.outputDir, "soldier_heavy.webp")),
      ).toBe(true);

      expect(Object.keys(manifest)).toHaveLength(2);
    } finally {
      fixture.cleanup();
    }
  }, 30000);
});
