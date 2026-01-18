import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { CampaignSoldier } from "@src/shared/campaign_types";
import {
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary,
  Item,
  Weapon,
  EquipmentState,
} from "@src/shared/types";
import { Icons } from "@src/renderer/Icons";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";
import { SoldierInspector } from "@src/renderer/ui/SoldierInspector";

export class BarracksScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private selectedSoldierId: string | null = null;
  private onBack: () => void;
  private inspector: SoldierInspector;
  private activeTab: "Recruitment" | "Armory" = "Recruitment";

  constructor(
    containerId: string,
    manager: CampaignManager,
    onBack: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.onBack = onBack;
    this.inspector = new SoldierInspector({
      manager: this.manager,
      onUpdate: () => this.render(),
    });
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
  }

  public hide() {
    this.container.style.display = "none";
  }

  private render() {
    const state = this.manager.getState();
    if (!state) return;

    this.container.innerHTML = "";
    this.container.className = "screen barracks-screen flex-row p-20 gap-20 relative";
    this.container.style.display = "flex";
    this.container.style.overflow = "hidden";

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

    this.container.appendChild(leftPanel);
    this.container.appendChild(centerPanel);
    this.container.appendChild(rightPanel);

    // Header Stats (Floating)
    const statsOverlay = document.createElement("div");
    statsOverlay.className = "overlay-stats";
    statsOverlay.innerHTML = `
      <span style="margin-right:20px;">Scrap: <span style="color:var(--color-primary)">${state.scrap}</span></span>
      <span>Intel: <span style="color:var(--color-accent)">${state.intel}</span></span>
    `;
    this.container.appendChild(statsOverlay);

    // Footer Buttons
    const footer = document.createElement("div");
    footer.className = "screen-footer";

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back to Sector Map";
    backBtn.className = "back-button";
    backBtn.onclick = () => this.onBack();

    footer.appendChild(backBtn);
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
      const item = document.createElement("div");
      item.className = `menu-item clickable ${this.selectedSoldierId === soldier.id ? "active" : ""}`;
      item.style.marginBottom = "10px";
      item.style.padding = "10px";
      item.style.borderLeft = "4px solid transparent";

      if (soldier.status === "Dead") {
        item.style.opacity = "0.5";
        item.style.borderLeftColor = "var(--color-danger)";
      } else if (soldier.status === "Wounded") {
        item.style.borderLeftColor = "var(--color-hive)";
      } else {
        item.style.borderLeftColor = "var(--color-primary)";
      }

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:${this.selectedSoldierId === soldier.id ? "var(--color-accent)" : "var(--color-text)"};">${soldier.name}</strong>
          <span class="badge">LVL ${soldier.level}</span>
        </div>
        <div style="font-size:0.75em; color:var(--color-text-muted); margin-top:4px; display:flex; justify-content:space-between;">
          <span>${ArchetypeLibrary[soldier.archetypeId]?.name || soldier.archetypeId}</span>
          <span style="color:${this.getStatusColor(soldier.status)};">${soldier.status}</span>
        </div>
        <div style="font-size:0.7em; color:var(--color-text-dim); margin-top:4px;">
          HP: ${soldier.hp}/${soldier.maxHp} | XP: ${soldier.xp}
        </div>
      `;

      item.onclick = () => {
        this.selectedSoldierId = soldier.id;
        this.render();
      };
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
      case "Healthy": return "var(--color-primary)";
      case "Wounded": return "var(--color-hive)";
      case "Dead": return "var(--color-danger)";
      default: return "var(--color-text)";
    }
  }

  private renderSoldierDetails(panel: HTMLElement) {
    const state = this.manager.getState();
    if (!state) return;

    const soldier = state.roster.find((s) => s.id === this.selectedSoldierId);
    if (!soldier) {
      this.inspector.setSoldier(null, false);
      this.inspector.renderDetails(panel);
      return;
    }

    // Soldier Header
    const header = document.createElement("div");
    header.className = "flex-row justify-between align-center w-full";
    header.style.marginBottom = "10px";

    const nameInfo = document.createElement("div");
    nameInfo.innerHTML = `
      <h3 style="margin:0; font-size:1.5em; color:var(--color-accent);">${soldier.name}</h3>
      <div style="color:var(--color-text-muted);">${ArchetypeLibrary[soldier.archetypeId]?.name} Rank ${soldier.level}</div>
    `;
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
      };
      actions.appendChild(healBtn);
    } else if (soldier.status === "Dead" && state.rules.deathRule === "Clone") {
      const reviveBtn = document.createElement("button");
      reviveBtn.textContent = "Revive (250 Scrap)";
      reviveBtn.disabled = state.scrap < 250;
      reviveBtn.onclick = () => {
        this.manager.reviveSoldier(soldier.id);
        this.render();
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

    this.inspector.setSoldier(soldier, false);
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
        this.inspector.setSoldier(soldier, false);
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

    const archetypes = state.unlockedArchetypes;
    
    archetypes.forEach((archId) => {
      const arch = ArchetypeLibrary[archId];
      if (!arch) return;

      const card = document.createElement("div");
      card.className = "card";
      card.style.padding = "10px";
      card.style.marginBottom = "10px";

      card.innerHTML = `
        <div class="flex-row justify-between align-center">
          <strong style="color:var(--color-primary); font-size:1em;">${arch.name}</strong>
          <span style="color:var(--color-text); font-weight:bold; font-size:0.9em;">100 Scrap</span>
        </div>
        <div style="font-size:0.75em; color:var(--color-text-muted); margin-top:4px;">
          HP: ${arch.baseHp} | Aim: ${arch.soldierAim} | Spd: ${arch.speed/10}
        </div>
      `;

      const recruitBtn = document.createElement("button");
      recruitBtn.textContent = "Recruit";
      recruitBtn.className = "w-full";
      recruitBtn.style.padding = "5px";
      recruitBtn.style.fontSize = "0.8em";
      recruitBtn.disabled = state.scrap < 100;
      recruitBtn.onclick = () => {
        const name = prompt("Enter soldier name:", `Recruit ${Math.floor(Math.random()*1000)}`);
        if (name) {
          this.manager.recruitSoldier(archId, name);
          this.render();
        }
      };
      card.appendChild(recruitBtn);

      panel.appendChild(card);
    });
  }
}
