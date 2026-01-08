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

export class BarracksScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private selectedSoldierId: string | null = null;
  private onBack: () => void;

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
    this.container.style.display = "flex"; // Ensure it's visible if show() was called

    // Left: Roster List
    const leftPanel = this.createPanel("ROSTER", "300px");
    this.renderRoster(leftPanel);

    // Center: Soldier Details & Equipment
    const centerPanel = this.createPanel("SOLDIER DETAILS", "1fr");
    this.renderSoldierDetails(centerPanel);

    // Right: Recruitment & Store
    const rightPanel = this.createPanel("RECRUITMENT", "350px");
    this.renderRecruitment(rightPanel);

    this.container.appendChild(leftPanel);
    this.container.appendChild(centerPanel);
    this.container.appendChild(rightPanel);

    // Header Stats (Floating)
    const statsOverlay = document.createElement("div");
    statsOverlay.className = "overlay-stats";
    statsOverlay.innerHTML = `
      <span style="margin-right:20px;">SCRAP: <span style="color:var(--color-primary)">${state.scrap}</span></span>
      <span>INTEL: <span style="color:var(--color-accent)">${state.intel}</span></span>
    `;
    this.container.appendChild(statsOverlay);

    // Footer Buttons
    const footer = document.createElement("div");
    footer.className = "screen-footer";

    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK TO SECTOR MAP";
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

    const h2 = document.createElement("h2");
    h2.className = "panel-title";
    h2.textContent = title;
    panel.appendChild(h2);

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
          <span style="color:${this.getStatusColor(soldier.status)};">${soldier.status.toUpperCase()}</span>
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
      const placeholder = document.createElement("div");
      placeholder.className = "flex-col align-center justify-center h-full";
      placeholder.style.color = "var(--color-border-strong)";
      placeholder.innerHTML = `
        <div style="font-size:3em; margin-bottom:10px;">👤</div>
        <div>Select a soldier to view details</div>
      `;
      panel.appendChild(placeholder);
      return;
    }

    // Soldier Header
    const header = document.createElement("div");
    header.className = "flex-row justify-between align-center w-full";
    header.style.marginBottom = "20px";

    const nameInfo = document.createElement("div");
    nameInfo.innerHTML = `
      <h3 style="margin:0; font-size:1.5em; color:var(--color-accent);">${soldier.name}</h3>
      <div style="color:var(--color-text-muted);">${ArchetypeLibrary[soldier.archetypeId]?.name} Rank ${soldier.level}</div>
    `;
    header.appendChild(nameInfo);

    const statusBadge = document.createElement("div");
    statusBadge.className = "status-badge";
    statusBadge.textContent = soldier.status.toUpperCase();
    statusBadge.style.background = this.getStatusColor(soldier.status);
    header.appendChild(statusBadge);

    panel.appendChild(header);

    // Actions (Heal / Revive)
    const actions = document.createElement("div");
    actions.className = "flex-row gap-10 p-20";
    actions.style.marginBottom = "20px";
    actions.style.background = "var(--color-surface)";
    actions.style.border = "1px solid var(--color-border)";

    if (soldier.status === "Wounded") {
      const healBtn = document.createElement("button");
      healBtn.textContent = "HEAL (50 Scrap)";
      healBtn.disabled = state.scrap < 50;
      healBtn.onclick = () => {
        this.manager.healSoldier(soldier.id);
        this.render();
      };
      actions.appendChild(healBtn);
    } else if (soldier.status === "Dead" && state.rules.deathRule === "Clone") {
      const reviveBtn = document.createElement("button");
      reviveBtn.textContent = "REVIVE (250 Scrap)";
      reviveBtn.disabled = state.scrap < 250;
      reviveBtn.onclick = () => {
        this.manager.reviveSoldier(soldier.id);
        this.render();
      };
      actions.appendChild(reviveBtn);
    } else if (soldier.status === "Dead") {
      const deadText = document.createElement("div");
      deadText.textContent = "DECEASED - CANNOT BE RECOVERED";
      deadText.style.color = "var(--color-danger)";
      deadText.style.fontWeight = "bold";
      actions.appendChild(deadText);
    } else {
      const healthyText = document.createElement("div");
      healthyText.textContent = "SOLDIER IS FIT FOR COMBAT";
      healthyText.style.color = "var(--color-primary)";
      actions.appendChild(healthyText);
    }
    panel.appendChild(actions);

    // Stats
    const statsGrid = document.createElement("div");
    statsGrid.className = "stats-grid";
    statsGrid.style.marginBottom = "20px";

    const addStat = (label: string, value: any, icon: string) => {
      const div = document.createElement("div");
      div.className = "stat-box";
      div.innerHTML = `
        <div class="stat-label">${label}</div>
        <div class="flex-row align-center gap-10">
          <img src="${icon}" style="width:20px; height:20px;" />
          <span style="font-size:1.1em; font-weight:bold;">${value}</span>
        </div>
      `;
      statsGrid.appendChild(div);
    };

    addStat("HEALTH", `${soldier.hp} / ${soldier.maxHp}`, Icons.Health);
    addStat("ACCURACY (AIM)", soldier.soldierAim, Icons.Accuracy);
    addStat("KILLS", soldier.kills, Icons.Objective); // Placeholder icon
    addStat("MISSIONS", soldier.missions, Icons.Exit); // Placeholder icon

    panel.appendChild(statsGrid);

    // Equipment Slots
    const equipTitle = document.createElement("h4");
    equipTitle.textContent = "EQUIPMENT";
    equipTitle.style.borderBottom = "1px solid var(--color-border)";
    equipTitle.style.paddingBottom = "5px";
    equipTitle.style.color = "var(--color-text-muted)";
    panel.appendChild(equipTitle);

    const slotsContainer = document.createElement("div");
    slotsContainer.className = "slots-grid";

    const renderSlot = (label: string, slot: keyof EquipmentState, category: string) => {
      const div = document.createElement("div");
      div.className = "equipment-slot";

      const title = document.createElement("div");
      title.textContent = label;
      title.className = "stat-label";
      div.appendChild(title);

      const select = document.createElement("select");
      select.className = "w-full";
      select.style.background = "var(--color-bg)";
      select.style.color = "var(--color-text)";

      select.style.border = "1px solid var(--color-border-strong)";
      select.style.padding = "4px";

      const noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = "[ EMPTY ]";
      select.appendChild(noneOpt);

      let items: (Weapon | Item)[] = [];
      if (category === "Ranged") {
        items = Object.values(WeaponLibrary).filter(w => w.type === "Ranged");
      } else if (category === "Melee") {
        items = Object.values(WeaponLibrary).filter(w => w.type === "Melee");
      } else if (category === "Armor") {
        items = Object.values(ItemLibrary).filter(i => i.id.includes("recon") || i.id.includes("plate"));
      } else if (category === "Feet") {
        items = Object.values(ItemLibrary).filter(i => i.id.includes("boots"));
      }

      items.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.name;
        if (soldier.equipment[slot as keyof EquipmentState] === item.id) opt.selected = true;
        select.appendChild(opt);
      });

      select.onchange = () => {
        const newEquip = { ...soldier.equipment };
        (newEquip as any)[slot] = select.value || undefined;
        this.manager.assignEquipment(soldier.id, newEquip);
        this.render();
      };

      div.appendChild(select);
      slotsContainer.appendChild(div);
    };

    renderSlot("RIGHT HAND", "rightHand", "Ranged");
    renderSlot("LEFT HAND", "leftHand", "Melee");
    renderSlot("BODY", "body", "Armor");
    renderSlot("FEET", "feet", "Feet");

    panel.appendChild(slotsContainer);
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

      card.innerHTML = `
        <div class="flex-row justify-between align-center">
          <strong style="color:var(--color-primary); font-size:1.1em;">${arch.name}</strong>
          <span style="color:var(--color-text); font-weight:bold;">100 Scrap</span>
        </div>
        <div style="font-size:0.8em; color:var(--color-text-muted);">
          Base HP: ${arch.baseHp} | Aim: ${arch.soldierAim} | Speed: ${arch.speed/10}
        </div>
      `;

      const recruitBtn = document.createElement("button");
      recruitBtn.textContent = "RECRUIT";
      recruitBtn.className = "w-full";
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
