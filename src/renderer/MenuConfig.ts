import { CommandType, EngagementPolicy } from "@src/shared/types";

export type MenuState =
  | "ACTION_SELECT"
  | "ORDERS_SELECT"
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
    title: "Actions",
    options: [
      {
        key: 1,
        label: "Orders",
        type: "TRANSITION",
        nextState: "ORDERS_SELECT",
      },
      {
        key: 2,
        label: "Engagement",
        type: "ACTION",
        commandType: CommandType.SET_ENGAGEMENT,
        nextState: "MODE_SELECT",
      },
      {
        key: 3,
        label: "Use Item",
        type: "ACTION",
        commandType: CommandType.USE_ITEM,
        nextState: "ITEM_SELECT",
      },
      {
        key: 4,
        label: "Pickup",
        type: "ACTION",
        commandType: CommandType.PICKUP,
        nextState: "TARGET_SELECT",
      },
      {
        key: 5,
        label: "Extract",
        type: "ACTION",
        commandType: CommandType.EXTRACT,
        nextState: "UNIT_SELECT",
      },
    ],
  },
  ORDERS_SELECT: {
    title: "Orders",
    options: [
      {
        key: 1,
        label: "Move to Room",
        type: "ACTION",
        commandType: CommandType.MOVE_TO,
        nextState: "TARGET_SELECT",
      },
      {
        key: 2,
        label: "Overwatch Intersection",
        type: "ACTION",
        commandType: CommandType.OVERWATCH_POINT,
        nextState: "TARGET_SELECT",
      },
      {
        key: 3,
        label: "Explore",
        type: "ACTION",
        commandType: CommandType.EXPLORE,
        nextState: "UNIT_SELECT",
      },
      {
        key: 4,
        label: "Escort",
        type: "ACTION",
        commandType: CommandType.ESCORT_UNIT,
        nextState: "TARGET_SELECT",
      },
      {
        key: 5,
        label: "Hold",
        type: "ACTION",
        commandType: CommandType.STOP,
        nextState: "UNIT_SELECT",
      },
      { key: 0, label: "Back", type: "BACK" },
    ],
  },
  MODE_SELECT: {
    title: "Select Mode",
    options: [
      {
        key: 1,
        label: "Engage (Stop and Shoot)",
        type: "MODE",
        modeValue: "ENGAGE",
        nextState: "UNIT_SELECT",
      },
      {
        key: 2,
        label: "Ignore (Run)",
        type: "MODE",
        modeValue: "IGNORE",
        nextState: "UNIT_SELECT",
      },
      { key: 0, label: "Back", type: "BACK" },
    ],
  },
  ITEM_SELECT: {
    title: "Select Item",
    options: [{ key: 0, label: "Back", type: "BACK" }],
    dynamic: true,
  },
  TARGET_SELECT: {
    title: "Select Target",
    options: [{ key: 0, label: "Back", type: "BACK" }],
    dynamic: true, // Controller populates POIs
  },
  UNIT_SELECT: {
    title: "Select Unit(s)",
    options: [{ key: 0, label: "Back", type: "BACK" }],
    dynamic: true, // Controller populates Units
  },
};
