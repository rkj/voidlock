/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { t, setLocale, getCurrentLocale, getAvailableLocales, applyLocale } from "@src/renderer/i18n/index";
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
    expect(t("non.existent.key" as any)).toBe("non.existent.key");
  });

  it("should allow changing the locale", () => {
    setLocale("en-corporate");
    expect(getCurrentLocale()).toBe("en-corporate");
    
    // Test with pl
    setLocale("pl");
    expect(getCurrentLocale()).toBe("pl");
    expect(t(I18nKeys.menu.campaign)).toBe("Kampania");

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

  it("should apply the locale to DOM elements with data-i18n", () => {
    document.body.innerHTML = `
      <div data-i18n="menu.subtitle">Old Subtitle</div>
      <button data-i18n="menu.campaign">Old Button</button>
    `;

    setLocale("en-corporate");
    applyLocale();
    expect(document.querySelector("[data-i18n='menu.subtitle']")?.textContent).toBe("Terminal Assets");
    expect(document.querySelector("[data-i18n='menu.campaign']")?.textContent).toBe("Active Contracts");

    setLocale("pl");
    applyLocale();
    expect(document.querySelector("[data-i18n='menu.subtitle']")?.textContent).toBe("Taktyczna Walka Drużynowa");
    expect(document.querySelector("[data-i18n='menu.campaign']")?.textContent).toBe("Kampania");
  });

  it("should apply the locale to DOM elements (legacy compatibility)", () => {
    document.body.innerHTML = `
      <button id="btn-menu-campaign" data-i18n="menu.campaign">Old Text</button>
      <div class="menu-subtitle" data-i18n="menu.subtitle">Old Subtitle</div>
      <select id="mission-type">
        <option value="Default">Old Default</option>
      </select>
    `;

    setLocale("en-corporate");
    applyLocale();
    expect(document.getElementById("btn-menu-campaign")?.textContent).toBe("Active Contracts");
    expect(document.querySelector(".menu-subtitle")?.textContent).toBe("Terminal Assets");
    
    // Test select options manual update (fallback logic)
    expect(document.querySelector("#mission-type option[value='Default']")?.textContent).toBe("Standard Protocol");

    setLocale("pl");
    applyLocale();
    expect(document.getElementById("btn-menu-campaign")?.textContent).toBe("Kampania");
  });
});
