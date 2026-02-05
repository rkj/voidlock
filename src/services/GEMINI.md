# src/services

This directory contains external service integrations.

## Files

- `firebase.ts`: Initializes the Firebase app, Firestore database, and Authentication. It uses environment variables for configuration and enables IndexedDB persistence for offline support.
- `CloudSyncService.ts`: Provides methods for saving, loading, and listing campaigns in Firebase Firestore. Handles anonymous authentication and integrates with Zod schemas for data validation.

## Environment Variables

The following variables must be defined in the environment (e.g., via `.env` file):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
