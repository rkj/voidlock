import { CampaignEventDefinition } from "../shared/campaign_types";

export const CampaignEvents: CampaignEventDefinition[] = [
  {
    id: "derelict_ship",
    title: "SALVAGE OPPORTUNITY: Unregistered Vessel",
    text: "Long-range sensors have identified a drifting unregistered vessel. High-value cargo signatures detected in the primary hold. Structural integrity is critical and deteriorating.",
    choices: [
      {
        label: "Authorize Scavenge",
        description:
          "Authorize assets to secure proprietary materials. High risk of structural collapse.",
        reward: { scrap: 50 },
        risk: { chance: 0.2, damage: 0.2 },
      },
      {
        label: "Decline Engagement",
        description: "Projected salvage value does not justify asset risk.",
      },
    ],
  },
  {
    id: "distress_signal",
    title: "UNSCHEDULED ASSET RECOVERY: Beacon Detected",
    text: "A corporate distress beacon is broadcasting from local debris. An escape pod is localized. Probability of viable biological personnel: 64%.",
    choices: [
      {
        label: "Initiate Retrieval",
        description: "Deploy retrieval team to recover viable personnel for roster re-assignment.",
        reward: { recruit: true },
        risk: { chance: 0.3, ambush: true },
      },
      {
        label: "Ignore Beacon",
        description: "Unscheduled stops adversely affect quarterly efficiency ratings.",
      },
    ],
  },
  {
    id: "black_market",
    title: "UNAUTHORIZED DATA EXCHANGE",
    text: "A non-corporate information broker has established a secure link. Valuable operational intel is available for a standard credit surcharge.",
    choices: [
      {
        label: "Authorize Purchase",
        description: "Deduct operational credits to procure high-value sector intel.",
        cost: { scrap: 50 },
        reward: { intel: 10 },
      },
      {
        label: "Terminate Link",
        description: "Resource conservation protocol is currently active.",
      },
    ],
  },
];
