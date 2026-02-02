// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { AppContext } from "@src/renderer/app/AppContext";
import { MissionType, SquadConfig } from "@src/shared/types";
import { MissionSetupManager } from "@src/renderer/app/MissionSetupManager";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";
import { ArchetypeLibrary } from "@src/shared/types/units";

describe("Regression voidlock-94kf: Custom Soldier Names", () => {
  let context: AppContext;
  let container: HTMLElement;
  let squad: SquadConfig;

  beforeEach(() => {
    document.body.innerHTML =
      '<div id="squad-builder"></div><button id="btn-goto-equipment"></button>';
    container = document.getElementById("squad-builder")!;

    squad = {
      soldiers: [],
      inventory: {},
    };

    context = {
      campaignManager: {
        getState: vi.fn().mockReturnValue({
          roster: [],
          scrap: 100,
          unlockedArchetypes: ["assault", "medic"],
        }),
      },
      themeManager: {
        setTheme: vi.fn(),
      },
      modalService: {
        alert: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
  });

  it("should generate a name and stats when adding an archetype to custom squad", () => {
    const builder = new SquadBuilder(
      "squad-builder",
      context,
      squad,
      MissionType.Default,
      false, // isCampaign = false
      () => {},
    );
    builder.render();

    const assaultCard = container.querySelector(
      ".roster-panel .soldier-card",
    ) as HTMLElement;
    
    // Simulate double click to add to squad
    assaultCard.dispatchEvent(new MouseEvent("dblclick"));

    expect(squad.soldiers.length).toBe(1);
    const soldier = squad.soldiers[0];
    expect(soldier.archetypeId).toBe("assault");
    
    // These are the assertions that should fail before implementation
    expect(soldier.name).toBeDefined();
    expect(typeof soldier.name).toBe("string");
    expect(soldier.hp).toBeDefined();
    expect(soldier.maxHp).toBeDefined();
    expect(soldier.hp).toBeGreaterThan(0);
    expect(soldier.soldierAim).toBeDefined();
    expect(soldier.rightHand).toBeDefined();
    expect(soldier.leftHand).toBeDefined();
  });

  it("should hydrate initial soldiers in MissionSetupManager", () => {
    // Mock ConfigManager.loadCustom to return a squad with no names
    vi.spyOn(ConfigManager, "loadCustom").mockReturnValue({
      squadConfig: {
        soldiers: [{ archetypeId: "assault" }, { archetypeId: "medic" }],
        inventory: {}
      }
    } as any);

    const manager = new MissionSetupManager(context);
    manager.loadAndApplyConfig(false); // isCampaign = false

    const squad = manager.currentSquad;
    expect(squad.soldiers.length).toBe(2);
    
    squad.soldiers.forEach((s: any) => {
      expect(s.name).toBeDefined();
      expect(typeof s.name).toBe("string");
      expect(s.hp).toBeDefined();
      expect(s.maxHp).toBeDefined();
    });
  });

  it("should not show redundant archetype name in SoldierWidget for named custom soldiers", () => {
    const arch = ArchetypeLibrary.assault;
    const customSoldier = {
      archetypeId: "assault",
      name: "Kyle Hicks",
      hp: 100,
      maxHp: 100,
      soldierAim: 90
    };

    const container = SoldierWidget.render(customSoldier, {
      context: "squad-builder"
    });

    const text = container.textContent || "";
    // Should contain the name
    expect(text).toContain("Kyle Hicks");
    // Should contain the archetype name
    expect(text).toContain("Assault");
    
    // Now check an archetype template (no custom name)
    const templateContainer = SoldierWidget.render(arch, {
      context: "squad-builder"
    });
    
    const templateText = templateContainer.textContent || "";
    // It should contain "Assault" (from getName)
    expect(templateText).toContain("Assault");
    
    // It should NOT contain "Assault" a second time in the subtitle area
    // In our implementation, we removed it from subTitle if it matches name.
    // The previous implementation would have "Assault" in displayName AND in the subtitle.
    
    // Let's count occurrences of "Assault"
    const count = (templateText.match(/Assault/g) || []).length;
    expect(count).toBe(1);
  });
});
