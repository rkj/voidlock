/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { t, setLocale, getCurrentLocale, getAvailableLocales } from "@src/renderer/i18n/index";
import { I18nKeys } from "@src/renderer/i18n/keys";

describe("i18n system", () => {
  beforeEach(() => {
    setLocale("en-corporate");
  });

  it("should return the correct translation for a given key", () => {
    expect(t(I18nKeys.menu.campaign)).toBe("Active Contracts");
    expect(t(I18nKeys.common.back)).toBe("Back");
  });

  it("should return the key itself if no translation is found", () => {
    expect(t("non.existent.key")).toBe("non.existent.key");
  });

  it("should allow changing the locale", () => {
    setLocale("en-corporate");
    expect(getCurrentLocale()).toBe("en-corporate");
    
    // Test with pl
    setLocale("pl");
    expect(getCurrentLocale()).toBe("pl");
    expect(t(I18nKeys.menu.campaign)).toBe("Aktywne Kontrakty");

    // Test with en-standard
    setLocale("en-standard");
    expect(getCurrentLocale()).toBe("en-standard");
    expect(t(I18nKeys.menu.campaign)).toBe("Campaign");
  });

  it("should return a list of available locales", () => {
    const available = getAvailableLocales();
    expect(available).toContain("en-corporate");
    expect(available).toContain("en-standard");
    expect(available).toContain("pl");
  });
});
