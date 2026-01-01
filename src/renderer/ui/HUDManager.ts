import { GameState, UnitState, Unit } from "../../shared/types";
import { MenuController } from "../MenuController";
import { MenuRenderer } from "./MenuRenderer";

export class HUDManager {
  private lastMenuHtml = "";

  constructor(
    private menuController: MenuController,
    private onUnitClick: (unit: Unit) => void,
    private onAbortMission: () => void,
    private onMenuInput: (key: string) => void,
    private version: string,
  ) {}

  public update(state: GameState, selectedUnitId: string | null) {
    this.updateTopBar(state);
    this.updateRightPanel(state);
    this.updateSoldierList(state, selectedUnitId);
  }

  private updateTopBar(state: GameState) {
    const statusElement = document.getElementById("game-status");
    if (statusElement) {
      statusElement.innerHTML = `<span style="color:#888">TIME:</span>${(state.t / 1000).toFixed(1)}s | <span style="color:#888">STATUS:</span>${state.status}`;
    }

    const vEl = document.getElementById("version-display");
    if (vEl && vEl.textContent !== `v${this.version}`)
      vEl.textContent = `v${this.version}`;

    const mvEl = document.getElementById("menu-version");
    if (mvEl && mvEl.textContent !== `v${this.version}`)
      mvEl.textContent = `v${this.version}`;

    const threatLevel = state.stats.threatLevel || 0;

    const topThreatFill = document.getElementById("top-threat-fill");
    const topThreatValue = document.getElementById("top-threat-value");

    if (topThreatFill && topThreatValue) {
      let threatColor = "#4caf50";
      if (threatLevel > 30) threatColor = "#ff9800";
      if (threatLevel > 70) threatColor = "#f44336";
      if (threatLevel > 90) threatColor = "#b71c1c";

      topThreatFill.style.width = `${Math.min(100, threatLevel)}%`;
      topThreatFill.style.backgroundColor = threatColor;
      topThreatValue.textContent = `${threatLevel.toFixed(0)}%`;
      topThreatValue.style.color = threatColor;
    }
  }

