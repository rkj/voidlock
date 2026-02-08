import { GameState, UnitState, Unit } from "@src/shared/types";
import { MenuController } from "@src/renderer/MenuController";
import { MenuRenderer } from "@src/renderer/ui/MenuRenderer";
import { Icons } from "@src/renderer/Icons";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";

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
    private onStartMission: () => void,
  ) {}

  public update(state: GameState, selectedUnitId: string | null) {
    this.updateTopBar(state);
    this.updateRightPanel(state);
    this.updateSoldierList(state, selectedUnitId);
  }

  private updateTopBar(state: GameState) {
    const statusElement = document.getElementById("game-status");
    if (statusElement) {
      let timeVal = statusElement.querySelector(".time-value");
      if (!timeVal) {
        statusElement.innerHTML = `<span class="time-label">Time</span> <span class="time-value"></span>s`;
        timeVal = statusElement.querySelector(".time-value");
      }
      if (timeVal) {
        const timeStr = (state.t / 1000).toFixed(1);
        if (timeVal.textContent !== timeStr) {
          timeVal.textContent = timeStr;
        }
      }
    }

    const threatLevel = state.stats.threatLevel || 0;

    const topThreatFill = document.getElementById("top-threat-fill");
    const topThreatValue = document.getElementById("top-threat-value");

    if (topThreatFill && topThreatValue) {
      const isInitial = state.t < 1000;
      if (isInitial) {
        topThreatFill.classList.add("no-transition");
      }

      let threatClass = "threat-success";
      if (threatLevel > 30) threatClass = "threat-warning";
      if (threatLevel > 70) threatClass = "threat-danger";
      if (threatLevel > 90) threatClass = "threat-danger";

      topThreatFill.style.width = `${Math.min(100, threatLevel)}%`;
      topThreatFill.className = `threat-fill ${threatClass}`;
      topThreatValue.textContent = `${threatLevel.toFixed(0)}%`;
      topThreatValue.className = `threat-value ${threatClass}`;

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

    const btn = document.getElementById(
      "btn-pause-toggle",
    ) as HTMLButtonElement;
    if (btn) {
      const isPaused = state.settings.isPaused;
      btn.textContent = isPaused ? "▶ PLAY" : "|| PAUSE";
    }
  }

  private updateRightPanel(state: GameState) {
    const rightPanel = document.getElementById("right-panel");
    if (!rightPanel) return;

    if (state.status === "Deployment") {
      this.updateDeployment(rightPanel, state);
      return;
    }

    if (state.status !== "Playing") {
      if (rightPanel.querySelector(".game-over-summary")) return;
      this.renderGameOver(rightPanel, state);
      return;
    }

    // Remove deployment or game over summary if they exist
    const deploymentDiv = rightPanel.querySelector(".deployment-summary");
    if (deploymentDiv) {
      rightPanel.innerHTML = "";
      this.lastMenuHtml = "";
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
      objectivesDiv.innerHTML =
        "<h3>Objectives</h3><div class='obj-list'></div>";
      rightPanel.appendChild(objectivesDiv);
    }
    this.updateObjectives(
      state,
      objectivesDiv.querySelector(".obj-list") as HTMLElement,
    );

    // Remove old extraction div if it exists (now handled by objectives)
    const extDiv = rightPanel.querySelector(".extraction-status");
    if (extDiv) extDiv.remove();

    // Debug Buttons
    let debugDiv = rightPanel.querySelector(".debug-controls") as HTMLElement;
    if (state.settings.debugOverlayEnabled) {
      if (!debugDiv) {
        debugDiv = document.createElement("div");
        debugDiv.className = "debug-controls";
        rightPanel.appendChild(debugDiv);
      }
      const generatorName = state.map.generatorName || "Unknown";
      const genDisplay = generatorName.endsWith("Generator")
        ? generatorName
        : `${generatorName}Generator`;

      const debugHtml = `
        <h3>Debug Tools</h3>
        <div class="debug-info-grid">
          <span><strong>Map:</strong> ${genDisplay} (${state.seed})</span>
          <span><strong>Size:</strong> ${state.map.width}x${state.map.height}</span>
          <span><strong>Mission:</strong> ${state.missionType}</span>
        </div>
        <div class="debug-actions-row">
          <button id="btn-force-win" class="debug-btn-win">Force Win</button>
          <button id="btn-force-lose" class="debug-btn-lose">Force Lose</button>
        </div>
        <button id="btn-copy-world-state" class="debug-btn-copy">Copy World State</button>
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

  private updateDeployment(rightPanel: HTMLElement, state: GameState) {
    let deploymentDiv = rightPanel.querySelector(
      ".deployment-summary",
    ) as HTMLElement;

    if (!deploymentDiv) {
      rightPanel.innerHTML = "";
      deploymentDiv = document.createElement("div");
      deploymentDiv.className = "deployment-summary";

      const title = document.createElement("h2");
      title.textContent = "Deployment Phase";
      title.className = "deployment-title";
      deploymentDiv.appendChild(title);

      const desc = document.createElement("p");
      desc.textContent =
        "Tactically place your squad members on highlighted tiles. Drag units to move them.";
      desc.className = "deployment-desc";
      deploymentDiv.appendChild(desc);

      const squadList = document.createElement("div");
      squadList.className = "deployment-squad-list";
      deploymentDiv.appendChild(squadList);

      const startBtn = document.createElement("button");
      startBtn.id = "btn-start-mission";
      startBtn.textContent = "START MISSION";
      startBtn.className = "btn-start-mission";
      startBtn.addEventListener("click", () => this.onStartMission());
      deploymentDiv.appendChild(startBtn);

      rightPanel.appendChild(deploymentDiv);
    }

    const squadList = deploymentDiv.querySelector(
      ".deployment-squad-list",
    ) as HTMLElement;
    if (squadList) {
      const units = state.units.filter((u) => u.archetypeId !== "vip");
      const currentIds = new Set(units.map((u) => u.id));

      // Remove units that are gone
      Array.from(squadList.children).forEach((child) => {
        const id = (child as HTMLElement).dataset.unitId;
        if (id && !currentIds.has(id)) squadList.removeChild(child);
      });

      units.forEach((u) => {
        let item = squadList.querySelector(
          `[data-unit-id="${u.id}"]`,
        ) as HTMLElement;
        if (!item) {
          item = document.createElement("div");
          item.dataset.unitId = u.id;
          item.draggable = true;
          item.className = "deployment-unit-item";
          item.addEventListener("dragstart", (e) => {
            if (e.dataTransfer) {
              e.dataTransfer.setData("text/plain", u.id);
              e.dataTransfer.effectAllowed = "move";
            }
          });
          squadList.appendChild(item);
        }

        const isPlaced = u.isDeployed !== false;
        const statusText = isPlaced ? "Deployed" : "Pending";

        SoldierWidget.update(item, u, {
          context: "roster",
        });

        const statusSpan = item.querySelector(
          ".roster-item-details span:last-child",
        ) as HTMLElement;
        if (statusSpan) {
          statusSpan.textContent = statusText;
          statusSpan.style.color = isPlaced
            ? "var(--color-success)"
            : "var(--color-warning)";
        }
      });
    }

    const startBtn = deploymentDiv.querySelector(
      "#btn-start-mission",
    ) as HTMLButtonElement;
    if (startBtn) {
      // Validate that all soldiers are on valid spawn tiles
      const allOnValidTiles = state.units
        .filter(
          (u) =>
            u.archetypeId !== "vip" &&
            u.state !== UnitState.Extracted &&
            u.hp > 0,
        )
        .every((u) => {
          const x = Math.floor(u.pos.x);
          const y = Math.floor(u.pos.y);
          return (
            state.map.squadSpawns?.some((s) => s.x === x && s.y === y) ||
            (state.map.squadSpawn &&
              state.map.squadSpawn.x === x &&
              state.map.squadSpawn.y === y)
          );
        });

      if (!allOnValidTiles) {
        startBtn.disabled = true;
        startBtn.classList.add("disabled");
        startBtn.title = "All squad members must be on valid spawn tiles.";
      } else {
        startBtn.disabled = false;
        startBtn.classList.remove("disabled");
        startBtn.title = "";
      }
    }
  }

  private getObjectivesData(state: GameState) {
    const showCoords = state.settings.debugOverlayEnabled;
    const data: {
      id: string;
      icon: string;
      color: string;
      text: string;
      state: string;
    }[] = [];

    state.objectives.forEach((obj, idx) => {
      const isCompleted = obj.state === "Completed";
      const isFailed = obj.state === "Failed";
      const icon = isCompleted ? "✔" : isFailed ? "✘" : "○";
      const color = isCompleted
        ? "var(--color-success)"
        : isFailed
          ? "var(--color-danger)"
          : "var(--color-text-muted)";

      data.push({
        id: obj.id || `obj-${idx}`,
        icon,
        color,
        text: `${obj.kind}${obj.targetCell && showCoords ? ` at (${obj.targetCell.x},${obj.targetCell.y})` : ""}`,
        state: obj.state,
      });
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
      data.push({
        id: "extraction",
        icon,
        color,
        text: `Extraction (${extractedCount}/${totalUnits})${locStr}`,
        state: status,
      });
    }
    return data;
  }

  private updateObjectives(state: GameState, container: HTMLElement) {
    const data = this.getObjectivesData(state);
    const existingRows = Array.from(container.querySelectorAll("p"));

    if (existingRows.length !== data.length) {
      container.innerHTML = data
        .map(
          (d) => `
        <p class="obj-row" data-obj-id="${d.id}">
          <span class="obj-icon" style="color:${d.color};" title="${d.state}">${d.icon}</span>
          <span class="obj-text">${d.text}</span>
        </p>
      `,
        )
        .join("");
    } else {
      data.forEach((d, i) => {
        const row = existingRows[i];
        const iconSpan = row.querySelector(".obj-icon") as HTMLElement;
        const textSpan = row.querySelector(".obj-text") as HTMLElement;

        if (iconSpan.textContent !== d.icon) iconSpan.textContent = d.icon;
        if (iconSpan.title !== d.state) iconSpan.title = d.state;
        if (iconSpan.style.color !== d.color) iconSpan.style.color = d.color;
        if (textSpan.textContent !== d.text) textSpan.textContent = d.text;
      });
    }
  }

  private renderObjectivesList(state: GameState): string {
    const data = this.getObjectivesData(state);
    return data
      .map(
        (d) => `
      <p class="obj-row">
        <span class="obj-icon" style="color:${d.color};" title="${d.state}">${d.icon}</span>
        ${d.text}
      </p>
    `,
      )
      .join("");
  }

  private updateEnemyIntel(state: GameState, rightPanel: HTMLElement) {
    let intelDiv = rightPanel.querySelector(".enemy-intel") as HTMLElement;
    if (!intelDiv) {
      intelDiv = document.createElement("div");
      intelDiv.className = "enemy-intel";
      rightPanel.appendChild(intelDiv);
    }

    const visibleEnemies = state.enemies.filter((e) => {
      const cellKey = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
      return state.visibleCells.includes(cellKey);
    });

    if (visibleEnemies.length === 0) {
      const emptyHtml =
        "<h3>Enemy Intel</h3><p class='intel-empty'>No hostiles detected.</p>";
      if (intelDiv.innerHTML !== emptyHtml) {
        intelDiv.innerHTML = emptyHtml;
      }
      return;
    }

    // Ensure header exists
    let header = intelDiv.querySelector("h3");
    if (!header) {
      intelDiv.innerHTML = "<h3>Enemy Intel</h3>";
      header = intelDiv.querySelector("h3");
    }

    // Remove "No hostiles detected" if it exists
    const noHostiles = intelDiv.querySelector(".intel-empty");
    if (noHostiles) noHostiles.remove();

    // Group by type
    const groups: { [type: string]: number } = {};
    visibleEnemies.forEach((e) => {
      groups[e.type] = (groups[e.type] || 0) + 1;
    });

    const types = Object.keys(groups).sort();
    const existingTypes = new Set<string>();

    types.forEach((type) => {
      existingTypes.add(type);
      const count = groups[type];
      const e = visibleEnemies.find((en) => en.type === type)!;
      const fireRateVal = e.fireRate > 0 ? (1000 / e.fireRate).toFixed(1) : "0";

      let box = intelDiv.querySelector(
        `.intel-box[data-type="${type}"]`,
      ) as HTMLElement;
      if (!box) {
        box = document.createElement("div");
        box.className = "intel-box";
        box.dataset.type = type;
        box.innerHTML = `
          <div class="intel-header">
            <strong class="intel-title"></strong>
          </div>
          <div class="intel-stats">
            ${StatDisplay.render(Icons.Speed, e.speed, "Speed")}
            ${StatDisplay.render(Icons.Accuracy, e.accuracy, "Accuracy")}
            ${StatDisplay.render(Icons.Damage, e.damage, "Damage")}
            ${StatDisplay.render(Icons.Rate, fireRateVal, "Fire Rate")}
            ${StatDisplay.render(Icons.Range, e.attackRange, "Range")}
          </div>
        `;
        intelDiv.appendChild(box);
      }

      const title = box.querySelector(".intel-title") as HTMLElement;
      const titleText = `${type} x${count}`;
      if (title.textContent !== titleText) title.textContent = titleText;

      const statsContainer = box.querySelector(".intel-stats") as HTMLElement;
      const statsEls = statsContainer.querySelectorAll(".stat-display");
      if (statsEls.length === 5) {
        StatDisplay.update(statsEls[0] as HTMLElement, e.speed);
        StatDisplay.update(statsEls[1] as HTMLElement, e.accuracy);
        StatDisplay.update(statsEls[2] as HTMLElement, e.damage);
        StatDisplay.update(statsEls[3] as HTMLElement, fireRateVal);
        StatDisplay.update(statsEls[4] as HTMLElement, e.attackRange);
      }
    });

    // Remove boxes for types that are no longer visible
    Array.from(intelDiv.querySelectorAll(".intel-box")).forEach((box) => {
      const type = (box as HTMLElement).dataset.type;
      if (type && !existingTypes.has(type)) {
        box.remove();
      }
    });
  }

  private renderGameOver(rightPanel: HTMLElement, state: GameState) {
    rightPanel.innerHTML = "";
    const summaryDiv = document.createElement("div");
    summaryDiv.className =
      "game-over-summary" + (state.status === "Won" ? "" : " lost");

    const title = document.createElement("h2");
    title.textContent =
      state.status === "Won" ? "Mission Accomplished" : "Squad Wiped";
    title.className = "game-over-title";
    summaryDiv.appendChild(title);

    // Objectives List
    const objectivesDiv = document.createElement("div");
    objectivesDiv.className = "game-over-objectives";
    objectivesDiv.innerHTML = `<h3 class="game-over-panel-title">Objectives</h3>${this.renderObjectivesList(state)}`;

    summaryDiv.appendChild(objectivesDiv);

    const stats = document.createElement("div");
    stats.className = "game-over-stats";
    stats.innerHTML = `
      <p><strong>Time Elapsed:</strong> ${(state.t / 1000).toFixed(1)}s</p>
      <p><strong>Xenos Neutralized:</strong> ${state.stats.aliensKilled}</p>
      <p><strong>Casualties:</strong> ${state.stats.casualties}</p>
    `;
    summaryDiv.appendChild(stats);

    const menuBtn = document.createElement("button");
    menuBtn.textContent = "Back to Menu";
    menuBtn.className = "game-over-btn";
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
        el.dataset.unitId = unit.id;
        listContainer.appendChild(el);
      }

      SoldierWidget.update(el, unit, {
        context: "tactical",
        selected: unit.id === selectedUnitId,
        onClick: (e: MouseEvent) => this.onUnitClick(unit, e.shiftKey),
      });
    });

    Array.from(listContainer.children).forEach((child) => {
      const id = (child as HTMLElement).dataset.unitId;
      if (id && !existingIds.has(id)) listContainer.removeChild(child);
    });
  }
}
