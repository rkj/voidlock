
import { describe, it, expect, vi } from "vitest";
import { TutorialManager } from "../src/renderer/controllers/TutorialManager";
import { setLocale, t } from "../src/renderer/i18n";
import { I18nKeys } from "../src/renderer/i18n/keys";

// Mocking dependencies
const mockGameClient = {
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
};
const mockCampaignManager = {
  getState: vi.fn().mockReturnValue({ history: [] }),
};
const mockMenuController = {
  menuState: "ACTION_SELECT",
  pendingAction: null,
};
const mockOnMessage = vi.fn();
const mockRenderer = {
  getPixelCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  cellSize: 20,
};

describe("TutorialManager Locale Hot-swap Repro", () => {
  it("should reflect locale changes in tutorial directives", () => {
    // 1. Set locale to English
    setLocale("en-standard");
    const manager = new TutorialManager({
      gameClient: mockGameClient as any,
      campaignManager: mockCampaignManager as any,
      menuController: mockMenuController as any,
      onMessage: mockOnMessage,
      getRenderer: () => mockRenderer as any,
    });

    // 2. Check initial English directive
    // We need to access private prologueSteps for testing purposes, or use a public method that exposes it.
    // getCurrentStepId returns the ID, but not the text.
    // Let's use a trick to access private property or just check what's rendered if we had a DOM.
    // In this case, I'll use (manager as any).prologueSteps
    const steps = (manager as any).prologueSteps;
    const initialDirective = steps[0].directive;
    const expectedEn = t(I18nKeys.tutorial.prologue.step_observe_directive);
    expect(initialDirective).toBe(expectedEn);

    // 3. Change locale to Polish
    setLocale("pl");
    const expectedPl = t(I18nKeys.tutorial.prologue.step_observe_directive);
    
    // 4. Check if the directive in the existing manager instance has changed
    const currentDirective = (manager as any).prologueSteps[0].directive;
    
    console.log("Initial (EN):", initialDirective);
    console.log("Current after switch to PL:", currentDirective);
    console.log("Expected PL:", expectedPl);

    // This is expected to FAIL before the fix
    expect(currentDirective).toBe(expectedPl);
  });
});
