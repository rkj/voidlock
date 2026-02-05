import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import { CampaignStateSchema } from "@src/shared/schemas/campaign";
import { CampaignState, CampaignSummary } from "@src/shared/campaign_types";
import pkg from "../../package.json";

/**
 * Service for syncing campaign data with Firebase Cloud Storage.
 */
export class CloudSyncService {
  private userId: string | null = null;
  private syncEnabled: boolean = false;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initializes the service, ensuring the user is authenticated (anonymously if needed).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          this.userId = user.uid;
          this.syncEnabled = true;
          this.initialized = true;
          resolve();
        } else {
          try {
            const credential = await signInAnonymously(auth);
            this.userId = credential.user.uid;
            this.syncEnabled = true;
            this.initialized = true;
            resolve();
          } catch (error) {
            console.error("Firebase anonymous sign-in failed:", error);
            this.syncEnabled = false;
            this.initialized = true;
            resolve();
          }
        }
      });
    });

    return this.initializationPromise;
  }

  /**
   * Saves a campaign to the cloud.
   */
  async saveCampaign(campaignId: string, data: CampaignState): Promise<void> {
    if (!this.syncEnabled || !this.userId) {
      await this.initialize();
      if (!this.syncEnabled || !this.userId) return;
    }

    const docId = `${this.userId}_${campaignId}`;
    const docRef = doc(db, "campaigns", docId);

    // Metadata helps with listing without downloading the full campaign state
    await setDoc(
      docRef,
      {
        userId: this.userId,
        campaignId,
        updatedAt: serverTimestamp(),
        clientVersion: pkg.version,
        data,
        metadata: {
          sector: data.currentSector,
          difficulty: data.rules.difficulty,
          status: data.status,
          soldierCount: data.roster.length,
        }
      },
      { merge: true }
    );
  }

  /**
   * Loads a campaign from the cloud.
   */
  async loadCampaign(campaignId: string): Promise<CampaignState | null> {
    if (!this.syncEnabled || !this.userId) {
      await this.initialize();
      if (!this.syncEnabled || !this.userId) return null;
    }

    const docId = `${this.userId}_${campaignId}`;
    const docRef = doc(db, "campaigns", docId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) return null;

    const docData = snapshot.data();
    
    // Validate with Zod schema from ADR-0033
    const result = CampaignStateSchema.safeParse(docData.data);

    if (!result.success) {
      console.error("Invalid cloud save data:", result.error);
      return null;
    }

    return result.data as CampaignState;
  }

  /**
   * Lists all campaigns for the current user.
   */
  async listCampaigns(): Promise<CampaignSummary[]> {
    if (!this.syncEnabled || !this.userId) {
      await this.initialize();
      if (!this.syncEnabled || !this.userId) return [];
    }

    const campaignsRef = collection(db, "campaigns");
    const q = query(campaignsRef, where("userId", "==", this.userId));
    const querySnapshot = await getDocs(q);

    const summaries: CampaignSummary[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : Date.now();
      
      summaries.push({
        campaignId: data.campaignId,
        updatedAt,
        sector: data.metadata?.sector ?? 1,
        difficulty: data.metadata?.difficulty ?? "Standard",
        status: data.metadata?.status ?? "Active",
        soldierCount: data.metadata?.soldierCount ?? 0,
      });
    });

    // Sort by most recently updated
    return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getUserId(): string | null {
    return this.userId;
  }

  isSyncEnabled(): boolean {
    return this.syncEnabled;
  }
}
