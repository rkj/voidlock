import { ScreenId } from "@src/renderer/ScreenManager";

export const VALID_TRANSITIONS: Record<ScreenId, ScreenId[]> = {
  "main-menu": ["campaign", "mission-setup", "statistics", "mission"],
  campaign: [
    "main-menu",
    "barracks",
    "equipment",
    "mission",
    "mission-setup",
    "campaign-summary",
    "statistics",
  ],
  "mission-setup": [
    "main-menu",
    "equipment",
    "mission",
    "campaign",
    "barracks",
    "statistics",
  ],
  equipment: [
    "campaign",
    "mission-setup",
    "mission",
    "main-menu",
    "barracks",
    "statistics",
  ],
  barracks: ["campaign", "main-menu", "statistics"],
  mission: ["main-menu", "campaign", "debrief", "campaign-summary"],
  debrief: ["main-menu", "campaign", "campaign-summary"],
  "campaign-summary": ["main-menu"],
  statistics: ["main-menu", "campaign", "barracks"],
};
