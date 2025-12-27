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
      statusElement.innerHTML = `<span style="color:#888">T:</span>${(state.t / 1000).toFixed(1)}s | <span style="color:#888">S:</span>${state.status}`;
    }

    const vEl = document.getElementById("version-display");
    if (vEl && vEl.textContent !== `v${this.version}`)
      vEl.textContent = `v${this.version}`;

    const mvEl = document.getElementById("menu-version");
    if (mvEl && mvEl.textContent !== `v${this.version}`)
      mvEl.textContent = `v${this.version}`;

    const threatLevel = state.threatLevel || 0;
    const topTurnValue = document.getElementById("top-turn-value");
    if (topTurnValue) {
      const turn = Math.floor(threatLevel / 10);
      topTurnValue.textContent = turn.toString();
    }

    const topThreatFill = document.getElementById("top-threat-fill");
    const topThreatValue = document.getElementById("top-threat-value");

    if (topThreatFill && topThreatValue) {
      let threatColor = "#4caf50";
      if (threatLevel > 30) threatColor = "#ff9800";
      if (threatLevel > 70) threatColor = "#f44336";
      if (threatLevel > 90) threatColor = "#b71c1c";

      topThreatFill.style.width = `${threatLevel}%`;
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
    let objHtml = "<h3>Objectives</h3>";
    state.objectives.forEach((obj) => {
      objHtml += `<p>${obj.kind}: Status: ${obj.state}${obj.targetCell ? ` at (${obj.targetCell.x},${obj.targetCell.y})` : ""}</p>`;
    });
    if (objectivesDiv.innerHTML !== objHtml) objectivesDiv.innerHTML = objHtml;

    // Extraction
    let extDiv = rightPanel.querySelector(".extraction-status") as HTMLElement;
    if (state.map.extraction) {
      if (!extDiv) {
        extDiv = document.createElement("div");
        extDiv.className = "extraction-status";
        rightPanel.appendChild(extDiv);
      }
      const extractedCount = state.units.filter(
        (u) => u.state === UnitState.Extracted,
      ).length;
      const totalUnits = state.units.length;
      let extHtml = `<h3>Extraction</h3><p>Location: (${state.map.extraction.x},${state.map.extraction.y})</p>`;
      if (totalUnits > 0)
        extHtml += `<p>Extracted: ${extractedCount}/${totalUnits}</p>`;
      if (extDiv.innerHTML !== extHtml) extDiv.innerHTML = extHtml;
    } else if (extDiv) {
      extDiv.remove();
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

    const stats = document.createElement("div");
    stats.style.margin = "20px 0";
    stats.style.textAlign = "left";
    stats.innerHTML = `
      <p><strong>Time Elapsed:</strong> ${(state.t / 1000).toFixed(1)}s</p>
      <p><strong>Aliens Purged:</strong> ${state.aliensKilled}</p>
      <p><strong>Casualties:</strong> ${state.casualties}</p>
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
          <div class="stats-row" style="font-size:0.7em; display:flex; gap:6px; color:#888; margin-top:-2px;">
            <span>SPD:<span class="u-speed" style="color:#eee"></span></span>
            <span>DMG:<span class="u-dmg" style="color:#eee"></span></span>
            <span>RNG:<span class="u-range" style="color:#eee"></span></span>
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

      (el.querySelector(".u-speed") as HTMLElement).textContent =
        (unit.speed / 10).toFixed(1);
      (el.querySelector(".u-dmg") as HTMLElement).textContent =
        unit.damage.toString();
      (el.querySelector(".u-range") as HTMLElement).textContent =
        unit.attackRange.toString();
      (el.querySelector(".u-sight") as HTMLElement).textContent =
        unit.sightRange >= 100 ? "∞" : unit.sightRange.toString();
    });

    Array.from(listContainer.children).forEach((child) => {
      const id = (child as HTMLElement).dataset.unitId;
      if (id && !existingIds.has(id)) listContainer.removeChild(child);
    });
  }
}
