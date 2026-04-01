// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { t, I18nKeys } from "@src/renderer/i18n";
import { useStandardLocale } from "../i18n/test_helpers";

// Mock dependencies
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(null),
    saveCampaign: vi.fn(),
    clearCampaign: vi.fn(),
    getDefault: vi.fn().mockReturnValue({
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        squadConfig: { soldiers: [] },
    }),
  },
}));

describe("EquipmentScreen", () => {
  let container: HTMLElement;
  let screen: EquipmentScreen;
  let mockManager: any;
  let mockInputDispatcher: any;
  let mockModalService: any;
  let themeManager: ThemeManager;

  beforeEach(() => {
    useStandardLocale();
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };

    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    const mockCampaignState = {
      scrap: 1000,
      rules: { economyMode: "Open", deathRule: "Reinforced" },
      unlockedArchetypes: ["assault", "medic", "heavy", "scout"],
      unlockedItems: [],
      nodes: [],
      roster: [
        {
          id: "s1",
          name: "Sgt. Alpha",
          archetypeId: "assault",
          status: "Healthy",
          equipment: { rightHand: "pulse_rifle" },
          level: 1,
          xp: 0,
          maxHp: 100,
          soldierAim: 90,
        },
        {
          id: "s2",
          name: "Cpl. Bravo",
          archetypeId: "medic",
          status: "Healthy",
          equipment: {},
          level: 1,
          xp: 0,
          maxHp: 100,
          soldierAim: 90,
        },
      ],
    };

    
    mockManager = new CampaignManager(
      {
        load: vi.fn().mockReturnValue(mockCampaignState),
        save: vi.fn(),
        delete: vi.fn(),
      } as any,
      new MetaManager(new MockStorageProvider())
    );
    
    // Force set state since constructor load() might not be enough for some test expectations
    (mockManager as any).state = mockCampaignState;
    vi.spyOn(mockManager, "spendScrap").mockImplementation(() => {});

    themeManager = new ThemeManager();
    vi.spyOn(themeManager, "init").mockResolvedValue(undefined);
    vi.spyOn(themeManager, "getAssetUrl").mockReturnValue("mock-url");

    screen = new EquipmentScreen({
      containerId: "screen-equipment",
      campaignManager: mockManager,
      inputDispatcher: mockInputDispatcher,
      modalService: mockModalService,
      currentSquad: {
        soldiers: [
          { id: "s1", archetypeId: "assault", name: "Sgt. Alpha", rightHand: "pulse_rifle" },
        ],
        inventory: {},
      },
      onBack: vi.fn(),
      isCampaign: true,
    });
  });

  it("should render soldier list on show", () => {
    screen.show();
    const soldierList = container.querySelector(".soldier-list-panel");
    expect(soldierList).not.toBeNull();
    expect(soldierList?.textContent).toContain("Sgt. Alpha");
  });

  it("should allow selecting a soldier", () => {
    screen.show();
    const slots = container.querySelectorAll(".soldier-item");
    expect(slots.length).toBeGreaterThan(0);

    const firstSlot = slots[0] as HTMLElement;
    firstSlot.click();

    expect(firstSlot.classList.contains("selected")).toBe(true);
  });

  it("should pre-populate equipment from archetype defaults", () => {
    screen.show();
    // Sgt Alpha has pulse_rifle in RH.
    const soldierListTexts = Array.from(
      container.querySelectorAll(
        ".soldier-list-panel .roster-item-details span",
      ),
    ).map((el) => el.textContent?.trim());
    
    expect(soldierListTexts.some((text) => text?.includes(t(I18nKeys.units.item.pulse_rifle)))).toBe(true);
  });

  it("should allow adding global items", async () => {
    screen.show();
    
    // Use t() to find localized names
    const grenadeName = t(I18nKeys.units.item.frag_grenade);
    const medkitName = t(I18nKeys.units.item.medkit);

    const itemRows = Array.from(
      container.querySelectorAll(".armory-panel .card"),
    );
    const grenadeRow = itemRows.find((el) => el.textContent?.includes(grenadeName)) as HTMLElement;
    const medkitRow = itemRows.find((el) => el.textContent?.includes(medkitName)) as HTMLElement;

    expect(grenadeRow).toBeDefined();
    expect(medkitRow).toBeDefined();

    const grenadePlus = Array.from(
      grenadeRow.querySelectorAll("button"),
    ).find((btn) => btn.textContent === "+");
    const medkitPlus = Array.from(medkitRow.querySelectorAll("button")).find(
      (btn) => btn.textContent === "+",
    );

    grenadePlus?.click();
    medkitPlus?.click();

    expect(mockManager.spendScrap).toHaveBeenCalledWith(15); // frag_grenade cost
    expect(mockManager.spendScrap).toHaveBeenCalledWith(10); // medkit cost
  });
});
