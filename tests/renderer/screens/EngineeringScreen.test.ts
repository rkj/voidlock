/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngineeringScreen } from "@src/renderer/screens/EngineeringScreen";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Mock ConfigManager
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      phosphor: "green",
      logLevel: "INFO",
      debugSnapshots: false,
      debugSnapshotInterval: 0,
      debugOverlayEnabled: false,
      cloudSyncEnabled: false,
      locale: "en-corporate",
    }),
    saveGlobal: vi.fn(),
  },
}));

describe("EngineeringScreen", () => {
  let container: HTMLElement;
  let onUpdate: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-engineering"></div>';
    container = document.getElementById("screen-engineering")!;
    onUpdate = vi.fn();

    
    // Initialize MetaManager with a mock storage
    const metaManager = new MetaManager(
      new (class {
        save() {}
        load() {
          return null;
        }
        remove() {}
        clear() {}
      })(),
    );
  });

  it("should render correctly with default intel and unlockables", () => {
    const metaManager = new MetaManager(new (class {
        save() {}
        load() {
          return null;
        }
        remove() {}
        clear() {}
      })());
    const screen = new EngineeringScreen({
      containerId: "screen-engineering",
      metaManager: metaManager,
      inputDispatcher: { pushContext: vi.fn(), popContext: vi.fn() } as any,
      onUpdate,
    });
    screen.show();

    expect(container.textContent).toContain(t(I18nKeys.screen.engineering.title));
    expect(container.textContent).toContain(t(I18nKeys.screen.engineering.persistent_intel));
    expect(container.textContent).toContain("0"); // Default intel

    expect(container.textContent).toContain(t(I18nKeys.screen.engineering.unit_archetypes));
    expect(container.textContent).toContain(t(I18nKeys.screen.engineering.advanced_equipment));

    // Check localized archetype name
    expect(container.textContent).toContain(t(I18nKeys.units.archetype.heavy));
    // Check localized archetype description
    expect(container.textContent).toContain(t(I18nKeys.units.archetype.desc.heavy));
    
    // Check unlock buttons are disabled
    const unlockBtns = Array.from(container.querySelectorAll("button")).filter(b => b.textContent?.includes(t(I18nKeys.screen.engineering.unlock)));
    expect(unlockBtns.length).toBeGreaterThan(0);
    unlockBtns.forEach(btn => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("should allow unlocking an archetype when intel is sufficient", () => {
    const mockStorage = new (class {
        data: any = { 
            totalKills: 0, 
            totalCasualties: 0, 
            totalMissionsPlayed: 0, 
            totalMissionsWon: 0, 
            totalScrapEarned: 0, 
            currentIntel: 0, 
            unlockedArchetypes: [], 
            unlockedItems: [],
            totalCampaignsStarted: 0,
            campaignsWon: 0,
            campaignsLost: 0,
            prologueCompleted: false
        };
        save(key: string, val: any) { this.data = val; }
        load() { return this.data; }
        remove() {}
        clear() {}
      })();
    const meta = new MetaManager(mockStorage);
    // Give enough intel for heavy archetype (cost 50)
    meta.recordMissionResult({
      kills: 0,
      casualties: 0,
      won: true,
      scrapGained: 0,
      intelGained: 100,
    });

    const screen = new EngineeringScreen({
      containerId: "screen-engineering",
      metaManager: meta,
      inputDispatcher: { pushContext: vi.fn(), popContext: vi.fn() } as any,
      onUpdate,
    });
    screen.show();

    const heavyCard = Array.from(container.querySelectorAll(".unlock-card")).find(c => c.textContent?.includes(t(I18nKeys.units.archetype.heavy)));
    expect(heavyCard).toBeDefined();
    
    const unlockBtn = heavyCard?.querySelector("button") as HTMLButtonElement;
    expect(unlockBtn).toBeDefined();
    expect(unlockBtn.disabled).toBe(false);

    // Click unlock
    unlockBtn.click();

    expect(meta.isArchetypeUnlocked("heavy")).toBe(true);
    expect(meta.getStats().currentIntel).toBe(50);
    expect(onUpdate).toHaveBeenCalled();
    
    // UI should update - re-query the container
    const updatedCard = Array.from(container.querySelectorAll(".unlock-card")).find(c => c.textContent?.includes(t(I18nKeys.units.archetype.heavy)));
    expect(updatedCard?.textContent).toContain(t(I18nKeys.screen.engineering.unlocked));
  });
});
