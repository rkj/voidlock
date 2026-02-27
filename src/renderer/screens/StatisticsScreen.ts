import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";

export class StatisticsScreen {
  private container: HTMLElement;

  constructor(
    containerId: string,
    private metaManager: MetaManager,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
    this.pushInputContext();
  }

  public hide() {
    this.container.style.display = "none";
    InputDispatcher.getInstance().popContext("statistics");
  }

  private pushInputContext() {
    InputDispatcher.getInstance().pushContext({
      id: "statistics",
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
    const stats = this.metaManager.getStats();

    this.container.innerHTML = "";
    this.container.className = "screen screen-centered flex-col align-center p-20 atmospheric-bg bg-station";
    this.container.style.display = "flex";
    this.container.style.overflowY = "hidden";

    // Grain effect
    const grain = document.createElement("div");
    grain.className = "grain";
    this.container.appendChild(grain);

    // Scanline effect
    const scanline = document.createElement("div");
    scanline.className = "scanline";
    this.container.appendChild(scanline);

    // Content Wrapper (to ensure it's above grain/scanline)
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "flex-col align-center w-full h-full relative";
    contentWrapper.style.zIndex = "10";
    this.container.appendChild(contentWrapper);

    const h1 = document.createElement("h1");
    h1.textContent = "Service Record";
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-primary)";
    h1.style.flexShrink = "0";
    h1.style.marginBottom = "20px";
    contentWrapper.appendChild(h1);

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "scroll-content w-full flex-col align-center";
    contentWrapper.appendChild(scrollContainer);

    const statsGrid = document.createElement("div");
    statsGrid.className = "flex-col gap-10 p-20";
    statsGrid.style.background = "var(--color-surface-elevated)";
    statsGrid.style.border = "1px solid var(--color-border-strong)";
    statsGrid.style.minWidth = "400px";
    scrollContainer.appendChild(statsGrid);

    const createStatRow = (
      label: string,
      value: string | number,
      color?: string,
    ) => {
      const row = document.createElement("div");
      row.className = "flex-row justify-between w-full gap-20";

      const labelSpan = document.createElement("span");
      labelSpan.textContent = label + ":";
      labelSpan.style.color = "var(--color-text-dim)";

      const valueSpan = document.createElement("span");
      valueSpan.textContent = value.toString();
      if (color) valueSpan.style.color = color;

      row.appendChild(labelSpan);
      row.appendChild(valueSpan);
      return row;
    };

    // Campaigns
    statsGrid.appendChild(this.createHeader("Campaigns"));
    statsGrid.appendChild(
      createStatRow("Total Started", stats.totalCampaignsStarted),
    );
    statsGrid.appendChild(
      createStatRow(
        "Expeditions Won",
        stats.campaignsWon,
        "var(--color-primary)",
      ),
    );
    statsGrid.appendChild(
      createStatRow(
        "Expeditions Lost",
        stats.campaignsLost,
        "var(--color-error)",
      ),
    );

    statsGrid.appendChild(document.createElement("br"));

    // Combat
    statsGrid.appendChild(this.createHeader("Combat"));
    statsGrid.appendChild(
      createStatRow(
        "Total Xeno Purged",
        stats.totalKills,
        "var(--color-warning)",
      ),
    );
    statsGrid.appendChild(
      createStatRow(
        "Total Casualties",
        stats.totalCasualties,
        "var(--color-error)",
      ),
    );
    statsGrid.appendChild(
      createStatRow("Missions Played", stats.totalMissionsPlayed),
    );
    statsGrid.appendChild(
      createStatRow(
        "Missions Won",
        stats.totalMissionsWon,
        "var(--color-primary)",
      ),
    );

    statsGrid.appendChild(document.createElement("br"));

    // Economy
    statsGrid.appendChild(this.createHeader("Economy"));
    statsGrid.appendChild(
      createStatRow(
        "Total Scrap Earned",
        stats.totalScrapEarned.toLocaleString(),
        "var(--color-primary)",
      ),
    );
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
