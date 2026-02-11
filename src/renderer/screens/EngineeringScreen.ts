import { MetaManager } from "@src/renderer/campaign/MetaManager";
import {
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary,
  InputPriority,
} from "@src/shared/types";
import { InputDispatcher } from "../InputDispatcher";
import { UIUtils } from "../utils/UIUtils";

export class EngineeringScreen {
  private container: HTMLElement;
  private onUpdate: () => void;

  private unlockables = {
    archetypes: [
      {
        id: "heavy",
        cost: 50,
        description: "Slow, heavily armored unit with a shotgun and hammer.",
      },
      {
        id: "sniper",
        cost: 100,
        description:
          "Precision marksman with extreme range but slow fire rate.",
      },
      {
        id: "demolitionist",
        cost: 75,
        description:
          "Close-quarters specialist using a flamer and high-explosives.",
      },
    ],
    items: [
      {
        id: "autocannon",
        cost: 50,
        description:
          "Deployable sentry turret that provides automatic fire support.",
      },
      {
        id: "stimpack",
        cost: 25,
        description: "Instant, low-cost healing injectable for emergency use.",
      },
      {
        id: "scanner",
        cost: 40,
        description:
          "Handheld device to reveal enemies and objectives through fog.",
      },
      {
        id: "heavy_plate",
        cost: 60,
        description:
          "Heavy chest plating that grants significant HP at the cost of speed.",
      },
      {
        id: "flamer",
        cost: 50,
        description:
          "A liquid-fire projector for clearing hallways and groups of enemies.",
      },
    ],
  };

  constructor(containerId: string, onUpdate: () => void) {
    let el = document.getElementById(containerId);
    if (!el) {
      const isTest = typeof process !== "undefined" && process.env?.VITEST;
      if (isTest) {
        el = document.createElement("div");
        el.id = containerId;
        document.body.appendChild(el);
      } else {
        throw new Error(`Container #${containerId} not found`);
      }
    }
    this.container = el!;
    this.onUpdate = onUpdate;
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
    this.pushInputContext();
  }

  public hide() {
    this.container.style.display = "none";
    InputDispatcher.getInstance().popContext("engineering");
  }

