import {
  CampaignNode,
  calculateMapSize,
  calculateSpawnPoints,
  CampaignState,
} from "@src/shared/campaign_types";
import { PRNG } from "@src/shared/PRNG";
import { CampaignEvents } from "@src/content/CampaignEvents";
import { EventModal, OutcomeModal } from "@src/renderer/ui/EventModal";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { ScreenManager } from "@src/renderer/ScreenManager";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";
import { ModalService } from "@src/renderer/ui/ModalService";

export class CampaignFlowCoordinator {
  constructor(
    private campaignManager: CampaignManager,
    private screenManager: ScreenManager,
    private campaignShell: CampaignShell,
    private modalService: ModalService,
  ) {}

  public async onCampaignMenu(
    applyCampaignTheme: () => void,
    showCampaignSummary: (state: CampaignState) => void,
    showCampaignScreen: () => void,
  ) {
    applyCampaignTheme();
    const state = this.campaignManager.getState();
    if (state && (state.status === "Victory" || state.status === "Defeat")) {
      showCampaignSummary(state);
      this.screenManager.show("campaign-summary", true, true);
      this.campaignShell.hide();
    } else {
      showCampaignScreen();
      this.screenManager.show("campaign", true, true);
      this.campaignShell.show("campaign", "sector-map");
    }
  }

  public async onCampaignNodeSelected(
    node: CampaignNode,
    showCampaignScreen: () => void,
    prepareMissionSetup: (
      node: CampaignNode,
      size: number,
      spawnPoints: number,
    ) => void,
  ) {
    if (node.type === "Shop") {
      await this.modalService.alert(
        "Supply Depot reached. +100 Scrap granted for resupply.",
      );
      this.campaignManager.advanceCampaignWithoutMission(
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

      const modal = new EventModal(this.modalService, (choice) => {
        const outcome = this.campaignManager.applyEventChoice(
          node.id,
          choice,
          prng,
        );

        const outcomeModal = new OutcomeModal(this.modalService, () => {
          if (outcome.ambush) {
            // Ambush triggers a combat mission at this node
            this.onCampaignNodeSelected(
              node,
              showCampaignScreen,
              prepareMissionSetup,
            );
          } else {
            showCampaignScreen();
          }
        });
        outcomeModal.show(event.title, outcome.text);
      });
      modal.show(event);
      return;
    }

    const state = this.campaignManager.getState();
    const rules = state?.rules;
    const growthRate = rules?.mapGrowthRate ?? 1.0;
    const size = calculateMapSize(node.rank, growthRate);
    const spawnPoints = calculateSpawnPoints(size);

    prepareMissionSetup(node, size, spawnPoints);
  }

  public async onResetData() {
    if (
      await this.modalService.confirm(
        "Are you sure? This will wipe all campaign progress and settings.",
      )
    ) {
      localStorage.clear();
      window.location.reload();
    }
  }
}
