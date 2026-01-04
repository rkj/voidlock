import { expect, test } from "vitest";
import { Icons } from "@src/renderer/Icons";

test("Icons object contains all required stat icons", () => {
  expect(Icons.Speed).toBeDefined();
  expect(Icons.Accuracy).toBeDefined();
  expect(Icons.Damage).toBeDefined();
  expect(Icons.Rate).toBeDefined();
  expect(Icons.Range).toBeDefined();
});

  test("Icons are valid URLs", () => {
    const iconKeys = ["Speed", "Accuracy", "Damage", "Rate", "Range"] as const;
    iconKeys.forEach((key) => {
      expect(Icons[key]).toMatch(/^\/assets\/icons\/.*\.svg$/);
    });
  });

