import { GameState, UnitState, Unit, MissionType } from "@src/shared/types";
import { MenuController } from "@src/renderer/MenuController";
import { MenuRenderer } from "@src/renderer/ui/MenuRenderer";
import { Icons } from "@src/renderer/Icons";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { UIBinder } from "@src/renderer/ui/UIBinder";
import { HUDTopBar, HUDSoldierPanel, HUDRightPanel, HUDMobileActionPanel } from "@src/renderer/ui/HUD";

import { FocusManager } from "@src/renderer/utils/FocusManager";

export class HUDManager {
  private lastMenuHtml = "";
  private currentState: GameState | null = null;
  private binder: UIBinder;
  private selectedUnitId: string | null = null;

  constructor(
    private menuController: MenuController,
    private onUnitClick: (unit: Unit, shiftHeld?: boolean) => void,
    private onAbortMission: () => void,
    private onMenuInput: (key: string, shiftHeld?: boolean) => void,
    private onSetTimeScale: (scale: number) => void,
    private onCopyWorldState: () => void,
    private onForceWin: () => void,
    private onForceLose: () => void,
    private onStartMission: () => void,
    private onDeployUnit: (unitId: string, x: number, y: number) => void,
  ) {
    this.binder = new UIBinder();
    this.setupTransformers();
    this.initializeHUD();
  }

  private initializeHUD() {
    const missionScreen = document.getElementById("screen-mission");
    if (!missionScreen) return;

    const missionBody = document.getElementById("mission-body");
    if (!missionBody) return;

    const topBar = document.getElementById("top-bar");
    const soldierPanel = document.getElementById("soldier-panel");
    const rightPanel = document.getElementById("right-panel");
    const mobileActionPanel = document.getElementById("mobile-action-panel");

    if (topBar) topBar.remove();
    if (soldierPanel) soldierPanel.remove();
    if (rightPanel) rightPanel.remove();
    if (mobileActionPanel) mobileActionPanel.remove();

    missionScreen.insertBefore(HUDTopBar() as Node, missionBody);
    missionScreen.insertBefore(HUDSoldierPanel() as Node, missionBody);
    missionBody.appendChild(HUDRightPanel() as Node);
    missionScreen.appendChild(HUDMobileActionPanel() as Node);

    // Initial scan
    this.binder.initialize(document.body);

    // Speed Slider listener
    const handleSliderInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      // Skip if this input event was triggered by UIBinder programmatic sync
      if (target.getAttribute("data-is-binding") === "true") return;

      const val = parseInt(target.value);
      // slider 0 maps to 0.1x (Active Pause) if allowed, but here we want to unpause if user moves it
      const scale = TimeUtility.sliderToScale(val);
      
      // If we are currently paused and user moved slider away from 0, 
      // or if they just clicked the slider, we want to unpause.
      // GameApp.onTimeScaleChange calls gameClient.setTimeScale which handles unpausing if scale > 0.
      this.onSetTimeScale(scale);
    };

