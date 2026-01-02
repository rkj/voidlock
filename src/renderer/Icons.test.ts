import { expect, test } from "vitest";
import { Icons } from "./Icons";

test("Icons object contains all required stat icons", () => {
  expect(Icons.Speed).toBeDefined();
  expect(Icons.Accuracy).toBeDefined();
  expect(Icons.Damage).toBeDefined();
  expect(Icons.Rate).toBeDefined();
  expect(Icons.Range).toBeDefined();
});

test("Icons are valid data URLs", () => {
  const iconKeys = ["Speed", "Accuracy", "Damage", "Rate", "Range"] as const;
  iconKeys.forEach((key) => {
    expect(Icons[key]).toMatch(/^data:image\/svg\+xml;base64,/);

    // Verify it's actually base64 and decodable
    const base64Part = Icons[key].split(",")[1];
    const decoded = atob(base64Part);
    expect(decoded).toContain("<svg");
    expect(decoded).toContain("</svg>");
  });
});
