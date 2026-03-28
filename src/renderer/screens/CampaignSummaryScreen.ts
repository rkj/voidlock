import type { CampaignState} from "@src/shared/campaign_types";
import { calculateLevel } from "@src/shared/campaign_types";
import type { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";
import { t } from "../i18n";
import { I18nKeys } from "../i18n/keys";

export class CampaignSummaryScreen {
  private container: HTMLElement;
  private inputDispatcher: InputDispatcher;
  private onMainMenu: () => void;
  private state: CampaignState | null = null;

  constructor(containerId: string, inputDispatcher: InputDispatcher, onMainMenu: () => void) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.inputDispatcher = inputDispatcher;
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
    this.inputDispatcher.popContext("campaign-summary");
  }

  private pushInputContext() {
    this.inputDispatcher.pushContext({
      id: "campaign-summary",
      priority: InputPriority.UI,
      trapsFocus: true,
      container: this.container,
      handleKeyDown: (e) => this.handleKeyDown(e),
      getShortcuts: () => [
        {
          key: "Arrows",
          label: t(I18nKeys.common.shortcuts.navigate),
          description: t(I18nKeys.common.shortcuts.move_selection),
          category: "Navigation",
        },
        {
          key: "Enter",
          label: t(I18nKeys.common.shortcuts.select),
          description: t(I18nKeys.common.shortcuts.activate_button),
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
    this.container.className = `screen campaign-summary-screen flex-col h-full ${isVictory ? "campaign-victory-overlay" : "campaign-game-over"}`;
    this.container.style.display = "flex";
    this.container.style.overflow = "hidden";

    // Scanline effect
    const scanline = document.createElement("div");
    scanline.className = "scanline";
    this.container.appendChild(scanline);

    // Header container
    const headerContainer = document.createElement("div");
    headerContainer.className = "flex-col align-center p-20";
    headerContainer.style.flexShrink = "0";

    const header = document.createElement("h1");
    header.className = "summary-header";
    header.style.margin = "0";
    header.textContent = isVictory ? t(I18nKeys.screen.summary.contract_success) : t(I18nKeys.screen.summary.contract_terminated);
    headerContainer.appendChild(header);

    const subHeader = document.createElement("h2");
    subHeader.className = "summary-subheader";
    subHeader.style.margin = "0";
    subHeader.textContent = isVictory ? t(I18nKeys.screen.summary.victory_confirmed) : t(I18nKeys.screen.summary.operational_failure);
    headerContainer.appendChild(subHeader);
    
    this.container.appendChild(headerContainer);

    // Scrollable Content
    const scrollContent = document.createElement("div");
    scrollContent.className = "scroll-content flex-col align-center w-full p-20";
    
    const content = document.createElement("div");
    content.className = "summary-content";
    scrollContent.appendChild(content);

    // Left: Stats
    const statsPanel = this.createPanel(t(I18nKeys.screen.summary.operational_statistics));
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
          <span>${t(I18nKeys.screen.summary.biologicals_neutralized)}</span>
          <span style="color:var(--color-primary); font-weight:bold;">${totalKills}</span>
        </div>
        <div class="summary-stat-row">
          <span>${t(I18nKeys.screen.summary.operations_finalized)}</span>
          <span style="color:var(--color-accent); font-weight:bold;">${totalMissions}</span>
        </div>
        <div class="summary-stat-row">
          <span>${t(I18nKeys.screen.summary.total_credits_recovered)}</span>
          <span style="color:var(--color-warning); font-weight:bold;">${totalScrap}</span>
        </div>
        ${
          !isVictory
            ? `
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border-strong);">
            <div style="color: var(--color-text-dim); font-size: 0.9em; letter-spacing: 1px;">
              ${t(I18nKeys.screen.summary.cause)} <span style="color: var(--color-danger); font-weight: bold; letter-spacing: 2px;">${this.getCauseOfDeath()}</span>
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
      isVictory ? t(I18nKeys.screen.summary.retrieved_assets) : t(I18nKeys.screen.summary.termination_roster),
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

      const statusDisplay = s.status === "Healthy" ? t(I18nKeys.screen.summary.status_functional) : (s.status === "Wounded" ? t(I18nKeys.screen.summary.status_damaged) : t(I18nKeys.screen.summary.status_integrity_failure));

      row.innerHTML = `
        <div class="flex-col">
          <div style="font-weight:bold; letter-spacing: 1px;">${s.name}</div>
          <div style="font-size: 0.8em; color: var(--color-text-dim);">${t("units.archetype." + s.archetypeId)} - Lvl ${calculateLevel(s.xp)}</div>
        </div>
        <div style="color: ${statusColor}; font-weight: bold; font-size: 0.9em; border: 1px solid ${statusColor}; padding: 2px 10px; border-radius: 2px;">
          ${statusDisplay}
        </div>
      `;
      rosterList.appendChild(row);
    });
    rosterPanel.appendChild(rosterList);
    content.appendChild(rosterPanel);

    this.container.appendChild(scrollContent);

    // Footer
    const footer = document.createElement("div");
    footer.className = "summary-footer flex-row justify-center p-20 w-full";
    footer.style.flexShrink = "0";
    footer.style.borderTop = "1px solid var(--color-border-strong)";
    footer.style.backgroundColor = "rgba(0,0,0,0.5)";
    footer.style.marginTop = "0"; // Override CSS margin-top

    const btn = document.createElement("button");
    btn.textContent = isVictory ? t(I18nKeys.screen.summary.retire_main_menu) : t(I18nKeys.screen.summary.abandon_expedition);
    btn.className = `summary-button ${isVictory ? "primary-button" : "danger-button"}`;
    btn.style.margin = "0";

    btn.addEventListener("click", () => this.onMainMenu());
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
    if (!this.state) return t(I18nKeys.screen.summary.cause_unknown);
    const aliveCount = this.state.roster.filter(
      (s) => s.status !== "Dead",
    ).length;
    const canAffordRecruit = this.state.scrap >= 100;

    if (aliveCount === 0 && !canAffordRecruit) return t(I18nKeys.screen.summary.cause_bankruptcy);
    return t(I18nKeys.screen.summary.cause_squad_wiped);
  }
}
