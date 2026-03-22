import type { GameState, Unit} from "@src/shared/types";
import { UnitState, MissionType } from "@src/shared/types";
import type { MenuController } from "@src/renderer/MenuController";
import { MenuRenderer } from "@src/renderer/ui/MenuRenderer";
import { Icons } from "@src/renderer/Icons";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { MapUtils } from "@src/shared/utils/MapUtils";
import type { UIBinder } from "@src/renderer/ui/UIBinder";

/**
 * Deployed from HUDManager as part of ADR 0052.
 * All panels follow Title Case standard for labels and headers.
 */

export class DeploymentPanel {
  private lastDeploymentHash = "";

  constructor(
    private callbacks: {
      onDeployUnit: (unitId: string, x: number, y: number) => void;
      onStartMission: () => void;
      onAbortMission: () => void;
      onUnitClick: (unit: Unit) => void;
      getCurrentState: () => GameState | null;
      getBinder: () => UIBinder;
      getSelectedUnitId: () => string | null;
    }
  ) {}

  public update(container: HTMLElement, state: GameState) {
    let deploymentDiv = container.querySelector(".deployment-summary") as HTMLElement;

    if (!deploymentDiv) {
      container.innerHTML = "";
      deploymentDiv = document.createElement("div");
      deploymentDiv.className = "deployment-summary";

      const title = document.createElement("h2");
      title.textContent = "Asset Deployment Phase";
      title.className = "deployment-title";
      deploymentDiv.appendChild(title);

      const desc = document.createElement("p");
      // Standard Title Case: prepositions and articles are lowercase unless first/last
      desc.textContent = "Tactically Place Your Assets on Highlighted Tiles. Drag Units to Move Them.";
      desc.className = "deployment-desc";
      deploymentDiv.appendChild(desc);

      const squadList = document.createElement("div");
      squadList.className = "deployment-squad-list";
      deploymentDiv.appendChild(squadList);

      const autoFillBtn = document.createElement("button");
      autoFillBtn.id = "btn-autofill-deployment";
      autoFillBtn.dataset.focusId = "btn-autofill-deployment";
      autoFillBtn.textContent = "Auto-Fill Spawns";
      autoFillBtn.className = "menu-button";
      autoFillBtn.style.width = "100%";
      autoFillBtn.style.marginBottom = "10px";
      autoFillBtn.addEventListener("click", () => {
        const s = this.callbacks.getCurrentState();
        if (!s) return;
        const soldiers = s.units.filter((u) => u.archetypeId !== "vip");
        const allSpawns = s.map.squadSpawns ?? (s.map.squadSpawn ? [s.map.squadSpawn] : []);
        if (allSpawns.length === 0) return;
        soldiers.forEach((u, idx) => {
           const spawn = allSpawns[idx % allSpawns.length];
           this.callbacks.onDeployUnit(u.id, spawn.x + 0.5, spawn.y + 0.5);
        });
      });

      const startBtn = document.createElement("button");
      startBtn.id = "btn-start-mission";
      startBtn.dataset.focusId = "btn-start-mission";
      startBtn.textContent = "Start Mission";
      startBtn.className = "primary-button";
      startBtn.style.width = "100%";
      startBtn.style.marginBottom = "20px";
      startBtn.addEventListener("click", () => this.callbacks.onStartMission());

      deploymentDiv.appendChild(autoFillBtn);
      deploymentDiv.appendChild(startBtn);
      container.appendChild(deploymentDiv);

      autoFillBtn.focus();
    }

    // Operation Controls (Speed Slider for mobile) during deployment
    let controlsDiv = container.querySelector(".mission-controls") as HTMLElement;
    if (!controlsDiv) {
      controlsDiv = document.createElement("div");
      controlsDiv.className = "mission-controls mobile-only";
      controlsDiv.innerHTML = `
        <h3 class="game-over-panel-title">Operation Controls</h3>
        <div class="control-group" style="border:none; padding-top:0; display: flex; flex-direction: column; gap: 10px;">
          <label style="margin-top:0;">Terminal Speed: <span class="mobile-speed-value" data-bind-text="settings" data-bind-transform="speedText">1.0x</span></label>
          <input type="range" class="mobile-speed-slider" min="0" max="100" step="1" value="50" data-bind-value="settings.targetTimeScale" data-bind-transform="speedSlider" data-bind-min="settings.allowTacticalPause|minSpeedValue">
          <button class="mobile-abort-button back-button" style="width: 100%; margin: 10px 0 0 0;">Abort Operation</button>
        </div>
      `;
      const abortBtn = controlsDiv.querySelector(".mobile-abort-button") as HTMLButtonElement;
      if (abortBtn) {
        abortBtn.addEventListener("click", () => this.callbacks.onAbortMission());
      }

      container.insertBefore(controlsDiv, deploymentDiv);
      this.callbacks.getBinder().initialize(container);
    }

    const units = state.units.filter((u) => u.archetypeId !== "vip");
    const selectedUnitId = this.callbacks.getSelectedUnitId();
    const currentHash = `${units.map(u => `${u.id}:${u.isDeployed}`).join("|")  }:${selectedUnitId}`;
    
    const squadList = deploymentDiv.querySelector(".deployment-squad-list") as HTMLElement;
    if (squadList && currentHash !== this.lastDeploymentHash) {
      this.lastDeploymentHash = currentHash;
      const existingIds = new Set(units.map(u => u.id));

      units.forEach((u) => {
        let item = squadList.querySelector(`[data-unit-id="${u.id}"]`) as HTMLButtonElement;
        if (!item) {
          item = document.createElement("button");
          item.id = `keyboard-id-${u.id}`;
          item.dataset.unitId = u.id;
          item.dataset.focusId = `keyboard-id-${u.id}`;
          item.draggable = true;
          squadList.appendChild(item);
        }

        const isPlaced = u.isDeployed !== false;
        SoldierWidget.update(item, u, {
          context: "roster",
          onClick: () => this.callbacks.onUnitClick(u),
          onDoubleClick: () => {
            if (!isPlaced) {
              const s = this.callbacks.getCurrentState();
              if (!s) return;
              const spawn = this.findNextEmptySpawn(s);
              if (spawn) this.callbacks.onDeployUnit(u.id, spawn.x + 0.5, spawn.y + 0.5);
            }
          },
        });

        item.id = `keyboard-id-${u.id}`;
        const baseClasses = ["deployment-unit-item", "clickable", "soldier-widget", "soldier-item", "soldier-widget-roster", "menu-item", "keyboard-tab-target"];
        baseClasses.forEach(cls => item.classList.add(cls));
        
        if (u.id === selectedUnitId) item.classList.add("selected", "active");

        const statusSpan = item.querySelector(".roster-item-details span:last-child") as HTMLElement;
        if (statusSpan) {
          statusSpan.textContent = isPlaced ? "Deployed" : "Pending";
          statusSpan.style.color = isPlaced ? "var(--color-success)" : "var(--color-warning)";
        }
      });

      Array.from(squadList.children).forEach((child) => {
        const id = (child as HTMLElement).dataset.unitId;
        if (id && !existingIds.has(id)) squadList.removeChild(child);
      });
    }

    const startBtn = deploymentDiv.querySelector("#btn-start-mission") as HTMLButtonElement;
    if (startBtn) {
      const aliveUnits = state.units.filter((u) => u.archetypeId !== "vip" && u.state !== UnitState.Extracted && u.hp > 0);
      const deployedUnits = aliveUnits.filter((u) => u.isDeployed !== false);
      const allDeployed = deployedUnits.length === aliveUnits.length;
      const allOnValidTiles = deployedUnits.every((u) => {
        const cell = MathUtils.toCellCoord(u.pos);
        return MapUtils.isValidSpawnPoint(state.map, cell);
      });
      startBtn.disabled = !allDeployed || !allOnValidTiles;
      startBtn.classList.toggle("disabled", startBtn.disabled);
    }
  }

