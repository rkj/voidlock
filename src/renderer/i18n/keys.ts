/**
 * Type-safe keys for the internationalization system.
 * Use dot-separated namespaces (e.g., 'menu.campaign').
 */
export const I18nKeys = {
  menu: {
    subtitle: "menu.subtitle",
    campaign: "menu.campaign",
    custom: "menu.custom",
    engineering: "menu.engineering",
    statistics: "menu.statistics",
    settings: "menu.settings",
    import: "menu.import",
  },
  mission: {
    setup: {
      title: "mission.setup.title",
    },
    type: {
      label: "mission.type.label",
      default: "mission.type.default",
      recover_intel: "mission.type.recover_intel",
      extract_artifacts: "mission.type.extract_artifacts",
      destroy_hive: "mission.type.destroy_hive",
      escort_vip: "mission.type.escort_vip",
    },
  },
  common: {
    back: "common.back",
    confirm: "common.confirm",
    cancel: "common.cancel",
    loading: "common.loading",
  },
} as const;

export type I18nKey = string;
