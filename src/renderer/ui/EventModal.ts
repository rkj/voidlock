import { CampaignEventDefinition, EventChoice } from "../../shared/campaign_types";
import { ModalService, ModalInstance } from "./ModalService";

export class EventModal {
  constructor(
    private modalService: ModalService,
    private onChoice: (choice: EventChoice) => void
  ) {}

  public async show(event: CampaignEventDefinition) {
    return this.modalService.show({
      title: event.title,
      message: event.text,
      zIndex: 1000,
      content: (instance: ModalInstance) => {
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

          if (choice.cost && choice.cost.scrap) {
            const span = document.createElement("span");
            span.textContent = `COST: ${choice.cost.scrap} SCRAP`;
            span.style.color = "var(--color-error)";
            details.appendChild(span);
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
            instance.close();
            this.onChoice(choice);
          };

          choicesContainer.appendChild(btn);
        });
        return choicesContainer;
      }
    });
  }
}

export class OutcomeModal {
  constructor(
    private modalService: ModalService,
    private onConfirm: () => void
  ) {}

  public async show(title: string, text: string) {
    return this.modalService.show({
      title,
      message: text,
      zIndex: 1100,
      buttons: [
        {
          label: "CONTINUE",
          isPrimary: true,
          onClick: (modal) => {
            modal.close();
            this.onConfirm();
          }
        }
      ]
    });
  }
}
