import { ScreenId } from "@src/renderer/ScreenManager";

export const VALID_TRANSITIONS: Record<ScreenId, ScreenId[]> = {
  "main-menu": ["campaign", "mission-setup", "statistics"],
  campaign: ["main-menu", "barracks", "equipment", "mission", "mission-setup", "campaign-summary"],
  "mission-setup": ["main-menu", "equipment", "mission"],
  equipment: ["campaign", "mission-setup", "mission"],
  barracks: ["campaign"],
  mission: ["main-menu", "campaign", "debrief", "campaign-summary"],
  debrief: ["main-menu", "campaign", "campaign-summary"],
  "campaign-summary": ["main-menu"],
  statistics: ["main-menu"],
};
