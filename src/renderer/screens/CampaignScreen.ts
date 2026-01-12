import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { CampaignNode, CampaignState } from "@src/shared/campaign_types";

export class CampaignScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private onNodeSelect: (node: CampaignNode) => void;
  private onBarracks: () => void;
  private onBack: () => void;
  private onCampaignStart?: () => void;

  constructor(
    containerId: string,
    manager: CampaignManager,
    onNodeSelect: (node: CampaignNode) => void,
    onBarracks: () => void,
    onBack: () => void,
    onCampaignStart?: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.onNodeSelect = onNodeSelect;
    this.onBarracks = onBarracks;
    this.onBack = onBack;
    this.onCampaignStart = onCampaignStart;
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
  }

  public hide() {
    this.container.style.display = "none";
  }

  private render() {
    this.container.innerHTML = "";
    this.container.className =
      "screen campaign-screen flex-col relative h-full w-full";
    this.container.style.display = "flex";

    const state = this.manager.getState();
    if (!state) {
      this.renderNoCampaign();
      return;
    }

    if (state.status === "Victory") {
      this.renderVictory();
      return;
    }

    if (state.status === "Defeat") {
      this.renderDefeat();
      return;
    }

    // Header
    const header = document.createElement("div");
    header.className = "flex-row justify-between align-center p-20";
    header.style.borderBottom = "1px solid var(--color-border-strong)";
    header.style.background = "var(--color-surface-elevated)";

    const title = document.createElement("h1");
    title.textContent = "SECTOR MAP";
    title.style.margin = "0";
    title.style.fontSize = "1.5em";
    header.appendChild(title);

    const stats = document.createElement("div");
    stats.className = "flex-row gap-20";
    stats.innerHTML = `
      <span>SCRAP: <span style="color:var(--color-primary)">${state.scrap}</span></span>
      <span>INTEL: <span style="color:var(--color-accent)">${state.intel}</span></span>
      <span>SECTOR: <span style="color:var(--color-text)">${state.currentSector}</span></span>
    `;
    header.appendChild(stats);

    this.container.appendChild(header);

    // Map Viewport
    const viewport = document.createElement("div");
    viewport.className = "campaign-map-viewport";

    // Scanline effect
    const scanline = document.createElement("div");
    scanline.className = "scanline";
    viewport.appendChild(scanline);

    this.renderMap(viewport, state);
    this.container.appendChild(viewport);

    // Footer
    const footer = document.createElement("div");
    footer.className = "flex-row justify-between p-20";
    footer.style.borderTop = "1px solid var(--color-border-strong)";
    footer.style.background = "var(--color-surface-elevated)";

    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK TO MENU";
    backBtn.className = "back-button";
    backBtn.onclick = () => this.onBack();
    footer.appendChild(backBtn);

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "NEW CAMPAIGN";
    resetBtn.style.color = "var(--color-error)";
    resetBtn.onclick = () => {
      if (confirm("Are you sure you want to abandon the current campaign?")) {
        this.manager.reset();
        this.onBack();
      }
    };
    footer.appendChild(resetBtn);

    const barracksBtn = document.createElement("button");
    barracksBtn.textContent = "BARRACKS";
    barracksBtn.onclick = () => this.onBarracks();
    footer.appendChild(barracksBtn);

    this.container.appendChild(footer);
  }

  private renderNoCampaign() {
    const content = document.createElement("div");
    content.className =
      "flex-col align-center justify-center h-full gap-20 campaign-setup-wizard";
    content.style.maxWidth = "400px";
    content.style.margin = "0 auto";

    const h1 = document.createElement("h1");
    h1.textContent = "NEW CAMPAIGN";
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-primary)";
    content.appendChild(h1);

    const form = document.createElement("div");
    form.className = "flex-col gap-20 w-full p-20";
    form.style.background = "var(--color-surface-elevated)";
    form.style.border = "1px solid var(--color-border-strong)";
    form.style.minWidth = "800px";

    // Difficulty Cards
    const diffLabel = document.createElement("label");
    diffLabel.textContent = "SELECT DIFFICULTY";
    diffLabel.style.fontSize = "0.8em";
    diffLabel.style.color = "var(--color-text-dim)";
    diffLabel.style.marginBottom = "-10px";
    form.appendChild(diffLabel);

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "flex-row gap-10 w-full";
    cardsContainer.style.justifyContent = "space-between";

    let selectedDifficulty = "normal";

    const DIFFICULTIES = [
      {
        id: "easy",
        name: "SIMULATION",
        rules: ["Permadeath: OFF", "Save: Manual", "Pause: ALLOWED"],
      },
      {
        id: "normal",
        name: "CLONE",
        rules: ["Permadeath: PARTIAL (Cloneable)", "Save: Manual", "Pause: ALLOWED"],
      },
      {
        id: "hard",
        name: "STANDARD",
        rules: ["Permadeath: ON", "Save: Manual", "Pause: ALLOWED"],
      },
      {
        id: "extreme",
        name: "IRONMAN",
        rules: ["Permadeath: ON", "Save: Auto-Delete", "Pause: DISABLED"],
      },
    ];

    const cards: HTMLElement[] = [];

    // Tactical Pause (needed early for card click logic)
    const pauseGroup = document.createElement("div");
    pauseGroup.className = "flex-row align-center gap-10";
    const pauseCheck = document.createElement("input");
    pauseCheck.type = "checkbox";
    pauseCheck.id = "campaign-tactical-pause";
    pauseCheck.checked = true;
    const pauseLabel = document.createElement("label");
    pauseLabel.htmlFor = "campaign-tactical-pause";
    pauseLabel.textContent = "Allow Tactical Pause (0.05x)";
    pauseLabel.style.fontSize = "0.9em";
    pauseGroup.appendChild(pauseCheck);
    pauseGroup.appendChild(pauseLabel);

    DIFFICULTIES.forEach((diff) => {
      const card = document.createElement("div");
      card.className = "difficulty-card flex-col gap-10 p-15 flex-1";
      card.style.border = "1px solid var(--color-border-strong)";
      card.style.background = "rgba(255, 255, 255, 0.05)";
      card.style.cursor = "pointer";
      card.style.transition = "all 0.2s ease";

      const title = document.createElement("h3");
      title.textContent = diff.name;
      title.style.margin = "0";
      title.style.color = "var(--color-text)";
      card.appendChild(title);

      const rulesList = document.createElement("ul");
      rulesList.style.margin = "0";
      rulesList.style.paddingLeft = "15px";
      rulesList.style.fontSize = "0.8em";
      rulesList.style.color = "var(--color-text-dim)";
      diff.rules.forEach((rule) => {
        const li = document.createElement("li");
        li.textContent = rule;
        rulesList.appendChild(li);
      });
      card.appendChild(rulesList);

      if (diff.id === selectedDifficulty) {
        card.classList.add("selected");
        card.style.borderColor = "var(--color-primary)";
        card.style.background = "rgba(var(--color-primary-rgb), 0.1)";
        title.style.color = "var(--color-primary)";
      }

      card.onclick = () => {
        selectedDifficulty = diff.id;
        cards.forEach((c) => {
          c.classList.remove("selected");
          c.style.borderColor = "var(--color-border-strong)";
          c.style.background = "rgba(255, 255, 255, 0.05)";
          (c.querySelector("h3") as HTMLElement).style.color = "var(--color-text)";
        });
        card.classList.add("selected");
        card.style.borderColor = "var(--color-primary)";
        card.style.background = "rgba(var(--color-primary-rgb), 0.1)";
        title.style.color = "var(--color-primary)";

        // Ironman logic
        if (selectedDifficulty === "extreme") {
          pauseCheck.checked = false;
          pauseCheck.disabled = true;
          const tooltip = "Tactical Pause is disabled in Ironman mode.";
          pauseCheck.title = tooltip;
          pauseLabel.title = tooltip;
          pauseLabel.style.opacity = "0.5";
        } else {
          pauseCheck.disabled = false;
          pauseCheck.title = "";
          pauseLabel.title = "";
          pauseLabel.style.opacity = "1";
          if (
            selectedDifficulty === "easy" ||
            selectedDifficulty === "normal" ||
            selectedDifficulty === "hard"
          ) {
            pauseCheck.checked = true;
          }
        }
      };

      cards.push(card);
      cardsContainer.appendChild(card);
    });

    form.appendChild(cardsContainer);
    form.appendChild(pauseGroup);

    // Theme Selection
    const themeGroup = document.createElement("div");
    themeGroup.className = "flex-col gap-5";
    const themeLabel = document.createElement("label");
    themeLabel.textContent = "VISUAL THEME";
    themeLabel.style.fontSize = "0.8em";
    themeLabel.style.color = "var(--color-text-dim)";
    const themeSelect = document.createElement("select");
    themeSelect.id = "campaign-theme";
    themeSelect.innerHTML = `
      <option value="default" selected>DEFAULT (Voidlock Green)</option>
      <option value="industrial">INDUSTRIAL (Amber/Steel)</option>
      <option value="hive">ALIEN HIVE (Purple/Biolume)</option>
    `;
    themeGroup.appendChild(themeLabel);
    themeGroup.appendChild(themeSelect);
    form.appendChild(themeGroup);

    // Campaign Length Selection
    const lengthGroup = document.createElement("div");
    lengthGroup.className = "flex-col gap-5";
    const lengthLabel = document.createElement("label");
    lengthLabel.textContent = "CAMPAIGN LENGTH";
    lengthLabel.style.fontSize = "0.8em";
    lengthLabel.style.color = "var(--color-text-dim)";
    const lengthSelect = document.createElement("select");
    lengthSelect.id = "campaign-length";
    lengthSelect.innerHTML = `
      <option value="1.0" selected>STANDARD (Short, ~6-8 Missions)</option>
      <option value="0.5">EXTENDED (Long, ~12-16 Missions)</option>
    `;
    lengthGroup.appendChild(lengthLabel);
    lengthGroup.appendChild(lengthSelect);
    form.appendChild(lengthGroup);

    // Unit Style Selection
    const styleGroup = document.createElement("div");
    styleGroup.className = "flex-col gap-5";
    const styleLabel = document.createElement("label");
    styleLabel.textContent = "VISUAL STYLE";
    styleLabel.style.fontSize = "0.8em";
    styleLabel.style.color = "var(--color-text-dim)";
    const styleSelect = document.createElement("select");
    styleSelect.id = "campaign-unit-style";
    styleSelect.innerHTML = `
      <option value="Sprites" selected>SPRITES (Default)</option>
      <option value="TacticalIcons">TACTICAL ICONS</option>
    `;
    styleGroup.appendChild(styleLabel);
    styleGroup.appendChild(styleSelect);
    form.appendChild(styleGroup);

    // Advanced Options (Collapsible)
    const advancedWrapper = document.createElement("div");
    advancedWrapper.className = "flex-col gap-10";
    advancedWrapper.style.marginTop = "10px";
    advancedWrapper.style.paddingTop = "10px";
    advancedWrapper.style.borderTop = "1px solid var(--color-border)";

    const advancedToggle = document.createElement("button");
    advancedToggle.textContent = "SHOW ADVANCED SETTINGS ▼";
    advancedToggle.style.background = "none";
    advancedToggle.style.border = "none";
    advancedToggle.style.color = "var(--color-text-dim)";
    advancedToggle.style.fontSize = "0.8em";
    advancedToggle.style.cursor = "pointer";
    advancedToggle.style.textAlign = "left";
    advancedToggle.style.padding = "0";

    const advancedContent = document.createElement("div");
    advancedContent.className = "flex-col gap-15";
    advancedContent.style.display = "none";
    advancedContent.style.marginTop = "10px";

    advancedToggle.onclick = () => {
      const isHidden = advancedContent.style.display === "none";
      advancedContent.style.display = isHidden ? "flex" : "none";
      advancedToggle.textContent = isHidden
        ? "HIDE ADVANCED SETTINGS ▲"
        : "SHOW ADVANCED SETTINGS ▼";
    };

    // Custom Seed
    const seedGroup = document.createElement("div");
    seedGroup.className = "flex-col gap-5";
    const seedLabel = document.createElement("label");
    seedLabel.textContent = "CUSTOM SEED (Optional)";
    seedLabel.style.fontSize = "0.7em";
    seedLabel.style.color = "var(--color-text-dim)";
    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.placeholder = "Enter seed...";
    seedGroup.appendChild(seedLabel);
    seedGroup.appendChild(seedInput);
    advancedContent.appendChild(seedGroup);

    // Forced Map Generator
    const genGroup = document.createElement("div");
    genGroup.className = "flex-col gap-5";
    const genLabel = document.createElement("label");
    genLabel.textContent = "FORCE MAP GENERATOR";
    genLabel.style.fontSize = "0.7em";
    genLabel.style.color = "var(--color-text-dim)";
    const genSelect = document.createElement("select");
    genSelect.innerHTML = `
      <option value="">(Default for mission)</option>
      <option value="DenseShip">DENSE SHIP (>90% fill)</option>
      <option value="TreeShip">TREE SHIP (No Loops)</option>
      <option value="Procedural">SPACESHIP (Balanced)</option>
    `;
    genGroup.appendChild(genLabel);
    genGroup.appendChild(genSelect);
    advancedContent.appendChild(genGroup);

    // Scaling Slider
    const scalingGroup = document.createElement("div");
    scalingGroup.className = "flex-col gap-5";
    const scalingLabel = document.createElement("label");
    scalingLabel.innerHTML = `DIFFICULTY SCALING: <span id="scaling-val">100</span>%`;
    scalingLabel.style.fontSize = "0.7em";
    scalingLabel.style.color = "var(--color-text-dim)";
    const scalingSlider = document.createElement("input");
    scalingSlider.type = "range";
    scalingSlider.min = "50";
    scalingSlider.max = "200";
    scalingSlider.value = "100";
    scalingSlider.oninput = () => {
      document.getElementById("scaling-val")!.textContent = scalingSlider.value;
    };
    scalingGroup.appendChild(scalingLabel);
    scalingGroup.appendChild(scalingSlider);
    advancedContent.appendChild(scalingGroup);

    // Scarcity Slider
    const scarcityGroup = document.createElement("div");
    scarcityGroup.className = "flex-col gap-5";
    const scarcityLabel = document.createElement("label");
    scarcityLabel.innerHTML = `RESOURCE SCARCITY: <span id="scarcity-val">100</span>%`;
    scarcityLabel.style.fontSize = "0.7em";
    scarcityLabel.style.color = "var(--color-text-dim)";
    const scarcitySlider = document.createElement("input");
    scarcitySlider.type = "range";
    scarcitySlider.min = "50";
    scarcitySlider.max = "200";
    scarcitySlider.value = "100";
    scarcitySlider.oninput = () => {
      document.getElementById("scarcity-val")!.textContent = scarcitySlider.value;
    };
    scarcityGroup.appendChild(scarcityLabel);
    scarcityGroup.appendChild(scarcitySlider);
    advancedContent.appendChild(scarcityGroup);

    // Death Rule
    const deathGroup = document.createElement("div");
    deathGroup.className = "flex-col gap-5";
    const deathLabel = document.createElement("label");
    deathLabel.textContent = "DEATH RULE";
    deathLabel.style.fontSize = "0.7em";
    deathLabel.style.color = "var(--color-text-dim)";
    const deathSelect = document.createElement("select");
    deathSelect.innerHTML = `
      <option value="">(Preset Default)</option>
      <option value="Simulation">SIMULATION (No Death)</option>
      <option value="Clone">CLONE (Pay to revive)</option>
      <option value="Iron">IRON (Permanent)</option>
    `;
    deathGroup.appendChild(deathLabel);
    deathGroup.appendChild(deathSelect);
    advancedContent.appendChild(deathGroup);

    advancedWrapper.appendChild(advancedToggle);
    advancedWrapper.appendChild(advancedContent);
    form.appendChild(advancedWrapper);

    content.appendChild(form);

    const startBtn = document.createElement("button");
    startBtn.textContent = "INITIALIZE EXPEDITION";
    startBtn.className = "primary-button w-full";
    startBtn.onclick = () => {
      const overrides: any = {
        allowTacticalPause: pauseCheck.checked,
        themeId: themeSelect.value,
        unitStyle: styleSelect.value as any,
        mapGrowthRate: parseFloat(lengthSelect.value),
      };

      if (seedInput.value) overrides.customSeed = parseInt(seedInput.value);
      if (genSelect.value) overrides.mapGeneratorType = genSelect.value;
      if (scalingSlider.value !== "100")
        overrides.scaling = parseInt(scalingSlider.value) / 100;
      if (scarcitySlider.value !== "100")
        overrides.scarcity = 100 / parseInt(scarcitySlider.value); // Scarcity means less rewards, so higher scarcity = lower multiplier
      if (deathSelect.value) overrides.deathRule = deathSelect.value;

      this.manager.startNewCampaign(Date.now(), selectedDifficulty, overrides);
      if (this.onCampaignStart) this.onCampaignStart();
      this.render();
    };
    content.appendChild(startBtn);

    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK TO MENU";
    backBtn.className = "back-button w-full";
    backBtn.onclick = () => this.onBack();
    content.appendChild(backBtn);

    this.container.appendChild(content);
  }

  private renderMap(container: HTMLElement, state: CampaignState) {
    const nodes = state.nodes;
    // Canvas for connections
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);

    // Nodes
    nodes.forEach((node) => {
      const isCurrent = state.currentNodeId === node.id;
      const nodeEl = document.createElement("div");
      nodeEl.className = `campaign-node ${node.status.toLowerCase()}`;
      if (isCurrent) nodeEl.className += " current";
      nodeEl.dataset.id = node.id;
      nodeEl.style.position = "absolute";
      nodeEl.style.left = `${node.position.x + 100}px`;
      nodeEl.style.top = `${node.position.y + 100}px`;

      const statusText =
        node.status === "Revealed"
          ? "Locked"
          : node.status === "Skipped"
            ? "Skipped"
            : node.status;
      nodeEl.title = `${node.type} (${statusText}) - Difficulty: ${node.difficulty.toFixed(1)}`;

      if (node.status === "Accessible") {
        nodeEl.onclick = () => this.onNodeSelect(node);
      }

      // Icon/Text
      const icon = document.createElement("span");
      icon.style.fontSize = "1.2em";
      icon.style.filter = "drop-shadow(0 0 2px currentColor)";
      switch (node.type) {
        case "Combat":
          icon.textContent = "⚔️";
          break;
        case "Elite":
          icon.textContent = "💀";
          break;
        case "Shop":
          icon.textContent = "💰";
          break;
        case "Event":
          icon.textContent = "❓";
          break;
        case "Boss":
          icon.textContent = "👹";
          break;
      }
      nodeEl.appendChild(icon);

      // Current Indicator (Ship Icon)
      if (isCurrent) {
        const indicator = document.createElement("div");
        indicator.textContent = "▲";
        indicator.style.position = "absolute";
        indicator.style.top = "-20px";
        indicator.style.color = "var(--color-accent)";
        indicator.style.fontSize = "1.2em";
        indicator.style.textShadow = "0 0 5px var(--color-accent)";
        nodeEl.appendChild(indicator);
      }

      container.appendChild(nodeEl);
    });

    // Resize observer for canvas
    const ro = new ResizeObserver(() => {
      canvas.width = container.scrollWidth;
      canvas.height = container.scrollHeight;
      this.drawConnections(canvas, nodes);
    });
    ro.observe(container);
    // Initial call after a tick to ensure layout
    setTimeout(() => {
      canvas.width = container.scrollWidth;
      canvas.height = container.scrollHeight;
      this.drawConnections(canvas, nodes);
    }, 0);
  }

  private drawConnections(canvas: HTMLCanvasElement, nodes: CampaignNode[]) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    nodes.forEach((node) => {
      if (node.status === "Hidden") return;

      node.connections.forEach((connId) => {
        const target = nodes.find((n) => n.id === connId);
        if (target && target.status !== "Hidden") {
          ctx.beginPath();
          // Center of 44x44 node is +22. Added to 100 padding = 122.
          ctx.moveTo(node.position.x + 122, node.position.y + 122);
          ctx.lineTo(target.position.x + 122, target.position.y + 122);

          if (
            node.status === "Cleared" &&
            (target.status === "Accessible" || target.status === "Cleared")
          ) {
            ctx.strokeStyle = "var(--color-los-soldier)";
            ctx.setLineDash([]);
            ctx.lineWidth = 2;
          } else {
            ctx.strokeStyle = "var(--color-text-dim)";
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
          }

          ctx.stroke();
        }
      });
    });
  }

  private renderVictory() {
    const state = this.manager.getState();
    if (!state) return;

    const totalKills = state.history.reduce(
      (sum, report) => sum + report.aliensKilled,
      0,
    );
    const totalMissions = state.history.length;

    const content = document.createElement("div");
    content.className =
      "flex-col align-center justify-center h-full gap-40 campaign-victory-overlay";
    content.style.background = "rgba(0,20,0,0.9)";
    content.style.position = "absolute";
    content.style.inset = "0";
    content.style.zIndex = "100";
    content.style.border = "4px solid var(--color-primary)";

    const h1 = document.createElement("h1");
    h1.textContent = "SECTOR SECURED";
    h1.style.color = "var(--color-primary)";
    h1.style.fontSize = "4em";
    h1.style.letterSpacing = "10px";
    h1.style.margin = "0";
    h1.style.textShadow = "0 0 20px var(--color-primary)";
    content.appendChild(h1);

    const stats = document.createElement("div");
    stats.className = "flex-col align-center gap-10";
    stats.style.fontSize = "1.5em";
    stats.style.color = "var(--color-text)";
    stats.innerHTML = `
      <div>ALIENS KILLED: <span style="color:var(--color-primary)">${totalKills}</span></div>
      <div>MISSIONS: <span style="color:var(--color-primary)">${totalMissions}</span></div>
    `;
    content.appendChild(stats);

    const menuBtn = document.createElement("button");
    menuBtn.textContent = "RETURN TO MAIN MENU";
    menuBtn.className = "primary-button";
    menuBtn.style.minWidth = "300px";
    menuBtn.style.padding = "20px";
    menuBtn.onclick = () => {
      this.manager.deleteSave();
      this.onBack();
    };
    content.appendChild(menuBtn);

    this.container.appendChild(content);
  }

  private renderDefeat() {
    const state = this.manager.getState();
    if (!state) return;

    const content = document.createElement("div");
    content.className =
      "flex-col align-center justify-center h-full gap-40 campaign-game-over";
    content.style.background = "rgba(20,0,0,0.9)";
    content.style.position = "absolute";
    content.style.inset = "0";
    content.style.zIndex = "100";
    content.style.border = "4px solid var(--color-error)";

    const h1 = document.createElement("h1");
    h1.textContent = "MISSION FAILED";
    h1.style.color = "var(--color-error)";
    h1.style.fontSize = "4em";
    h1.style.letterSpacing = "8px";
    h1.style.margin = "0";
    h1.style.textShadow = "0 0 20px var(--color-error)";
    content.appendChild(h1);

    const sub = document.createElement("h2");
    sub.textContent = "SECTOR LOST";
    sub.style.color = "var(--color-text-dim)";
    sub.style.letterSpacing = "4px";
    sub.style.margin = "0";
    content.appendChild(sub);

    // Cause of death
    const cause = document.createElement("div");
    cause.style.fontSize = "1.2em";
    cause.style.color = "var(--color-text)";
    
    // Determine cause: Ironman mission loss or Bankruptcy
    const aliveCount = state.roster.filter(s => s.status !== "Dead").length;
    const canAffordRecruit = state.scrap >= 100;
    const isBankruptcy = aliveCount === 0 && !canAffordRecruit;
    
    cause.textContent = `CAUSE: ${isBankruptcy ? "BANKRUPTCY" : "SQUAD WIPED"}`;
    content.appendChild(cause);

    const abandonBtn = document.createElement("button");
    abandonBtn.textContent = "ABANDON CAMPAIGN";
    abandonBtn.className = "primary-button";
    abandonBtn.style.backgroundColor = "var(--color-error)";
    abandonBtn.style.minWidth = "300px";
    abandonBtn.style.padding = "20px";
    abandonBtn.onclick = () => {
      this.manager.deleteSave();
      this.onBack();
    };
    content.appendChild(abandonBtn);

    this.container.appendChild(content);
  }
}
