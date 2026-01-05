import { ScreenId } from "./ScreenManager";

export const VALID_TRANSITIONS: Record<ScreenId, ScreenId[]> = {
  "main-menu": ["campaign", "mission-setup"],
  campaign: ["main-menu", "barracks", "equipment", "mission"],
  "mission-setup": ["main-menu", "equipment", "mission"],
  equipment: ["campaign", "mission-setup", "mission"],
  barracks: ["campaign"],
  mission: ["main-menu", "campaign", "debrief"],
  debrief: ["main-menu", "campaign"],
};