  private findNextEmptySpawn(state: GameState): { x: number; y: number } | null {
    const spawns = state.map?.squadSpawns ?? (state.map?.squadSpawn ? [state.map.squadSpawn] : []);
    for (const spawn of spawns) {
      if (!state.units.some(u => u.isDeployed !== false && MathUtils.sameCellPosition(u.pos, spawn))) return spawn;
    }
    return spawns.length > 0 ? spawns[0] : null;
  }
}

export class CommandMenuPanel {
  private lastMenuHtml = "";

  constructor(
    private callbacks: {
      menuController: MenuController;
      onMenuInput: (key: string, shiftHeld?: boolean) => void;
      onAbortMission: () => void;
      getBinder: () => UIBinder;
    }
  ) {}

  public update(container: HTMLElement, state: GameState) {
    let controlsDiv = container.querySelector(".mission-controls") as HTMLElement;
    if (!controlsDiv) {
      controlsDiv = document.createElement("div");
      controlsDiv.className = "mission-controls mobile-only";
      controlsDiv.innerHTML = `
        <h3 class="game-over-panel-title">Mission Controls</h3>
        <div class="control-group" style="border:none; padding-top:0; display: flex; flex-direction: column; gap: 10px;">
          <label style="margin-top:0;">Game Speed: <span class="mobile-speed-value" data-bind-text="settings" data-bind-transform="speedText">1.0x</span></label>
          <input type="range" class="mobile-speed-slider" min="0" max="100" step="1" value="50" data-bind-value="settings.targetTimeScale" data-bind-transform="speedSlider" data-bind-min="settings.allowTacticalPause|minSpeedValue">
          <button class="mobile-abort-button back-button" style="width: 100%; margin: 10px 0 0 0;">Abort Operation</button>
        </div>
      `;
      const abortBtn = controlsDiv.querySelector(".mobile-abort-button") as HTMLButtonElement;
      if (abortBtn) {
        abortBtn.addEventListener("click", () => this.callbacks.onAbortMission());
      }

      container.appendChild(controlsDiv);
      this.callbacks.getBinder().initialize(container);
    }

    let menuDiv = container.querySelector(".command-menu") as HTMLElement;
    if (!menuDiv) {
      menuDiv = document.createElement("div");
      menuDiv.className = "command-menu";
      menuDiv.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const clickable = target.closest(".menu-item.clickable") as HTMLElement;
        if (clickable) {
          const idxStr = clickable.dataset.index;
          if (idxStr !== undefined) this.callbacks.onMenuInput(idxStr, e.shiftKey);
        }
      });
      container.appendChild(menuDiv);
      this.lastMenuHtml = "";
    }

    const menuRenderState = this.callbacks.menuController.getRenderableState(state);
    const menuHtml = MenuRenderer.renderMenu(menuRenderState);

    if (menuHtml !== this.lastMenuHtml) {
      menuDiv.innerHTML = menuHtml;
      this.lastMenuHtml = menuHtml;
    }
  }

  public reset() {
    this.lastMenuHtml = "";
  }
}

