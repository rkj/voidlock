import { ConfigManager } from "../ConfigManager";
import { I18nKey, I18nKeys } from "./keys";
import { enCorporate } from "./locales/en-corporate";
import { enStandard } from "./locales/en-standard";
import { pl } from "./locales/pl";

type LocaleData = Record<string, string>;

const locales: Record<string, LocaleData> = {
  "en-corporate": enCorporate,
  "en-standard": enStandard,
  "pl": pl,
};

let currentLocaleId = "en-corporate";
let currentLocaleData = locales[currentLocaleId];

/**
 * Translates a key to the current locale.
 */
export function t(key: I18nKey): string {
  return currentLocaleData[key] || key;
}

/**
 * Changes the current locale and updates the global configuration.
 */
export function setLocale(localeId: string): void {
  if (locales[localeId]) {
    currentLocaleId = localeId;
    currentLocaleData = locales[localeId];
    
    // Update global config
    const globalConfig = ConfigManager.loadGlobal();
    globalConfig.locale = localeId;
    ConfigManager.saveGlobal(globalConfig);
  }
}

/**
 * Applies the current locale to static elements in the DOM.
 * Targeted at src/index.html elements.
 */
export function applyLocale(): void {
  const elements = [
    { selector: ".menu-subtitle", key: I18nKeys.menu.subtitle },
    { id: "btn-menu-campaign", key: I18nKeys.menu.campaign },
    { id: "btn-menu-custom", key: I18nKeys.menu.custom },
    { id: "btn-menu-engineering", key: I18nKeys.menu.engineering },
    { id: "btn-menu-statistics", key: I18nKeys.menu.statistics },
    { id: "btn-menu-settings", key: I18nKeys.menu.settings },
    { selector: ".menu-import-label", key: I18nKeys.menu.import },
    { id: "mission-setup-title", key: I18nKeys.mission.setup.title },
    { selector: 'label[for="mission-type"]', key: I18nKeys.mission.type.label },
  ];

  elements.forEach(({ id, selector, key }) => {
    const el = id ? document.getElementById(id) : document.querySelector(selector!);
    if (el) {
      el.textContent = t(key);
    }
  });

  // Update mission type options
  const missionTypeSelect = document.getElementById(
    "mission-type",
  ) as HTMLSelectElement;
  if (missionTypeSelect) {
    const options = missionTypeSelect.options;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      switch (opt.value) {
        case "Default":
          opt.textContent = t(I18nKeys.mission.type.default);
          break;
        case "RecoverIntel":
          opt.textContent = t(I18nKeys.mission.type.recover_intel);
          break;
        case "ExtractArtifacts":
          opt.textContent = t(I18nKeys.mission.type.extract_artifacts);
          break;
        case "DestroyHive":
          opt.textContent = t(I18nKeys.mission.type.destroy_hive);
          break;
        case "EscortVIP":
          opt.textContent = t(I18nKeys.mission.type.escort_vip);
          break;
      }
    }
  }
}

/**
 * Returns the current locale ID.
 */
export function getCurrentLocale(): string {
  return currentLocaleId;
}

/**
 * Returns a list of available locale IDs.
 */
export function getAvailableLocales(): string[] {
  return Object.keys(locales);
}

// Initialize from global config
const globalConfig = ConfigManager.loadGlobal();
if (locales[globalConfig.locale]) {
  currentLocaleId = globalConfig.locale;
  currentLocaleData = locales[currentLocaleId];
}
