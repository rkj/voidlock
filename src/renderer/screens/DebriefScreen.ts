import { MissionReport, XP_THRESHOLDS, calculateLevel } from "../../shared/campaign_types";

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
    this.container.className = "screen debrief-screen flex-col align-center justify-center p-20";
    this.container.style.display = "flex";

    const isWon = this.report.result === "Won";

    // Header
    const header = document.createElement("h1");
    header.textContent = isWon ? "MISSION SUCCESS" : "MISSION FAILED";
    header.className = `debrief-header ${isWon ? "success" : "failed"}`;
    this.container.appendChild(header);

    const subHeader = document.createElement("div");
    subHeader.textContent = isWon
      ? "All objectives completed."
      : "Squad wiped or mission aborted.";
    subHeader.style.color = "var(--color-text-muted)";
    subHeader.style.marginBottom = "40px";
    subHeader.style.fontSize = "1.2em";
    this.container.appendChild(subHeader);

    // Main Content Grid
    const content = document.createElement("div");
    content.style.display = "grid";
    content.style.gridTemplateColumns = "1fr 1.5fr";
    content.style.gap = "30px";
    content.style.maxWidth = "1000px";
    content.style.width = "100%";
    this.container.appendChild(content);

    // Left Panel: Stats
    const statsPanel = this.createPanel("MISSION STATISTICS");
    statsPanel.innerHTML += `
      <div class="flex-row justify-between" style="margin-bottom: 15px; font-size: 1.1em;">
        <span>Xenos Neutralized:</span>
        <span style="color:var(--color-hive); font-weight:bold;">${this.report.aliensKilled}</span>
      </div>
      <div class="flex-row justify-between" style="margin-bottom: 15px; font-size: 1.1em;">
        <span>Operation Time:</span>
        <span style="color:var(--color-accent); font-weight:bold;">${(this.report.timeSpent / 60).toFixed(1)}s</span>
      </div>
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--color-border);">
        <div class="flex-row justify-between" style="margin-bottom: 10px;">
          <span style="font-size: 1.2em;">SCRAP RECOVERED:</span>
          <span style="color:var(--color-primary); font-weight:bold; font-size: 1.2em;">+${this.report.scrapGained}</span>
        </div>
        <div class="flex-row justify-between">
          <span style="font-size: 1.2em;">INTEL GATHERED:</span>
          <span style="color:var(--color-accent); font-weight:bold; font-size: 1.2em;">+${this.report.intelGained}</span>
        </div>
      </div>
    `;
    content.appendChild(statsPanel);

    // Right Panel: Squad
    const squadPanel = this.createPanel("SQUAD AFTER-ACTION REPORT");
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
            ${res.status.toUpperCase()}
          </span>
        </div>
        
        <div style="margin-top: 10px;">
          <div class="flex-row justify-between" style="font-size: 0.8em; color: var(--color-text-muted); margin-bottom: 4px;">
            <span>XP: ${res.xpBefore} (+${res.xpGained})</span>
            <span>${xpAfter} / ${nextLevelThreshold}</span>
          </div>
          <div style="height: 8px; background: #222; border: 1px solid #444; position: relative; overflow: hidden;">
            <div style="height: 100%; background: var(--color-primary); width: ${progressBefore}%; position: absolute; left: 0; top: 0; z-index: 2;"></div>
            <div style="height: 100%; background: var(--color-accent); width: ${progressAfter}%; position: absolute; left: 0; top: 0; z-index: 1;"></div>
          </div>
        </div>

        <div class="flex-row gap-20" style="margin-top: 10px; font-size: 0.9em; color: var(--color-text-muted);">
          <span>Kills: <span style="color:var(--color-text);">${res.kills}</span></span>
          ${res.promoted ? `<span style="color:var(--color-accent); font-weight:bold;">LEVEL UP! (LVL ${res.newLevel})</span>` : ""}
          ${res.status === "Wounded" && res.recoveryTime ? `<span style="color:var(--color-warning);">RECOVERY: ${res.recoveryTime} MISSIONS</span>` : ""}
        </div>
      `;
      squadPanel.appendChild(soldierRow);
    });
    content.appendChild(squadPanel);

    // Footer
    const footer = document.createElement("div");
    footer.style.marginTop = "50px";

    const continueBtn = document.createElement("button");
    continueBtn.textContent = "RETURN TO COMMAND BRIDGE";
    continueBtn.style.padding = "20px 60px";
    continueBtn.style.fontSize = "1.4em";
    continueBtn.style.letterSpacing = "2px";
    continueBtn.style.background = "rgba(0, 255, 0, 0.2)";
    continueBtn.style.borderColor = "var(--color-primary)";

    continueBtn.onclick = () => this.onContinue();
    footer.appendChild(continueBtn);

    this.container.appendChild(footer);
  }

  private createPanel(title: string): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "debrief-panel";

    const h2 = document.createElement("h2");
    h2.textContent = title;
    h2.className = "stat-label";
    h2.style.fontSize = "1.2em";
    h2.style.borderBottom = "1px solid var(--color-border)";
    h2.style.paddingBottom = "10px";
    h2.style.margin = "0 0 20px 0";
    panel.appendChild(h2);

    return panel;
  }
}
