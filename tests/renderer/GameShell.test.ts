/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GameShell } from "@src/renderer/GameShell";

describe("GameShell", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.innerHTML = `
      <div id="header-title"></div>
      <div id="header-controls"></div>
      <div id="main-content"></div>
      <div id="global-footer"></div>
    `;
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  it("should initialize successfully when all required elements are present", () => {
    expect(() => new GameShell()).not.toThrow();
  });

  it("should throw an error when a required element is missing", () => {
    document.getElementById("header-title")?.remove();
    expect(() => new GameShell()).toThrow(
      "Required DOM element not found: #header-title",
    );
  });

  it("should correctly update title", () => {
    const shell = new GameShell();
    shell.updateConfig({ title: "Test Title" });
    expect(document.getElementById("header-title")?.textContent).toBe(
      "Test Title",
    );
  });

  it("should clear content", () => {
    const shell = new GameShell();
    const mainContent = document.getElementById("main-content")!;
    mainContent.innerHTML = "<span>Old Content</span>";
    shell.clearContent();
    expect(mainContent.innerHTML).toBe("");
  });

  it("should set content", () => {
    const shell = new GameShell();
    const newEl = document.createElement("div");
    newEl.id = "new-el";
    shell.setContent(newEl);
    expect(document.getElementById("new-el")).not.toBeNull();
    expect(document.getElementById("main-content")?.contains(newEl)).toBe(true);
  });
});
