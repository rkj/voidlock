import { CommandType, EngagementPolicy } from "../shared/types";

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
    title: "ACTIONS",
    options: [
      {
        key: 1,
        label: "ORDERS",
        type: "TRANSITION",
        nextState: "ORDERS_SELECT",
      },
      {
        key: 2,
        label: "ENGAGEMENT",
        type: "ACTION",
        commandType: CommandType.SET_ENGAGEMENT,
        nextState: "MODE_SELECT",
      },
      {
        key: 3,
        label: "USE ITEM",
        type: "ACTION",
        commandType: CommandType.USE_ITEM,
        nextState: "ITEM_SELECT",
      },
    ],
  },
  ORDERS_SELECT: {
    title: "ORDERS",
    options: [
      {
        key: 1,
        label: "MOVE TO ROOM",
        type: "ACTION",
        commandType: CommandType.MOVE_TO,
        nextState: "TARGET_SELECT",
      },
      {
        key: 2,
        label: "OVERWATCH INTERSECTION",
        type: "ACTION",
        commandType: CommandType.OVERWATCH_POINT,
        nextState: "TARGET_SELECT",
      },
      {
        key: 3,
        label: "EXPLORE",
        type: "ACTION",
        commandType: CommandType.EXPLORE,
        nextState: "UNIT_SELECT",
      },
      {
        key: 4,
        label: "HOLD",
        type: "ACTION",
        commandType: CommandType.STOP,
        nextState: "UNIT_SELECT",
      },
      { key: 0, label: "BACK", type: "BACK" },
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