export class ObjectivesPanel {
  private lastHash: string | null = null;

  public update(container: HTMLElement, state: GameState) {
    let objectivesDiv = container.querySelector(".objectives-status") as HTMLElement;
    if (!objectivesDiv) {
      objectivesDiv = document.createElement("div");
      objectivesDiv.className = "objectives-status";
      objectivesDiv.innerHTML = "<h3>Recovery Targets</h3><div class='obj-list'></div>";
      container.appendChild(objectivesDiv);
    }
    const list = objectivesDiv.querySelector(".obj-list") as HTMLElement;
    if (list) {
      const data = this.getObjectivesData(state);
      const hash = JSON.stringify(data);
      if (hash !== this.lastHash) {
        list.innerHTML = data.map((d) => `
          <p class="obj-row" data-obj-id="${d.id}">
            <span class="obj-icon" style="color:${d.color};" title="${d.state}">${d.icon}</span>
            <span class="obj-text">${d.text}</span>
          </p>
        `).join("");
        this.lastHash = hash;
      }
    }
  }

  public getObjectivesData(state: GameState) {
    const showCoords = state.settings.debugOverlayEnabled;
    const data: { id: string; icon: string; color: string; text: string; state: string }[] = [];
    state.objectives.forEach((obj, idx) => {
      const isCompleted = obj.state === "Completed";
      const isFailed = obj.state === "Failed";
      data.push({
        id: obj.id || `obj-${idx}`,
        icon: isCompleted ? "✔" : isFailed ? "✘" : "○",
        color: isCompleted ? "var(--color-success)" : isFailed ? "var(--color-danger)" : "var(--color-text-muted)",
        text: `${obj.kind}${obj.targetCell && showCoords ? ` at (${obj.targetCell.x},${obj.targetCell.y})` : ""}`,
        state: obj.state,
      });
    });
    if (state.map?.extraction && !state.objectives.some((o) => o.kind === "Escort")) {
      const extractedCount = state.units.filter((u) => u.state === UnitState.Extracted).length;
      const totalUnits = state.units.length;
      const isCompleted = extractedCount === totalUnits && totalUnits > 0;
      const locStr = showCoords && state.map.extraction
        ? ` at (${state.map.extraction.x},${state.map.extraction.y})`
        : "";
      data.push({
        id: "extraction",
        icon: extractedCount > 0 ? "✔" : "○",
        color: extractedCount > 0 ? "var(--color-success)" : "var(--color-text-muted)",
        text: `Retrieval (${extractedCount}/${totalUnits})${locStr}`,
        state: isCompleted ? "Completed" : "Pending",
      });
    }
    return data;
  }

  public renderObjectivesList(state: GameState): string {
    const data = this.getObjectivesData(state);
    return data.map((d) => `
      <p class="obj-row">
        <span class="obj-icon" style="color:${d.color};" title="${d.state}">${d.icon}</span>
        ${d.text}
      </p>
    `).join("");
  }
}

export class EnemyIntelPanel {
  private lastHash: string | null = null;

