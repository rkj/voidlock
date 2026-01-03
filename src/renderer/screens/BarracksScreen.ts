import { CampaignManager } from "../campaign/CampaignManager";
import { CampaignSoldier } from "../../shared/campaign_types";
import {
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary,
  Item,
  Weapon,
  EquipmentState,
} from "../../shared/types";
import { Icons } from "../Icons";
import { StatDisplay } from "../ui/StatDisplay";

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
    this.container.className = "screen barracks-screen";
    this.container.style.flexDirection = "row";
    this.container.style.backgroundColor = "#111";
    this.container.style.color = "#eee";
    this.container.style.padding = "20px";
    this.container.style.boxSizing = "border-box";
    this.container.style.gap = "20px";
    this.container.style.position = "relative";

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
    statsOverlay.style.position = "absolute";
    statsOverlay.style.top = "20px";
    statsOverlay.style.right = "40px";
    statsOverlay.style.background = "rgba(0,0,0,0.8)";
    statsOverlay.style.padding = "10px 20px";
    statsOverlay.style.border = "1px solid #444";
    statsOverlay.style.borderRadius = "4px";
    statsOverlay.style.zIndex = "10";
    statsOverlay.innerHTML = `
      <span style="margin-right:20px;">SCRAP: <span style="color:#0f0">${state.scrap}</span></span>
      <span>INTEL: <span style="color:#0af">${state.intel}</span></span>
    `;
    this.container.appendChild(statsOverlay);

    // Footer Buttons
    const footer = document.createElement("div");
    footer.style.position = "absolute";
    footer.style.bottom = "20px";
    footer.style.left = "20px";
    footer.style.display = "flex";
    footer.style.gap = "10px";

    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK TO SECTOR MAP";
    backBtn.className = "back-button";
    backBtn.onclick = () => this.onBack();

    footer.appendChild(backBtn);
    this.container.appendChild(footer);
  }

  private createPanel(title: string, width: string): HTMLElement {
    const panel = document.createElement("div");
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.width = width === "1fr" ? "auto" : width;
    if (width === "1fr") panel.style.flexGrow = "1";
    panel.style.border = "1px solid #444";
    panel.style.background = "#1a1a1a";
    panel.style.padding = "15px";
    panel.style.overflowY = "auto";
    panel.style.position = "relative";

    const h2 = document.createElement("h2");
    h2.textContent = title;
    h2.style.marginTop = "0";
    h2.style.fontSize = "1.2em";
    h2.style.borderBottom = "1px solid #333";
    h2.style.paddingBottom = "10px";
    h2.style.color = "#0af";
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
        item.style.borderLeftColor = "#f00";
      } else if (soldier.status === "Wounded") {
        item.style.borderLeftColor = "#f0f";
      } else {
        item.style.borderLeftColor = "#0f0";
      }

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:${this.selectedSoldierId === soldier.id ? "#0af" : "#eee"};">${soldier.name}</strong>
          <span style="font-size:0.8em; background:#333; padding:2px 6px; border-radius:3px;">LVL ${soldier.level}</span>
        </div>
        <div style="font-size:0.75em; color:#888; margin-top:4px; display:flex; justify-content:space-between;">
          <span>${ArchetypeLibrary[soldier.archetypeId]?.name || soldier.archetypeId}</span>
          <span style="color:${this.getStatusColor(soldier.status)};">${soldier.status.toUpperCase()}</span>
        </div>
        <div style="font-size:0.7em; color:#555; margin-top:4px;">
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
      empty.style.color = "#666";
      empty.style.textAlign = "center";
      empty.style.marginTop = "20px";
      panel.appendChild(empty);
    }
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case "Healthy": return "#0f0";
      case "Wounded": return "#f0f";
      case "Dead": return "#f00";
      default: return "#eee";
    }
  }

  private renderSoldierDetails(panel: HTMLElement) {
    const state = this.manager.getState();
    if (!state) return;

    const soldier = state.roster.find((s) => s.id === this.selectedSoldierId);
    if (!soldier) {
      const placeholder = document.createElement("div");
      placeholder.style.display = "flex";
      placeholder.style.flexDirection = "column";
      placeholder.style.alignItems = "center";
      placeholder.style.justifyContent = "center";
      placeholder.style.height = "100%";
      placeholder.style.color = "#444";
      placeholder.innerHTML = `
        <div style="font-size:3em; margin-bottom:10px;">👤</div>
        <div>Select a soldier to view details</div>
      `;
      panel.appendChild(placeholder);
      return;
    }

    // Soldier Header
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "flex-start";
    header.style.marginBottom = "20px";

    const nameInfo = document.createElement("div");
    nameInfo.innerHTML = `
      <h3 style="margin:0; font-size:1.5em; color:#0af;">${soldier.name}</h3>
      <div style="color:#888;">${ArchetypeLibrary[soldier.archetypeId]?.name} Rank ${soldier.level}</div>
    `;
    header.appendChild(nameInfo);

    const statusBadge = document.createElement("div");
    statusBadge.textContent = soldier.status.toUpperCase();
    statusBadge.style.padding = "5px 15px";
    statusBadge.style.background = this.getStatusColor(soldier.status);
    statusBadge.style.color = "#000";
    statusBadge.style.fontWeight = "bold";
    statusBadge.style.borderRadius = "3px";
    header.appendChild(statusBadge);

    panel.appendChild(header);

    // Actions (Heal / Revive)
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "10px";
    actions.style.marginBottom = "20px";
    actions.style.padding = "15px";
    actions.style.background = "#111";
    actions.style.border = "1px solid #333";

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
      deadText.style.color = "#f00";
      deadText.style.fontWeight = "bold";
      actions.appendChild(deadText);
    } else {
      const healthyText = document.createElement("div");
      healthyText.textContent = "SOLDIER IS FIT FOR COMBAT";
      healthyText.style.color = "#0f0";
      actions.appendChild(healthyText);
    }
    panel.appendChild(actions);

    // Stats
    const statsGrid = document.createElement("div");
    statsGrid.style.display = "grid";
    statsGrid.style.gridTemplateColumns = "1fr 1fr";
    statsGrid.style.gap = "10px";
    statsGrid.style.marginBottom = "20px";

    const addStat = (label: string, value: any, icon: string) => {
      const div = document.createElement("div");
      div.style.background = "#222";
      div.style.padding = "10px";
      div.style.border = "1px solid #333";
      div.innerHTML = `
        <div style="font-size:0.7em; color:#888; margin-bottom:5px;">${label}</div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.2em;">${icon}</span>
          <span style="font-size:1.1em; font-weight:bold;">${value}</span>
        </div>
      `;
      statsGrid.appendChild(div);
    };

    addStat("HEALTH", `${soldier.hp} / ${soldier.maxHp}`, Icons.Health);
    addStat("ACCURACY (AIM)", soldier.soldierAim, Icons.Accuracy);
    addStat("KILLS", soldier.kills, "🎯");
    addStat("MISSIONS", soldier.missions, "🚀");

    panel.appendChild(statsGrid);

    // Equipment Slots
    const equipTitle = document.createElement("h4");
    equipTitle.textContent = "EQUIPMENT";
    equipTitle.style.borderBottom = "1px solid #333";
    equipTitle.style.paddingBottom = "5px";
    equipTitle.style.color = "#888";
    panel.appendChild(equipTitle);

    const slotsContainer = document.createElement("div");
    slotsContainer.style.display = "grid";
    slotsContainer.style.gridTemplateColumns = "repeat(auto-fill, minmax(150px, 1fr))";
    slotsContainer.style.gap = "10px";

    const renderSlot = (label: string, slot: keyof EquipmentState, category: string) => {
      const div = document.createElement("div");
      div.style.background = "#111";
      div.style.padding = "10px";
      div.style.border = "1px solid #333";
      div.style.display = "flex";
      div.style.flexDirection = "column";
      div.style.gap = "5px";

      const title = document.createElement("div");
      title.textContent = label;
      title.style.fontSize = "0.7em";
      title.style.color = "#555";
      div.appendChild(title);

      const select = document.createElement("select");
      select.style.width = "100%";
      select.style.background = "#000";
      select.style.color = "#eee";
      select.style.border = "1px solid #444";
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
      card.style.background = "#222";
      card.style.border = "1px solid #333";
      card.style.padding = "15px";
      card.style.marginBottom = "15px";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "10px";

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#0f0; font-size:1.1em;">${arch.name}</strong>
          <span style="color:#eee; font-weight:bold;">100 Scrap</span>
        </div>
        <div style="font-size:0.8em; color:#888;">
          Base HP: ${arch.baseHp} | Aim: ${arch.soldierAim} | Speed: ${arch.speed/10}
        </div>
      `;

      const recruitBtn = document.createElement("button");
      recruitBtn.textContent = "RECRUIT";
      recruitBtn.style.width = "100%";
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
