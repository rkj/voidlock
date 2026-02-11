import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { ArchetypeLibrary, InputPriority } from "@src/shared/types";
import { SoldierInspector } from "@src/renderer/ui/SoldierInspector";
import { ModalService } from "@src/renderer/ui/ModalService";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";
import { InputDispatcher } from "../InputDispatcher";
import { UIUtils } from "../utils/UIUtils";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";

export class BarracksScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private modalService: ModalService;
  private selectedSoldierId: string | null = null;
  private inspector: SoldierInspector;
  private activeTab: "Recruitment" | "Armory" = "Recruitment";
  private onUpdate?: () => void;
  private onBack?: () => void;

  constructor(
    containerId: string,
    manager: CampaignManager,
    modalService: ModalService,
    onBack?: () => void,
    onUpdate?: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.modalService = modalService;
    this.onBack = onBack;
    this.onUpdate = onUpdate;
    this.inspector = new SoldierInspector({
      manager: this.manager,
      onUpdate: () => {
        this.render();
        if (this.onUpdate) this.onUpdate();
      },
    });
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
    this.pushInputContext();
  }

  public hide() {
    this.container.style.display = "none";
    InputDispatcher.getInstance().popContext("barracks");
  }

  private pushInputContext() {
    InputDispatcher.getInstance().pushContext({
      id: "barracks",
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
        {
          key: "ESC",
          label: "Back",
          description: "Return to sector map",
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
    if (e.key === "Escape") {
      if (this.onBack) {
        this.onBack();
        return true;
      }
    }
    return false;
  }

  private render() {
    const state = this.manager.getState();
    if (!state) return;

    this.container.innerHTML = "";
    this.container.className = "screen barracks-screen flex-col h-full";
    this.container.style.display = "flex";
    this.container.style.overflow = "hidden";

    // Main Content Wrapper (Flex Row for panels)
    const contentWrapper = document.createElement("div");
    contentWrapper.className =
      "flex-row flex-grow p-20 gap-20 barracks-main-content";
    contentWrapper.style.overflow = "hidden";
    contentWrapper.style.minHeight = "0"; // Crucial for nested flex scrolling

    // Left: Roster List
    const leftPanel = this.createPanel("Roster", "300px");
    leftPanel.style.overflowY = "auto";
    this.renderRoster(leftPanel);

    // Center: Soldier Details & Equipment
    const centerPanel = this.createPanel("Soldier Details", "1fr");
    centerPanel.style.overflowY = "auto";
    const centerBody = document.createElement("div");
    centerPanel.appendChild(centerBody);
    this.renderSoldierDetails(centerBody);

    // Right: Recruitment & Store
    const rightPanel = this.createPanel("", "400px");
    rightPanel.style.overflowY = "auto";
    this.renderRightSidebar(rightPanel);

    contentWrapper.appendChild(leftPanel);
    contentWrapper.appendChild(centerPanel);
    contentWrapper.appendChild(rightPanel);
    this.container.appendChild(contentWrapper);

    // Footer spacing (to match EquipmentScreen layout)
    const footer = document.createElement("div");
    footer.className = "flex-row justify-end p-10 gap-10";
    footer.style.flexShrink = "0";
    footer.style.borderTop = "1px solid var(--color-border-strong)";
    footer.style.backgroundColor = "var(--color-bg)";

    if (this.onBack) {
      const backBtn = document.createElement("button");
      backBtn.textContent = "Back to Sector Map";
      backBtn.className = "back-button";
      backBtn.style.marginTop = "0";
      backBtn.onclick = () => this.onBack?.();
      footer.appendChild(backBtn);
    }

    this.container.appendChild(footer);
  }

  private createPanel(title: string, width: string): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.style.width = width === "1fr" ? "auto" : width;
    if (width === "1fr") panel.style.flexGrow = "1";

    if (title) {
      const h2 = document.createElement("h2");
      h2.className = "panel-title";
      h2.textContent = title;
      panel.appendChild(h2);
    }

    return panel;
  }

  private renderRoster(panel: HTMLElement) {
    const state = this.manager.getState();
    if (!state) return;

    state.roster.forEach((soldier) => {
      const item = SoldierWidget.render(soldier, {
        context: "roster",
        selected: this.selectedSoldierId === soldier.id,
        onClick: () => {
          this.selectedSoldierId = soldier.id;
          this.render();
        },
      });
      panel.appendChild(item);
    });

    if (state.roster.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No soldiers in roster.";
      empty.style.color = "var(--color-text-dim)";
      empty.style.textAlign = "center";
      empty.style.marginTop = "20px";
      panel.appendChild(empty);
    }
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case "Healthy":
        return "var(--color-primary)";
      case "Wounded":
        return "var(--color-hive)";
      case "Dead":
        return "var(--color-danger)";
      default:
        return "var(--color-text)";
    }
  }

  private renderSoldierDetails(panel: HTMLElement) {
    const state = this.manager.getState();
    if (!state) return;

    const soldier = state.roster.find((s) => s.id === this.selectedSoldierId);
    if (!soldier) {
      this.inspector.setSoldier(null);
      this.inspector.renderDetails(panel);
      return;
    }

    // Soldier Header
    const header = document.createElement("div");
    header.className = "flex-row justify-between align-center w-full";
    header.style.marginBottom = "10px";

    const nameInfo = document.createElement("div");
    nameInfo.className = "flex-row align-center gap-10";
    const archName =
      ArchetypeLibrary[soldier.archetypeId]?.name ||
      soldier.archetypeId ||
      "Unknown";
    nameInfo.innerHTML = `
      <div class="flex-col">
        <h3 style="margin:0; font-size:1.5em; color:var(--color-accent);">${soldier.name}</h3>
        <div style="color:var(--color-text-muted);">${archName} Rank ${soldier.level}</div>
      </div>
    `;

    const renameBtn = document.createElement("button");
    renameBtn.innerHTML = "✎"; // Pencil icon
    renameBtn.title = "Rename Soldier";
    renameBtn.style.padding = "4px 8px";
    renameBtn.style.fontSize = "1.2em";
    renameBtn.style.marginTop = "0";
    renameBtn.onclick = async () => {
      const newName = await this.modalService.prompt(
        "Enter new name for this soldier:",
        soldier.name,
        "Rename Soldier",
      );
      if (newName && newName.trim() !== "" && newName !== soldier.name) {
        this.manager.renameSoldier(soldier.id, newName.trim());
        this.render();
        if (this.onUpdate) this.onUpdate();
      }
    };
    nameInfo.appendChild(renameBtn);

    header.appendChild(nameInfo);

    const statusBadge = document.createElement("div");
    statusBadge.className = "status-badge";
    statusBadge.textContent = soldier.status;
    statusBadge.style.background = this.getStatusColor(soldier.status);
    header.appendChild(statusBadge);

    panel.appendChild(header);

    // Actions (Heal / Revive)
    const actions = document.createElement("div");
    actions.className = "flex-row gap-10 p-10";
    actions.style.marginBottom = "10px";
    actions.style.background = "var(--color-surface)";
    actions.style.border = "1px solid var(--color-border)";
    actions.style.justifyContent = "center";

    if (soldier.status === "Wounded") {
      const healBtn = document.createElement("button");
      healBtn.textContent = "Heal (50 Scrap)";
      healBtn.disabled = state.scrap < 50;
      healBtn.onclick = () => {
        this.manager.healSoldier(soldier.id);
        this.render();
        if (this.onUpdate) this.onUpdate();
      };
      actions.appendChild(healBtn);
    } else if (soldier.status === "Dead" && state.rules.deathRule === "Clone") {
      const reviveBtn = document.createElement("button");
      reviveBtn.textContent = "Revive (250 Scrap)";
      reviveBtn.disabled = state.scrap < 250;
      reviveBtn.onclick = () => {
        this.manager.reviveSoldier(soldier.id);
        this.render();
        if (this.onUpdate) this.onUpdate();
      };
      actions.appendChild(reviveBtn);
    } else if (soldier.status === "Dead") {
      const deadText = document.createElement("div");
      deadText.textContent = "Deceased - Cannot be recovered";
      deadText.style.color = "var(--color-danger)";
      deadText.style.fontWeight = "bold";
      actions.appendChild(deadText);
    } else {
      const healthyText = document.createElement("div");
      healthyText.textContent = "Soldier is fit for combat";
      healthyText.style.color = "var(--color-primary)";
      actions.appendChild(healthyText);
    }
    panel.appendChild(actions);

    this.inspector.setSoldier(soldier);
    const inspectorBody = document.createElement("div");
    panel.appendChild(inspectorBody);
    this.inspector.renderDetails(inspectorBody);
  }

  private renderRightSidebar(panel: HTMLElement) {
    const state = this.manager.getState();
    if (!state) return;

    // Tabs
    const tabs = document.createElement("div");
    tabs.className = "flex-row gap-5";
    tabs.style.marginBottom = "15px";

    const recruitTab = document.createElement("button");
    recruitTab.textContent = "Recruitment";
    recruitTab.className = this.activeTab === "Recruitment" ? "active" : "";
    recruitTab.style.flex = "1";
    recruitTab.style.marginTop = "0";
    recruitTab.onclick = () => {
      this.activeTab = "Recruitment";
      this.render();
    };

    const armoryTab = document.createElement("button");
    armoryTab.textContent = "Armory";
    armoryTab.className = this.activeTab === "Armory" ? "active" : "";
    armoryTab.style.flex = "1";
    armoryTab.style.marginTop = "0";
    armoryTab.onclick = () => {
      this.activeTab = "Armory";
      this.render();
    };

    tabs.appendChild(recruitTab);
    tabs.appendChild(armoryTab);
    panel.appendChild(tabs);

    const body = document.createElement("div");
    panel.appendChild(body);

    if (this.activeTab === "Recruitment") {
      this.renderRecruitment(body);
    } else {
      const soldier = state.roster.find((s) => s.id === this.selectedSoldierId);
      if (soldier) {
        this.inspector.setSoldier(soldier);
        this.inspector.renderArmory(body);
      } else {
        const placeholder = document.createElement("div");
        placeholder.style.textAlign = "center";
        placeholder.style.color = "var(--color-text-dim)";
        placeholder.style.marginTop = "40px";
        placeholder.textContent = "Select a soldier to access Armory";
        body.appendChild(placeholder);
      }
    }
  }

  private renderRecruitment(panel: HTMLElement) {
    const state = this.manager.getState();
    if (!state) return;

    const isFull = state.roster.length >= CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE;

    if (isFull) {
      const msg = document.createElement("div");
      msg.textContent = `Roster is full (max ${CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE} soldiers).`;
      msg.style.color = "var(--color-hive)";
      msg.style.textAlign = "center";
      msg.style.padding = "20px";
      msg.style.fontWeight = "bold";
      panel.appendChild(msg);
    }

    const archetypes = state.unlockedArchetypes;

    archetypes.forEach((archId) => {
      const arch = ArchetypeLibrary[archId];
      if (!arch) return;

      const card = SoldierWidget.render(arch, {
        context: "squad-builder",
        price: "100 Scrap",
      });

      const recruitBtn = document.createElement("button");
      recruitBtn.textContent = "Recruit";
      recruitBtn.className = "w-full";
      recruitBtn.style.padding = "5px";
      recruitBtn.style.fontSize = "0.8em";
      recruitBtn.disabled = state.scrap < 100 || isFull;
      recruitBtn.onclick = () => {
        try {
          this.manager.recruitSoldier(archId);
          this.render();
          if (this.onUpdate) this.onUpdate();
        } catch (err: any) {
          this.modalService.alert(err.message);
        }
      };
      card.appendChild(recruitBtn);

      panel.appendChild(card);
    });
  }
}
