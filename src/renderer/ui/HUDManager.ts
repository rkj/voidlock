import { GameState, UnitState, Unit, WeaponLibrary } from "@src/shared/types";
import { MenuController } from "@src/renderer/MenuController";
import { MenuRenderer } from "@src/renderer/ui/MenuRenderer";
import { Icons } from "@src/renderer/Icons";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";
import { TimeUtility } from "@src/renderer/TimeUtility";

export class HUDManager {
  private lastMenuHtml = "";

  constructor(
    private menuController: MenuController,
    private onUnitClick: (unit: Unit, shiftHeld?: boolean) => void,
    private onAbortMission: () => void,
    private onMenuInput: (key: string, shiftHeld?: boolean) => void,
    private onCopyWorldState: () => void,
    private onForceWin: () => void,
    private onForceLose: () => void,
    private version: string,
  ) {}

  public update(state: GameState, selectedUnitId: string | null) {
    this.updateTopBar(state);
    this.updateRightPanel(state);
    this.updateSoldierList(state, selectedUnitId);
  }

  private getWeaponStats(unit: Unit, weaponId?: string) {
    if (!weaponId) return null;
    const weapon = WeaponLibrary[weaponId];
    if (!weapon) return null;

    const fireRateVal =
      weapon.fireRate * (unit.stats.speed > 0 ? 10 / unit.stats.speed : 1);

    return {
      name: weapon.name,
      damage: weapon.damage,
      range: weapon.range,
      accuracy:
        unit.stats.soldierAim +
        (weapon.accuracy || 0) +
        (unit.stats.equipmentAccuracyBonus || 0),
      fireRate: fireRateVal > 0 ? (1000 / fireRateVal).toFixed(1) : "0",
    };
  }

