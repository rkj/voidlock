import type { EngagementPolicy } from "@src/shared/types";
import { CommandType } from "@src/shared/types";
import { I18nKey, I18nKeys } from "./i18n/keys";

export type MenuState =
  | "ACTION_SELECT"
  | "ORDERS_SELECT"
  | "TARGET_SELECT"
  | "UNIT_SELECT"
  | "MODE_SELECT"
  | "ITEM_SELECT";

export interface MenuOptionDefinition {
  key: number;
  labelKey: I18nKey;
  type: "ACTION" | "TRANSITION" | "MODE" | "BACK" | "SPECIAL" | "ITEM";
  commandType?: CommandType;
  nextState?: MenuState;
  modeValue?: EngagementPolicy;
  specialId?: string; // For "ALL_UNITS" etc.
  itemId?: string; // For ITEM_SELECT
}

export interface MenuStateDefinition {
  titleKey: I18nKey;
  options: MenuOptionDefinition[];
  dynamic?: boolean; // If true, options are generated at runtime (e.g. Target Select)
}

export const MENU_CONFIG: Record<MenuState, MenuStateDefinition> = {
  ACTION_SELECT: {
    titleKey: I18nKeys.menu.actions_title,
    options: [
      {
        key: 1,
        labelKey: I18nKeys.menu.orders,
        type: "TRANSITION",
        nextState: "ORDERS_SELECT",
      },
      {
        key: 2,
        labelKey: I18nKeys.menu.engagement,
        type: "ACTION",
        commandType: CommandType.SET_ENGAGEMENT,
        nextState: "MODE_SELECT",
      },
      {
        key: 3,
        labelKey: I18nKeys.menu.use_item,
        type: "ACTION",
        commandType: CommandType.USE_ITEM,
        nextState: "ITEM_SELECT",
      },
      {
        key: 4,
        labelKey: I18nKeys.menu.pickup,
        type: "ACTION",
        commandType: CommandType.PICKUP,
        nextState: "TARGET_SELECT",
      },
      {
        key: 5,
        labelKey: I18nKeys.menu.extract,
        type: "ACTION",
        commandType: CommandType.EXTRACT,
        nextState: "UNIT_SELECT",
      },
    ],
  },
  ORDERS_SELECT: {
    titleKey: I18nKeys.menu.orders_title,
    options: [
      {
        key: 1,
        labelKey: I18nKeys.menu.move_to_room,
        type: "ACTION",
        commandType: CommandType.MOVE_TO,
        nextState: "TARGET_SELECT",
      },
      {
        key: 2,
        labelKey: I18nKeys.menu.overwatch_point,
        type: "ACTION",
        commandType: CommandType.OVERWATCH_POINT,
        nextState: "TARGET_SELECT",
      },
      {
        key: 3,
        labelKey: I18nKeys.menu.explore,
        type: "ACTION",
        commandType: CommandType.EXPLORE,
        nextState: "UNIT_SELECT",
      },
      {
        key: 4,
        labelKey: I18nKeys.menu.escort,
        type: "ACTION",
        commandType: CommandType.ESCORT_UNIT,
        nextState: "TARGET_SELECT",
      },
      {
        key: 5,
        labelKey: I18nKeys.menu.hold,
        type: "ACTION",
        commandType: CommandType.STOP,
        nextState: "UNIT_SELECT",
      },
      { key: 0, labelKey: I18nKeys.menu.back, type: "BACK" },
    ],
  },
  MODE_SELECT: {
    titleKey: I18nKeys.menu.mode_select_title,
    options: [
      {
        key: 1,
        labelKey: I18nKeys.menu.engage_mode,
        type: "MODE",
        modeValue: "ENGAGE",
        nextState: "UNIT_SELECT",
      },
      {
        key: 2,
        labelKey: I18nKeys.menu.ignore_mode,
        type: "MODE",
        modeValue: "IGNORE",
        nextState: "UNIT_SELECT",
      },
      { key: 0, labelKey: I18nKeys.menu.back, type: "BACK" },
    ],
  },
  ITEM_SELECT: {
    titleKey: I18nKeys.menu.item_select_title,
    options: [{ key: 0, labelKey: I18nKeys.menu.back, type: "BACK" }],
    dynamic: true,
  },
  TARGET_SELECT: {
    titleKey: I18nKeys.menu.target_select_title,
    options: [{ key: 0, labelKey: I18nKeys.menu.back, type: "BACK" }],
    dynamic: true, // Controller populates POIs
  },
  UNIT_SELECT: {
    titleKey: I18nKeys.menu.unit_select_title,
    options: [{ key: 0, labelKey: I18nKeys.menu.back, type: "BACK" }],
    dynamic: true, // Controller populates Units
  },
};
