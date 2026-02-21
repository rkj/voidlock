/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { SoldierInspector } from "@src/renderer/ui/SoldierInspector";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { ModalService } from "@src/renderer/ui/ModalService";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { ArchetypeLibrary, WeaponLibrary } from "@src/shared/types";

describe("SoldierInspector - Fire Rate Calculation Regression", () => {
  it("should calculate fire rate using SPEED_NORMALIZATION_CONST (30), not 10", () => {
    const storage = new MockStorageProvider();
    const manager = CampaignManager.getInstance(storage);
    const modalService = new ModalService();
    
    const inspector = new SoldierInspector({
      manager,
      modalService,
      onUpdate: () => {},
    });

    const assault = ArchetypeLibrary["assault"]; // Speed 20, Pulse Rifle (600ms)
    const pulseRifle = WeaponLibrary["pulse_rifle"];
    
    // Engine calculation: 600 * (30 / 20) = 900ms. 1000 / 900 = 1.11...
    // Current (buggy) UI calculation: 600 * (10 / 20) = 300ms. 1000 / 300 = 3.33...
    
    // We can't easily test the private method, but we can check the rendered output or use a public method if available.
    // getWeaponStats is private, but we can access it for testing purposes if we cast to any.
    const stats = (inspector as any).getWeaponStats("pulse_rifle", 20);
    
    // Correct value should be "1.1"
    expect(stats.fireRate).toBe("1.1");
  });
});
