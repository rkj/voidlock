import { describe, it, expect } from "vitest";

describe("E2E Setup Verification", () => {
  it("should have the dev server running", async () => {
    const response = await fetch("http://localhost:5188");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("<title>Voidlock</title>");
  });
});
