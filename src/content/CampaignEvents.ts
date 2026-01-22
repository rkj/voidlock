import { CampaignEventDefinition } from "../shared/campaign_types";

export const CampaignEvents: CampaignEventDefinition[] = [
  {
    id: "derelict_ship",
    title: "Derelict Ship",
    text: "You encounter a drifting derelict ship. Sensors detect faint energy signatures in the cargo hold, but the structural integrity is failing.",
    choices: [
      {
        label: "Search for Supplies",
        description:
          "Attempt to scavenge what remains before the ship breaks apart.",
        reward: { scrap: 50 },
        risk: { chance: 0.2, damage: 0.2 },
      },
      {
        label: "Leave",
        description: "It's too dangerous. Better to move on.",
      },
    ],
  },
  {
    id: "distress_signal",
    title: "Distress Signal",
    text: "An automated distress signal is beaming from a nearby asteroid belt. A small escape pod is trapped in the debris.",
    choices: [
      {
        label: "Attempt Rescue",
        description: "Send a team to recover the pod and its occupant.",
        reward: { recruit: true },
        risk: { chance: 0.3, ambush: true },
      },
      {
        label: "Ignore Signal",
        description: "We don't have time for side missions.",
      },
    ],
  },
  {
    id: "black_market",
    title: "Black Market",
    text: "A shadowed station orbits a rogue moon. A local broker offers valuable intel for a price.",
    choices: [
      {
        label: "Buy Intel",
        description: "Spend scrap to gain information about the sector.",
        cost: { scrap: 50 },
        reward: { intel: 10 },
      },
      {
        label: "Leave",
        description: "We can't afford to waste resources.",
      },
    ],
  },
];
