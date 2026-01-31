import {
  MissionReport,
} from "@src/shared/campaign_types";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";

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
      const soldierRow = SoldierWidget.render(res, { context: "debrief" });
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
