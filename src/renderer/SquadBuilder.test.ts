// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArchetypeLibrary, MissionType } from "../shared/types";

describe("SquadBuilder UI logic", () => {
  let currentSquad: { archetypeId: string; count: number }[] = [];
  let currentMissionType: MissionType = MissionType.Default;

  beforeEach(() => {
    currentSquad = [];
    currentMissionType = MissionType.Default;
    vi.clearAllMocks();

    document.body.innerHTML = `
      <div id="squad-builder"></div>
      <div id="squad-total-count"></div>
      <button id="btn-launch-mission"></button>
    `;

    vi.stubGlobal("alert", vi.fn());
  });

  const renderSquadBuilder = () => {
    const container = document.getElementById("squad-builder");
    if (!container) return;
    container.innerHTML = "";

    const MAX_SQUAD_SIZE = 4;

    const updateTotalCountDisplay = () => {
      let total = currentSquad
        .filter((s) => s.archetypeId !== "vip")
        .reduce((sum, s) => sum + s.count, 0);

      const display = document.getElementById("squad-total-count");
      if (display) {
        display.textContent = `Total Soldiers: ${total}/${MAX_SQUAD_SIZE}`;
        display.style.color =
          total > MAX_SQUAD_SIZE
            ? "#f00"
            : total === MAX_SQUAD_SIZE
              ? "#0f0"
              : "#aaa";
      }

      const launchBtn = document.getElementById("btn-launch-mission") as HTMLButtonElement;
      if (launchBtn) {
        launchBtn.disabled = total === 0 || total > MAX_SQUAD_SIZE;
      }
    };

    Object.values(ArchetypeLibrary).forEach((arch) => {
      if (currentMissionType === MissionType.EscortVIP && arch.id === "vip") {
        return;
      }
      const row = document.createElement("div");
      row.className = "squad-row";
      row.dataset.archId = arch.id;

      const input = document.createElement("input");
      input.type = "number";
      input.className = "squad-count-input";
      input.value = (
        currentSquad.find((s) => s.archetypeId === arch.id)?.count || 0
      ).toString();

      input.addEventListener("change", () => {
        const newVal = parseInt(input.value);
        if (isNaN(newVal) || newVal < 0) {
          input.value = (
            currentSquad.find((s) => s.archetypeId === arch.id)?.count || 0
          ).toString();
          return;
        }

        let otherTotal = currentSquad
          .filter((s) => s.archetypeId !== arch.id && s.archetypeId !== "vip")
          .reduce((sum, s) => sum + s.count, 0);

        if (arch.id !== "vip" && otherTotal + newVal > MAX_SQUAD_SIZE) {
          input.value = (
            currentSquad.find((s) => s.archetypeId === arch.id)?.count || 0
          ).toString();
          alert(`Maximum squad size is ${MAX_SQUAD_SIZE} soldiers.`);
          return;
        }

        const idx = currentSquad.findIndex((s) => s.archetypeId === arch.id);
        if (idx >= 0) {
          if (newVal === 0) {
            currentSquad.splice(idx, 1);
          } else {
            currentSquad[idx].count = newVal;
          }
        } else if (newVal > 0) {
          currentSquad.push({ archetypeId: arch.id, count: newVal });
        }

        updateTotalCountDisplay();
      });

      row.appendChild(input);
      container.appendChild(row);
    });

    updateTotalCountDisplay();
  };

  it("should disable launch button if squad is empty", () => {
    currentSquad = [];
    renderSquadBuilder();
    const launchBtn = document.getElementById("btn-launch-mission") as HTMLButtonElement;
    expect(launchBtn.disabled).toBe(true);
    expect(document.getElementById("squad-total-count")?.textContent).toBe("Total Soldiers: 0/4");
  });

  it("should enable launch button if squad has 1-4 members", () => {
    currentSquad = [{ archetypeId: "assault", count: 1 }];
    renderSquadBuilder();
    const launchBtn = document.getElementById("btn-launch-mission") as HTMLButtonElement;
    expect(launchBtn.disabled).toBe(false);
    expect(document.getElementById("squad-total-count")?.textContent).toBe("Total Soldiers: 1/4");
  });

  it("should prevent adding more than 4 members", () => {
    currentSquad = [{ archetypeId: "assault", count: 4 }];
    renderSquadBuilder();

    // ArchetypeLibrary usually has assault, medic, heavy
    const medicRow = document.querySelector('[data-arch-id="medic"]');
    const medicInput = medicRow?.querySelector("input") as HTMLInputElement;
    expect(medicInput.value).toBe("0");

    medicInput.value = "1";
    medicInput.dispatchEvent(new Event("change"));

    expect(alert).toHaveBeenCalledWith("Maximum squad size is 4 soldiers.");
    expect(medicInput.value).toBe("0");
    expect(currentSquad.length).toBe(1);
    expect(currentSquad[0].count).toBe(4);
  });

  it("should allow changing counts within limit", () => {
    currentSquad = [{ archetypeId: "assault", count: 2 }];
    renderSquadBuilder();

    const assaultRow = document.querySelector('[data-arch-id="assault"]');
    const assaultInput = assaultRow?.querySelector("input") as HTMLInputElement;

    assaultInput.value = "3";
    assaultInput.dispatchEvent(new Event("change"));

    expect(currentSquad[0].count).toBe(3);
    expect(document.getElementById("squad-total-count")?.textContent).toBe("Total Soldiers: 3/4");
  });

  it("should NOT include VIP in total count for EscortVIP missions", () => {
    currentMissionType = MissionType.EscortVIP;
    currentSquad = [{ archetypeId: "assault", count: 2 }];
    renderSquadBuilder();
    expect(document.getElementById("squad-total-count")?.textContent).toBe("Total Soldiers: 2/4");
    const launchBtn = document.getElementById("btn-launch-mission") as HTMLButtonElement;
    expect(launchBtn.disabled).toBe(false);
  });

  it("should allow adding 4 members even in EscortVIP missions", () => {
    currentMissionType = MissionType.EscortVIP;
    currentSquad = [{ archetypeId: "assault", count: 4 }];
    renderSquadBuilder();

    expect(document.getElementById("squad-total-count")?.textContent).toBe("Total Soldiers: 4/4");
    const launchBtn = document.getElementById("btn-launch-mission") as HTMLButtonElement;
    expect(launchBtn.disabled).toBe(false);

    const medicRow = document.querySelector('[data-arch-id="medic"]');
    const medicInput = medicRow?.querySelector("input") as HTMLInputElement;
    expect(medicInput.value).toBe("0");

    medicInput.value = "1";
    medicInput.dispatchEvent(new Event("change"));

    expect(alert).toHaveBeenCalledWith("Maximum squad size is 4 soldiers.");
    expect(medicInput.value).toBe("0");
    expect(currentSquad.length).toBe(1);
    expect(currentSquad[0].count).toBe(4);
  });
});