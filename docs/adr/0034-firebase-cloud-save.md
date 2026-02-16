# ADR 0034: Firebase Cloud Save Integration

**Date:** 2026-02-04
**Status:** Proposed

## Context

Voidlock currently stores all campaign data in browser LocalStorage. This has limitations:

1. **Data Loss Risk**: Clearing browser data loses progress
1. **Single Device**: No way to continue campaign on different device
1. **No Backup**: No recovery if save becomes corrupted
1. **Limited Analytics**: No visibility into player progression for balance tuning

Players have requested cloud save functionality to protect their campaign progress.

### Requirements

| Requirement | Priority | Notes |
| ------------------------ | -------- | -------------------------------- |
| Save campaign to cloud | P0 | Core feature |
| Load campaign from cloud | P0 | Core feature |
| Work without account | P1 | Anonymous auth, low friction |
| Optional user accounts | P2 | For cross-device sync |
| Offline-first | P1 | Game must work without internet |
| Conflict resolution | P2 | Handle save conflicts gracefully |
| Minimal latency impact | P0 | No blocking on game start |

## Decision

We will integrate **Firebase** for cloud save functionality using a phased approach.

### Why Firebase

| Service | Setup Complexity | Free Tier | Offline Support | Auth Options |
| -------------- | ---------------- | --------- | --------------- | ----------------- |
| Firebase | Low | Generous | Excellent | Anonymous + OAuth |
| Supabase | Medium | Good | Limited | OAuth only |
| Custom Backend | High | N/A | Manual | Full control |
| PlayFab | Medium | Good | Limited | Gaming-focused |

Firebase selected because:

1. **Anonymous Auth**: Players can save without creating account
1. **Offline Persistence**: Built-in offline cache with sync
1. **Free Tier**: 1GB storage, 10GB/month transfer - sufficient for indie game
1. **Quick Setup**: Can be integrated in days, not weeks
1. **Firestore**: Document-based storage matches our campaign data structure

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │   GameApp   │───▶│ SaveManager │───▶│  LocalStorage   │  │
│  └─────────────┘    └──────┬──────┘    │  (Primary)      │  │
│                            │           └─────────────────┘  │
│                            │                                │
│                            ▼                                │
│                    ┌──────────────┐                         │
│                    │ CloudSync    │                         │
│                    │ Service      │                         │
│                    └──────┬───────┘                         │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Firebase   │
                    │  Firestore   │
                    └──────────────┘
```

### Data Model

```typescript
// Firestore document structure
// Collection: campaigns/{campaignId}

interface CloudCampaignDocument {
  // Metadata
  userId: string; // Firebase Auth UID (anonymous or signed in)
  campaignId: string; // Unique campaign identifier
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Versioning for conflict resolution
  version: number; // Incremented on each save
  clientVersion: string; // Game version that created save

  // Campaign data (validated with Zod schemas from ADR-0033)
  data: CampaignState;

  // Optional metadata for analytics
  stats?: {
    totalPlayTime: number;
    missionsCompleted: number;
    highestSector: number;
  };
}
```

### Implementation Plan

#### Phase 1: Foundation (Week 1)

**1.1 Firebase Setup**

```bash
npm install firebase
```

```typescript
// src/services/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Firebase offline persistence unavailable:", err);
});
```

**1.2 Cloud Sync Service**

```typescript
// src/services/CloudSyncService.ts
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import { CampaignStateSchema } from "@src/shared/schemas/campaign";

export class CloudSyncService {
  private userId: string | null = null;
  private syncEnabled: boolean = false;

  async initialize(): Promise<void> {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          this.userId = user.uid;
          this.syncEnabled = true;
        } else {
          // Auto sign-in anonymously
          const credential = await signInAnonymously(auth);
          this.userId = credential.user.uid;
          this.syncEnabled = true;
        }
        resolve();
      });
    });
  }

  async saveCampaign(campaignId: string, data: CampaignState): Promise<void> {
    if (!this.syncEnabled || !this.userId) return;

    const docRef = doc(db, "campaigns", `${this.userId}_${campaignId}`);

    await setDoc(
      docRef,
      {
        userId: this.userId,
        campaignId,
        updatedAt: serverTimestamp(),
        clientVersion: VERSION,
        data,
      },
      { merge: true },
    );
  }

  async loadCampaign(campaignId: string): Promise<CampaignState | null> {
    if (!this.syncEnabled || !this.userId) return null;

    const docRef = doc(db, "campaigns", `${this.userId}_${campaignId}`);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) return null;

    const doc = snapshot.data();
    const result = CampaignStateSchema.safeParse(doc.data);

    if (!result.success) {
      console.error("Invalid cloud save data:", result.error);
      return null;
    }

    return result.data;
  }

  async listCampaigns(): Promise<CampaignSummary[]> {
    // Query user's campaigns for campaign selection screen
  }
}
```

#### Phase 2: Integration (Week 2)

**2.1 SaveManager Wrapper**

```typescript
// src/services/SaveManager.ts
export class SaveManager {
  private localStorage: StorageProvider;
  private cloudSync: CloudSyncService;
  private syncInProgress: boolean = false;

