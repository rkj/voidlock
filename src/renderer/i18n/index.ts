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
export function t(key: I18nKey, params?: Record<string, string | number>): string {
  let text = currentLocaleData[key] || key;
  if (params) {
    Object.keys(params).forEach((p) => {
      const val = params[p];
      text = text.replace(`{${p}}`, val !== undefined && val !== null ? String(val) : "");
    });
  }
  return text;
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
 * Scans for [data-i18n] attributes and updates textContent.
 */
export function applyLocale(): void {
  // 1. Standard text elements
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((el) => {
    const key = el.getAttribute("data-i18n") as I18nKey;
    if (key) {
      el.textContent = t(key);
    }
  });

  // 2. Select options often need special handling if they don't have data-i18n on the options themselves,
  // but we prefer putting data-i18n directly on the <option> elements in src/index.html.
  // The following manual update is kept for backward compatibility with existing JS-driven selects
  // until they are migrated to data-i18n.
  const missionTypeSelect = document.getElementById(
    "mission-type",
  ) as HTMLSelectElement;
  if (missionTypeSelect && !missionTypeSelect.querySelector("option[data-i18n]")) {
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
