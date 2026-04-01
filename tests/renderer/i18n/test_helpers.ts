import { setLocale } from "@src/renderer/i18n";

/**
 * Sets the locale to en-standard for deterministic test output.
 * Should be called in beforeEach or beforeAll of tests that assert on UI strings.
 */
export function useStandardLocale() {
  setLocale("en-standard");
}
