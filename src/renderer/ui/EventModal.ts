import { CampaignEventDefinition, EventChoice } from "../../shared/campaign_types";

export class EventModal {
  private overlay: HTMLElement;
  private onChoice: (choice: EventChoice) => void;

  constructor(onChoice: (choice: EventChoice) => void) {
    this.onChoice = onChoice;
    this.overlay = document.createElement("div");
    this.overlay.className = "event-modal-overlay";
    this.overlay.style.position = "fixed";
    this.overlay.style.inset = "0";
    this.overlay.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
    this.overlay.style.display = "flex";
    this.overlay.style.alignItems = "center";
    this.overlay.style.justifyContent = "center";
    this.overlay.style.zIndex = "1000";
    this.overlay.style.backdropFilter = "blur(4px)";
  }

  public show(event: CampaignEventDefinition) {
    const modal = document.createElement("div");
    modal.className = "event-modal flex-col gap-20 p-40";
    modal.style.backgroundColor = "var(--color-surface-elevated)";
    modal.style.border = "2px solid var(--color-primary)";
    modal.style.width = "600px";
    modal.style.boxShadow = "0 0 30px rgba(var(--color-primary-rgb), 0.2)";
    modal.style.animation = "modal-fade-in 0.3s ease-out";

    const title = document.createElement("h2");
    title.textContent = event.title.toUpperCase();
    title.style.margin = "0";
    title.style.color = "var(--color-primary)";
    title.style.letterSpacing = "2px";
    title.style.borderBottom = "1px solid var(--color-border)";
    title.style.paddingBottom = "10px";
    modal.appendChild(title);

    const text = document.createElement("p");
    text.textContent = event.text;
    text.style.lineHeight = "1.6";
    text.style.fontSize = "1.1em";
    modal.appendChild(text);

    const choicesContainer = document.createElement("div");
    choicesContainer.className = "flex-col gap-10";
    
    event.choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.className = "event-choice-button flex-col align-start p-15";
      btn.style.width = "100%";
      btn.style.textAlign = "left";
      btn.style.background = "rgba(255, 255, 255, 0.05)";
      btn.style.border = "1px solid var(--color-border)";
      btn.style.cursor = "pointer";
      btn.style.transition = "all 0.2s ease";

      const label = document.createElement("div");
      label.textContent = choice.label;
      label.style.fontWeight = "bold";
      label.style.color = "var(--color-text)";
      btn.appendChild(label);

      if (choice.description) {
        const desc = document.createElement("div");
        desc.textContent = choice.description;
        desc.style.fontSize = "0.85em";
        desc.style.color = "var(--color-text-dim)";
        desc.style.marginTop = "4px";
        btn.appendChild(desc);
      }

      // Show costs/rewards/risks
      const details = document.createElement("div");
      details.className = "flex-row gap-10";
      details.style.marginTop = "8px";
      details.style.fontSize = "0.75em";

      if (choice.cost) {
          if (choice.cost.scrap) {
              const span = document.createElement("span");
              span.textContent = `COST: ${choice.cost.scrap} SCRAP`;
              span.style.color = "var(--color-error)";
              details.appendChild(span);
          }
      }

      if (choice.reward) {
          const rewards: string[] = [];
          if (choice.reward.scrap) rewards.push(`${choice.reward.scrap} SCRAP`);
          if (choice.reward.intel) rewards.push(`${choice.reward.intel} INTEL`);
          if (choice.reward.recruit) rewards.push(`NEW RECRUIT`);
          
          if (rewards.length > 0) {
              const span = document.createElement("span");
              span.textContent = `REWARD: ${rewards.join(", ")}`;
              span.style.color = "var(--color-primary)";
              details.appendChild(span);
          }
      }

      if (choice.risk) {
          const span = document.createElement("span");
          span.textContent = `RISK: ${Math.floor(choice.risk.chance * 100)}% CHANCE OF DANGER`;
          span.style.color = "var(--color-warning)";
          details.appendChild(span);
      }

      if (details.children.length > 0) {
          btn.appendChild(details);
      }

      btn.onmouseover = () => {
        btn.style.background = "rgba(var(--color-primary-rgb), 0.1)";
        btn.style.borderColor = "var(--color-primary)";
      };
      btn.onmouseout = () => {
        btn.style.background = "rgba(255, 255, 255, 0.05)";
        btn.style.borderColor = "var(--color-border)";
      };

      btn.onclick = () => {
        this.hide();
        this.onChoice(choice);
      };

      choicesContainer.appendChild(btn);
    });

    modal.appendChild(choicesContainer);
    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);
  }

  public hide() {
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}

export class OutcomeModal {
  private overlay: HTMLElement;
  private onConfirm: () => void;

  constructor(onConfirm: () => void) {
    this.onConfirm = onConfirm;
    this.overlay = document.createElement("div");
    this.overlay.className = "outcome-modal-overlay";
    this.overlay.style.position = "fixed";
    this.overlay.style.inset = "0";
    this.overlay.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
    this.overlay.style.display = "flex";
    this.overlay.style.alignItems = "center";
    this.overlay.style.justifyContent = "center";
    this.overlay.style.zIndex = "1100";
    this.overlay.style.backdropFilter = "blur(4px)";
  }

  public show(title: string, text: string) {
    const modal = document.createElement("div");
    modal.className = "outcome-modal flex-col gap-20 p-40";
    modal.style.backgroundColor = "var(--color-surface-elevated)";
    modal.style.border = "2px solid var(--color-primary)";
    modal.style.width = "400px";
    modal.style.textAlign = "center";

    const h2 = document.createElement("h2");
    h2.textContent = title.toUpperCase();
    h2.style.margin = "0";
    h2.style.color = "var(--color-primary)";
    modal.appendChild(h2);

    const p = document.createElement("p");
    p.textContent = text;
    p.style.lineHeight = "1.6";
    modal.appendChild(p);

    const btn = document.createElement("button");
    btn.textContent = "CONTINUE";
    btn.className = "primary-button";
    btn.style.width = "100%";
    btn.onclick = () => {
      this.hide();
      this.onConfirm();
    };
    modal.appendChild(btn);

    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);
  }

  public hide() {
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}
