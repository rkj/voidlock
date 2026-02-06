import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { ArchetypeLibrary, ItemLibrary, WeaponLibrary } from "@src/shared/types";

export class EngineeringScreen {
  private container: HTMLElement;
  private onUpdate: () => void;

  private unlockables = {
    archetypes: [
      { id: "heavy", cost: 50, description: "Slow, heavily armored unit with a shotgun and hammer." },
      { id: "sniper", cost: 100, description: "Precision marksman with extreme range but slow fire rate." },
      { id: "demolitionist", cost: 75, description: "Close-quarters specialist using a flamer and high-explosives." },
    ],
    items: [
      { id: "autocannon", cost: 50, description: "Deployable sentry turret that provides automatic fire support." },
      { id: "stimpack", cost: 25, description: "Instant, low-cost healing injectable for emergency use." },
      { id: "scanner", cost: 40, description: "Handheld device to reveal enemies and objectives through fog." },
      { id: "heavy_plate", cost: 60, description: "Heavy chest plating that grants significant HP at the cost of speed." },
      { id: "flamer", cost: 50, description: "A liquid-fire projector for clearing hallways and groups of enemies." },
    ]
  };

  constructor(containerId: string, onUpdate: () => void) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.onUpdate = onUpdate;
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
    this.container.className = "screen screen-centered flex-col gap-20 p-20";
    this.container.style.display = "flex";
    this.container.style.overflowY = "auto";
    this.container.style.backgroundColor = "var(--color-surface)";

    const h1 = document.createElement("h1");
    h1.textContent = "Engineering Bay";
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-accent)";
    this.container.appendChild(h1);

    const intelDisplay = document.createElement("div");
    intelDisplay.className = "stat-box flex-row align-center gap-10 p-10";
    intelDisplay.style.background = "rgba(0,0,0,0.3)";
    intelDisplay.style.border = "1px solid var(--color-accent)";
    intelDisplay.style.borderRadius = "4px";
    intelDisplay.innerHTML = `
      <span style="color: var(--color-text-dim); text-transform: uppercase; font-size: 0.8em; letter-spacing: 1px;">Available Intel:</span>
      <span style="color: var(--color-accent); font-weight: bold; font-size: 1.2em;">${stats.currentIntel}</span>
    `;
    this.container.appendChild(intelDisplay);

    const contentGrid = document.createElement("div");
    contentGrid.className = "flex-row gap-20 justify-center";
    contentGrid.style.width = "100%";
    contentGrid.style.maxWidth = "1000px";
    contentGrid.style.alignItems = "flex-start";

    // Archetypes Section
    const archCol = this.createSection("Advanced Archetypes");
    this.unlockables.archetypes.forEach(arch => {
      const isUnlocked = stats.unlockedArchetypes.includes(arch.id);
      const name = ArchetypeLibrary[arch.id]?.name || arch.id;
      archCol.appendChild(this.createUnlockCard(name, arch.description, arch.cost, isUnlocked, stats.currentIntel, () => {
        MetaManager.getInstance().unlockArchetype(arch.id, arch.cost);
        this.render();
        this.onUpdate();
      }));
    });
    contentGrid.appendChild(archCol);

    // Items Section
    const itemCol = this.createSection("Equipment Licenses");
    this.unlockables.items.forEach(item => {
      const isUnlocked = stats.unlockedItems.includes(item.id);
      const data = ItemLibrary[item.id] || WeaponLibrary[item.id];
      const name = data?.name || item.id;
      itemCol.appendChild(this.createUnlockCard(name, item.description, item.cost, isUnlocked, stats.currentIntel, () => {
        MetaManager.getInstance().unlockItem(item.id, item.cost);
        this.render();
        this.onUpdate();
      }));
    });
    contentGrid.appendChild(itemCol);

    this.container.appendChild(contentGrid);
  }

  private createSection(title: string) {
    const col = document.createElement("div");
    col.className = "flex-col gap-10";
    col.style.flex = "1";
    col.style.minWidth = "300px";

    const h2 = document.createElement("h2");
    h2.textContent = title;
    h2.style.fontSize = "1em";
    h2.style.color = "var(--color-primary)";
    h2.style.borderBottom = "1px solid var(--color-border)";
    h2.style.paddingBottom = "5px";
    h2.style.textTransform = "uppercase";
    h2.style.letterSpacing = "1px";
    col.appendChild(h2);

    return col;
  }

  private createUnlockCard(
    name: string,
    description: string,
    cost: number,
    isUnlocked: boolean,
    currentIntel: number,
    onUnlock: () => void
  ) {
    const card = document.createElement("div");
    card.className = "stat-box p-15 flex-col gap-10";
    card.style.background = "var(--color-surface-elevated)";
    card.style.border = isUnlocked ? "1px solid var(--color-primary)" : "1px solid var(--color-border)";
    card.style.opacity = isUnlocked ? "1" : "0.9";
    card.style.transition = "all 0.2s ease";

    const header = document.createElement("div");
    header.className = "flex-row justify-between align-center";
    header.innerHTML = `
      <span style="font-weight: bold; color: ${isUnlocked ? "var(--color-primary)" : "var(--color-text)"}">${name}</span>
      ${isUnlocked ? '<span style="color: var(--color-success); font-size: 0.7em; font-weight: bold; text-transform: uppercase;">Unlocked</span>' : `<span style="color: var(--color-accent); font-weight: bold;">${cost} INTEL</span>`}
    `;
    card.appendChild(header);

    const desc = document.createElement("div");
    desc.textContent = description;
    desc.style.fontSize = "0.8em";
    desc.style.color = "var(--color-text-dim)";
    card.appendChild(desc);

    if (!isUnlocked) {
      const btn = document.createElement("button");
      btn.textContent = "Unlock Project";
      btn.className = "primary-button";
      btn.style.width = "100%";
      btn.style.marginTop = "5px";
      btn.disabled = currentIntel < cost;
      if (currentIntel < cost) {
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        btn.title = "Insufficient Intel";
      }
      btn.onclick = (e) => {
        e.stopPropagation();
        onUnlock();
      };
      card.appendChild(btn);
    }

    return card;
  }
}
