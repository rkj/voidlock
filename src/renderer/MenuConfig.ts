import { CommandType, EngagementPolicy } from "../shared/types";

export type MenuState =
  | "ACTION_SELECT"
  | "TARGET_SELECT"
  | "UNIT_SELECT"
  | "MODE_SELECT"
  | "ITEM_SELECT";

export interface MenuOptionDefinition {
  key: number;
  label: string;
  type: "ACTION" | "TRANSITION" | "MODE" | "BACK" | "SPECIAL" | "ITEM";
  commandType?: CommandType;
  nextState?: MenuState;
  modeValue?: EngagementPolicy;
  specialId?: string; // For "ALL_UNITS" etc.
  itemId?: string; // For ITEM_SELECT
}

export interface MenuStateDefinition {
  title: string;
  options: MenuOptionDefinition[];
  dynamic?: boolean; // If true, options are generated at runtime (e.g. Target Select)
}

export const MENU_CONFIG: Record<MenuState, MenuStateDefinition> = {
  ACTION_SELECT: {
    title: "ACTIONS",
    options: [
      {
        key: 1,
        label: "MOVE",
        type: "ACTION",
        commandType: CommandType.MOVE_TO,
        nextState: "TARGET_SELECT",
      },
      {
        key: 2,
        label: "STOP",
        type: "ACTION",
        commandType: CommandType.STOP,
        nextState: "UNIT_SELECT",
      },
      {
        key: 3,
        label: "ENGAGEMENT",
        type: "ACTION",
        commandType: CommandType.SET_ENGAGEMENT,
        nextState: "MODE_SELECT",
      },
      {
        key: 4,
        label: "USE ITEM",
        type: "ACTION",
        commandType: CommandType.USE_ITEM,
        nextState: "ITEM_SELECT",
      },
      {
        key: 5,
        label: "COLLECT",
        type: "ACTION",
        commandType: CommandType.MOVE_TO,
        nextState: "TARGET_SELECT",
      }, // Collect is Move To Item
      {
        key: 6,
        label: "EXTRACT",
        type: "ACTION",
        commandType: CommandType.MOVE_TO,
        nextState: "UNIT_SELECT",
      }, // Special handling in controller for target
      {
        key: 7,
        label: "RESUME AI",
        type: "ACTION",
        commandType: CommandType.RESUME_AI,
        nextState: "UNIT_SELECT",
      },
    ],
  },
  MODE_SELECT: {
    title: "SELECT MODE",
    options: [
      {
        key: 1,
        label: "ENGAGE (Stop and Shoot)",
        type: "MODE",
        modeValue: "ENGAGE",
        nextState: "UNIT_SELECT",
      },
      {
        key: 2,
        label: "IGNORE (Run)",
        type: "MODE",
        modeValue: "IGNORE",
        nextState: "UNIT_SELECT",
      },
      { key: 0, label: "BACK", type: "BACK" },
    ],
  },
  ITEM_SELECT: {
    title: "SELECT ITEM",
    options: [{ key: 0, label: "BACK", type: "BACK" }],
    dynamic: true,
  },
  TARGET_SELECT: {
    title: "SELECT TARGET",
    options: [{ key: 0, label: "BACK", type: "BACK" }],
    dynamic: true, // Controller populates POIs
  },
  UNIT_SELECT: {
    title: "SELECT UNIT(S)",
    options: [{ key: 0, label: "BACK", type: "BACK" }],
    dynamic: true, // Controller populates Units
  },
};
