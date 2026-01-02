import { describe, it, expect } from "vitest";
import { StatDisplay } from "./StatDisplay";

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
      color: "#ff0",
      gap: "5px",
    });
    expect(html).toContain("font-size:10px");
    expect(html).toContain("width:16px");
    expect(html).toContain("height:16px");
    expect(html).toContain("color:#ff0");
    expect(html).toContain("gap:5px");
  });
});
