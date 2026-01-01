import { MissionReport } from "../../shared/campaign_types";

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

  private render() {
    if (!this.report) return;

    this.container.innerHTML = "";
    this.container.className = "screen debrief-screen";
    // Ensure it overlays correctly even if ScreenManager tries to manage it
    this.container.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
    this.container.style.color = "#eee";
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.left = "0";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.zIndex = "1000";
    this.container.style.display = "flex";
    this.container.style.flexDirection = "column";
    this.container.style.alignItems = "center";
    this.container.style.justifyContent = "center";
    this.container.style.padding = "40px";
    this.container.style.boxSizing = "border-box";
    this.container.style.backdropFilter = "blur(4px)";

    const isWon = this.report.result === "Won";

    // Header
    const header = document.createElement("h1");
    header.textContent = isWon ? "MISSION SUCCESS" : "MISSION FAILED";
    header.style.color = isWon ? "#0f0" : "#ff4444";
    header.style.fontSize = "4em";
    header.style.margin = "0 0 10px 0";
    header.style.textShadow = `0 0 20px ${isWon ? "rgba(0,255,0,0.5)" : "rgba(255,0,0,0.5)"}`;
    this.container.appendChild(header);

    const subHeader = document.createElement("div");
    subHeader.textContent = isWon ? "All objectives completed." : "Squad wiped or mission aborted.";
    subHeader.style.color = "#888";
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
      <div style="display:flex; justify-content:space-between; margin-bottom: 15px; font-size: 1.1em;">
        <span>Xenos Neutralized:</span>
        <span style="color:#f0f; font-weight:bold;">${this.report.aliensKilled}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom: 15px; font-size: 1.1em;">
        <span>Operation Time:</span>
        <span style="color:#0af; font-weight:bold;">${(this.report.timeSpent / 60).toFixed(1)}s</span>
      </div>
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
        <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
          <span style="font-size: 1.2em;">SCRAP RECOVERED:</span>
          <span style="color:#0f0; font-weight:bold; font-size: 1.2em;">+${this.report.scrapGained}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="font-size: 1.2em;">INTEL GATHERED:</span>
          <span style="color:#0af; font-weight:bold; font-size: 1.2em;">+${this.report.intelGained}</span>
        </div>
      </div>
    `;
    content.appendChild(statsPanel);

    // Right Panel: Squad
    const squadPanel = this.createPanel("SQUAD AFTER-ACTION REPORT");
    this.report.soldierResults.forEach(res => {
      const soldierRow = document.createElement("div");
      soldierRow.style.background = "rgba(0,0,0,0.3)";
      soldierRow.style.border = "1px solid #333";
      soldierRow.style.padding = "15px";
      soldierRow.style.marginBottom = "10px";
      soldierRow.style.display = "flex";
      soldierRow.style.flexDirection = "column";

      const statusColor = res.status === "Healthy" ? "#0f0" : res.status === "Wounded" ? "#ff0" : "#f00";

      soldierRow.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size: 1.2em; font-weight:bold;">${res.soldierId}</span>
          <span style="color:${statusColor}; font-weight:bold; border: 1px solid ${statusColor}; padding: 2px 8px; font-size: 0.8em; border-radius: 4px;">
            ${res.status.toUpperCase()}
          </span>
        </div>
        <div style="display:flex; gap: 20px; margin-top: 10px; font-size: 0.9em; color: #aaa;">
          <span>Kills: <span style="color:#eee;">${res.kills}</span></span>
          <span>XP Gained: <span style="color:#0f0;">+${res.xpGained}</span></span>
          ${res.promoted ? `<span style="color:#0af; font-weight:bold;">LEVEL UP! (LVL ${res.newLevel})</span>` : ""}
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
    continueBtn.style.background = "#040";
    continueBtn.style.borderColor = "#0f0";
    continueBtn.onclick = () => this.onContinue();
    footer.appendChild(continueBtn);
    
    this.container.appendChild(footer);
  }

  private createPanel(title: string): HTMLElement {
    const panel = document.createElement("div");
    panel.style.background = "rgba(25, 25, 25, 0.9)";
    panel.style.border = "1px solid #444";
    panel.style.padding = "25px";
    panel.style.display = "flex";
    panel.style.flexDirection = "column";

    const h2 = document.createElement("h2");
    h2.textContent = title;
    h2.style.margin = "0 0 20px 0";
    h2.style.fontSize = "1.2em";
    h2.style.color = "#aaa";
    h2.style.borderBottom = "1px solid #333";
    h2.style.paddingBottom = "10px";
    panel.appendChild(h2);

    return panel;
  }
}
