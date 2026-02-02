import { expect, test } from "vitest";
import { Icons } from "@src/renderer/Icons";

test("Icons object contains all required icons", () => {
  expect(Icons.Speed).toBeDefined();
  expect(Icons.Accuracy).toBeDefined();
  expect(Icons.Damage).toBeDefined();
  expect(Icons.Rate).toBeDefined();
  expect(Icons.Range).toBeDefined();
  expect(Icons.LootStar).toBeDefined();
  expect(Icons.ObjectiveDisk).toBeDefined();
});

test("Icons are valid URLs", () => {
  const svgKeys = [
    "Speed",
    "Accuracy",
    "Damage",
    "Rate",
    "Range",
    "LootStar",
  ] as const;
  svgKeys.forEach((key) => {
    expect(Icons[key]).toMatch(/assets\/icons\/.*\.svg$/);
  });

  expect(Icons.ObjectiveDisk).toMatch(/assets\/.*\.webp$/);
});
