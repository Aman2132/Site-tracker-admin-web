import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Same Firebase project as the mobile app (Auth + Firestore + Realtime
 * Database). Each NEXT_PUBLIC_ value is referenced literally so Next can
 * inline it into the browser bundle; put them in .env.local.
 */
export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

export const HAS_FIREBASE_CONFIG = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

interface Firebase {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  rtdb: Database;
}

let cached: Firebase | null = null;

/** Browser-only: call from effects and event handlers, never during render on the server. */
export function firebase(): Firebase {
  if (!cached) {
    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    cached = { app, auth: getAuth(app), db: getFirestore(app), rtdb: getDatabase(app) };
  }
  return cached;
}
