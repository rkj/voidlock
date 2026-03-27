import { ConfigManager } from "../ConfigManager";
import { I18nKey } from "./keys";
import { enCorporate } from "./locales/en-corporate";
import { enStandard } from "./locales/en-standard";

type LocaleData = Record<string, string>;

const locales: Record<string, LocaleData> = {
  "en-corporate": enCorporate,
  "en-standard": enStandard,
  "pl": enCorporate,          // Placeholder
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
