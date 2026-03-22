import { processAssets } from "../../scripts/process_assets";
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { createAssetFixture } from "./process_assets.fixture";

describe("Asset Processor", () => {
  it("should fail clearly and avoid writing output when mapped sources are missing", async () => {
    const fixture = await createAssetFixture([]);

    try {
      await expect(
        processAssets({
          outputDir: fixture.outputDir,
          sourceDir: fixture.sourceDir,
        }),
      ).rejects.toThrow(
        /No source assets were processed .*Expected at least one mapped source file\./,
      );

      expect(fs.existsSync(fixture.outputDir)).toBe(false);
      expect(
        fs.existsSync(path.join(fixture.outputDir, "assets.json")),
      ).toBe(false);
    } finally {
      fixture.cleanup();
    }
  }, 60000); // Higher timeout for image processing
});
