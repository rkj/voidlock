import { MetaManager } from "@src/renderer/campaign/MetaManager";

export class StatisticsScreen {
  private container: HTMLElement;
  private onBack: () => void;

  constructor(containerId: string, onBack: () => void) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.onBack = onBack;
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
  }

  public hide() {
    this.container.style.display = "none";
  }

  private render() {
    const stats = MetaManager.getInstance().getStats();

    this.container.innerHTML = "";
    this.container.className = "screen screen-centered flex-col gap-20";
    this.container.style.display = "flex";
    
    const h1 = document.createElement("h1");
    h1.textContent = "SERVICE RECORD";
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-primary)";
    this.container.appendChild(h1);

    const statsGrid = document.createElement("div");
    statsGrid.className = "flex-col gap-10 p-20";
    statsGrid.style.background = "var(--color-surface-elevated)";
    statsGrid.style.border = "1px solid var(--color-border-strong)";
    statsGrid.style.minWidth = "400px";

    const createStatRow = (label: string, value: string | number, color?: string) => {
      const row = document.createElement("div");
      row.className = "flex-row justify-between w-full gap-20";
      
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;
      labelSpan.style.color = "var(--color-text-dim)";
      
      const valueSpan = document.createElement("span");
      valueSpan.textContent = value.toString();
      if (color) valueSpan.style.color = color;
      
      row.appendChild(labelSpan);
      row.appendChild(valueSpan);
      return row;
    };

    // Campaigns
    statsGrid.appendChild(this.createHeader("CAMPAIGNS"));
    statsGrid.appendChild(createStatRow("Total Started", stats.totalCampaignsStarted));
    statsGrid.appendChild(createStatRow("Campaigns Won", stats.campaignsWon, "var(--color-primary)"));
    statsGrid.appendChild(createStatRow("Campaigns Lost", stats.campaignsLost, "var(--color-error)"));
    
    statsGrid.appendChild(document.createElement("br"));

    // Combat
    statsGrid.appendChild(this.createHeader("COMBAT"));
    statsGrid.appendChild(createStatRow("Total Xeno Kills", stats.totalKills, "var(--color-warning)"));
    statsGrid.appendChild(createStatRow("Total Casualties", stats.totalCasualties, "var(--color-error)"));
    statsGrid.appendChild(createStatRow("Missions Played", stats.totalMissionsPlayed));
    statsGrid.appendChild(createStatRow("Missions Won", stats.totalMissionsWon, "var(--color-primary)"));

    statsGrid.appendChild(document.createElement("br"));

    // Economy
    statsGrid.appendChild(this.createHeader("ECONOMY"));
    statsGrid.appendChild(createStatRow("Total Scrap Earned", stats.totalScrapEarned.toLocaleString(), "var(--color-primary)"));

    this.container.appendChild(statsGrid);

    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK TO MENU";
    backBtn.className = "back-button w-full";
    backBtn.onclick = () => this.onBack();
    this.container.appendChild(backBtn);
  }

  private createHeader(text: string) {
    const header = document.createElement("div");
    header.textContent = text;
    header.style.fontSize = "0.8em";
    header.style.color = "var(--color-accent)";
    header.style.borderBottom = "1px solid var(--color-border)";
    header.style.marginBottom = "5px";
    header.style.paddingBottom = "2px";
    header.style.marginTop = "5px";
    return header;
  }
}
