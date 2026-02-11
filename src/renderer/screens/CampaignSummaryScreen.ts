import { CampaignState, calculateLevel } from "@src/shared/campaign_types";
import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";

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
    this.pushInputContext();
  }

  public hide() {
    this.container.style.display = "none";
    InputDispatcher.getInstance().popContext("campaign-summary");
  }

  private pushInputContext() {
    InputDispatcher.getInstance().pushContext({
      id: "campaign-summary",
      priority: InputPriority.UI,
      trapsFocus: true,
      container: this.container,
      handleKeyDown: (e) => this.handleKeyDown(e),
      getShortcuts: () => [
        {
          key: "Arrows",
          label: "Navigate",
          description: "Move selection",
          category: "Navigation",
        },
        {
          key: "Enter",
          label: "Select",
          description: "Activate button",
          category: "Navigation",
        },
      ],
    });
  }

  private handleKeyDown(e: KeyboardEvent): boolean {
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      return UIUtils.handleArrowNavigation(e, this.container);
    }
    return false;
  }

  private render() {
    if (!this.state) return;

    const isVictory = this.state.status === "Victory";
    this.container.innerHTML = "";
    this.container.className = `screen campaign-summary-screen ${isVictory ? "campaign-victory-overlay" : "campaign-game-over"}`;

    // Scanline effect
    const scanline = document.createElement("div");
    scanline.className = "scanline";
    this.container.appendChild(scanline);

    // Header
    const header = document.createElement("h1");
    header.className = "summary-header";
    header.textContent = isVictory ? "Sector Secured" : "Mission Failed";
    this.container.appendChild(header);

    const subHeader = document.createElement("h2");
    subHeader.className = "summary-subheader";
    subHeader.textContent = isVictory ? "Victory" : "Sector Lost";
    this.container.appendChild(subHeader);

    // Main Content
    const content = document.createElement("div");
    content.className = "summary-content";
    this.container.appendChild(content);

    // Left: Stats
    const statsPanel = this.createPanel("Campaign Statistics");
    const totalKills = this.state.history.reduce(
      (sum, r) => sum + r.aliensKilled,
      0,
    );
    const totalMissions = this.state.history.length;
    const totalScrap = this.state.history.reduce(
      (sum, r) => sum + r.scrapGained,
      0,
    );

    statsPanel.innerHTML += `
      <div class="flex-col gap-20">
        <div class="summary-stat-row">
          <span>Aliens Killed:</span>
          <span style="color:var(--color-primary); font-weight:bold;">${totalKills}</span>
        </div>
        <div class="summary-stat-row">
          <span>Missions:</span>
          <span style="color:var(--color-accent); font-weight:bold;">${totalMissions}</span>
        </div>
        <div class="summary-stat-row">
          <span>Total Scrap:</span>
          <span style="color:var(--color-warning); font-weight:bold;">${totalScrap}</span>
        </div>
        ${
          !isVictory
            ? `
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border-strong);">
            <div style="color: var(--color-text-dim); font-size: 0.9em; letter-spacing: 1px;">
              Cause: <span style="color: var(--color-danger); font-weight: bold; letter-spacing: 2px;">${this.getCauseOfDeath()}</span>
            </div>
          </div>
        `
            : ""
        }
      </div>
    `;
    content.appendChild(statsPanel);

    // Right: Survivors (if Victory) or Roster Status
    const rosterPanel = this.createPanel(
      isVictory ? "Surviving Squad" : "Final Roster Status",
    );
    const rosterList = document.createElement("div");
    rosterList.className = "summary-roster-list";

    this.state.roster.forEach((s) => {
      const row = document.createElement("div");
      row.className = "summary-roster-item";

      const statusColor =
        s.status === "Healthy"
          ? "var(--color-primary)"
          : s.status === "Wounded"
            ? "var(--color-warning)"
            : "var(--color-danger)";

      row.innerHTML = `
        <div class="flex-col">
          <div style="font-weight:bold; letter-spacing: 1px;">${s.name}</div>
          <div style="font-size: 0.8em; color: var(--color-text-dim);">${s.archetypeId} - LVL ${calculateLevel(s.xp)}</div>
        </div>
        <div style="color: ${statusColor}; font-weight: bold; font-size: 0.9em; border: 1px solid ${statusColor}; padding: 2px 10px; border-radius: 2px;">
          ${s.status}
        </div>
      `;
      rosterList.appendChild(row);
    });
    rosterPanel.appendChild(rosterList);
    content.appendChild(rosterPanel);

    // Footer
    const footer = document.createElement("div");
    footer.className = "summary-footer";

    const btn = document.createElement("button");
    btn.textContent = isVictory ? "Retire to Main Menu" : "Abandon Expedition";
    btn.className = `summary-button ${isVictory ? "primary-button" : "danger-button"}`;

    btn.onclick = () => this.onMainMenu();
    footer.appendChild(btn);

    this.container.appendChild(footer);
  }

  private createPanel(title: string): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "summary-panel";

    const h3 = document.createElement("h3");
    h3.className = "summary-panel-title";
    h3.textContent = title;
    panel.appendChild(h3);

    return panel;
  }

  private getCauseOfDeath(): string {
    if (!this.state) return "Unknown";
    const aliveCount = this.state.roster.filter(
      (s) => s.status !== "Dead",
    ).length;
    const canAffordRecruit = this.state.scrap >= 100;

    if (aliveCount === 0 && !canAffordRecruit) return "Bankruptcy";
    return "Squad Wiped";
  }
}
