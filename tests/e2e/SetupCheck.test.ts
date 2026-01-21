import { describe, it, expect } from "vitest";
import { E2E_URL } from "./config";

describe("E2E Setup Verification", () => {
  it("should have the dev server running", async () => {
    const response = await fetch(E2E_URL);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("<title>Voidlock</title>");
  });
});