  constructor() {
    this.localStorage = new LocalStorageProvider();
    this.cloudSync = new CloudSyncService();
  }

  async save(campaignId: string, data: CampaignState): Promise<void> {
    // Always save locally first (fast, reliable)
    this.localStorage.save(`campaign_${campaignId}`, data);

    // Async cloud sync (non-blocking)
    if (!this.syncInProgress) {
      this.syncInProgress = true;
      this.cloudSync
        .saveCampaign(campaignId, data)
        .catch((err) => console.warn("Cloud sync failed:", err))
        .finally(() => (this.syncInProgress = false));
    }
  }

  async load(campaignId: string): Promise<CampaignState | null> {
    // Try local first (fast)
    const local = this.localStorage.load(`campaign_${campaignId}`);

    // Check cloud for newer version (async)
    const cloud = await this.cloudSync.loadCampaign(campaignId);

    if (!local && !cloud) return null;
    if (!cloud) return local;
    if (!local) return cloud;

    // Conflict resolution: use newer version
    return this.resolveConflict(local, cloud);
  }

  private resolveConflict(
    local: CampaignState,
    cloud: CampaignState,
  ): CampaignState {
    // Simple strategy: higher version wins
    // Could be enhanced with merge logic for specific fields
    return (cloud.version || 0) > (local.version || 0) ? cloud : local;
  }
}
```

**2.2 UI Integration**

```typescript
// Add to CampaignScreen
private renderCloudStatus(): HTMLElement {
  const status = document.createElement('div');
  status.className = 'cloud-status';

  if (this.cloudSync.isSynced()) {
    status.innerHTML = '☁️ Saved to cloud';
  } else if (this.cloudSync.isSyncing()) {
    status.innerHTML = '⏳ Syncing...';
  } else {
    status.innerHTML = '💾 Local only';
  }

  return status;
}
```

#### Phase 3: Enhanced Features (Week 3+)

**3.1 Optional User Accounts**

- Add "Sign In" button to settings
- Support Google/GitHub OAuth
- Link anonymous saves to account

**3.2 Campaign Sharing (Future)**

- Generate shareable campaign codes
- Import friend's campaign start

**3.3 Analytics Integration**

- Track mission completion rates
- Balance data collection (opt-in)

### Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /campaigns/{campaignDoc} {
      // Users can only read/write their own campaigns
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;

      // Allow create if userId matches auth
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

### Cost Estimation

Firebase Free Tier (Spark Plan):

- 1 GiB storage
- 10 GiB/month network
- 50K reads/day, 20K writes/day

Estimated usage for 1000 DAU:

- Campaign size: ~10KB
- Saves per session: ~10
- Daily writes: 10,000 (well under limit)
- Monthly storage: ~10MB (well under limit)

**Conclusion**: Free tier sufficient for initial launch and moderate growth.

## Consequences

### Positive

- **Data Safety**: Player progress backed up automatically
- **Cross-Device**: Continue campaign on any device
- **Low Friction**: Works without account creation
- **Offline-First**: Game works without internet
- **Analytics Ready**: Foundation for balance data collection

### Negative

- **Bundle Size**: +80KB for Firebase SDK
- **Privacy Considerations**: Need privacy policy update
- **Dependency**: Reliance on Google infrastructure
- **Complexity**: Additional failure modes to handle

### Neutral

- **Optional Feature**: Can be disabled entirely via config
- **Gradual Migration**: Existing LocalStorage saves continue working

## Alternatives Considered

1. **Supabase**: Good option but less mature offline support
1. **Custom Backend**: Too much effort for current team size
1. **PlayFab**: Gaming-focused but more complex setup
1. **No Cloud Save**: Rejected - player demand is clear

## Migration Path

1. **v0.124**: Add Firebase SDK, anonymous auth only
1. **v0.125**: Enable cloud sync (opt-in via settings)
1. **v0.126**: Add sync status UI indicators
1. **v0.127+**: Optional user accounts, campaign sharing

## References

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Offline Persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- Related: ADR-0033 (Zod Validation) - validates cloud data
- Related: ADR-0029 (Frontend Framework) - no framework needed for this integration