  private updateRightPanel(state: GameState) {
    const rightPanel = document.getElementById("right-panel");
    if (!rightPanel) return;

    if (state.status !== "Playing") {
      if (rightPanel.querySelector(".game-over-summary")) return;
      this.renderGameOver(rightPanel, state);
      return;
    }

    if (rightPanel.querySelector(".game-over-summary")) {
      rightPanel.innerHTML = "";
      this.lastMenuHtml = "";
    }

    // Command Menu
    let menuDiv = rightPanel.querySelector(".command-menu") as HTMLElement;
    if (!menuDiv) {
      menuDiv = document.createElement("div");
      menuDiv.className = "command-menu";
      menuDiv.style.borderBottom = "1px solid #444";
      menuDiv.style.paddingBottom = "10px";
      menuDiv.style.marginBottom = "10px";
      menuDiv.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const clickable = target.closest(".menu-item.clickable") as HTMLElement;
        if (clickable) {
          const idxStr = clickable.dataset.index;
          if (idxStr !== undefined) this.onMenuInput(idxStr);
        }
      });
      rightPanel.appendChild(menuDiv);
      this.lastMenuHtml = ""; // Force re-render if menuDiv was just created
    }

    const menuRenderState = this.menuController.getRenderableState(state);
    const menuHtml = MenuRenderer.renderMenu(menuRenderState);

    if (menuHtml !== this.lastMenuHtml) {
      menuDiv.innerHTML = menuHtml;
      this.lastMenuHtml = menuHtml;
    }

    // Objectives
    let objectivesDiv = rightPanel.querySelector(
      ".objectives-status",
    ) as HTMLElement;
    if (!objectivesDiv) {
      objectivesDiv = document.createElement("div");
      objectivesDiv.className = "objectives-status";
      rightPanel.appendChild(objectivesDiv);
    }
    const objHtml = "<h3>Objectives</h3>" + this.renderObjectivesList(state);
    if (objectivesDiv.innerHTML !== objHtml) objectivesDiv.innerHTML = objHtml;

    // Remove old extraction div if it exists (now handled by objectives)
    const extDiv = rightPanel.querySelector(".extraction-status");
    if (extDiv) extDiv.remove();

    this.updateEnemyIntel(state, rightPanel);
  }

  private renderObjectivesList(state: GameState): string {
    let html = "";
    const showCoords = state.settings.debugOverlayEnabled;
    state.objectives.forEach((obj) => {
      const isCompleted = obj.state === "Completed";
      const isFailed = obj.state === "Failed";
      const icon = isCompleted ? "✔" : isFailed ? "✘" : "○";
      const color = isCompleted ? "#0f0" : isFailed ? "#f00" : "#888";

      html += `<p style="margin: 5px 0;">
        <span style="color:${color}; margin-right:8px; font-weight:bold;" title="${obj.state}">${icon}</span>
        ${obj.kind}${obj.targetCell && showCoords ? ` at (${obj.targetCell.x},${obj.targetCell.y})` : ""}
      </p>`;
    });

    // Extraction Status (as an implicit objective if not already present)
    if (
      state.map.extraction &&
      !state.objectives.some((o) => o.kind === "Escort")
    ) {
      const extractedCount = state.units.filter(
        (u) => u.state === UnitState.Extracted,
      ).length;
      const totalUnits = state.units.length;
      const isCompleted = extractedCount === totalUnits && totalUnits > 0;
      const icon = extractedCount > 0 ? "✔" : "○";
      const color = extractedCount > 0 ? "#0f0" : "#888";
      const status = isCompleted ? "Completed" : "Pending";
      const locStr = showCoords
        ? ` at (${state.map.extraction.x},${state.map.extraction.y})`
        : "";
      html += `<p style="margin: 5px 0;">
        <span style="color:${color}; margin-right:8px; font-weight:bold;" title="${status}">${icon}</span>
        Extraction (${extractedCount}/${totalUnits})${locStr}
      </p>`;
    }
    return html;
  }

  private updateEnemyIntel(state: GameState, rightPanel: HTMLElement) {
    let intelDiv = rightPanel.querySelector(".enemy-intel") as HTMLElement;
    if (!intelDiv) {
      intelDiv = document.createElement("div");
      intelDiv.className = "enemy-intel";
      intelDiv.style.marginTop = "10px";
      intelDiv.style.borderTop = "1px solid #444";
      intelDiv.style.paddingTop = "10px";
      rightPanel.appendChild(intelDiv);
    }

    const visibleEnemies = state.enemies.filter((e) => {
      const cellKey = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
      return state.visibleCells.includes(cellKey);
    });

    if (visibleEnemies.length === 0) {
      intelDiv.innerHTML =
        "<h3>Enemy Intel</h3><p style='color:#666; font-size:0.8em;'>No hostiles detected.</p>";
      return;
    }

    let html = "<h3>Enemy Intel</h3>";
    // Group by type
    const groups: { [type: string]: number } = {};
    visibleEnemies.forEach((e) => {
      groups[e.type] = (groups[e.type] || 0) + 1;
    });

    Object.keys(groups).forEach((type) => {
      const count = groups[type];
      const e = visibleEnemies.find((en) => en.type === type)!;
      const fireRateVal = e.fireRate > 0 ? (1000 / e.fireRate).toFixed(1) : "0";
      const dmgLabel = e.attackRange <= 1.5 ? "MDMG" : "DMG";

      html += `
        <div style="margin-bottom:8px; border:1px solid #333; padding:4px 8px; background:#111; border-left: 3px solid #f44336;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#f44336; font-size:0.9em;">${type} x${count}</strong>
          </div>
          <div style="font-size:0.7em; color:#888; display:grid; grid-template-columns: 1fr 1fr 1fr; gap:2px; margin-top:2px;">
            <span>SPD:<span style="color:#eee">${(e.speed / 10).toFixed(1)}</span></span>
            <span>ACC:<span style="color:#eee">${e.accuracy}</span></span>
            <span>${dmgLabel}:<span style="color:#eee">${e.damage}</span></span>
            <span>FR:<span style="color:#eee">${fireRateVal}</span></span>
            <span>RNG:<span style="color:#eee">${e.attackRange}</span></span>
          </div>
        </div>
      `;
    });

    if (intelDiv.innerHTML !== html) {
      intelDiv.innerHTML = html;
    }
  }

  private renderGameOver(rightPanel: HTMLElement, state: GameState) {
    rightPanel.innerHTML = "";
    const summaryDiv = document.createElement("div");
    summaryDiv.className = "game-over-summary";
    summaryDiv.style.textAlign = "center";
    summaryDiv.style.padding = "20px";
    summaryDiv.style.background = "#222";
    summaryDiv.style.border =
      "2px solid " + (state.status === "Won" ? "#0f0" : "#f00");

    const title = document.createElement("h2");
    title.textContent =
      state.status === "Won" ? "MISSION ACCOMPLISHED" : "SQUAD WIPED";
    title.style.color = state.status === "Won" ? "#0f0" : "#f00";
    summaryDiv.appendChild(title);

    // Objectives List
    const objectivesDiv = document.createElement("div");
    objectivesDiv.style.margin = "20px 0";
    objectivesDiv.style.textAlign = "left";
    objectivesDiv.style.borderBottom = "1px solid #444";
    objectivesDiv.style.paddingBottom = "10px";
    objectivesDiv.innerHTML = `<h3 style="font-size:0.9em; color:#888; margin-top:0;">OBJECTIVES</h3>${this.renderObjectivesList(state)}`;

    summaryDiv.appendChild(objectivesDiv);

    const stats = document.createElement("div");
    stats.style.margin = "20px 0";
    stats.style.textAlign = "left";
    stats.innerHTML = `
      <p><strong>Time Elapsed:</strong> ${(state.t / 1000).toFixed(1)}s</p>
      <p><strong>Aliens Purged:</strong> ${state.stats.aliensKilled}</p>
      <p><strong>Casualties:</strong> ${state.stats.casualties}</p>
    `;
    summaryDiv.appendChild(stats);

    const menuBtn = document.createElement("button");
    menuBtn.textContent = "BACK TO MENU";
    menuBtn.style.width = "100%";
    menuBtn.style.padding = "15px";
    menuBtn.addEventListener("click", () => this.onAbortMission());
    summaryDiv.appendChild(menuBtn);

    rightPanel.appendChild(summaryDiv);
  }

  private updateSoldierList(state: GameState, selectedUnitId: string | null) {
    const listContainer = document.getElementById("soldier-list");
    if (!listContainer) return;

    const existingIds = new Set<string>();
    state.units.forEach((unit) => {
      existingIds.add(unit.id);
      let el = listContainer.querySelector(
        `.soldier-item[data-unit-id="${unit.id}"]`,
      ) as HTMLDivElement;

      if (!el) {
        el = document.createElement("div");
        el.className = "soldier-item";
        el.dataset.unitId = unit.id;
        el.addEventListener("click", () => this.onUnitClick(unit));
        listContainer.appendChild(el);
      }

      const isSelected = unit.id === selectedUnitId;
      el.classList.toggle("selected", isSelected);
      el.classList.toggle("dead", unit.state === UnitState.Dead);
      el.classList.toggle("extracted", unit.state === UnitState.Extracted);

      let statusText: string = unit.state;
      if (unit.activeCommand) {
        const cmd = unit.activeCommand;
        const cmdLabel = cmd.label || cmd.type;
        statusText = `${cmdLabel} (${unit.state})`;
      }
      if (unit.commandQueue && unit.commandQueue.length > 0) {
        statusText += ` (+${unit.commandQueue.length})`;
      }

      const hpPercent =
        unit.state === UnitState.Dead ? 0 : (unit.hp / unit.maxHp) * 100;
      const policyIcon = unit.engagementPolicy === "IGNORE" ? "🏃" : "⚔️";

      if (!el.hasChildNodes()) {
        el.innerHTML = `
          <div class="info-row" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:6px;">
               <span class="u-icon" style="font-size:1.2em;"></span>
               <strong class="u-id"></strong>
            </div>
            <span class="u-hp" style="font-weight:bold;"></span>
          </div>
          <div class="stats-row" style="font-size:0.7em; display:flex; gap:6px; color:#888; margin-top:-2px; flex-wrap:wrap;">
            <span>SPD:<span class="u-speed" style="color:#eee"></span></span>
            <span>ACC:<span class="u-acc" style="color:#eee"></span></span>
            <span>DMG:<span class="u-dmg" style="color:#eee"></span></span>
            <span>FR:<span class="u-firerate" style="color:#eee"></span></span>
            <span>RNG:<span class="u-range" style="color:#eee"></span></span>
            <span>EffR:<span class="u-eff-range" style="color:#eee"></span></span>
            <span>VIS:<span class="u-sight" style="color:#eee"></span></span>
          </div>
          <div class="status-row" style="font-size:0.75em; color:#aaa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px;">
               <span class="u-status-text"></span>
          </div>
          <div class="hp-bar" style="margin-top:2px;"><div class="hp-fill"></div></div>
        `;
      }

      (el.querySelector(".u-icon") as HTMLElement).textContent = policyIcon;
      (el.querySelector(".u-id") as HTMLElement).textContent = unit.id;
      (el.querySelector(".u-status-text") as HTMLElement).textContent =
        statusText;
      (el.querySelector(".u-hp") as HTMLElement).textContent =
        `${unit.hp}/${unit.maxHp}`;
      (el.querySelector(".hp-fill") as HTMLElement).style.width =
        `${hpPercent}%`;

      (el.querySelector(".u-speed") as HTMLElement).textContent = (
        unit.stats.speed / 10
      ).toFixed(1);
      (el.querySelector(".u-acc") as HTMLElement).textContent =
        unit.stats.accuracy.toString();
      (el.querySelector(".u-dmg") as HTMLElement).textContent =
        unit.stats.damage.toString();
      (el.querySelector(".u-firerate") as HTMLElement).textContent =
        unit.stats.fireRate > 0 ? (1000 / unit.stats.fireRate).toFixed(1) : "0";
      (el.querySelector(".u-range") as HTMLElement).textContent =
        unit.stats.attackRange.toString();

      const S = unit.stats.accuracy;
      let effRange = unit.stats.attackRange;
      if (S < 100 && S > 0) {
        const A = Math.sqrt((25 * S) / (100 - S));
        effRange = Math.min(unit.stats.attackRange, 3 * A);
      } else if (S <= 0) {
        effRange = 0;
      }
      (el.querySelector(".u-eff-range") as HTMLElement).textContent =
        effRange.toFixed(1);

      (el.querySelector(".u-sight") as HTMLElement).textContent =
        unit.stats.sightRange >= 100 ? "∞" : unit.stats.sightRange.toString();
    });

    Array.from(listContainer.children).forEach((child) => {
      const id = (child as HTMLElement).dataset.unitId;
      if (id && !existingIds.has(id)) listContainer.removeChild(child);
    });
  }
}
