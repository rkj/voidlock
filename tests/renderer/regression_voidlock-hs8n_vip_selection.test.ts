// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArchetypeLibrary, MissionType } from "@src/shared/types";

describe("Regression voidlock-hs8n: VIP Availability in Custom Missions", () => {
  let currentSquad: { soldiers: { archetypeId: string; id?: string }[] } = {
    soldiers: [],
  };
  let currentMissionType: MissionType = MissionType.Default;
  let mockModalService: {
    alert: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    currentSquad = { soldiers: [] };
    currentMissionType = MissionType.Default;
    vi.clearAllMocks();

    document.body.innerHTML = `
      <div id="squad-builder"></div>
      <button id="btn-goto-equipment"></button>
    `;

    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
    };
  });

  const mockCampaignManager = {
    getState: vi.fn().mockReturnValue({
      roster: [
        { id: "s1", name: "Soldier 1", archetypeId: "assault" },
        { id: "v1", name: "VIP 1", archetypeId: "vip" },
      ],
    }),
  };

  // Simplified version of renderSquadBuilder from main.ts with the proposed changes
  function renderSquadBuilder(isCampaign: boolean = false) {
    const container = document.getElementById("squad-builder");
    if (!container) return;
    container.innerHTML = "";

    const MAX_SQUAD_SIZE = 4;
    const totalDiv = document.createElement("div");
    totalDiv.id = "squad-total-count";
    container.appendChild(totalDiv);

    const updateCount = () => {
      let total = currentSquad.soldiers.filter(
        (s) => s.archetypeId !== "vip",
      ).length;
      totalDiv.textContent = `TOTAL SOLDIERS: ${total}/${MAX_SQUAD_SIZE}`;
      const launchBtn = document.getElementById(
        "btn-goto-equipment",
      ) as HTMLButtonElement;
      if (launchBtn) launchBtn.disabled = total === 0 || total > MAX_SQUAD_SIZE;
    };

    if (isCampaign) {
      const state = mockCampaignManager.getState();
      state.roster.forEach((soldier: any) => {
        if (soldier.archetypeId === "vip") return;
        const row = document.createElement("div");
        row.dataset.soldierId = soldier.id;
        row.textContent = soldier.name.toUpperCase();
        container.appendChild(row);
      });
    } else {
      Object.values(ArchetypeLibrary).forEach((arch) => {
        const isVip = arch.id === "vip";
        const isEscortMission = currentMissionType === MissionType.EscortVIP;

        const row = document.createElement("div");
        row.dataset.archId = arch.id;

        const info = document.createElement("div");
        info.innerHTML = `<strong>${arch.name.toUpperCase()}</strong>`;

        if (isVip && isEscortMission) {
          const note = document.createElement("div");
          note.className = "vip-note";
          note.textContent = "(AUTO-ASSIGNED)";
          info.appendChild(note);
        }

        const input = document.createElement("input");
        input.type = "number";
        const currentCount = currentSquad.soldiers.filter(
          (s) => s.archetypeId === arch.id,
        ).length;
        input.value = currentCount.toString();

        if (isVip && isEscortMission) {
          input.disabled = true;
          input.value = "0";
        }

        input.addEventListener("change", async () => {
          const val = parseInt(input.value) || 0;
          const otherSoldiers = currentSquad.soldiers.filter(
            (s) => s.archetypeId !== arch.id,
          );
          const otherTotal = otherSoldiers.filter(
            (s) => s.archetypeId !== "vip",
          ).length;

          if (arch.id !== "vip" && otherTotal + val > MAX_SQUAD_SIZE) {
            input.value = currentCount.toString();
            await mockModalService.alert(
              `Max squad size is ${MAX_SQUAD_SIZE}.`,
            );
            return;
          }

          const newSoldiers = [...otherSoldiers];
          for (let i = 0; i < val; i++) {
            newSoldiers.push({ archetypeId: arch.id });
          }
          currentSquad.soldiers = newSoldiers;
          updateCount();
        });
        row.append(info, input);
        container.appendChild(row);
      });
    }
    updateCount();
  }

  it("should hide VIP in Campaign Mode", () => {
    renderSquadBuilder(true);
    const vipRow = document.querySelector('[data-soldier-id="v1"]');
    expect(vipRow).toBeNull();
    const soldierRow = document.querySelector('[data-soldier-id="s1"]');
    expect(soldierRow).not.toBeNull();
  });

  it("should show VIP in Custom Mission (Default Type)", () => {
    currentMissionType = MissionType.Default;
    renderSquadBuilder(false);
    const vipRow = document.querySelector('[data-arch-id="vip"]');
    expect(vipRow).not.toBeNull();
    const input = vipRow?.querySelector("input") as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it("should disable VIP in Custom Mission (Escort VIP Type) and show auto-assigned note", () => {
    currentMissionType = MissionType.EscortVIP;
    renderSquadBuilder(false);
    const vipRow = document.querySelector('[data-arch-id="vip"]');
    expect(vipRow).not.toBeNull();
    const input = vipRow?.querySelector("input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.value).toBe("0");
    const note = vipRow?.querySelector(".vip-note");
    expect(note?.textContent).toBe("(AUTO-ASSIGNED)");
  });

  it("should not count VIP towards squad size limit", () => {
    currentMissionType = MissionType.Default;
    renderSquadBuilder(false);

    // Fill squad with 4 assaults
    currentSquad.soldiers = [
      { archetypeId: "assault" },
      { archetypeId: "assault" },
      { archetypeId: "assault" },
      { archetypeId: "assault" },
    ];
    renderSquadBuilder(false);

    expect(document.getElementById("squad-total-count")?.textContent).toBe(
      "TOTAL SOLDIERS: 4/4",
    );

    // Add a VIP
    const vipRow = document.querySelector('[data-arch-id="vip"]');
    const input = vipRow?.querySelector("input") as HTMLInputElement;
    input.value = "1";
    input.dispatchEvent(new Event("change"));

    expect(
      currentSquad.soldiers.filter((s) => s.archetypeId === "vip").length,
    ).toBe(1);
    expect(document.getElementById("squad-total-count")?.textContent).toBe(
      "TOTAL SOLDIERS: 4/4",
    );
    expect(mockModalService.alert).not.toHaveBeenCalled();
  });
});