  private pushInputContext() {
    InputDispatcher.getInstance().pushContext({
      id: "engineering",
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

  public isVisible(): boolean {
    return this.container.style.display === "flex";
  }

  private render() {
    const meta = MetaManager.getInstance();
    const stats = meta.getStats();
    const intel = stats.currentIntel;
    const unlockedArchetypes = stats.unlockedArchetypes;
    const unlockedItems = stats.unlockedItems;

    this.container.innerHTML = "";
    this.container.className = "screen screen-centered flex-col gap-20 p-20";
    this.container.style.overflowY = "auto";

    const h1 = document.createElement("h1");
    h1.textContent = "Engineering Bay";
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-primary)";
    this.container.appendChild(h1);

    const intelDisplay = document.createElement("div");
    intelDisplay.className = "intel-display flex-row align-center gap-10";
    intelDisplay.style.background = "var(--color-surface-elevated)";
    intelDisplay.style.padding = "10px 20px";
    intelDisplay.style.border = "1px solid var(--color-accent)";
    intelDisplay.innerHTML = `
      <span style="color: var(--color-text-dim); font-size: 0.8em;">Persistent Intel:</span>
      <span style="color: var(--color-accent); font-weight: bold; font-size: 1.2em;">${intel}</span>
    `;
    this.container.appendChild(intelDisplay);

    const grid = document.createElement("div");
    grid.className = "engineering-grid flex-col gap-20 w-full";
    grid.style.maxWidth = "800px";

    // --- Archetypes Section ---
    const archHeader = document.createElement("h3");
    archHeader.textContent = "Unit Archetypes";
    archHeader.style.borderBottom = "1px solid var(--color-border)";
    archHeader.style.paddingBottom = "5px";
    archHeader.style.color = "var(--color-text-dim)";
    grid.appendChild(archHeader);

    const archList = document.createElement("div");
    archList.className = "flex-col gap-10";

    this.unlockables.archetypes.forEach((arch) => {
      const isUnlocked = unlockedArchetypes.includes(arch.id);
      archList.appendChild(
        this.createUnlockCard(
          ArchetypeLibrary[arch.id]?.name || arch.id,
          arch.description,
          arch.cost,
          isUnlocked,
          intel >= arch.cost,
          () => this.handleUnlockArchetype(arch.id, arch.cost),
        ),
      );
    });
    grid.appendChild(archList);

    // --- Equipment Section ---
    const itemHeader = document.createElement("h3");
    itemHeader.textContent = "Advanced Equipment";
    itemHeader.style.marginTop = "20px";
    itemHeader.style.borderBottom = "1px solid var(--color-border)";
    itemHeader.style.paddingBottom = "5px";
    itemHeader.style.color = "var(--color-text-dim)";
    grid.appendChild(itemHeader);

    const itemList = document.createElement("div");
    itemList.className = "flex-col gap-10";

    this.unlockables.items.forEach((item) => {
      const isUnlocked = unlockedItems.includes(item.id);
      const name =
        ItemLibrary[item.id]?.name || WeaponLibrary[item.id]?.name || item.id;
      itemList.appendChild(
        this.createUnlockCard(
          name,
          item.description,
          item.cost,
          isUnlocked,
          intel >= item.cost,
          () => this.handleUnlockItem(item.id, item.cost),
        ),
      );
    });
    grid.appendChild(itemList);

    this.container.appendChild(grid);
  }

  private createUnlockCard(
    name: string,
    desc: string,
    cost: number,
    isUnlocked: boolean,
    canAfford: boolean,
    onUnlock: () => void,
  ): HTMLElement {
    const card = document.createElement("div");
    card.className = `unlock-card card p-15 flex-row justify-between align-center ${isUnlocked ? "unlocked" : ""}`;
    card.style.background = isUnlocked
      ? "rgba(46, 204, 113, 0.05)"
      : "var(--color-surface-elevated)";
    card.style.border = `1px solid ${isUnlocked ? "var(--color-success)" : "var(--color-border)"}`;
    card.style.opacity = !isUnlocked && !canAfford ? "0.7" : "1.0";

    const left = document.createElement("div");
    left.className = "flex-col gap-5";
    left.innerHTML = `
      <div style="font-weight: bold; color: ${isUnlocked ? "var(--color-success)" : "var(--color-primary)"};">${name}</div>
      <div style="font-size: 0.8em; color: var(--color-text-dim); max-width: 500px;">${desc}</div>
    `;
    card.appendChild(left);

    const right = document.createElement("div");
    if (isUnlocked) {
      right.innerHTML = `<span style="color: var(--color-success); font-weight: bold; font-size: 0.8em;">Unlocked</span>`;
    } else {
      const btn = document.createElement("button");
      btn.className = canAfford ? "primary-button" : "back-button disabled";
      btn.style.width = "120px";
      btn.innerHTML = `<span style="font-size: 0.8em;">Unlock (${cost})</span>`;
      btn.disabled = !canAfford;
      btn.onclick = onUnlock;
      right.appendChild(btn);
    }
    card.appendChild(right);

    return card;
  }

  private handleUnlockArchetype(id: string, cost: number) {
    const meta = MetaManager.getInstance();
    try {
      meta.unlockArchetype(id, cost);
      this.render();
      this.onUpdate();
    } catch (e) {
      console.error(e);
    }
  }

  private handleUnlockItem(id: string, cost: number) {
    const meta = MetaManager.getInstance();
    try {
      meta.unlockItem(id, cost);
      this.render();
      this.onUpdate();
    } catch (e) {
      console.error(e);
    }
  }
}