  public update(container: HTMLElement, state: GameState) {
    let intelDiv = container.querySelector(".enemy-intel") as HTMLElement;
    if (!intelDiv) {
      intelDiv = document.createElement("div");
      intelDiv.className = "enemy-intel";
      container.appendChild(intelDiv);
    }
    const visibleEnemies = state.enemies.filter((e) => state.visibleCells.includes(MathUtils.cellKey(e.pos)));
    const hash = visibleEnemies.length === 0 ? "empty" : visibleEnemies.map(e => `${e.type}:${e.hp}`).sort().join("|");
    
    if (hash === this.lastHash) return;
    this.lastHash = hash;

    if (visibleEnemies.length === 0) {
      intelDiv.innerHTML = "<h3>Hostile Contact Intel</h3><p class='intel-empty'>No Hostiles Detected.</p>";
      return;
    }
    const groups: { [type: string]: number } = {};
    visibleEnemies.forEach((e) => { groups[e.type] = (groups[e.type] || 0) + 1; });
    const types = Object.keys(groups).sort();
      intelDiv.innerHTML = `<h3>Hostile Contact Intel</h3>${  types.map(type => {
        const e = visibleEnemies.find(en => en.type === type);
        if (!e) return "";
        const fireRateVal = e.fireRate > 0 ? (1000 / e.fireRate).toFixed(1) : "0";
        return `
          <div class="intel-box" data-type="${type}">
            <div class="intel-header"><strong class="intel-title">${type} x${groups[type]}</strong></div>
            <div class="intel-stats">
              ${StatDisplay.render(Icons.Speed, e.speed, "Operational Speed")}
              ${StatDisplay.render(Icons.Accuracy, e.accuracy, "Accuracy")}
              ${StatDisplay.render(Icons.Damage, e.damage, "Damage")}
              ${StatDisplay.render(Icons.Rate, fireRateVal, "Terminal Feed Delay (Shots/sec)")}
              ${StatDisplay.render(Icons.Range, e.attackRange, "Range")}
            </div>
          </div>
        `;
      }).join("")}`;
  }
}

export class SoldierListPanel {
  constructor(
    private callbacks: {
      onUnitClick: (unit: Unit, shiftHeld?: boolean) => void;
    }
  ) {}

  public update(state: GameState, selectedUnitId: string | null) {
    const listContainer = document.getElementById("soldier-list");
    if (!listContainer) return;

    const panel = document.getElementById("soldier-panel");
    if (panel) {
      if (state.status === "Deployment") {
        panel.style.display = "none";
      } else if (state.missionType !== MissionType.Prologue) {
        panel.style.display = "flex";
      }
    }

    const existingIds = new Set(state.units.map(u => u.id));
    state.units.forEach((unit) => {
      let el = listContainer.querySelector(`.soldier-item[data-unit-id="${unit.id}"]`) as HTMLDivElement;
      if (!el) {
        el = document.createElement("div");
        el.dataset.unitId = unit.id;
        listContainer.appendChild(el);
      }
      SoldierWidget.update(el, unit, {
        context: "tactical",
        selected: unit.id === selectedUnitId,
        onClick: (e: Event) => this.callbacks.onUnitClick(unit, (e as MouseEvent).shiftKey),
      });
    });
    Array.from(listContainer.children).forEach((child) => {
      const id = (child as HTMLElement).dataset.unitId;
      if (id && !existingIds.has(id)) listContainer.removeChild(child);
    });
  }
}

export class GameOverPanel {
  constructor(
    private callbacks: {
      onAbortMission: () => void;
      objectivesPanel: ObjectivesPanel;
    }
  ) {}

  public update(container: HTMLElement, state: GameState) {
    if (container.querySelector(".game-over-summary")) return;
    
    container.innerHTML = "";
    const summaryDiv = document.createElement("div");
    summaryDiv.className = `game-over-summary${  state.status === "Won" ? "" : " lost"}`;
    summaryDiv.innerHTML = `
      <h2 class="game-over-title">${state.status === "Won" ? "OPERATION CLOSED — Targets Secured" : "OPERATION CLOSED — Total Asset Loss"}</h2>
      <div class="game-over-objectives"><h3 class="game-over-panel-title">Recovery Targets</h3>${this.callbacks.objectivesPanel.renderObjectivesList(state)}</div>
      <div class="game-over-stats">
        <p><strong>Operational Time:</strong> ${(state.t / 1000).toFixed(1)}s</p>
        <p><strong>Hostiles Neutralized:</strong> ${state.stats.aliensKilled}</p>
        <p><strong>Asset Write-offs:</strong> ${state.stats.casualties}</p>
      </div>
      <button class="game-over-btn">Back to Menu</button>
    `;
    summaryDiv.querySelector(".game-over-btn")?.addEventListener("click", () => this.callbacks.onAbortMission());
    container.appendChild(summaryDiv);
  }
}