  private updateTopBar(state: GameState) {
    const statusElement = document.getElementById("game-status");
    if (statusElement) {
      statusElement.innerHTML = `<span style="color:var(--color-text-muted); text-transform:uppercase; letter-spacing:1px; font-size:0.8em;">Time</span> ${(state.t / 1000).toFixed(1)}s`;
    }

    const threatLevel = state.stats.threatLevel || 0;

    const topThreatFill = document.getElementById("top-threat-fill");
    const topThreatValue = document.getElementById("top-threat-value");

    if (topThreatFill && topThreatValue) {
      const isInitial = state.t < 1000;
      if (isInitial) {
        topThreatFill.classList.add("no-transition");
      }

      let threatVar = "--color-success";
      if (threatLevel > 30) threatVar = "--color-warning";
      if (threatLevel > 70) threatVar = "--color-danger";
      if (threatLevel > 90) threatVar = "--color-danger"; // Could add a darker red if needed

      topThreatFill.style.width = `${Math.min(100, threatLevel)}%`;
      topThreatFill.style.backgroundColor = `var(${threatVar})`;
      topThreatValue.textContent = `${threatLevel.toFixed(0)}%`;
      topThreatValue.style.color = `var(${threatVar})`;

      if (isInitial) {
        // Force a reflow to ensure the width is applied without transition
        void topThreatFill.offsetWidth;
        topThreatFill.classList.remove("no-transition");
      }
    }

    const gameSpeedSlider = document.getElementById(
      "game-speed",
    ) as HTMLInputElement;
    if (gameSpeedSlider) {
      const minVal = state.settings.allowTacticalPause ? "0" : "50";
      if (gameSpeedSlider.min !== minVal) {
        gameSpeedSlider.min = minVal;
      }
    }

    const speedValue = document.getElementById("speed-value");
    if (speedValue) {
      const isPaused = state.settings.isPaused;
      const scale = isPaused
        ? state.settings.allowTacticalPause
          ? 0.1
          : 0.0
        : state.settings.timeScale;
      speedValue.textContent = TimeUtility.formatSpeed(scale, isPaused);
    }

    const btn = document.getElementById("btn-pause-toggle") as HTMLButtonElement;
    if (btn) {
      const isPaused = state.settings.isPaused;
      btn.textContent = isPaused ? "▶ PLAY" : "|| PAUSE";
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
      menuDiv.style.borderBottom = "1px solid var(--color-border-strong)";
      menuDiv.style.paddingBottom = "10px";
      menuDiv.style.marginBottom = "10px";
      menuDiv.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const clickable = target.closest(".menu-item.clickable") as HTMLElement;
        if (clickable) {
          const idxStr = clickable.dataset.index;
          if (idxStr !== undefined) this.onMenuInput(idxStr, e.shiftKey);
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

    // Debug Buttons
    let debugDiv = rightPanel.querySelector(".debug-controls") as HTMLElement;
    if (state.settings.debugOverlayEnabled) {
      if (!debugDiv) {
        debugDiv = document.createElement("div");
        debugDiv.className = "debug-controls";
        debugDiv.style.marginTop = "10px";
        debugDiv.style.borderTop = "1px solid var(--color-border-strong)";
        debugDiv.style.paddingTop = "10px";
        rightPanel.appendChild(debugDiv);
      }
      const generatorName = state.map.generatorName || "Unknown";
      const genDisplay = generatorName.endsWith("Generator")
        ? generatorName
        : `${generatorName}Generator`;

      const debugHtml = `
        <h3>Debug Tools</h3>
        <div style="font-size:0.8em; color:var(--color-text-muted); margin-bottom:10px; display:flex; flex-direction:column; gap:4px;">
          <span><strong>Map:</strong> ${genDisplay} (${state.seed})</span>
          <span><strong>Size:</strong> ${state.map.width}x${state.map.height}</span>
          <span><strong>Mission:</strong> ${state.missionType}</span>
        </div>
        <div style="display:flex; gap:4px; margin-bottom:4px;">
          <button id="btn-force-win" style="flex:1; font-size:0.8em; padding:8px; background-color:var(--color-success); color:white; border:none; cursor:pointer;">Force Win</button>
          <button id="btn-force-lose" style="flex:1; font-size:0.8em; padding:8px; background-color:var(--color-danger); color:white; border:none; cursor:pointer;">Force Lose</button>
        </div>
        <button id="btn-copy-world-state" style="width:100%; font-size:0.8em; padding:8px;">Copy World State</button>
      `;
      if (debugDiv.innerHTML !== debugHtml) {
        debugDiv.innerHTML = debugHtml;
        document
          .getElementById("btn-copy-world-state")
          ?.addEventListener("click", () => this.onCopyWorldState());
        document
          .getElementById("btn-force-win")
          ?.addEventListener("click", () => this.onForceWin());
        document
          .getElementById("btn-force-lose")
          ?.addEventListener("click", () => this.onForceLose());
      }
    } else if (debugDiv) {
      debugDiv.remove();
    }

    this.updateEnemyIntel(state, rightPanel);
  }

  private renderObjectivesList(state: GameState): string {
    let html = "";
    const showCoords = state.settings.debugOverlayEnabled;
    state.objectives.forEach((obj) => {
      const isCompleted = obj.state === "Completed";
      const isFailed = obj.state === "Failed";
      const icon = isCompleted ? "✔" : isFailed ? "✘" : "○";
      const color = isCompleted
        ? "var(--color-success)"
        : isFailed
          ? "var(--color-danger)"
          : "var(--color-text-muted)";

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
      const color =
        extractedCount > 0 ? "var(--color-success)" : "var(--color-text-muted)";
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
      intelDiv.style.borderTop = "1px solid var(--color-border-strong)";
      intelDiv.style.paddingTop = "10px";
      rightPanel.appendChild(intelDiv);
    }

    const visibleEnemies = state.enemies.filter((e) => {
      const cellKey = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
      return state.visibleCells.includes(cellKey);
    });

    if (visibleEnemies.length === 0) {
      intelDiv.innerHTML =
        "<h3>Enemy Intel</h3><p style='color:var(--color-text-dim); font-size:0.8em;'>No hostiles detected.</p>";
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

      html += `
        <div class="intel-box">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:var(--color-danger); font-size:0.9em;">${type} x${count}</strong>
          </div>
          <div style="font-size:0.7em; color:var(--color-text-muted); display:flex; gap:8px; margin-top:4px; flex-wrap:wrap;">
            ${StatDisplay.render(Icons.Speed, e.speed, "Speed")}
            ${StatDisplay.render(Icons.Accuracy, e.accuracy, "Accuracy")}
            ${StatDisplay.render(Icons.Damage, e.damage, "Damage")}
            ${StatDisplay.render(Icons.Rate, fireRateVal, "Fire Rate")}
            ${StatDisplay.render(Icons.Range, e.attackRange, "Range")}
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
    summaryDiv.className =
      "game-over-summary" + (state.status === "Won" ? "" : " lost");
    summaryDiv.style.margin = "20px";

    const title = document.createElement("h2");
    title.textContent =
      state.status === "Won" ? "Mission Accomplished" : "Squad Wiped";
    title.style.color =
      state.status === "Won" ? "var(--color-success)" : "var(--color-danger)";
    summaryDiv.appendChild(title);

    // Objectives List
    const objectivesDiv = document.createElement("div");
    objectivesDiv.style.margin = "20px 0";
    objectivesDiv.style.textAlign = "left";
    objectivesDiv.style.borderBottom = "1px solid var(--color-border-strong)";
    objectivesDiv.style.paddingBottom = "10px";
    objectivesDiv.innerHTML = `<h3 style="font-size:0.9em; color:var(--color-text-muted); margin-top:0;">Objectives</h3>${this.renderObjectivesList(state)}`;

    summaryDiv.appendChild(objectivesDiv);

    const stats = document.createElement("div");
    stats.style.margin = "20px 0";
    stats.style.textAlign = "left";
    stats.innerHTML = `
      <p><strong>Time Elapsed:</strong> ${(state.t / 1000).toFixed(1)}s</p>
      <p><strong>Xenos Neutralized:</strong> ${state.stats.aliensKilled}</p>
      <p><strong>Casualties:</strong> ${state.stats.casualties}</p>
    `;
    summaryDiv.appendChild(stats);

    const menuBtn = document.createElement("button");
    menuBtn.textContent = "Back to Menu";
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
        el.addEventListener("click", (e) => this.onUnitClick(unit, e.shiftKey));
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
      const burdenIcon = unit.carriedObjectiveId ? " 📦" : "";

      if (!el.hasChildNodes()) {
        el.innerHTML = `
          <div class="info-row" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:6px;">
               <span class="u-icon" style="font-size:1.2em;"></span>
               <strong class="u-id"></strong>
               <span class="u-burden" style="color:var(--color-danger); font-size:1em;"></span>
            </div>
            <span class="u-hp" style="font-weight:bold;"></span>
          </div>
          <div class="base-stats-row" style="font-size:0.7em; display:flex; gap:8px; color:var(--color-text-muted); margin-top:2px;">
             <span class="u-speed-box"></span>
          </div>
          <div class="weapon-stats-container" style="font-size:0.65em; margin-top:4px; display:flex; flex-direction:column; gap:2px; border-top:1px solid var(--color-surface-elevated); padding-top:2px;">
             <div class="u-lh-row" style="display:flex; gap:6px; align-items:center; padding: 1px 2px;">
                <span style="color:var(--color-text-dim); flex: 0 0 24px;">LH:</span>
                <span class="u-lh-stats" style="display:flex; gap:8px;"></span>
             </div>
             <div class="u-rh-row" style="display:flex; gap:6px; align-items:center; padding: 1px 2px;">
                <span style="color:var(--color-text-dim); flex: 0 0 24px;">RH:</span>
                <span class="u-rh-stats" style="display:flex; gap:8px;"></span>
             </div>
          </div>
          <div class="status-row" style="font-size:0.75em; color:var(--color-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">
               <span class="u-status-text"></span>
          </div>
          <div class="hp-bar" style="margin-top:2px;"><div class="hp-fill"></div></div>
        `;
      }

      (el.querySelector(".u-icon") as HTMLElement).textContent = policyIcon;
      (el.querySelector(".u-id") as HTMLElement).textContent = unit.id;
      (el.querySelector(".u-burden") as HTMLElement).textContent = burdenIcon;
      (el.querySelector(".u-status-text") as HTMLElement).textContent =
        statusText;
      (el.querySelector(".u-hp") as HTMLElement).textContent =
        `${unit.hp}/${unit.maxHp}`;
      (el.querySelector(".hp-fill") as HTMLElement).style.width =
        `${hpPercent}%`;

      (el.querySelector(".u-speed-box") as HTMLElement).innerHTML =
        StatDisplay.render(Icons.Speed, unit.stats.speed, "Speed");

      const lhStats = this.getWeaponStats(unit, unit.leftHand);
      const rhStats = this.getWeaponStats(unit, unit.rightHand);

      const renderWep = (stats: any) => {
        if (!stats)
          return '<span style="color:var(--color-border-strong)">Empty</span>';
        return `
          ${StatDisplay.render(Icons.Damage, stats.damage, "Damage")}
          ${StatDisplay.render(Icons.Accuracy, stats.accuracy, "Accuracy")}
          ${StatDisplay.render(Icons.Rate, stats.fireRate, "Fire Rate")}
          ${StatDisplay.render(Icons.Range, stats.range, "Range")}
        `;
      };

      (el.querySelector(".u-lh-stats") as HTMLElement).innerHTML =
        renderWep(lhStats);
      (el.querySelector(".u-rh-stats") as HTMLElement).innerHTML =
        renderWep(rhStats);

      const lhRow = el.querySelector(".u-lh-row") as HTMLElement;
      const rhRow = el.querySelector(".u-rh-row") as HTMLElement;

      if (unit.activeWeaponId === unit.leftHand && unit.leftHand) {
        lhRow.style.background = "var(--color-surface-elevated)";
        rhRow.style.background = "transparent";
      } else if (unit.activeWeaponId === unit.rightHand && unit.rightHand) {
        rhRow.style.background = "var(--color-surface-elevated)";
        lhRow.style.background = "transparent";
      } else {
        lhRow.style.background = "transparent";
        rhRow.style.background = "transparent";
      }
    });

    Array.from(listContainer.children).forEach((child) => {
      const id = (child as HTMLElement).dataset.unitId;
      if (id && !existingIds.has(id)) listContainer.removeChild(child);
    });
  }
}
