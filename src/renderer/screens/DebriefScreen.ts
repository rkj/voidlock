import { MissionReport, XP_THRESHOLDS, calculateLevel } from "@src/shared/campaign_types";

export class DebriefScreen {
  private container: HTMLElement;
  private onContinue: () => void;
  private report: MissionReport | null = null;

  constructor(containerId: string, onContinue: () => void) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.onContinue = onContinue;
  }

  public show(report: MissionReport) {
    this.report = report;
    this.container.style.display = "flex";
    this.render();
  }

  public hide() {
    this.container.style.display = "none";
  }

  public isVisible(): boolean {
    return this.container.style.display === "flex";
  }

  private render() {
    if (!this.report) return;

    this.container.innerHTML = "";
    this.container.className = "screen debrief-screen";
    this.container.style.display = "flex";

    const inner = document.createElement("div");
    inner.className = "debrief-inner";
    this.container.appendChild(inner);

    const isWon = this.report.result === "Won";

    // Header
    const header = document.createElement("h1");
    header.textContent = isWon ? "Mission Success" : "Mission Failed";
    header.className = `debrief-header ${isWon ? "success" : "failed"}`;
    inner.appendChild(header);

    const subHeader = document.createElement("div");
    subHeader.textContent = isWon
      ? "All objectives completed."
      : "Squad wiped or mission aborted.";
    subHeader.className = "debrief-subheader";
    inner.appendChild(subHeader);

    // Main Content Grid
    const content = document.createElement("div");
    content.className = "debrief-content";
    inner.appendChild(content);

    // Left Panel: Stats
    const statsPanel = this.createPanel("Mission Statistics");
    statsPanel.innerHTML += `
      <div class="debrief-stat-row">
        <span>Xenos Neutralized:</span>
        <span style="color:var(--color-hive); font-weight:bold;">${this.report.aliensKilled}</span>
      </div>
      <div class="debrief-stat-row">
        <span>Operation Time:</span>
        <span style="color:var(--color-accent); font-weight:bold;">${(this.report.timeSpent / 60).toFixed(1)}s</span>
      </div>
      <div class="debrief-resource-section">
        <div class="debrief-resource-row">
          <span>Scrap Recovered:</span>
          <span style="color:var(--color-primary); font-weight:bold;">+${this.report.scrapGained}</span>
        </div>
        <div class="debrief-resource-row">
          <span>Intel Gathered:</span>
          <span style="color:var(--color-accent); font-weight:bold;">+${this.report.intelGained}</span>
        </div>
      </div>
    `;
    content.appendChild(statsPanel);

    // Right Panel: Squad
    const squadPanel = this.createPanel("Squad After-Action Report");
    this.report.soldierResults.forEach((res) => {
      const soldierRow = document.createElement("div");
      soldierRow.className = "debrief-item";

      const statusColor =
        res.status === "Healthy"
          ? "var(--color-primary)"
          : res.status === "Wounded"
            ? "var(--color-warning)"
            : "var(--color-danger)";

      const currentLevel = calculateLevel(res.xpBefore);
      const nextLevelThreshold = XP_THRESHOLDS[currentLevel] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
      const prevLevelThreshold = XP_THRESHOLDS[currentLevel - 1];
      
      const xpInCurrentLevel = res.xpBefore - prevLevelThreshold;
      const xpNeededForNext = nextLevelThreshold - prevLevelThreshold;
      const xpAfter = res.xpBefore + res.xpGained;
      const xpInCurrentLevelAfter = Math.min(xpAfter, nextLevelThreshold) - prevLevelThreshold;

      const progressBefore = (xpInCurrentLevel / xpNeededForNext) * 100;
      const progressAfter = (xpInCurrentLevelAfter / xpNeededForNext) * 100;

      soldierRow.innerHTML = `
        <div class="flex-row justify-between align-center">
          <span style="font-size: 1.2em; font-weight:bold;">${res.soldierId} <span style="font-size: 0.7em; color: var(--color-text-muted); font-weight: normal;">LVL ${currentLevel}</span></span>
          <span style="color:${statusColor}; font-weight:bold; border: 1px solid ${statusColor}; padding: 2px 8px; font-size: 0.8em; border-radius: 4px;">
            ${res.status}
          </span>
        </div>
        
        <div class="debrief-xp-container">
          <div class="flex-row justify-between" style="font-size: 0.8em; color: var(--color-text-muted); margin-bottom: 4px;">
            <span>XP: ${res.xpBefore} (+${res.xpGained})</span>
            <span>${xpAfter} / ${nextLevelThreshold}</span>
          </div>
          <div class="debrief-xp-bar">
            <div class="debrief-xp-fill-before" style="width: ${progressBefore}%;"></div>
            <div class="debrief-xp-fill-after" style="width: ${progressAfter}%;"></div>
          </div>
        </div>

        <div class="flex-row gap-20" style="margin-top: 10px; font-size: 0.9em; color: var(--color-text-muted);">
          <span>Kills: <span style="color:var(--color-text);">${res.kills}</span></span>
          ${res.promoted ? `<span style="color:var(--color-accent); font-weight:bold;">Level Up! (LVL ${res.newLevel})</span>` : ""}
          ${res.status === "Wounded" && res.recoveryTime ? `<span style="color:var(--color-warning);">Recovery: ${res.recoveryTime} Missions</span>` : ""}
        </div>
      `;
      squadPanel.appendChild(soldierRow);
    });
    content.appendChild(squadPanel);

    // Footer
    const footer = document.createElement("div");
    footer.className = "debrief-footer";

    const continueBtn = document.createElement("button");
    continueBtn.textContent = "Return to Command Bridge";
    continueBtn.className = "debrief-button";

    continueBtn.onclick = () => this.onContinue();
    footer.appendChild(continueBtn);

    inner.appendChild(footer);
  }

  private createPanel(title: string): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "debrief-panel";

    const h2 = document.createElement("h2");
    h2.textContent = title;
    h2.className = "stat-label debrief-panel-title";
    panel.appendChild(h2);

    return panel;
  }
}
