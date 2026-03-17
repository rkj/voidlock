/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { TutorialManager } from "../../../src/renderer/controllers/TutorialManager";

describe("TutorialManager Mobile Detection", () => {
  it("should detect mobile via innerWidth", () => {
    // @ts-ignore
    const manager = new TutorialManager({}, {}, {}, () => {}, () => null, {});
    
    // Desktop size
    // @ts-ignore
    window.innerWidth = 1024;
    document.documentElement.classList.remove("mobile-touch");
    expect((manager as any).isMobile()).toBe(false);

    // Mobile size
    // @ts-ignore
    window.innerWidth = 500;
    expect((manager as any).isMobile()).toBe(true);
  });

  it("should detect mobile via mobile-touch class", () => {
    // @ts-ignore
    const manager = new TutorialManager({}, {}, {}, () => {}, () => null, {});
    
    // Large screen with touch
    // @ts-ignore
    window.innerWidth = 1024;
    document.documentElement.classList.add("mobile-touch");
    expect((manager as any).isMobile()).toBe(true);
  });
});
