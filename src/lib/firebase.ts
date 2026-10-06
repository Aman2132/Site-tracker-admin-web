import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import {
  clearIndexedDbPersistence,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from "firebase/firestore";

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

/**
 * Firestore with a saved copy in the browser (IndexedDB). A reload then shows
 * the saved data at once and asks the server only for what changed since, which
 * is billed as a few reads instead of re-reading every document. The server
 * remembers a listener's position for about 30 minutes; after that a reload is
 * a full download again. Several tabs share one saved copy.
 */
function openFirestore(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    // Already initialised (a hot reload) — use that instance.
    return getFirestore(app);
  }
}

/** Browser-only: call from effects and event handlers, never during render on the server. */
export function firebase(): Firebase {
  if (!cached) {
    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    cached = { app, auth: getAuth(app), db: openFirestore(app), rtdb: getDatabase(app) };
  }
  return cached;
}

/**
 * Wipes the saved copy of Firestore data from this browser, so crew and
 * location data does not stay behind on a shared computer after sign-out. The
 * Firestore instance is shut down by this, so the page must be reloaded after.
 */
export async function clearSavedData(): Promise<void> {
  if (!cached) return;
  const { db } = cached;
  cached = null;
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (error) {
    // E.g. another tab still has it open; the data then stays until that tab closes.
    console.warn("[firebase] could not clear the saved data —", error);
  }
}