    document.getElementById("game-speed")?.addEventListener("input", handleSliderInput);
  }

  private setupTransformers() {
    this.binder.registerTransformer("toSeconds", (val) => ((val as number) / 1000).toFixed(1));
    this.binder.registerTransformer("threatPercent", (val) => `${Math.floor(val as number)}%`);
    
    const getThreatClass = (val: number) => {
      if (val > 70) return "threat-danger";
      if (val > 30) return "threat-warning";
      return "threat-success";
    };

    this.binder.registerTransformer("threatFillClass", (val) => `threat-fill ${getThreatClass(val as number)}`);
    this.binder.registerTransformer("threatValueClass", (val) => `threat-value ${getThreatClass(val as number)}`);

    this.binder.registerTransformer("threatVisibility", (_, state) => {
      const isDeployment = state.status === "Deployment";
      const isPrologue = state.missionType === "Prologue";
      const threatLevel = state.stats.threatLevel || 0;
      const aliensKilled = state.stats.aliensKilled || 0;
      const hasContact = threatLevel > 1 || aliensKilled > 0;
      return !isDeployment && (!isPrologue || hasContact);
    });

    this.binder.registerTransformer("speedVisibility", (_, state) => {
      const isDeployment = state.status === "Deployment";
      const isPrologue = state.missionType === "Prologue";
      return !isDeployment && !isPrologue;
    });

    this.binder.registerTransformer("pauseText", (isPaused) => (isPaused as boolean) ? "▶ Play" : "|| Pause");

    this.binder.registerTransformer("minSpeedValue", (allowTacticalPause) => (allowTacticalPause as boolean) ? "0" : "50");

    this.binder.registerTransformer("speedSlider", (targetTimeScale) => {
      // Optimization: Don't fight the user while they are dragging
      const active = document.activeElement as HTMLInputElement;
      if (active && (active.id === "game-speed" || active.classList.contains("mobile-speed-slider"))) {
        return active.value;
      }

      // Map current target scale to slider value
      return Math.round(TimeUtility.scaleToSlider(targetTimeScale as number)).toString();
    });

    this.binder.registerTransformer("speedText", (settings) => {
      const s = settings as { isPaused: boolean; allowTacticalPause: boolean; timeScale: number; targetTimeScale: number };
      const displayScale = s.isPaused ? (s.allowTacticalPause ? 0.1 : 0) : s.timeScale;
      return TimeUtility.formatSpeed(displayScale, s.isPaused);
    });
  }

  public update(state: GameState, selectedUnitId: string | null) {
    this.currentState = state;
    this.selectedUnitId = selectedUnitId;
    
    const activeBefore = document.activeElement;
    FocusManager.saveFocus();
    
    // Auto-discover new elements if needed (e.g. fragments swapped in)
    if (!this.binder.hasBindings()) {
      this.binder.initialize(document.body);
    }

    this.binder.sync(state);
    this.updateTopBar(state);
    this.updateRightPanel(state);
    this.updateSoldierList(state, selectedUnitId);
    
    // Only restore if focus was actually lost to body during the update
    if (activeBefore !== document.body && document.activeElement === document.body) {
        FocusManager.restoreFocus(document.body);
    }
  }

  private updateTopBar(state: GameState) {
    const topThreatFill = document.getElementById("top-threat-fill");
    if (topThreatFill) {
      const isInitial = state.t < 1000;
      if (isInitial) {
        topThreatFill.classList.add("no-transition");
        void topThreatFill.offsetWidth;
        topThreatFill.classList.remove("no-transition");
      }
    }
  }

  private updateRightPanel(state: GameState) {
    const rightPanel = document.getElementById("right-panel");
    const mobileActionPanel = document.getElementById("mobile-action-panel");
    if (!rightPanel) return;

    const isMobile = window.innerWidth < 768;
    const actionContainer = isMobile && mobileActionPanel ? mobileActionPanel : rightPanel;
    const secondaryContainer = isMobile && mobileActionPanel ? rightPanel : null;

    if (state.status === "Deployment") {
      if (secondaryContainer) secondaryContainer.innerHTML = "";
      this.updateDeployment(actionContainer, state);
      return;
    }

    if (state.status !== "Playing") {
      if (actionContainer.querySelector(".game-over-summary")) return;
      if (secondaryContainer) secondaryContainer.innerHTML = "";
      this.renderGameOver(actionContainer, state);
      return;
    }

    if (secondaryContainer) {
      if (!secondaryContainer.querySelector(".objectives-status")) {
        secondaryContainer.innerHTML = "";
      }
    }

    const deploymentDiv = actionContainer.querySelector(".deployment-summary");
    if (deploymentDiv) {
      actionContainer.innerHTML = "";
      this.lastMenuHtml = "";
    }

    if (actionContainer.querySelector(".game-over-summary")) {
      actionContainer.innerHTML = "";
      this.lastMenuHtml = "";
    }

    let controlsDiv = actionContainer.querySelector(".mission-controls") as HTMLElement;
    if (!controlsDiv) {
      controlsDiv = document.createElement("div");
      controlsDiv.className = "mission-controls mobile-only";
      controlsDiv.innerHTML = `
        <h3 class="game-over-panel-title">Mission Controls</h3>
        <div class="control-group" style="border:none; padding-top:0; display: flex; flex-direction: column; gap: 10px;">
          <label style="margin-top:0;">Game Speed: <span class="mobile-speed-value" data-bind-text="settings" data-bind-transform="speedText">1.0x</span></label>
          <input type="range" class="mobile-speed-slider" min="0" max="100" step="1" value="50" data-bind-value="settings.targetTimeScale" data-bind-transform="speedSlider" data-bind-min="settings.allowTacticalPause|minSpeedValue">
          <button class="mobile-abort-button back-button" style="width: 100%; margin: 10px 0 0 0;">Abort Mission</button>
        </div>
      `;
      const slider = controlsDiv.querySelector(".mobile-speed-slider") as HTMLInputElement;
      slider.addEventListener("input", (e) => {
        const val = parseInt((e.target as HTMLInputElement).value);
        const scale = TimeUtility.sliderToScale(val);
        this.onSetTimeScale(scale);
      });

      const abortBtn = controlsDiv.querySelector(".mobile-abort-button") as HTMLButtonElement;
      if (abortBtn) {
        abortBtn.addEventListener("click", () => this.onAbortMission());
      }

      actionContainer.appendChild(controlsDiv);
      // Scan the new container
      this.binder.initialize(actionContainer);
    }

    let menuDiv = actionContainer.querySelector(".command-menu") as HTMLElement;
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
      actionContainer.appendChild(menuDiv);
      this.lastMenuHtml = "";
    }

    const menuRenderState = this.menuController.getRenderableState(state);
    const menuHtml = MenuRenderer.renderMenu(menuRenderState);

    if (menuHtml !== this.lastMenuHtml) {
      menuDiv.innerHTML = menuHtml;
      this.lastMenuHtml = menuHtml;
    }

    const objectivesContainer = secondaryContainer || actionContainer;
    let objectivesDiv = objectivesContainer.querySelector(".objectives-status") as HTMLElement;
    if (!objectivesDiv) {
      objectivesDiv = document.createElement("div");
      objectivesDiv.className = "objectives-status";
      objectivesDiv.innerHTML = "<h3>Objectives</h3><div class='obj-list'></div>";
      objectivesContainer.appendChild(objectivesDiv);
    }
    this.updateObjectives(state, objectivesDiv.querySelector(".obj-list") as HTMLElement);

    // Debug Buttons (Always in Right Panel/Drawer)
    const debugContainer = secondaryContainer || actionContainer;
    let debugDiv = debugContainer.querySelector(".debug-controls") as HTMLElement;
    if (state.settings.debugOverlayEnabled) {
      if (!debugDiv) {
        debugDiv = document.createElement("div");
        debugDiv.className = "debug-controls";
        debugContainer.appendChild(debugDiv);
      }
      const generatorName = state.map?.generatorName || "Unknown";
      const genDisplay = generatorName.endsWith("Generator")
        ? generatorName
        : `${generatorName}Generator`;

      const debugKey = `${state.seed}-${state.map?.width}x${state.map?.height}-${state.missionType}`;
      if (debugDiv.dataset.renderedKey !== debugKey) {
        debugDiv.dataset.renderedKey = debugKey;
        debugDiv.innerHTML = `
          <h3>Debug Tools</h3>
          <div class="debug-info-grid">
            <span><strong>Map:</strong> ${genDisplay} (${state.seed})</span>
            <span><strong>Size:</strong> ${state.map ? `${state.map.width}x${state.map.height}` : "Unknown"}</span>
            <span><strong>Mission:</strong> ${state.missionType}</span>
          </div>
          <div class="debug-actions-row">
            <button id="btn-force-win" class="debug-btn-win">Force Win</button>
            <button id="btn-force-lose" class="debug-btn-lose">Force Lose</button>
          </div>
          <button id="btn-copy-world-state" class="debug-btn-copy">Copy World State</button>
        `;
        document.getElementById("btn-copy-world-state")?.addEventListener("click", () => this.onCopyWorldState());
        document.getElementById("btn-force-win")?.addEventListener("click", () => this.onForceWin());
        document.getElementById("btn-force-lose")?.addEventListener("click", () => this.onForceLose());
      }
    } else if (debugDiv) {
      debugDiv.remove();
    }

    this.updateEnemyIntel(state, secondaryContainer || actionContainer);
  }

  private lastDeploymentHash = "";

  private updateDeployment(container: HTMLElement, state: GameState) {
    let deploymentDiv = container.querySelector(".deployment-summary") as HTMLElement;

    if (!deploymentDiv) {
      container.innerHTML = "";
      deploymentDiv = document.createElement("div");
      deploymentDiv.className = "deployment-summary";

      const title = document.createElement("h2");
      title.textContent = "Deployment Phase";
      title.className = "deployment-title";
      deploymentDiv.appendChild(title);

      const desc = document.createElement("p");
      desc.textContent = "Tactically place your squad members on highlighted tiles. Drag units to move them.";
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
        const s = this.currentState;
        if (!s) return;
        const soldiers = s.units.filter((u) => u.archetypeId !== "vip");
        const allSpawns = s.map.squadSpawns || (s.map.squadSpawn ? [s.map.squadSpawn] : []);
        if (allSpawns.length === 0) return;
        soldiers.forEach((u, idx) => {
           const spawn = allSpawns[idx % allSpawns.length];
           this.onDeployUnit(u.id, spawn.x + 0.5, spawn.y + 0.5);
        });
      });

      const startBtn = document.createElement("button");
      startBtn.id = "btn-start-mission";
      startBtn.dataset.focusId = "btn-start-mission";
      startBtn.textContent = "Start Mission";
      startBtn.className = "primary-button";
      startBtn.style.width = "100%";
      startBtn.style.marginBottom = "20px";
      startBtn.addEventListener("click", () => this.onStartMission());

      deploymentDiv.appendChild(autoFillBtn);
      deploymentDiv.appendChild(startBtn);
      container.appendChild(deploymentDiv);

      // Explicitly focus the first action button when entering deployment phase
      // to ensure keyboard navigation starts from a known state (Spec 8.3)
      autoFillBtn.focus();
    }

    // Mission Controls (Speed Slider for mobile) during deployment
    let controlsDiv = container.querySelector(".mission-controls") as HTMLElement;
    if (!controlsDiv) {
      controlsDiv = document.createElement("div");
      controlsDiv.className = "mission-controls mobile-only";
      controlsDiv.innerHTML = `
        <h3 class="game-over-panel-title">Mission Controls</h3>
        <div class="control-group" style="border:none; padding-top:0; display: flex; flex-direction: column; gap: 10px;">
          <label style="margin-top:0;">Game Speed: <span class="mobile-speed-value" data-bind-text="settings" data-bind-transform="speedText">1.0x</span></label>
          <input type="range" class="mobile-speed-slider" min="0" max="100" step="1" value="50" data-bind-value="settings.targetTimeScale" data-bind-transform="speedSlider" data-bind-min="settings.allowTacticalPause|minSpeedValue">
          <button class="mobile-abort-button back-button" style="width: 100%; margin: 10px 0 0 0;">Abort Mission</button>
        </div>
      `;
      const slider = controlsDiv.querySelector(".mobile-speed-slider") as HTMLInputElement;
      slider.addEventListener("input", (e) => {
        const val = parseInt((e.target as HTMLInputElement).value);
        const scale = TimeUtility.sliderToScale(val);
        this.onSetTimeScale(scale);
      });

      const abortBtn = controlsDiv.querySelector(".mobile-abort-button") as HTMLButtonElement;
      if (abortBtn) {
        abortBtn.addEventListener("click", () => this.onAbortMission());
      }

      container.insertBefore(controlsDiv, deploymentDiv);
      this.binder.initialize(container);
    }

    const units = state.units.filter((u) => u.archetypeId !== "vip");
    const currentHash = units.map(u => `${u.id}:${u.isDeployed}`).join("|") + `:${this.selectedUnitId}`;
    
    const squadList = deploymentDiv.querySelector(".deployment-squad-list") as HTMLElement;
    if (squadList && currentHash !== this.lastDeploymentHash) {
      this.lastDeploymentHash = currentHash;
      const existingIds = new Set(units.map(u => u.id));

      units.forEach((u) => {
        let item = squadList.querySelector(`[data-unit-id="${u.id}"]`) as HTMLButtonElement;
        if (!item) {
          // Use BUTTON instead of DIV for better Tab navigation stability
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
          onClick: () => this.onUnitClick(u),
          onDoubleClick: () => {
            if (!isPlaced) {
              const s = this.currentState;
              if (!s) return;
              const spawn = this.findNextEmptySpawn(s);
              if (spawn) this.onDeployUnit(u.id, spawn.x + 0.5, spawn.y + 0.5);
            }
          },
        });

        // Forced class and ID re-application (ensuring correct classes for E2E)
        item.id = `keyboard-id-${u.id}`;
        // CRITICAL: We MUST not use setAttribute("class") here as it overwrites classes added by SoldierWidget.update (like "dead")
        const baseClasses = ["deployment-unit-item", "clickable", "soldier-widget", "soldier-item", "soldier-widget-roster", "menu-item", "keyboard-tab-target"];
        baseClasses.forEach(cls => item.classList.add(cls));
        
        if (u.id === this.selectedUnitId) item.classList.add("selected", "active");

        const statusSpan = item.querySelector(".roster-item-details span:last-child") as HTMLElement;
        if (statusSpan) {
          statusSpan.textContent = isPlaced ? "Deployed" : "Pending";
          statusSpan.style.color = isPlaced ? "var(--color-success)" : "var(--color-warning)";
        }
      });

      // Cleanup removed units
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
        return state.map?.squadSpawns?.some((s) => MathUtils.sameCellPosition(s, cell)) ||
               (state.map?.squadSpawn && MathUtils.sameCellPosition(state.map.squadSpawn, cell));
      });
      startBtn.disabled = !allDeployed || !allOnValidTiles;
      startBtn.classList.toggle("disabled", startBtn.disabled);
    }
  }

  private getObjectivesData(state: GameState) {
    const showCoords = state.settings.debugOverlayEnabled;
    const data: any[] = [];
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
        text: `Extraction (${extractedCount}/${totalUnits})${locStr}`,
        state: isCompleted ? "Completed" : "Pending",
      });
    }
    return data;
  }

  private updateObjectives(state: GameState, container: HTMLElement) {
    const data = this.getObjectivesData(state);
    container.innerHTML = data.map((d) => `
      <p class="obj-row" data-obj-id="${d.id}">
        <span class="obj-icon" style="color:${d.color};" title="${d.state}">${d.icon}</span>
        <span class="obj-text">${d.text}</span>
      </p>
    `).join("");
  }

  private renderObjectivesList(state: GameState): string {
    const data = this.getObjectivesData(state);
    return data.map((d) => `
      <p class="obj-row">
        <span class="obj-icon" style="color:${d.color};" title="${d.state}">${d.icon}</span>
        ${d.text}
      </p>
    `).join("");
  }

  private updateEnemyIntel(state: GameState, rightPanel: HTMLElement) {
    let intelDiv = rightPanel.querySelector(".enemy-intel") as HTMLElement;
    if (!intelDiv) {
      intelDiv = document.createElement("div");
      intelDiv.className = "enemy-intel";
      rightPanel.appendChild(intelDiv);
    }
    const visibleEnemies = state.enemies.filter((e) => state.visibleCells.includes(MathUtils.cellKey(e.pos)));
    if (visibleEnemies.length === 0) {
      intelDiv.innerHTML = "<h3>Enemy Intel</h3><p class='intel-empty'>No Hostiles Detected.</p>";
      return;
    }
    const groups: { [type: string]: number } = {};
    visibleEnemies.forEach((e) => { groups[e.type] = (groups[e.type] || 0) + 1; });
    const types = Object.keys(groups).sort();
    intelDiv.innerHTML = "<h3>Enemy Intel</h3>" + types.map(type => {
      const e = visibleEnemies.find(en => en.type === type)!;
      const fireRateVal = e.fireRate > 0 ? (1000 / e.fireRate).toFixed(1) : "0";
      return `
        <div class="intel-box" data-type="${type}">
          <div class="intel-header"><strong class="intel-title">${type} x${groups[type]}</strong></div>
          <div class="intel-stats">
            ${StatDisplay.render(Icons.Speed, e.speed, "Speed")}
            ${StatDisplay.render(Icons.Accuracy, e.accuracy, "Accuracy")}
            ${StatDisplay.render(Icons.Damage, e.damage, "Damage")}
            ${StatDisplay.render(Icons.Rate, fireRateVal, "Rate of Fire (Shots/sec)")}
            ${StatDisplay.render(Icons.Range, e.attackRange, "Range")}
          </div>
        </div>
      `;
    }).join("");
  }

  private renderGameOver(rightPanel: HTMLElement, state: GameState) {
    rightPanel.innerHTML = "";
    const summaryDiv = document.createElement("div");
    summaryDiv.className = "game-over-summary" + (state.status === "Won" ? "" : " lost");
    summaryDiv.innerHTML = `
      <h2 class="game-over-title">${state.status === "Won" ? "Mission Accomplished" : "Squad Wiped"}</h2>
      <div class="game-over-objectives"><h3 class="game-over-panel-title">Objectives</h3>${this.renderObjectivesList(state)}</div>
      <div class="game-over-stats">
        <p><strong>Time:</strong> ${(state.t / 1000).toFixed(1)}s</p>
        <p><strong>Kills:</strong> ${state.stats.aliensKilled}</p>
        <p><strong>Casualties:</strong> ${state.stats.casualties}</p>
      </div>
      <button class="game-over-btn">Back to Menu</button>
    `;
    summaryDiv.querySelector(".game-over-btn")?.addEventListener("click", () => this.onAbortMission());
    rightPanel.appendChild(summaryDiv);
  }

  private updateSoldierList(state: GameState, selectedUnitId: string | null) {
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
        onClick: (e: Event) => this.onUnitClick(unit, (e as MouseEvent).shiftKey),
      });
    });
    Array.from(listContainer.children).forEach((child) => {
      const id = (child as HTMLElement).dataset.unitId;
      if (id && !existingIds.has(id)) listContainer.removeChild(child);
    });
  }

  private findNextEmptySpawn(state: GameState): { x: number; y: number } | null {
    const spawns = state.map?.squadSpawns || (state.map?.squadSpawn ? [state.map.squadSpawn] : []);
    for (const spawn of spawns) {
      if (!state.units.some(u => u.isDeployed !== false && MathUtils.sameCellPosition(u.pos, spawn))) return spawn;
    }
    return spawns.length > 0 ? spawns[0] : null;
  }
}
