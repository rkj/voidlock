// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";

describe("StatDisplay", () => {
  it("should render correctly with default options", () => {
    const html = StatDisplay.render("icon.png", 10, "Strength");
    expect(html).toContain('title="Strength"');
    expect(html).toContain('src="icon.png"');
    expect(html).toContain(">10</span>");
    expect(html).toContain("display:inline-flex");
  });

  it("should apply custom options", () => {
    const html = StatDisplay.render("icon.png", "50%", "Accuracy", {
      fontSize: "10px",
      iconSize: "16px",
      color: "blue",
      gap: "5px",
    });
    expect(html).toContain("font-size:10px");
    expect(html).toContain("width:16px");
    expect(html).toContain("height:16px");
    expect(html).toContain('style="color:blue"');
    expect(html).toContain("gap:5px");
  });

  it("should update existing element value", () => {
    const container = document.createElement("div");
    container.innerHTML = StatDisplay.render("icon.png", 10, "Strength");
    const el = container.firstChild as HTMLElement;

    StatDisplay.update(el, 20);
    const valSpan = el.querySelector(".stat-value");
    expect(valSpan?.textContent).toBe("20");
  });
});
