import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudSyncService } from "@src/services/CloudSyncService";
import { CampaignState } from "@src/shared/campaign_types";
import { MapGeneratorType } from "@src/shared/types/map";
import pkg from "../../package.json";

// Mock firebase
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));

const mockDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockServerTimestamp = vi.fn(() => "server-timestamp");

const { MockTimestamp } = vi.hoisted(() => {
  class InnerMockTimestamp {
    constructor(public ms: number) {}
    toMillis() { return this.ms; }
    static fromMillis(ms: number) { return new InnerMockTimestamp(ms); }
    static now() { return new InnerMockTimestamp(Date.now()); }
  }
  return { MockTimestamp: InnerMockTimestamp };
});

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  enableIndexedDbPersistence: vi.fn(() => Promise.resolve()),
  doc: (...args: any[]) => mockDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  serverTimestamp: () => mockServerTimestamp(),
  Timestamp: MockTimestamp
}));

const mockSignInAnonymously = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  signInAnonymously: (...args: any[]) => mockSignInAnonymously(...args),
  onAuthStateChanged: (auth: any, cb: any) => mockOnAuthStateChanged(auth, cb),
}));

// Mock the firebase service to return our mocked db/auth
vi.mock("@src/services/firebase", () => ({
  db: {},
  auth: {},
}));

describe("CloudSyncService", () => {
  let service: CloudSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CloudSyncService();
    mockDoc.mockReturnValue({ id: "mock-doc" });
  });

  it("should initialize with anonymous auth if not logged in", async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      // Simulate no user initially
      cb(null);
    });

    mockSignInAnonymously.mockResolvedValue({
      user: { uid: "test-uid" }
    });

    await service.initialize();

    expect(mockSignInAnonymously).toHaveBeenCalled();
    expect(service.getUserId()).toBe("test-uid");
    expect(service.isSyncEnabled()).toBe(true);
  });

  it("should initialize with existing user", async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "existing-uid" });
    });

    await service.initialize();

    expect(mockSignInAnonymously).not.toHaveBeenCalled();
    expect(service.getUserId()).toBe("existing-uid");
  });

  it("should save campaign", async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "test-uid" });
    });

    const mockCampaign: CampaignState = {
      version: "0.1.0",
      seed: 123,
      status: "Active",
      rules: {
        mode: "Preset",
        difficulty: "Standard",
        deathRule: "Clone",
        allowTacticalPause: true,
        mapGeneratorType: MapGeneratorType.DenseShip,
        difficultyScaling: 1,
        resourceScarcity: 1,
        startingScrap: 500,
        mapGrowthRate: 1,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        economyMode: "Open",
      },
      scrap: 100,
      intel: 50,
      currentSector: 1,
      currentNodeId: "node-1",
      nodes: [],
      roster: [],
      history: [],
      unlockedArchetypes: ["assault", "medic", "scout", "heavy"],
    };

    await service.saveCampaign("camp-1", mockCampaign);

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: "mock-doc" }),
      expect.objectContaining({
        userId: "test-uid",
        campaignId: "camp-1",
        clientVersion: pkg.version,
        data: mockCampaign,
        metadata: expect.objectContaining({
          sector: 1,
          difficulty: "Standard",
        })
      }),
      { merge: true }
    );
  });

  it("should load campaign", async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "test-uid" });
    });

    const mockCampaignData = {
      version: "0.1.0",
      seed: 123,
      status: "Active",
      rules: {
        mode: "Preset",
        difficulty: "Standard",
        deathRule: "Clone",
        allowTacticalPause: true,
        mapGeneratorType: MapGeneratorType.DenseShip,
        difficultyScaling: 1,
        resourceScarcity: 1,
        startingScrap: 500,
        mapGrowthRate: 1,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        economyMode: "Open",
      },
      scrap: 100,
      intel: 50,
      currentSector: 1,
      currentNodeId: "node-1",
      nodes: [],
      roster: [],
      history: [],
      unlockedArchetypes: ["assault", "medic", "scout", "heavy"],
    };

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ data: mockCampaignData })
    });

    const loaded = await service.loadCampaign("camp-1");

    expect(loaded).toEqual(mockCampaignData);
  });

  it("should list campaigns", async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "test-uid" });
    });

    const mockDocs = [
      {
        data: () => ({
          campaignId: "camp-1",
          updatedAt: new MockTimestamp(1000),
          metadata: { sector: 1, difficulty: "Standard", status: "Active", soldierCount: 4 }
        })
      },
      {
        data: () => ({
          campaignId: "camp-2",
          updatedAt: new MockTimestamp(2000),
          metadata: { sector: 2, difficulty: "Ironman", status: "Active", soldierCount: 3 }
        })
      }
    ];

    mockGetDocs.mockResolvedValue({
      forEach: (cb: any) => mockDocs.forEach(cb)
    });

    const list = await service.listCampaigns();

    expect(list).toHaveLength(2);
    expect(list[0].campaignId).toBe("camp-2"); // Sorted by updatedAt desc
    expect(list[1].campaignId).toBe("camp-1");
  });
});
