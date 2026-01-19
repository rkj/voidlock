import {
  CampaignState,
  EventChoice,
  CampaignSoldier,
} from "../../shared/campaign_types";
import { PRNG } from "../../shared/PRNG";
import { ArchetypeLibrary, MissionType } from "../../shared/types";
import { MissionReconciler } from "./MissionReconciler";

/**
 * Handles narrative event logic for the campaign.
 */
export class EventManager {
  /**
   * Applies the outcome of a narrative event choice.
   */
  public applyEventChoice(
    state: CampaignState,
    nodeId: string,
    choice: EventChoice,
    prng: PRNG,
    reconciler: MissionReconciler,
  ): { text: string; ambush: boolean } {
    let outcomeText = "";
    let ambushOccurred = false;

    // 1. Handle Costs
    if (choice.cost) {
      if (choice.cost.scrap) {
        if (state.scrap < choice.cost.scrap)
          throw new Error("Not enough scrap.");
        state.scrap -= choice.cost.scrap;
        outcomeText += `Spent ${choice.cost.scrap} Scrap. `;
      }
      if (choice.cost.intel) {
        if (state.intel < choice.cost.intel)
          throw new Error("Not enough intel.");
        state.intel -= choice.cost.intel;
        outcomeText += `Spent ${choice.cost.intel} Intel. `;
      }
    }

    // 2. Handle Risks
    if (choice.risk) {
      if (prng.next() < choice.risk.chance) {
        if (choice.risk.damage) {
          const healthyRoster = state.roster.filter(
            (s) => s.status === "Healthy",
          );
          if (healthyRoster.length > 0) {
            const victim =
              healthyRoster[Math.floor(prng.next() * healthyRoster.length)];
            const damageAmount = Math.floor(victim.maxHp * choice.risk.damage);
            victim.hp -= damageAmount;
            if (victim.hp <= 0) {
              victim.hp = 0;
              victim.status = "Wounded";
              victim.recoveryTime = 2; // Extra recovery time for event injuries
              outcomeText += `${victim.name} was seriously injured! `;
            } else {
              outcomeText += `${victim.name} took ${damageAmount} damage. `;
            }
          }
        }
        if (choice.risk.ambush) {
          ambushOccurred = true;
          outcomeText += "It's an ambush! ";
        }
      }
    }

    // 3. Handle Rewards
    if (!ambushOccurred) {
      if (choice.reward) {
        if (choice.reward.scrap) {
          state.scrap += choice.reward.scrap;
          outcomeText += `Gained ${choice.reward.scrap} Scrap. `;
        }
        if (choice.reward.intel) {
          state.intel += choice.reward.intel;
          outcomeText += `Gained ${choice.reward.intel} Intel. `;
        }
        if (choice.reward.recruit) {
          const archetypes = ["assault", "medic", "scout", "heavy"];
          const archId = archetypes[Math.floor(prng.next() * archetypes.length)];
          const arch = ArchetypeLibrary[archId];
          const newSoldier: CampaignSoldier = {
            id: `soldier_${Date.now()}_${Math.floor(prng.next() * 1000)}`,
            name: `Volunteer ${state.roster.length + 1}`,
            archetypeId: archId,
            hp: arch ? arch.baseHp : 100,
            maxHp: arch ? arch.baseHp : 100,
            soldierAim: arch ? arch.soldierAim : 80,
            xp: 0,
            level: 1,
            kills: 0,
            missions: 0,
            status: "Healthy",
            recoveryTime: 0,
            equipment: {
              rightHand: arch?.rightHand,
              leftHand: arch?.leftHand,
              body: arch?.body,
              feet: arch?.feet,
            },
          };
          state.roster.push(newSoldier);
          outcomeText += `Recruited ${newSoldier.name} (${archId}). `;
        }
      }
    }

    if (outcomeText === "") outcomeText = "Nothing happened.";

    // 4. Advance campaign
    if (!ambushOccurred) {
      reconciler.advanceCampaignWithoutMission(state, nodeId, 0, 0);
    } else {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.type = "Combat";
        node.missionType = MissionType.DestroyHive;
      }
    }

    return { text: outcomeText.trim(), ambush: ambushOccurred };
  }
}
