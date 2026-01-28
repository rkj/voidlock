import { AppContext } from "./AppContext";
import { CampaignNode, calculateMapSize, calculateSpawnPoints } from "@src/shared/campaign_types";
import { PRNG } from "@src/shared/PRNG";
import { CampaignEvents } from "@src/content/CampaignEvents";
import { EventModal, OutcomeModal } from "@src/renderer/ui/EventModal";

export class CampaignFlowCoordinator {
  constructor(private context: AppContext) {}

  public async onCampaignMenu(
    applyCampaignTheme: () => void,
    showCampaignSummary: (state: any) => void,
    showCampaignScreen: () => void,
  ) {
    applyCampaignTheme();
    const state = this.context.campaignManager.getState();
    if (state && (state.status === "Victory" || state.status === "Defeat")) {
      showCampaignSummary(state);
      this.context.screenManager.show("campaign-summary");
      this.context.campaignShell.hide();
    } else {
      showCampaignScreen();
      this.context.screenManager.show("campaign");
      this.context.campaignShell.show("campaign", "sector-map");
    }
  }

  public async onCampaignNodeSelected(
    node: CampaignNode,
    showCampaignScreen: () => void,
    prepareMissionSetup: (node: CampaignNode, size: number, spawnPoints: number) => void,
  ) {
    if (node.type === "Shop") {
      await this.context.modalService.alert(
        "Supply Depot reached. +100 Scrap granted for resupply.",
      );
      this.context.campaignManager.advanceCampaignWithoutMission(
        node.id,
        100,
        0,
      );
      showCampaignScreen();
      return;
    }

    if (node.type === "Event") {
      const prng = new PRNG(node.mapSeed);
      const event =
        CampaignEvents[Math.floor(prng.next() * CampaignEvents.length)];

      const modal = new EventModal(this.context.modalService, (choice) => {
        const outcome = this.context.campaignManager.applyEventChoice(
          node.id,
          choice,
          prng,
        );

        const outcomeModal = new OutcomeModal(this.context.modalService, () => {
          if (outcome.ambush) {
            // Ambush triggers a combat mission at this node
            this.onCampaignNodeSelected(node, showCampaignScreen, prepareMissionSetup);
          } else {
            showCampaignScreen();
          }
        });
        outcomeModal.show(event.title, outcome.text);
      });
      modal.show(event);
      return;
    }

    const state = this.context.campaignManager.getState();
    const rules = state?.rules;
    const growthRate = rules?.mapGrowthRate ?? 1.0;
    const size = calculateMapSize(node.rank, growthRate);
    const spawnPoints = calculateSpawnPoints(size);

    prepareMissionSetup(node, size, spawnPoints);
  }

  public async onResetData() {
    if (
      await this.context.modalService.confirm(
        "Are you sure? This will wipe all campaign progress and settings.",
      )
    ) {
      localStorage.clear();
      window.location.reload();
    }
  }
}
