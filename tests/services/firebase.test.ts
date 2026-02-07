import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  beforeEach(() => {
    vi.stubEnv("VITE_FIREBASE_API_KEY", "test-key");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project");
    vi.stubEnv("VITE_FIREBASE_APP_ID", "test-app");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should export db and auth", async () => {
    const { db, auth, isFirebaseConfigured } =
      await import("@src/services/firebase");
    expect(isFirebaseConfigured).toBe(true);
    expect(db).toBeDefined();
    expect(auth).toBeDefined();
  });
});
