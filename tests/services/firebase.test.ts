import { describe, it, expect, vi } from "vitest";

// Mock firebase to avoid actual initialization in tests
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  enableIndexedDbPersistence: vi.fn(() => Promise.resolve()),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
}));

describe("Firebase Service", () => {
  it("should export db and auth", async () => {
    const { db, auth } = await import("@src/services/firebase");
    expect(db).toBeDefined();
    expect(auth).toBeDefined();
  });
});
