import { initializeApp, FirebaseApp } from "firebase/app";
import { Firestore, getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { Auth, getAuth } from "firebase/auth";
import { Logger } from "../shared/Logger";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is configured
export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Enable offline persistence
    if (typeof window !== "undefined" && db) {
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === "failed-precondition") {
          // Multiple tabs open, persistence can only be enabled in one tab at a time.
          Logger.warn("Firebase persistence failed: Multiple tabs open");
        } else if (err.code === "unimplemented") {
          // The current browser does not support all of the features required to enable persistence
          Logger.warn("Firebase persistence failed: Browser not supported");
        }
      });
    }
  } catch (error) {
    Logger.error("Firebase initialization failed:", error);
  }
}

export { db, auth };
