import { CampaignState, calculateLevel } from "@src/shared/campaign_types";

export class CampaignSummaryScreen {
  private container: HTMLElement;
  private onMainMenu: () => void;
  private state: CampaignState | null = null;

  constructor(containerId: string, onMainMenu: () => void) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.onMainMenu = onMainMenu;
  }

  public show(state: CampaignState) {
    this.state = state;
    this.container.style.display = "flex";
    this.render();
  }

  public hide() {
    this.container.style.display = "none";
  }

  private render() {
    if (!this.state) return;

    const isVictory = this.state.status === "Victory";
    this.container.innerHTML = "";
    this.container.className = `screen campaign-summary-screen flex-col align-center justify-center p-40 ${isVictory ? "campaign-victory-overlay" : "campaign-game-over"}`;
    this.container.style.display = "flex";
    this.container.style.position = "absolute";
    this.container.style.inset = "0";
    this.container.style.zIndex = "1100";

    this.container.style.background = isVictory ? "rgba(0, 20, 0, 0.95)" : "rgba(20, 0, 0, 0.95)";
    this.container.style.border = `8px solid ${isVictory ? "var(--color-primary)" : "var(--color-error)"}`;

    // Header
    const header = document.createElement("h1");
    header.textContent = isVictory ? "Sector Secured" : "Mission Failed";
    header.style.fontSize = "5em";
    header.style.letterSpacing = "12px";
    header.style.margin = "0 0 10px 0";
    header.style.color = isVictory ? "var(--color-primary)" : "var(--color-error)";
    header.style.textShadow = `0 0 30px ${isVictory ? "var(--color-primary)" : "var(--color-error)"}`;
    this.container.appendChild(header);

    const subHeader = document.createElement("h2");
    subHeader.textContent = isVictory ? "Victory" : "Sector Lost";
    subHeader.style.fontSize = "2em";
    subHeader.style.letterSpacing = "4px";
    subHeader.style.margin = "0 0 40px 0";
    subHeader.style.color = "var(--color-text-dim)";
    this.container.appendChild(subHeader);

    // Main Content
    const content = document.createElement("div");
    content.className = "flex-row gap-40 w-full";
    content.style.maxWidth = "1200px";
    content.style.justifyContent = "center";
    this.container.appendChild(content);

    // Left: Stats
    const statsPanel = this.createPanel("Campaign Statistics");
    const totalKills = this.state.history.reduce((sum, r) => sum + r.aliensKilled, 0);
    const totalMissions = this.state.history.length;
    const totalScrap = this.state.history.reduce((sum, r) => sum + r.scrapGained, 0);

    statsPanel.innerHTML += `
      <div class="flex-col gap-20" style="font-size: 1.5em;">
        <div class="flex-row justify-between">
          <span>Aliens Killed: <span style="color:var(--color-primary); font-weight:bold;">${totalKills}</span></span>
        </div>
        <div class="flex-row justify-between">
          <span>Missions: <span style="color:var(--color-accent); font-weight:bold;">${totalMissions}</span></span>
        </div>
        <div class="flex-row justify-between">
          <span>Total Scrap Earned: <span style="color:var(--color-warning); font-weight:bold;">${totalScrap}</span></span>
        </div>
        ${!isVictory ? `
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border-strong);">
            <div style="color: var(--color-text-dim); font-size: 0.7em;">Cause: <span style="color: var(--color-error); font-weight: bold; letter-spacing: 2px;">${this.getCauseOfDeath()}</span></div>
          </div>
        ` : ""}
      </div>
    `;
    content.appendChild(statsPanel);

    // Right: Survivors (if Victory) or Roster Status
    const rosterPanel = this.createPanel(isVictory ? "Surviving Squad" : "Final Roster Status");
    const rosterList = document.createElement("div");
    rosterList.className = "flex-col gap-10";
    
    this.state.roster.forEach(s => {
      const row = document.createElement("div");
      row.style.padding = "10px";
      row.style.background = "rgba(255,255,255,0.05)";
      row.style.border = "1px solid var(--color-border)";
      row.className = "flex-row justify-between align-center";
      
      const statusColor = s.status === "Healthy" ? "var(--color-primary)" : s.status === "Wounded" ? "var(--color-warning)" : "var(--color-error)";
      
      row.innerHTML = `
        <div class="flex-col">
          <div style="font-weight:bold;">${s.name}</div>
          <div style="font-size: 0.8em; color: var(--color-text-dim);">${s.archetypeId} - LVL ${calculateLevel(s.xp)}</div>
        </div>
        <div style="color: ${statusColor}; font-weight: bold; font-size: 0.9em; border: 1px solid ${statusColor}; padding: 2px 8px; border-radius: 4px;">
          ${s.status}
        </div>
      `;
      rosterList.appendChild(row);
    });
    rosterPanel.appendChild(rosterList);
    content.appendChild(rosterPanel);

    // Footer
    const footer = document.createElement("div");
    footer.style.marginTop = "60px";

    const btn = document.createElement("button");
    btn.textContent = isVictory ? "Retire to Main Menu" : "Abandon Expedition";
    btn.className = "primary-button";
    btn.style.padding = "25px 80px";
    btn.style.fontSize = "1.8em";
    btn.style.letterSpacing = "4px";
    if (!isVictory) btn.style.backgroundColor = "var(--color-error)";

    btn.onclick = () => this.onMainMenu();
    footer.appendChild(btn);

    this.container.appendChild(footer);
  }

  private createPanel(title: string): HTMLElement {
    const panel = document.createElement("div");
    panel.style.flex = "1";
    panel.style.background = "rgba(255,255,255,0.02)";
    panel.style.padding = "30px";
    panel.style.border = "1px solid var(--color-border-strong)";

    const h3 = document.createElement("h3");
    h3.textContent = title;
    h3.style.margin = "0 0 20px 0";
    h3.style.fontSize = "1.2em";
    h3.style.color = "var(--color-text-dim)";
    h3.style.borderBottom = "1px solid var(--color-border)";
    h3.style.paddingBottom = "10px";
    panel.appendChild(h3);

    return panel;
  }

  private getCauseOfDeath(): string {
    if (!this.state) return "Unknown";
    const aliveCount = this.state.roster.filter(s => s.status !== "Dead").length;
    const canAffordRecruit = this.state.scrap >= 100;
    
    if (aliveCount === 0 && !canAffordRecruit) return "Bankruptcy";
    return "Squad Wiped";
  }
}
